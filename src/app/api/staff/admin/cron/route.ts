// =============================================================================
// Cron Job Status — GET /api/staff/admin/cron
// =============================================================================
// Returns status of all cron jobs (mock/derived) plus real DB counts.
// Auth-gated: SYSTEM_MANAGER only.
// =============================================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STAFF_ROLE } from "@/lib/enums";
import { WAITLIST_STATUS, APPOINTMENT_STATUS } from "@/lib/enums";

type CronJobStatus = {
  name: string;
  key: string;
  status: string;
  lastRun: string | null;
  successRate: string | null;
  description: string;
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    if (user.role !== STAFF_ROLE.SYSTEM_MANAGER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Real DB counts in parallel
    const [expiredLocks, activeWaitlist, pendingAppointments] = await Promise.all([
      db.slotLock.count({
        where: { expiresAt: { lt: new Date() } },
      }),
      db.waitlistEntry.count({
        where: { status: WAITLIST_STATUS.ACTIVE },
      }),
      db.appointment.count({
        where: { status: APPOINTMENT_STATUS.BOOKED },
      }),
    ]);

    const jobs: CronJobStatus[] = [
      {
        name: "Slot Generation",
        key: "SLOT_GENERATION",
        status: "IDLE",
        lastRun: null,
        successRate: null,
        description: "Rolling 90-day window",
      },
      {
        name: "Lock Sweeper",
        key: "LOCK_SWEEP",
        status: "IDLE",
        lastRun: null,
        successRate: null,
        description: "TTL purging for expired locks",
      },
      {
        name: "Waitlist Processor",
        key: "WAITLIST_PROCESSOR",
        status: "IDLE",
        lastRun: null,
        successRate: null,
        description: "Async matching engine",
      },
      {
        name: "Cache Purge",
        key: "CACHE_PURGE",
        status: "N/A",
        lastRun: null,
        successRate: null,
        description: "Manual cache invalidation",
      },
    ];

    return NextResponse.json({
      jobs,
      counts: {
        expiredLocks,
        activeWaitlist,
        pendingAppointments,
      },
    });
  } catch (error) {
    console.error("[CRON_STATUS]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}