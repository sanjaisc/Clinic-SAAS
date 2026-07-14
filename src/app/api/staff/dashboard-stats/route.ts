import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { SLOT_STATUS, PROVIDER_STATUS } from "@/lib/enums";
import { startOfDay, endOfDay } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const clinicId = session.user.clinicId;
    const role = session.user.role;

    const targetClinicId = request.nextUrl.searchParams.get("clinicId") || clinicId;
    if (!targetClinicId) {
      return NextResponse.json({ error: "No clinic specified" }, { status: 400 });
    }

    if (role !== "SYSTEM_MANAGER" && clinicId && targetClinicId !== clinicId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);
    const dayOfWeek = today.getDay(); // 0=Sunday, 6=Saturday

    const [
      todayAppointmentsCount,
      pendingBookingsCount,
      availableSlotsTodayCount,
      activeProvidersCount,
    ] = await Promise.all([
      // Today's appointments (BOOKED or CHECKED_IN)
      db.appointment.count({
        where: {
          clinicId: targetClinicId,
          startTime: { gte: todayStart, lte: todayEnd },
          status: { in: ["BOOKED", "CHECKED_IN"] },
        },
      }),

      // Pending bookings (active waitlist entries)
      db.waitlistEntry.count({
        where: {
          clinicId: targetClinicId,
          status: "ACTIVE",
        },
      }),

      // Available slots today
      db.slot.count({
        where: {
          clinicId: targetClinicId,
          startTime: { gte: todayStart, lte: todayEnd },
          status: SLOT_STATUS.AVAILABLE,
        },
      }),

      // Active providers
      db.provider.count({
        where: {
          clinicId: targetClinicId,
          status: PROVIDER_STATUS.ACTIVE,
        },
      }),
    ]);

    return NextResponse.json({
      todayAppointments: todayAppointmentsCount,
      pendingBookings: pendingBookingsCount,
      availableSlots: availableSlotsTodayCount,
      activeProviders: activeProvidersCount,
    });
  } catch (error) {
    console.error("[STAFF_DASHBOARD_STATS]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}