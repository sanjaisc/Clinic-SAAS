import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cache } from "@/lib/cache";
import { STAFF_ROLE } from "@/lib/enums";
import { subDays, format, startOfDay, endOfDay, parseISO } from "date-fns";

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

    // Date range parsing
    const period = request.nextUrl.searchParams.get("period") || "30D";
    const dateFromParam = request.nextUrl.searchParams.get("dateFrom");
    const dateToParam = request.nextUrl.searchParams.get("dateTo");

    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;
    let days: number;

    if (dateFromParam && dateToParam) {
      periodStart = startOfDay(parseISO(dateFromParam));
      periodEnd = endOfDay(parseISO(dateToParam));
      days = Math.max(
        1,
        Math.ceil(
          (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
        )
      );
    } else {
      const daysMap: Record<string, number> = {
        TODAY: 1,
        "7D": 7,
        "30D": 30,
        "90D": 90,
      };
      days = daysMap[period] ?? 30;
      periodStart = startOfDay(subDays(now, days - 1));
      periodEnd = endOfDay(now);
    }

    const cacheKey = `admin:analytics:${period}:${dateFromParam || ""}:${dateToParam || ""}:${format(now, "yyyy-MM-dd-HH")}`;

    const data = await cache.getOrSet(
      cacheKey,
      () => buildPlatformAnalytics(periodStart, periodEnd, days),
      300
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error("[ADMIN_ANALYTICS]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function buildPlatformAnalytics(
  periodStart: Date,
  periodEnd: Date,
  days: number
) {
  // Run parallel queries
  const [
    dailyRaw,
    modalityRaw,
    noShowAppointments,
    depositLedgerEntries,
    allAppointments,
    allReviews,
    clinicNames,
  ] = await Promise.all([
    // 1. Daily appointment counts
    db.appointment.groupBy({
      by: ["startTime"],
      where: { startTime: { gte: periodStart, lte: periodEnd } },
      _count: { id: true },
    }),

    // 2. Modality split
    db.appointment.groupBy({
      by: ["modality"],
      where: { startTime: { gte: periodStart, lte: periodEnd } },
      _count: { id: true },
    }),

    // 3. No-show appointments for day-of-week distribution
    db.appointment.findMany({
      where: {
        status: "NO_SHOW",
        startTime: { gte: periodStart, lte: periodEnd },
      },
      select: { startTime: true },
    }),

    // 4. Deposit ledger entries
    db.appointmentLedger.findMany({
      where: { createdAt: { gte: periodStart, lte: periodEnd } },
      select: {
        type: true,
        amountCents: true,
        refundStatus: true,
        createdAt: true,
      },
    }),

    // 5. All appointments in period for summary stats
    db.appointment.findMany({
      where: { startTime: { gte: periodStart, lte: periodEnd } },
      select: {
        id: true,
        status: true,
        clinicId: true,
        modality: true,
        depositCents: true,
        paymentStatus: true,
      },
    }),

    // 6. All reviews in period for avg rating
    db.review.findMany({
      where: { createdAt: { gte: periodStart, lte: periodEnd } },
      select: { overallRating: true },
    }),

    // 7. Clinic names for breakdown
    db.clinic.findMany({
      select: { id: true, name: true, city: true, zipCode: true },
    }),
  ]);

  // Build clinic name map
  const clinicNameMap = new Map<string, string>();
  const clinicInfoMap = new Map<string, { city: string; zipCode: string }>();
  for (const c of clinicNames) {
    clinicNameMap.set(c.id, c.name);
    clinicInfoMap.set(c.id, { city: c.city ?? "", zipCode: c.zipCode ?? "" });
  }

  // -------------------------------------------------------------------------
  // 1. Appointment Volume (daily counts for area chart)
  // -------------------------------------------------------------------------
  const dailyMap = new Map<string, number>();
  for (const row of dailyRaw) {
    const dateStr = format(new Date(row.startTime), "yyyy-MM-dd");
    dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + row._count.id);
  }

  const appointmentVolume: Array<{ date: string; count: number }> = [];
  for (let i = 0; i < days; i++) {
    const d = subDays(periodEnd, days - 1 - i);
    const dateStr = format(d, "yyyy-MM-dd");
    appointmentVolume.push({
      date: dateStr,
      count: dailyMap.get(dateStr) || 0,
    });
  }

  // -------------------------------------------------------------------------
  // 2. Modality Split (pie chart)
  // -------------------------------------------------------------------------
  let inPersonCount = 0;
  let videoCount = 0;
  for (const row of modalityRaw) {
    if (row.modality === "IN_PERSON") inPersonCount = row._count.id;
    else if (row.modality === "VIDEO") videoCount = row._count.id;
  }
  const totalModality = inPersonCount + videoCount;
  const modalitySplit = {
    inPerson: inPersonCount,
    video: videoCount,
    inPersonPct:
      totalModality > 0
        ? Math.round((inPersonCount / totalModality) * 1000) / 10
        : 0,
    videoPct:
      totalModality > 0
        ? Math.round((videoCount / totalModality) * 1000) / 10
        : 0,
  };

  // -------------------------------------------------------------------------
  // 3. No-Show Distribution by Day of Week (bar chart)
  // -------------------------------------------------------------------------
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const noShowCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const a of noShowAppointments) {
    const jsDay = new Date(a.startTime).getDay();
    const dayIndex = jsDay === 0 ? 6 : jsDay - 1; // Mon=0 ... Sun=6
    noShowCounts[dayIndex]++;
  }
  const noShowDistribution = dayLabels.map((day, idx) => ({
    day,
    count: noShowCounts[idx],
  }));

  // -------------------------------------------------------------------------
  // 4. Deposit Capture (stacked bar chart data)
  // -------------------------------------------------------------------------
  let authorizedCents = 0;
  let capturedCents = 0;
  let forfeitedCents = 0;
  let refundedCents = 0;

  for (const entry of depositLedgerEntries) {
    switch (entry.type) {
      case "DEPOSIT_AUTH":
        authorizedCents += entry.amountCents;
        break;
      case "DEPOSIT_CAPTURE":
        capturedCents += entry.amountCents;
        break;
      case "REFUND":
        if (entry.refundStatus === "FORFEITED") {
          forfeitedCents += entry.amountCents;
        } else {
          refundedCents += entry.amountCents;
        }
        break;
      case "FULL_PAYMENT":
        capturedCents += entry.amountCents;
        break;
      case "BALANCE_PAYMENT":
        capturedCents += entry.amountCents;
        break;
    }
  }

  const depositCapture = {
    totalDepositCents: authorizedCents,
    capturedCents,
    forfeitedCents,
    refundedCents,
  };

  // -------------------------------------------------------------------------
  // 5. Summary Stats
  // -------------------------------------------------------------------------
  const totalAppointments = allAppointments.length;
  const completedAppointments = allAppointments.filter(
    (a) => a.status === "COMPLETED"
  ).length;
  const noShowCount = allAppointments.filter(
    (a) => a.status === "NO_SHOW"
  ).length;
  const cancellationCount = allAppointments.filter(
    (a) => a.status === "CANCELLED"
  ).length;

  const avgRating =
    allReviews.length > 0
      ? Math.round(
          (allReviews.reduce((s, r) => s + r.overallRating, 0) /
            allReviews.length) *
            10
        ) / 10
      : 0;

  // Completed appointment IDs for revenue calculation
  const completedAppts = allAppointments.filter(
    (a) => a.status === "COMPLETED"
  );
  const completedApptIds = completedAppts.map((a) => a.id);

  // Build clinic aggregation for breakdown
  const clinicAgg = new Map<
    string,
    {
      total: number;
      completed: number;
      noShows: number;
      completedIds: string[];
    }
  >();

  for (const a of allAppointments) {
    if (!clinicAgg.has(a.clinicId)) {
      clinicAgg.set(a.clinicId, {
        total: 0,
        completed: 0,
        noShows: 0,
        completedIds: [],
      });
    }
    const agg = clinicAgg.get(a.clinicId)!;
    agg.total++;
    if (a.status === "COMPLETED") {
      agg.completed++;
      agg.completedIds.push(a.id);
    }
    if (a.status === "NO_SHOW") agg.noShows++;
  }

  // Get all revenue ledgers for completed appointments (single query)
  const allCompletedIds = Array.from(clinicAgg.values()).flatMap(
    (c) => c.completedIds
  );
  let totalRevenue = 0;
  const clinicRevenueMap = new Map<string, number>();

  if (allCompletedIds.length > 0) {
    // Build appt->clinicId lookup
    const apptClinicMap = new Map<string, string>();
    for (const a of completedAppts) {
      apptClinicMap.set(a.id, a.clinicId);
    }

    const revenueLedgers = await db.appointmentLedger.findMany({
      where: {
        appointmentId: { in: allCompletedIds },
        type: { in: ["DEPOSIT_CAPTURE", "FULL_PAYMENT", "BALANCE_PAYMENT"] },
      },
      select: { appointmentId: true, amountCents: true },
    });

    for (const l of revenueLedgers) {
      totalRevenue += l.amountCents;
      const cId = apptClinicMap.get(l.appointmentId);
      if (cId) {
        clinicRevenueMap.set(
          cId,
          (clinicRevenueMap.get(cId) || 0) + l.amountCents
        );
      }
    }
  }

  const summaryStats = {
    totalAppointments,
    completedAppointments,
    noShowCount,
    cancellationRate:
      totalAppointments > 0
        ? Math.round((cancellationCount / totalAppointments) * 1000) / 10
        : 0,
    avgRating,
    totalRevenue,
  };

  // -------------------------------------------------------------------------
  // 6. Clinic Breakdown
  // -------------------------------------------------------------------------
  // Get clinic ratings (aggregate from reviews)
  const clinicRatings = await db.review.groupBy({
    by: ["clinicId"],
    _avg: { overallRating: true },
  });
  const clinicRatingMap = new Map<string, number>();
  for (const r of clinicRatings) {
    clinicRatingMap.set(
      r.clinicId,
      Math.round((r._avg.overallRating ?? 0) * 10) / 10
    );
  }

  const clinicBreakdown = Array.from(clinicAgg.entries())
    .map(([clinicId, agg]) => {
      const info = clinicInfoMap.get(clinicId);
      return {
        clinicId,
        clinicName: clinicNameMap.get(clinicId) ?? "Unknown Clinic",
        appointments: agg.total,
        completed: agg.completed,
        noShows: agg.noShows,
        revenue: clinicRevenueMap.get(clinicId) ?? 0,
        rating: clinicRatingMap.get(clinicId) ?? 0,
        city: info?.city ?? "",
        zipCode: info?.zipCode ?? "",
      };
    })
    .sort((a, b) => b.appointments - a.appointments);

  return {
    period: {
      start: format(periodStart, "yyyy-MM-dd"),
      end: format(periodEnd, "yyyy-MM-dd"),
      days,
    },
    appointmentVolume,
    modalitySplit,
    noShowDistribution,
    depositCapture,
    summaryStats,
    clinicBreakdown,
  };
}