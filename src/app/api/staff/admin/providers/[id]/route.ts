import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  STAFF_ROLE,
  PROVIDER_STATUS,
  PROVIDER_STATUSES,
  isValidProviderStatus,
  isValidSlotModality,
  SLOT_MODALITIES,
} from "@/lib/enums";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { cache } from "@/lib/cache";
import { Prisma } from "@prisma/client";

// ─── PATCH /api/staff/admin/providers/[id] ──────────────────────────────────
// Emergency edit any provider field (B4). SYSTEM_MANAGER can edit any field.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    if (user.role !== STAFF_ROLE.SYSTEM_MANAGER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Verify provider exists
    const existing = await db.provider.findUnique({
      where: { id },
      select: { id: true, firstName: true, lastName: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const body = await request.json();

    // Build update payload
    const data: Prisma.ProviderUpdateInput = {};

    // String fields
    const stringFields = [
      "firstName", "lastName", "credentials", "bio", "photoUrl",
      "npiNumber", "videoVisitLink",
    ] as const;

    for (const field of stringFields) {
      if (field in body) {
        (data as Record<string, unknown>)[field] = body[field] === null ? null : String(body[field]);
      }
    }

    // Numeric fields
    if ("yearsExperience" in body) {
      data.yearsExperience = body.yearsExperience === null ? null : Math.max(0, Number(body.yearsExperience));
    }
    if ("rating" in body) {
      data.rating = Math.max(0, Math.min(5, Number(body.rating)));
    }
    if ("reviewCount" in body) {
      data.reviewCount = Math.max(0, Number(body.reviewCount));
    }

    // Slot duration — must be valid
    if ("slotDurationMinutes" in body) {
      const dur = Number(body.slotDurationMinutes);
      if (![15, 30, 45, 60].includes(dur)) {
        return NextResponse.json(
          { error: "Slot duration must be 15, 30, 45, or 60 minutes" },
          { status: 400 }
        );
      }
      data.slotDurationMinutes = dur;
    }

    // Status with validation
    if ("status" in body) {
      if (!isValidProviderStatus(body.status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${PROVIDER_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
      data.status = body.status;
    }

    // Check if there's anything to update
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await db.provider.update({
      where: { id },
      data,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        credentials: true,
        status: true,
        updatedAt: true,
      },
    });

    // Invalidate caches
    cache.deleteByPrefix("clinic:");
    cache.deleteByPrefix("search:");

    const auditAction =
      body.status === PROVIDER_STATUS.SUSPENDED
        ? AUDIT_ACTIONS.PROVIDER_SUSPENDED
        : AUDIT_ACTIONS.PROVIDER_UPDATED;

    await createAuditLog({
      userId: user.id,
      action: auditAction,
      targetType: "Provider",
      targetId: id,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ provider: updated });
  } catch (error) {
    console.error("[ADMIN_PROVIDER_EDIT_PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}