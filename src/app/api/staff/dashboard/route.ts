import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  APPOINTMENT_STATUS,
  SLOT_STATUS,
} from "@/lib/enums";
import { format, startOfDay, endOfDay } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const clinicId = session.user.clinicId;
    const role = session.user.role;

    // System managers must specify a clinic
    const targetClinicId = request.nextUrl.searchParams.get("clinicId") || clinicId;
    if (!targetClinicId) {
      return NextResponse.json(
        { error: "No clinic specified" },
        { status: 400 }
      );
    }

    // Non-system managers can only see their own clinic
    if (role !== "SYSTEM_MANAGER" && clinicId && targetClinicId !== clinicId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    // Parallel queries
    const [
      clinic,
      todayAppointments,
      upcomingAppointments,
      totalSlotsToday,
      availableSlotsToday,
      recentAppointments,
    ] = await Promise.all([
      db.clinic.findUnique({
        where: { id: targetClinicId },
        select: {
          id: true,
          name: true,
          slug: true,
          phoneNumber: true,
          status: true,
        },
      }),

      db.appointment.findMany({
        where: {
          clinicId: targetClinicId,
          startTime: { gte: todayStart, lte: todayEnd },
          status: { in: [APPOINTMENT_STATUS.BOOKED, APPOINTMENT_STATUS.CHECKED_IN] },
        },
        orderBy: { startTime: "asc" },
        take: 50,
        include: {
          provider: { select: { firstName: true, lastName: true, credentials: true } },
          service: { select: { name: true } },
          slot: { select: { modality: true } },
        },
      }),

      db.appointment.findMany({
        where: {
          clinicId: targetClinicId,
          startTime: { gt: todayEnd },
          status: { in: [APPOINTMENT_STATUS.BOOKED, APPOINTMENT_STATUS.CHECKED_IN] },
        },
        orderBy: { startTime: "asc" },
        take: 20,
        include: {
          provider: { select: { firstName: true, lastName: true, credentials: true } },
          service: { select: { name: true } },
        },
      }),

      db.slot.count({
        where: {
          clinicId: targetClinicId,
          startTime: { gte: todayStart, lte: todayEnd },
          status: { not: SLOT_STATUS.BLOCKED },
        },
      }),

      db.slot.count({
        where: {
          clinicId: targetClinicId,
          startTime: { gte: todayStart, lte: todayEnd },
          status: SLOT_STATUS.AVAILABLE,
        },
      }),

      db.appointment.findMany({
        where: {
          clinicId: targetClinicId,
          startTime: { lte: todayEnd },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          provider: { select: { firstName: true, lastName: true, credentials: true } },
          service: { select: { name: true } },
        },
      }),
    ]);

    // Appointment counts by status
    const appointmentCounts = await db.appointment.groupBy({
      by: ["status"],
      where: { clinicId: targetClinicId },
      _count: { status: true },
    });

    const statusCounts: Record<string, number> = {};
    for (const ac of appointmentCounts) {
      statusCounts[ac.status] = ac._count.status;
    }

    return NextResponse.json({
      clinic,
      today: format(today, "EEEE, MMMM d, yyyy"),
      stats: {
        todayAppointments: todayAppointments.length,
        totalSlotsToday,
        availableSlotsToday,
        bookedToday: totalSlotsToday - availableSlotsToday,
        utilizationPercent:
          totalSlotsToday > 0
            ? Math.round(
                ((totalSlotsToday - availableSlotsToday) / totalSlotsToday) * 100
              )
            : 0,
        upcomingCount: upcomingAppointments.length,
        totalBookings: Object.values(statusCounts).reduce((a, b) => a + b, 0),
        completedCount: statusCounts[APPOINTMENT_STATUS.COMPLETED] || 0,
        cancelledCount: statusCounts[APPOINTMENT_STATUS.CANCELLED] || 0,
        noShowCount: statusCounts[APPOINTMENT_STATUS.NO_SHOW] || 0,
      },
      todayAppointments,
      upcomingAppointments,
      recentAppointments,
    });
  } catch (error) {
    console.error("[STAFF_DASHBOARD]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}