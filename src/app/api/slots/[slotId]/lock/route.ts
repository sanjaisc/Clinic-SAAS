import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SLOT_STATUS } from "@/lib/enums";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { cache, CacheKeys } from "@/lib/cache";
import { DEFAULT_LOCK_TTL_SECONDS } from "@/lib/constants";
import { Prisma } from "@prisma/client";

// =============================================================================
// Types
// =============================================================================

interface LockRequestBody {
  lockKey: string;
}

// =============================================================================
// POST — Acquire a two-phase booking lock on a slot
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slotId: string }> }
) {
  try {
    const { slotId } = await params;

    if (!slotId) {
      return NextResponse.json(
        { error: "Slot ID is required", code: "MISSING_SLOT_ID" },
        { status: 400 }
      );
    }

    // Parse request body
    let body: LockRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body", code: "INVALID_BODY" },
        { status: 400 }
      );
    }

    if (!body.lockKey || typeof body.lockKey !== "string") {
      return NextResponse.json(
        { error: "lockKey is required and must be a string", code: "MISSING_LOCK_KEY" },
        { status: 400 }
      );
    }

    // Fetch lock TTL from SystemConfig (with fallback)
    const config = await db.systemConfig.findUnique({ where: { id: "singleton" } });
    const lockTtlSeconds = config?.lockTtlSeconds ?? DEFAULT_LOCK_TTL_SECONDS;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + lockTtlSeconds * 1000);

    // ---- Atomic two-phase lock transaction ----
    try {
      const result = await db.$transaction(async (tx) => {
        // 1. Verify slot exists and is AVAILABLE
        const slot = await tx.slot.findUnique({
          where: { id: slotId },
        });

        if (!slot || slot.status !== SLOT_STATUS.AVAILABLE) {
          return null; // Signal: not available
        }

        // 2. Verify slot is in the future
        if (slot.startTime <= now) {
          return null; // Signal: past slot
        }

        // 3. Create SlotLock — the @@unique([slotId]) constraint is the
        //    race-condition catcher. If two requests hit this simultaneously,
        //    the second one will throw P2002.
        await tx.slotLock.create({
          data: {
            slotId,
            lockKey: body.lockKey,
            expiresAt,
          },
        });

        // 4. Update slot status to LOCKED
        await tx.slot.update({
          where: { id: slotId },
          data: { status: SLOT_STATUS.LOCKED },
        });

        return { expiresAt };
      });

      if (!result) {
        // Slot not found, not available, or in the past
        return NextResponse.json(
          { error: "This time slot is no longer available", code: "SLOT_UNAVAILABLE" },
          { status: 404 }
        );
      }

      // Invalidate slot caches
      cache.deleteByPrefix("slots:");

      // Audit log (fire-and-forget)
      createAuditLog({
        action: AUDIT_ACTIONS.SLOT_LOCK_ACQUIRED,
        targetType: "SLOT",
        targetId: slotId,
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
      });

      return NextResponse.json({
        success: true,
        lockExpiresAt: result.expiresAt.toISOString(),
      });
    } catch (txError) {
      // P2002 = unique constraint violation → another user locked this slot first
      if (
        txError instanceof Prisma.PrismaClientKnownRequestError &&
        txError.code === "P2002"
      ) {
        return NextResponse.json(
          {
            error:
              "This time slot was just booked by someone else. Please try another.",
            code: "SLOT_TAKEN",
          },
          { status: 409 }
        );
      }

      // Re-throw unexpected transaction errors
      throw txError;
    }
  } catch (error) {
    console.error("[SLOT_LOCK] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE — Release a lock (only the locker can release)
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slotId: string }> }
) {
  try {
    const { slotId } = await params;

    if (!slotId) {
      return NextResponse.json(
        { error: "Slot ID is required", code: "MISSING_SLOT_ID" },
        { status: 400 }
      );
    }

    // Read lockKey from query params or body
    // Prefer query param for DELETE (since DELETE with body is non-standard)
    const url = new URL(request.url);
    const lockKey = url.searchParams.get("lockKey");

    if (!lockKey) {
      return NextResponse.json(
        { error: "lockKey query parameter is required", code: "MISSING_LOCK_KEY" },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      // 1. Delete the SlotLock only if the lockKey matches (ownership check)
      const lock = await tx.slotLock.findUnique({
        where: { slotId },
      });

      if (!lock) {
        return "NOT_FOUND" as const;
      }

      if (lock.lockKey !== lockKey) {
        return "WRONG_KEY" as const;
      }

      // 2. Delete the lock
      await tx.slotLock.delete({
        where: { slotId },
      });

      // 3. Update slot status back to AVAILABLE
      await tx.slot.update({
        where: { id: slotId },
        data: { status: SLOT_STATUS.AVAILABLE },
      });

      return "RELEASED" as const;
    });

    if (result === "NOT_FOUND") {
      return NextResponse.json(
        { error: "No active lock found for this slot", code: "LOCK_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (result === "WRONG_KEY") {
      return NextResponse.json(
        { error: "You do not own this lock", code: "LOCK_MISMATCH" },
        { status: 403 }
      );
    }

    // result === "RELEASED"
    cache.deleteByPrefix("slots:");

    createAuditLog({
      action: AUDIT_ACTIONS.SLOT_LOCK_RELEASED,
      targetType: "SLOT",
      targetId: slotId,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SLOT_LOCK_RELEASE] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}