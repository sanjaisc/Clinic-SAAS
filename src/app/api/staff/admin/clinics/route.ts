import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STAFF_ROLE, CLINIC_STATUSES, type ClinicStatus } from "@/lib/enums";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { Prisma } from "@prisma/client";

// ─── GET /api/staff/admin/clinics?search=...&status=...&page=1&limit=20 ─────────
// List ALL clinics (all statuses) with search/filter by name, city, status.

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

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    // Build WHERE clause
    const where: Prisma.ClinicWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { city: { contains: search } },
      ];
    }
    if (status && CLINIC_STATUSES.includes(status as ClinicStatus)) {
      where.status = status as ClinicStatus;
    }

    // Today's date range for appointment count
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    // This week: Sunday through today
    const weekStart = startOfDay(subDays(now, now.getDay()));
    const weekEnd = endOfDay(now);

    const [clinics, total] = await Promise.all([
      db.clinic.findMany({
        where,
        select: {
          id: true,
          slug: true,
          name: true,
          city: true,
          state: true,
          zipCode: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              providers: true,
              appointments: {
                where: {
                  startTime: { gte: todayStart, lte: todayEnd },
                },
              },
            },
          },
          reviews: {
            select: { overallRating: true },
          },
        },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      db.clinic.count({ where }),
    ]);

    // Compute rating per clinic and this-week appointment count
    const clinicIds = clinics.map((c) => c.id);
    const weekCounts = await db.appointment.groupBy({
      by: ["clinicId"],
      where: {
        clinicId: { in: clinicIds },
        startTime: { gte: weekStart, lte: weekEnd },
      },
      _count: true,
    });
    const weekCountMap = new Map(weekCounts.map((w) => [w.clinicId, w._count]));

    const clinicData = clinics.map((c) => {
      const avgRating =
        c.reviews.length > 0
          ? Math.round(
              (c.reviews.reduce((sum, r) => sum + r.overallRating, 0) /
                c.reviews.length) *
                10
            ) / 10
          : 0;

      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        city: c.city,
        state: c.state,
        zipCode: c.zipCode,
        status: c.status,
        providerCount: c._count.providers,
        todayAppointments: c._count.appointments,
        appointmentsThisWeek: weekCountMap.get(c.id) ?? 0,
        avgRating,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({
      clinics: clinicData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[ADMIN_CLINICS_LIST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}