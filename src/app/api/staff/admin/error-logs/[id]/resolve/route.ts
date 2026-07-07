import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STAFF_ROLE } from "@/lib/enums";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";

type RouteParams = { params: Promise<{ id: string }> };

// ─── PATCH /api/staff/admin/error-logs/[id]/resolve ────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const log = await db.systemErrorLog.findUnique({
      where: { id },
      select: { id: true, resolved: true },
    });

    if (!log) {
      return NextResponse.json({ error: "Error log not found" }, { status: 404 });
    }

    if (log.resolved) {
      return NextResponse.json({ error: "Already resolved" }, { status: 400 });
    }

    await db.systemErrorLog.update({
      where: { id },
      data: {
        resolved: true,
        resolvedBy: user.id,
        resolvedAt: new Date(),
      },
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.ERROR_LOG_RESOLVED,
      targetType: "SYSTEM_ERROR_LOG",
      targetId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADMIN_ERROR_LOGS_RESOLVE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}