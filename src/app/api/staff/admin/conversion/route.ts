import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cache } from "@/lib/cache";
import { STAFF_ROLE } from "@/lib/enums";
import { startOfDay, endOfDay, parseISO, format } from "date-fns";

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
    const dateFromParam = request.nextUrl.searchParams.get("dateFrom");
    const dateToParam = request.nextUrl.searchParams.get("dateTo");

    let periodStart: Date;
    let periodEnd: Date;

    if (dateFromParam && dateToParam) {
      periodStart = startOfDay(parseISO(dateFromParam));
      periodEnd = endOfDay(parseISO(dateToParam));
    } else {
      // Default: last 30 days
      const now = new Date();
      periodEnd = endOfDay(now);
      periodStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
    }

    const cacheKey = `admin:conversion:${dateFromParam || ""}:${dateToParam || ""}:${format(new Date(), "yyyy-MM-dd-HH")}`;

    const data = await cache.getOrSet(
      cacheKey,
      () => buildConversionMetrics(periodStart, periodEnd),
      300
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error("[ADMIN_CONVERSION]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function buildConversionMetrics(periodStart: Date, periodEnd: Date) {
  // Get all conversion events in the period
  const events = await db.conversionEvent.findMany({
    where: { createdAt: { gte: periodStart, lte: periodEnd } },
    select: {
      id: true,
      sessionId: true,
      eventType: true,
      clinicId: true,
      createdAt: true,
    },
  });

  // Group by eventType
  const eventCounts: Record<string, number> = {
    SEARCH: 0,
    CLINIC_VIEW: 0,
    BOOKING_START: 0,
    BOOKING_COMPLETE: 0,
    RECOMMENDATION_ACCEPT: 0,
  };

  const uniqueSessions: Record<string, Set<string>> = {
    SEARCH: new Set(),
    CLINIC_VIEW: new Set(),
    BOOKING_START: new Set(),
    BOOKING_COMPLETE: new Set(),
    RECOMMENDATION_ACCEPT: new Set(),
  };

  for (const e of events) {
    eventCounts[e.eventType] = (eventCounts[e.eventType] || 0) + 1;
    uniqueSessions[e.eventType].add(e.sessionId);
  }

  const totalSearches = eventCounts.SEARCH;
  const uniqueSearchSessions = uniqueSessions.SEARCH.size;
  const clinicViews = eventCounts.CLINIC_VIEW;
  const uniqueClinicViewSessions = uniqueSessions.CLINIC_VIEW.size;
  const bookingStarts = eventCounts.BOOKING_START;
  const uniqueBookingStartSessions = uniqueSessions.BOOKING_START.size;
  const bookingCompletes = eventCounts.BOOKING_COMPLETE;
  const uniqueBookingCompleteSessions = uniqueSessions.BOOKING_COMPLETE.size;
  const recommendationAccepts = eventCounts.RECOMMENDATION_ACCEPT;

  // Conversion rates (using unique sessions where applicable)
  const searchToClinicViewRate =
    totalSearches > 0
      ? Math.round((clinicViews / totalSearches) * 1000) / 10
      : 0;

  const clinicViewToBookingStartRate =
    clinicViews > 0
      ? Math.round((bookingStarts / clinicViews) * 1000) / 10
      : 0;

  const bookingStartToCompleteRate =
    bookingStarts > 0
      ? Math.round((bookingCompletes / bookingStarts) * 1000) / 10
      : 0;

  const searchToBookingRate =
    totalSearches > 0
      ? Math.round((bookingCompletes / totalSearches) * 1000) / 10
      : 0;

  // Recommendation acceptance rate
  const recommendationAcceptRate =
    eventCounts.BOOKING_COMPLETE > 0
      ? Math.round(
          (recommendationAccepts /
            (eventCounts.BOOKING_COMPLETE + recommendationAccepts)) *
            1000
        ) / 10
      : 0;

  return {
    period: {
      start: format(periodStart, "yyyy-MM-dd"),
      end: format(periodEnd, "yyyy-MM-dd"),
    },
    funnel: {
      totalSearches,
      clinicViews,
      bookingStarts,
      bookingCompletes,
    },
    conversionRates: {
      searchToClinicView: searchToClinicViewRate,
      clinicViewToBookingStart: clinicViewToBookingStartRate,
      bookingStartToComplete: bookingStartToCompleteRate,
      searchToBooking: searchToBookingRate,
    },
    recommendationAcceptRate,
    uniqueSessions: {
      searches: uniqueSearchSessions,
      clinicViews: uniqueClinicViewSessions,
      bookingStarts: uniqueBookingStartSessions,
      bookingCompletes: uniqueBookingCompleteSessions,
    },
  };
}