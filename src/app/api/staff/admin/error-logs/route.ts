import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STAFF_ROLE } from "@/lib/enums";
import { Prisma } from "@prisma/client";

const VALID_LEVELS = ["ERROR", "WARN", "INFO"];
const VALID_SOURCES = ["API", "AUTH", "CRON", "SLOT_GEN", "LOCK_SWEEP", "WAITLIST"];

// ─── GET /api/staff/admin/error-logs?level=...&source=...&resolved=...&page=1&limit=20 ─

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
    const level = searchParams.get("level");
    const source = searchParams.get("source");
    const resolved = searchParams.get("resolved"); // "true" | "false"
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.SystemErrorLogWhereInput = {};

    if (level && VALID_LEVELS.includes(level)) {
      where.level = level;
    }

    if (source && VALID_SOURCES.includes(source)) {
      where.source = source;
    }

    if (resolved === "true") {
      where.resolved = true;
    } else if (resolved === "false") {
      where.resolved = false;
    }

    const [logs, total] = await Promise.all([
      db.systemErrorLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          level: true,
          source: true,
          message: true,
          path: true,
          stack: true,
          resolved: true,
          resolvedBy: true,
          resolvedAt: true,
          createdAt: true,
        },
      }),
      db.systemErrorLog.count({ where }),
    ]);

    return NextResponse.json({
      data: logs.map((log) => ({
        ...log,
        createdAt: log.createdAt.toISOString(),
        resolvedAt: log.resolvedAt?.toISOString() ?? null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[ADMIN_ERROR_LOGS]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}