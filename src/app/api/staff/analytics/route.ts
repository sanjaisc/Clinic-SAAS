import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { ClinicBookSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cache } from "@/lib/cache";
import { subDays, format, startOfDay, endOfDay } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as ClinicBookSessionUser;
    const clinicId = user.clinicId;
    const role = user.role;

    if (!clinicId) {
      return NextResponse.json(
        { error: "No clinic associated with this account" },
        { status: 400 }
      );
    }

    // System managers can specify a different clinic
    const targetClinicId =
      role === "SYSTEM_MANAGER"
        ? (request.nextUrl.searchParams.get("clinicId") || clinicId)
        : clinicId;

    // Non-system managers can only see their own clinic
    if (role !== "SYSTEM_MANAGER" && targetClinicId !== clinicId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const period = request.nextUrl.searchParams.get("period") || "30d";
    const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
    const days = daysMap[period] ?? 30;
    const now = new Date();
    const periodStart = startOfDay(subDays(now, days - 1));
    const periodEnd = endOfDay(now);

    const cacheKey = `analytics:${targetClinicId}:${period}:${format(now, "yyyy-MM-dd")}`;

    const data = await cache.getOrSet(cacheKey, async () => {
      return buildAnalytics(targetClinicId, periodStart, periodEnd, days);
    }, 300);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[STAFF_ANALYTICS]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function buildAnalytics(
  clinicId: string,
  periodStart: Date,
  periodEnd: Date,
  days: number
) {
  // ---------------------------------------------------------------
  // 1. Daily appointment counts grouped by DATE(startTime) & status
  // ---------------------------------------------------------------
  const dailyRaw = await db.appointment.groupBy({
    by: ["startTime", "status"],
    where: {
      clinicId,
      startTime: { gte: periodStart, lte: periodEnd },
    },
    _count: { id: true },
  });

  // Build a map: dateStr -> status -> count
  const dailyMap = new Map<
    string,
    Record<string, number>
  >();

  for (const row of dailyRaw) {
    const dateStr = format(new Date(row.startTime), "yyyy-MM-dd");
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, {
        BOOKED: 0,
        CHECKED_IN: 0,
        COMPLETED: 0,
        CANCELLED: 0,
        NO_SHOW: 0,
      });
    }
    const entry = dailyMap.get(dateStr)!;
    entry[row.status] = (entry[row.status] || 0) + row._count.id;
  }

  // Fill in all days in the range
  const dailyTrends: {
    date: string;
    booked: number;
    checkedIn: number;
    completed: number;
    cancelled: number;
    noShow: number;
  }[] = [];

  for (let i = 0; i < days; i++) {
    const d = subDays(periodEnd, days - 1 - i);
    const dateStr = format(d, "yyyy-MM-dd");
    const counts = dailyMap.get(dateStr);
    dailyTrends.push({
      date: dateStr,
      booked: counts?.BOOKED ?? 0,
      checkedIn: counts?.CHECKED_IN ?? 0,
      completed: counts?.COMPLETED ?? 0,
      cancelled: counts?.CANCELLED ?? 0,
      noShow: counts?.NO_SHOW ?? 0,
    });
  }

  // ---------------------------------------------------------------
  // 2. Modality distribution
  // ---------------------------------------------------------------
  const modalityRaw = await db.appointment.groupBy({
    by: ["modality"],
    where: {
      clinicId,
      startTime: { gte: periodStart, lte: periodEnd },
    },
    _count: { id: true },
  });

  let inPerson = 0;
  let video = 0;
  for (const row of modalityRaw) {
    if (row.modality === "IN_PERSON") inPerson = row._count.id;
    else if (row.modality === "VIDEO") video = row._count.id;
  }

  const modality = { inPerson, video, total: inPerson + video };

  // ---------------------------------------------------------------
  // 3. Provider performance
  // ---------------------------------------------------------------
  const providerAppointments = await db.appointment.findMany({
    where: {
      clinicId,
      startTime: { gte: periodStart, lte: periodEnd },
    },
    select: {
      providerId: true,
      status: true,
      startTime: true,
      review: { select: { overallRating: true } },
    },
  });

  // Get provider names
  const providerIds = [...new Set(providerAppointments.map((a) => a.providerId))];
  const providers = await db.provider.findMany({
    where: { id: { in: providerIds } },
    select: { id: true, firstName: true, lastName: true },
  });

  const providerNameMap = new Map<string, string>();
  for (const p of providers) {
    providerNameMap.set(p.id, `Dr. ${p.firstName} ${p.lastName}`);
  }

  // Aggregate per provider
  const providerAgg = new Map<
    string,
    {
      total: number;
      completed: number;
      cancelled: number;
      noShow: number;
      ratingSum: number;
      ratingCount: number;
    }
  >();

  for (const a of providerAppointments) {
    if (!providerAgg.has(a.providerId)) {
      providerAgg.set(a.providerId, {
        total: 0,
        completed: 0,
        cancelled: 0,
        noShow: 0,
        ratingSum: 0,
        ratingCount: 0,
      });
    }
    const agg = providerAgg.get(a.providerId)!;
    agg.total++;
    if (a.status === "COMPLETED") agg.completed++;
    if (a.status === "CANCELLED") agg.cancelled++;
    if (a.status === "NO_SHOW") agg.noShow++;
    if (a.review) {
      agg.ratingSum += a.review.overallRating;
      agg.ratingCount++;
    }
  }

  const providerPerformance = Array.from(providerAgg.entries())
    .map(([id, agg]) => ({
      name: providerNameMap.get(id) ?? "Unknown",
      total: agg.total,
      completed: agg.completed,
      cancelled: agg.cancelled,
      noShowRate:
        agg.total > 0 ? Math.round((agg.noShow / agg.total) * 100) : 0,
      avgRating:
        agg.ratingCount > 0
          ? Math.round((agg.ratingSum / agg.ratingCount) * 10) / 10
          : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // ---------------------------------------------------------------
  // 4. Summary stats
  // ---------------------------------------------------------------
  const totalAppointments = providerAppointments.length;
  const completedCount = providerAppointments.filter(
    (a) => a.status === "COMPLETED"
  ).length;
  const cancelledCount = providerAppointments.filter(
    (a) => a.status === "CANCELLED"
  ).length;
  const noShowCount = providerAppointments.filter(
    (a) => a.status === "NO_SHOW"
  ).length;

  const summary = {
    totalAppointments,
    completionRate:
      totalAppointments > 0
        ? Math.round((completedCount / totalAppointments) * 100)
        : 0,
    cancellationRate:
      totalAppointments > 0
        ? Math.round((cancelledCount / totalAppointments) * 100)
        : 0,
    noShowRate:
      totalAppointments > 0
        ? Math.round((noShowCount / totalAppointments) * 100)
        : 0,
    avgDaily:
      days > 0 ? Math.round((totalAppointments / days) * 10) / 10 : 0,
  };

  // ---------------------------------------------------------------
  // 5. Busiest day of week & busiest hour
  // ---------------------------------------------------------------
  const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun=0 .. Sat=6
  const hourCounts = new Array(24).fill(0);

  for (const a of providerAppointments) {
    const dt = new Date(a.startTime);
    dayOfWeekCounts[dt.getDay()]++;
    hourCounts[dt.getHours()]++;
  }

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const maxDayCount = Math.max(...dayOfWeekCounts);
  const busiestDay =
    maxDayCount > 0 ? dayNames[dayOfWeekCounts.indexOf(maxDayCount)] : "N/A";

  const maxHourCount = Math.max(...hourCounts);
  const busiestHour =
    maxHourCount > 0 ? hourCounts.indexOf(maxHourCount) : -1;
  const busiestHourLabel =
    busiestHour >= 0 ? `${busiestHour.toString().padStart(2, "0")}:00` : "N/A";

  return {
    period: {
      start: format(periodStart, "yyyy-MM-dd"),
      end: format(periodEnd, "yyyy-MM-dd"),
    },
    dailyTrends,
    modality,
    providerPerformance,
    summary,
    busiestDay,
    busiestHour: busiestHourLabel,
  };
}