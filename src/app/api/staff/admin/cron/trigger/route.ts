// =============================================================================
// Trigger Cron Job — POST /api/staff/admin/cron/trigger
// =============================================================================
// Manually triggers a cron job: SLOT_GENERATION, LOCK_SWEEP, WAITLIST_PROCESSOR, CACHE_PURGE.
// Auth-gated: SYSTEM_MANAGER only.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cache } from "@/lib/cache";
import { STAFF_ROLE, SLOT_STATUS, WAITLIST_STATUS } from "@/lib/enums";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { SLOT_GENERATION_WINDOW_DAYS, DEFAULT_SLOT_DURATION_MINUTES } from "@/lib/constants";

const VALID_JOBS = ["SLOT_GENERATION", "LOCK_SWEEP", "WAITLIST_PROCESSOR", "CACHE_PURGE"] as const;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    if (user.role !== STAFF_ROLE.SYSTEM_MANAGER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { job } = body as { job: string };

    if (!job || !VALID_JOBS.includes(job as typeof VALID_JOBS[number])) {
      return NextResponse.json(
        { error: `Invalid job. Must be one of: ${VALID_JOBS.join(", ")}` },
        { status: 400 }
      );
    }

    switch (job) {
      case "SLOT_GENERATION":
        return runSlotGeneration(user.id);
      case "LOCK_SWEEP":
        return runLockSweep(user.id);
      case "WAITLIST_PROCESSOR":
        return runWaitlistProcessor(user.id);
      case "CACHE_PURGE":
        return runCachePurge(user.id);
      default:
        return NextResponse.json({ error: "Unknown job" }, { status: 400 });
    }
  } catch (error) {
    console.error("[CRON_TRIGGER]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Job: Slot Generation
// ---------------------------------------------------------------------------
async function runSlotGeneration(userId: string) {
  try {
    const templates = await db.slotTemplate.findMany({
      where: { isActive: true },
      include: { provider: { select: { id: true, clinicId: true } } },
    });

    if (templates.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active slot templates found. Nothing to generate.",
        result: { generated: 0, skipped: 0, total: 0 },
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + SLOT_GENERATION_WINDOW_DAYS);

    let generated = 0;
    let skipped = 0;

    for (const template of templates) {
      const clinicId = template.provider.clinicId;
      const providerId = template.providerId;

      const currentDay = new Date(today);
      while (currentDay <= endDate) {
        if (currentDay.getDay() === template.dayOfWeek) {
          const [startHour, startMin] = template.startTime.split(":").map(Number);
          const [endHour, endMin] = template.endTime.split(":").map(Number);

          let slotStartMinutes = startHour * 60 + startMin;
          const slotEndMinutes = endHour * 60 + endMin;

          while (slotStartMinutes + DEFAULT_SLOT_DURATION_MINUTES <= slotEndMinutes) {
            const slotEndMin = slotStartMinutes + DEFAULT_SLOT_DURATION_MINUTES;
            const slotStartHour = Math.floor(slotStartMinutes / 60);
            const slotStartMinuteRem = slotStartMinutes % 60;
            const slotEndHour = Math.floor(slotEndMin / 60);
            const slotEndMinuteRem = slotEndMin % 60;

            const slotStartTime = new Date(currentDay);
            slotStartTime.setHours(slotStartHour, slotStartMinuteRem, 0, 0);

            const slotEndTime = new Date(currentDay);
            slotEndTime.setHours(slotEndHour, slotEndMinuteRem, 0, 0);

            const existingSlot = await db.slot.findUnique({
              where: {
                providerId_startTime: { providerId, startTime: slotStartTime },
              },
            });

            if (existingSlot) {
              skipped++;
            } else {
              await db.slot.create({
                data: {
                  clinicId,
                  providerId,
                  startTime: slotStartTime,
                  endTime: slotEndTime,
                  modality: template.modality,
                  status: SLOT_STATUS.AVAILABLE,
                  templateId: template.id,
                },
              });
              generated++;
            }

            slotStartMinutes += DEFAULT_SLOT_DURATION_MINUTES;
          }
        }
        currentDay.setDate(currentDay.getDate() + 1);
      }
    }

    const total = generated + skipped;

    // Invalidate caches
    cache.deleteByPrefix("slots:");
    cache.deleteByPrefix("search:");

    await createAuditLog({
      userId,
      action: AUDIT_ACTIONS.SLOT_GENERATED,
      targetType: "SLOT",
    });

    return NextResponse.json({
      success: true,
      message: `Slot generation complete: ${generated} new, ${skipped} existing, ${total} total.`,
      result: { generated, skipped, total },
    });
  } catch (error) {
    console.error("[CRON:slot_gen]", error);
    return NextResponse.json({
      success: false,
      message: "Slot generation failed. Check server logs for details.",
      result: { error: String(error) },
    });
  }
}

// ---------------------------------------------------------------------------
// Job: Lock Sweep — delete expired SlotLocks
// ---------------------------------------------------------------------------
async function runLockSweep(userId: string) {
  try {
    const result = await db.slotLock.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    // Also reset locked slots back to available
    if (result.count > 0) {
      const now = new Date();
      const updatedSlots = await db.slot.updateMany({
        where: {
          status: SLOT_STATUS.LOCKED,
          slotLock: null, // no active lock remaining
        },
        data: { status: SLOT_STATUS.AVAILABLE },
      });

      cache.deleteByPrefix("slots:");

      return NextResponse.json({
        success: true,
        message: `Swept ${result.count} expired locks. Released ${updatedSlots.count} orphaned locked slots.`,
        result: { locksDeleted: result.count, slotsReleased: updatedSlots.count },
      });
    }

    return NextResponse.json({
      success: true,
      message: "No expired locks found. Database is clean.",
      result: { locksDeleted: 0, slotsReleased: 0 },
    });
  } catch (error) {
    console.error("[CRON:lock_sweep]", error);
    return NextResponse.json({
      success: false,
      message: "Lock sweep failed. Check server logs for details.",
      result: { error: String(error) },
    });
  }
}

// ---------------------------------------------------------------------------
// Job: Waitlist Processor — return count of active entries
// ---------------------------------------------------------------------------
async function runWaitlistProcessor(userId: string) {
  try {
    const activeCount = await db.waitlistEntry.count({
      where: { status: WAITLIST_STATUS.ACTIVE },
    });

    await createAuditLog({
      userId,
      action: AUDIT_ACTIONS.WAITLIST_PROCESSED,
      targetType: "WAITLIST",
    });

    return NextResponse.json({
      success: true,
      message: `Waitlist processor ran. Found ${activeCount} active waitlist entries. No automatic matching available in manual mode.`,
      result: { activeWaitlistEntries: activeCount },
    });
  } catch (error) {
    console.error("[CRON:waitlist]", error);
    return NextResponse.json({
      success: false,
      message: "Waitlist processor failed. Check server logs for details.",
      result: { error: String(error) },
    });
  }
}

// ---------------------------------------------------------------------------
// Job: Cache Purge — clear all in-memory cache
// ---------------------------------------------------------------------------
async function runCachePurge(userId: string) {
  try {
    const sizeBefore = cache.size;
    cache.clear();
    const sizeAfter = cache.size;

    return NextResponse.json({
      success: true,
      message: `Cache purged. ${sizeBefore} entries cleared. Cache is now empty (${sizeAfter} entries).`,
      result: { entriesCleared: sizeBefore },
    });
  } catch (error) {
    console.error("[CRON:cache_purge]", error);
    return NextResponse.json({
      success: false,
      message: "Cache purge failed. Check server logs for details.",
      result: { error: String(error) },
    });
  }
}