// =============================================================================
// Purge Resolved Error Logs — POST /api/staff/admin/data/purge-errors
// =============================================================================
// Deletes all resolved SystemErrorLog entries. Auth-gated: SYSTEM_MANAGER only.
// =============================================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STAFF_ROLE } from "@/lib/enums";
import { createAuditLog } from "@/lib/audit";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    if (user.role !== STAFF_ROLE.SYSTEM_MANAGER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await db.systemErrorLog.deleteMany({
      where: { resolved: true },
    });

    await createAuditLog({
      userId: user.id,
      action: "ERROR_LOGS_PURGED",
      targetType: "SYSTEM_ERROR_LOG",
    });

    return NextResponse.json({
      success: true,
      message: `Purged ${result.count} resolved error log entries.`,
      result: { deleted: result.count },
    });
  } catch (error) {
    console.error("[PURGE_ERRORS]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}