import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cache } from "@/lib/cache";
import { subDays, format, startOfDay, endOfDay, parseISO } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    const clinicId = user.clinicId;
    const role = user.role;

    // System managers supply clinicId via query param; others from session.
    // "__all" means aggregate across all clinics (SYSTEM_MANAGER only).
    const rawClinicId = request.nextUrl.searchParams.get("clinicId");
    const isAllClinics = rawClinicId === "__all";
    const targetClinicId = isAllClinics ? "__all" : (rawClinicId || clinicId);

    if (!targetClinicId) {
      return NextResponse.json(
        { error: "No clinic specified" },
        { status: 400 }
      );
    }

    // Only SYSTEM_MANAGER can use "__all" or specify a different clinic
    if (role !== "SYSTEM_MANAGER" && (isAllClinics || (clinicId && targetClinicId !== clinicId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const effectiveClinicId = isAllClinics ? null : targetClinicId;

    const period = request.nextUrl.searchParams.get("period") || "30d";
    const dateFromParam = request.nextUrl.searchParams.get("dateFrom");
    const dateToParam = request.nextUrl.searchParams.get("dateTo");

    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;
    let days: number;

    // Custom date range takes precedence
    if (dateFromParam && dateToParam) {
      periodStart = startOfDay(parseISO(dateFromParam));
      periodEnd = endOfDay(parseISO(dateToParam));
      days = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));
    } else {
      const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "today": 1 };
      days = daysMap[period] ?? 30;
      periodStart = startOfDay(subDays(now, days - 1));
      periodEnd = endOfDay(now);
    }

    const cacheKey = `analytics:${effectiveClinicId || "__all"}:${period}:${dateFromParam || ""}:${dateToParam || ""}:${format(now, "yyyy-MM-dd-HH")}`;

    const data = await cache.getOrSet(cacheKey, async () => {
      return buildAnalytics(effectiveClinicId, periodStart, periodEnd, days);
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
  clinicId: string | null,
  periodStart: Date,
  periodEnd: Date,
  days: number
) {
  const clinicFilter = clinicId ? { clinicId } : {};
  const apptWhere = { ...clinicFilter, startTime: { gte: periodStart, lte: periodEnd } };

  // ---------------------------------------------------------------
  // 1. Daily appointment counts grouped by DATE(startTime) & status
  // ---------------------------------------------------------------
  const dailyRaw = await db.appointment.groupBy({
    by: ["startTime", "status"],
    where: apptWhere,
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
      ...clinicFilter,
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
      ...clinicFilter,
      startTime: { gte: periodStart, lte: periodEnd },
    },
    select: {
      providerId: true,
      clinicId: true,
      status: true,
      startTime: true,
      review: { select: { overallRating: true } },
      clinic: { select: { name: true, city: true, zipCode: true } },
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

  // Aggregate per provider+clinic so cross-clinic filtering works
  const providerAgg = new Map<
    string,
    {
      name: string;
      clinicName: string;
      city: string;
      zipCode: string;
      total: number;
      completed: number;
      cancelled: number;
      noShow: number;
      ratingSum: number;
      ratingCount: number;
    }
  >();

  for (const a of providerAppointments) {
    const pName = providerNameMap.get(a.providerId) ?? "Unknown";
    const cName = a.clinic?.name ?? "";
    const cCity = a.clinic?.city ?? "";
    const cZip = a.clinic?.zipCode ?? "";
    const key = `${a.providerId}::${a.clinicId}`;
    if (!providerAgg.has(key)) {
      providerAgg.set(key, {
        name: pName,
        clinicName: cName,
        city: cCity,
        zipCode: cZip,
        total: 0,
        completed: 0,
        cancelled: 0,
        noShow: 0,
        ratingSum: 0,
        ratingCount: 0,
      });
    }
    const agg = providerAgg.get(key)!;
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
    .map(([_, agg]) => ({
      name: agg.name,
      clinicName: agg.clinicName,
      city: agg.city,
      zipCode: agg.zipCode,
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

  // ---------------------------------------------------------------
  // 6. No-Show Distribution by Day of Week
  // ---------------------------------------------------------------
  const noShowAppointments = await db.appointment.findMany({
    where: {
      ...clinicFilter,
      status: "NO_SHOW",
      startTime: { gte: periodStart, lte: periodEnd },
    },
    select: { startTime: true },
  });

  const noShowByDayMap = new Map<string, number>();
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  for (const label of dayLabels) {
    noShowByDayMap.set(label, 0);
  }

  for (const a of noShowAppointments) {
    // JS getDay(): Sun=0, Mon=1, ..., Sat=6
    // Convert to Mon=0, Tue=1, ..., Sun=6
    const jsDay = new Date(a.startTime).getDay();
    const dayIndex = jsDay === 0 ? 6 : jsDay - 1; // Mon=0 ... Sun=6
    const label = dayLabels[dayIndex];
    noShowByDayMap.set(label, (noShowByDayMap.get(label) || 0) + 1);
  }

  const noShowByDay = dayLabels.map((day) => ({
    day,
    count: noShowByDayMap.get(day) || 0,
  }));

  // ---------------------------------------------------------------
  // 7. Financial data — Revenue + Deposit Capture (clinic-filtered)
  // ---------------------------------------------------------------
  const financialAppts = await db.appointment.findMany({
    where: { ...clinicFilter, startTime: { gte: periodStart, lte: periodEnd } },
    select: { id: true, paymentMethod: true, depositCents: true, selfPayCents: true, status: true },
  });

  const finApptIds = financialAppts.map((a) => a.id);
  const allLedgers = finApptIds.length > 0
    ? await db.appointmentLedger.findMany({
        where: { appointmentId: { in: finApptIds } },
        select: { type: true, amountCents: true, refundStatus: true, createdAt: true },
      })
    : [];

  // -- Deposit Capture Volume (now clinic-scoped via appointment join) --
  const depositCaptures = allLedgers.filter((l) => l.type === "DEPOSIT_CAPTURE");
  const depositCaptureMap = new Map<string, { amountCents: number; count: number }>();

  for (const entry of depositCaptures) {
    const dateStr = format(new Date(entry.createdAt), "yyyy-MM-dd");
    if (!depositCaptureMap.has(dateStr)) {
      depositCaptureMap.set(dateStr, { amountCents: 0, count: 0 });
    }
    const bucket = depositCaptureMap.get(dateStr)!;
    bucket.amountCents += entry.amountCents;
    bucket.count += 1;
  }

  const depositCapture: Array<{ date: string; amountCents: number; count: number }> = [];
  for (let i = 0; i < days; i++) {
    const d = subDays(periodEnd, days - 1 - i);
    const dateStr = format(d, "yyyy-MM-dd");
    const bucket = depositCaptureMap.get(dateStr);
    depositCapture.push({
      date: dateStr,
      amountCents: bucket?.amountCents ?? 0,
      count: bucket?.count ?? 0,
    });
  }

  // -- Revenue aggregation --
  let totalCaptured = 0;
  let totalAuthorized = 0;
  let totalRefunded = 0;
  let totalForfeited = 0;
  const dailyRevenueMap = new Map<string, number>();

  for (const l of allLedgers) {
    const dateStr = format(new Date(l.createdAt), "yyyy-MM-dd");
    switch (l.type) {
      case "DEPOSIT_AUTH":
        totalAuthorized += l.amountCents;
        break;
      case "DEPOSIT_CAPTURE":
      case "FULL_PAYMENT":
      case "BALANCE_PAYMENT":
        totalCaptured += l.amountCents;
        dailyRevenueMap.set(dateStr, (dailyRevenueMap.get(dateStr) || 0) + l.amountCents);
        break;
      case "REFUND":
        if (l.refundStatus === "FORFEITED") totalForfeited += l.amountCents;
        else totalRefunded += l.amountCents;
        break;
    }
  }

  // Payment method distribution (from completed appointments)
  const completedFin = financialAppts.filter((a) => a.status === "COMPLETED");
  const byPaymentMethod = {
    stripe: { count: 0, amount: 0 },
    cashAtDesk: { count: 0, amount: 0 },
    manualWaiver: { count: 0, amount: 0 },
  };
  for (const a of completedFin) {
    const m = a.paymentMethod?.toLowerCase() || "";
    const key = m === "stripe" ? "stripe" : m === "cash_at_desk" ? "cashAtDesk" : "manualWaiver";
    byPaymentMethod[key].count++;
    byPaymentMethod[key].amount += (a.depositCents || 0) + (a.selfPayCents || 0);
  }

  const dailyRevenue: Array<{ date: string; amount: number }> = [];
  for (let i = 0; i < days; i++) {
    const d = subDays(periodEnd, days - 1 - i);
    const dateStr = format(d, "yyyy-MM-dd");
    dailyRevenue.push({ date: dateStr, amount: dailyRevenueMap.get(dateStr) || 0 });
  }

  const avgPerAppointment = completedCount > 0
    ? Math.round(totalCaptured / completedCount)
    : 0;

  // ---------------------------------------------------------------
  // 8. Slot Utilization
  // ---------------------------------------------------------------
  const slotCounts = await db.slot.groupBy({
    by: ["status"],
    where: {
      ...clinicFilter,
      startTime: { gte: periodStart, lte: periodEnd },
    },
    _count: { id: true },
  });

  let slAvail = 0, slBooked = 0, slBlocked = 0, slClosed = 0, slLocked = 0;
  for (const row of slotCounts) {
    switch (row.status) {
      case "AVAILABLE": slAvail += row._count.id; break;
      case "BOOKED": slBooked += row._count.id; break;
      case "BLOCKED": slBlocked += row._count.id; break;
      case "CLOSED": slClosed += row._count.id; break;
      case "LOCKED": slLocked += row._count.id; break;
    }
  }
  const slTotal = slAvail + slBooked + slBlocked + slClosed + slLocked;
  const utilizable = slTotal - slBlocked - slClosed;
  const slotUtilization = {
    total: slTotal,
    available: slAvail,
    booked: slBooked,
    blocked: slBlocked,
    closed: slClosed,
    utilizationRate: utilizable > 0 ? Math.round((slBooked / utilizable) * 100) : 0,
  };

  // ---------------------------------------------------------------
  // 9. Cancellation Reasons
  // ---------------------------------------------------------------
  const cancelledAppts = await db.appointment.findMany({
    where: {
      ...clinicFilter,
      status: "CANCELLED",
      startTime: { gte: periodStart, lte: periodEnd },
    },
    select: { cancellationReason: true },
  });

  let cancPatient = 0, cancClinic = 0, cancDouble = 0, cancUnknown = 0;
  for (const a of cancelledAppts) {
    switch (a.cancellationReason) {
      case "PATIENT_CANCELLED": cancPatient++; break;
      case "CLINIC_CANCELLED": cancClinic++; break;
      case "DOUBLE_BOOKING": cancDouble++; break;
      default: cancUnknown++; break;
    }
  }
  const cancellationReasons = {
    patientCancelled: cancPatient,
    clinicCancelled: cancClinic,
    doubleBooking: cancDouble,
    unknown: cancUnknown,
    totalCancelled: cancelledAppts.length,
  };

  // ---------------------------------------------------------------
  // 10. Waitlist Performance
  // ---------------------------------------------------------------
  const waitlistEntries = await db.waitlistEntry.findMany({
    where: {
      ...clinicFilter,
      createdAt: { gte: periodStart, lte: periodEnd },
    },
    select: { status: true, createdAt: true, offeredAt: true },
  });

  let wlActive = 0, wlOffered = 0, wlFulfilled = 0, wlExpired = 0, wlRemoved = 0;
  for (const e of waitlistEntries) {
    switch (e.status) {
      case "ACTIVE": wlActive++; break;
      case "OFFERED": wlOffered++; break;
      case "FULFILLED": wlFulfilled++; break;
      case "EXPIRED": wlExpired++; break;
      case "REMOVED": wlRemoved++; break;
    }
  }
  const wlTotal = waitlistEntries.length;

  // Daily waitlist volume trend
  const wlDailyMap = new Map<string, number>();
  for (const e of waitlistEntries) {
    const ds = format(new Date(e.createdAt), "yyyy-MM-dd");
    wlDailyMap.set(ds, (wlDailyMap.get(ds) || 0) + 1);
  }
  const waitlistVolume: Array<{ date: string; count: number }> = [];
  for (let i = 0; i < days; i++) {
    const d = subDays(periodEnd, days - 1 - i);
    const ds = format(d, "yyyy-MM-dd");
    waitlistVolume.push({ date: ds, count: wlDailyMap.get(ds) || 0 });
  }

  const waitlist = {
    active: wlActive,
    offered: wlOffered,
    fulfilled: wlFulfilled,
    expired: wlExpired,
    removed: wlRemoved,
    total: wlTotal,
    fulfillmentRate: wlTotal > 0 ? Math.round((wlFulfilled / wlTotal) * 100) : 0,
    dailyVolume: waitlistVolume,
  };

  // ---------------------------------------------------------------
  // 11. Patient Demographics
  // ---------------------------------------------------------------
  const patientAppts = await db.appointment.findMany({
    where: {
      ...clinicFilter,
      startTime: { gte: periodStart, lte: periodEnd },
    },
    select: { patientType: true, patientDob: true },
  });

  let demoAdult = 0, demoPediatric = 0;
  const ageBuckets: Record<string, number> = { "0-12": 0, "13-17": 0, "18-30": 0, "31-45": 0, "46-60": 0, "60+": 0 };
  const nowDate = new Date();

  for (const a of patientAppts) {
    if (a.patientType === "ADULT") demoAdult++;
    else if (a.patientType === "PEDIATRIC") demoPediatric++;

    if (a.patientDob) {
      const age = nowDate.getFullYear() - new Date(a.patientDob).getFullYear();
      if (age <= 12) ageBuckets["0-12"]++;
      else if (age <= 17) ageBuckets["13-17"]++;
      else if (age <= 30) ageBuckets["18-30"]++;
      else if (age <= 45) ageBuckets["31-45"]++;
      else if (age <= 60) ageBuckets["46-60"]++;
      else ageBuckets["60+"]++;
    }
  }

  const demographics = {
    adult: demoAdult,
    pediatric: demoPediatric,
    total: patientAppts.length,
    ageGroups: Object.entries(ageBuckets)
      .filter(([, c]) => c > 0)
      .map(([group, count]) => ({ group, count })),
  };

  // ---------------------------------------------------------------
  // 12. Booking Source / Conversion Funnel
  // ---------------------------------------------------------------
  const convEvents = await db.conversionEvent.findMany({
    where: {
      ...clinicFilter,
      createdAt: { gte: periodStart, lte: periodEnd },
    },
    select: { sessionId: true, eventType: true },
  });

  const convCounts: Record<string, number> = {
    SEARCH: 0, CLINIC_VIEW: 0, BOOKING_START: 0, BOOKING_COMPLETE: 0, RECOMMENDATION_ACCEPT: 0,
  };
  const convSessions: Record<string, Set<string>> = {
    SEARCH: new Set(), CLINIC_VIEW: new Set(), BOOKING_START: new Set(), BOOKING_COMPLETE: new Set(), RECOMMENDATION_ACCEPT: new Set(),
  };

  for (const e of convEvents) {
    convCounts[e.eventType] = (convCounts[e.eventType] || 0) + 1;
    convSessions[e.eventType].add(e.sessionId);
  }

  const funnel = {
    totalSearches: convCounts.SEARCH,
    clinicViews: convCounts.CLINIC_VIEW,
    bookingStarts: convCounts.BOOKING_START,
    bookingCompletes: convCounts.BOOKING_COMPLETE,
  };
  const totalS = funnel.totalSearches;
  const convRates = {
    searchToClinicView: totalS > 0 ? Math.round((funnel.clinicViews / totalS) * 1000) / 10 : 0,
    clinicViewToBookingStart: funnel.clinicViews > 0 ? Math.round((funnel.bookingStarts / funnel.clinicViews) * 1000) / 10 : 0,
    bookingStartToComplete: funnel.bookingStarts > 0 ? Math.round((funnel.bookingCompletes / funnel.bookingStarts) * 1000) / 10 : 0,
    searchToBooking: totalS > 0 ? Math.round((funnel.bookingCompletes / totalS) * 1000) / 10 : 0,
  };
  const recommendationAcceptRate =
    convCounts.BOOKING_COMPLETE > 0
      ? Math.round((convCounts.RECOMMENDATION_ACCEPT / (convCounts.BOOKING_COMPLETE + convCounts.RECOMMENDATION_ACCEPT)) * 1000) / 10
      : 0;

  const conversionFunnel = {
    funnel,
    conversionRates: convRates,
    recommendationAcceptRate,
    uniqueSessions: {
      searches: convSessions.SEARCH.size,
      clinicViews: convSessions.CLINIC_VIEW.size,
      bookingStarts: convSessions.BOOKING_START.size,
      bookingCompletes: convSessions.BOOKING_COMPLETE.size,
    },
  };

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
    noShowByDay,
    depositCapture,
    revenue: {
      totalCaptured,
      totalAuthorized,
      totalRefunded,
      totalForfeited,
      byPaymentMethod,
      avgPerAppointment,
      dailyRevenue,
    },
    slotUtilization,
    cancellationReasons,
    waitlist,
    demographics,
    conversionFunnel,
  };
}