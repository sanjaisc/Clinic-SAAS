import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

// ─── GET /api/staff/audit-logs?clinicId=...&limit=5 ───

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    if (!user.clinicId) {
      return NextResponse.json({ error: "No clinic assigned" }, { status: 400 });
    }

    const { searchParams } = request.nextUrl;
    const requestClinicId = searchParams.get("clinicId");
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") || "5", 10)));

    // Ensure the requesting user can only see their own clinic's logs
    if (requestClinicId && requestClinicId !== user.clinicId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const logs = await db.auditLog.findMany({
      where: {
        user: {
          clinicId: user.clinicId,
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        userName: log.user?.name ?? "System",
        createdAt: log.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[STAFF_AUDIT_LOGS]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}