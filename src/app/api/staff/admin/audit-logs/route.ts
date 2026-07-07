import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STAFF_ROLE } from "@/lib/enums";
import { Prisma } from "@prisma/client";

// ─── GET /api/staff/admin/audit-logs?action=...&userId=...&targetType=...&from=...&to=...&page=1&limit=50 ─

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    if (user.role !== STAFF_ROLE.SYSTEM_MANAGER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const action = searchParams.get("action");
    const userId = searchParams.get("userId");
    const targetType = searchParams.get("targetType");
    const from = searchParams.get("from"); // ISO date string
    const to = searchParams.get("to"); // ISO date string
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    if (action) {
      where.action = action;
    }

    if (userId) {
      where.userId = userId;
    }

    if (targetType) {
      where.targetType = targetType;
    }

    if (from || to) {
      where.createdAt = {};
      if (from) {
        (where.createdAt as Prisma.DateTimeNullableFilter)["gte"] = new Date(from);
      }
      if (to) {
        (where.createdAt as Prisma.DateTimeNullableFilter)["lte"] = new Date(to);
      }
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              clinicId: true,
              clinic: { select: { name: true } },
            },
          },
        },
      }),
      db.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      data: logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        userName: log.user?.name ?? "System",
        userClinic: log.user?.clinic?.name ?? null,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        appointmentId: log.appointmentId,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[ADMIN_AUDIT_LOGS]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}