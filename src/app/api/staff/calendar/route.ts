import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { format, startOfDay, endOfDay, parseISO } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinicId = session.user.clinicId;
    if (!clinicId) {
      return NextResponse.json(
        { error: "No clinic assigned" },
        { status: 400 }
      );
    }

    const dateStr = request.nextUrl.searchParams.get("date");
    if (!dateStr) {
      return NextResponse.json(
        { error: "date query param required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const providerId = request.nextUrl.searchParams.get("providerId") || undefined;

    let targetDate: Date;
    try {
      targetDate = parseISO(dateStr);
    } catch {
      return NextResponse.json(
        { error: "Invalid date format, use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const dayStart = startOfDay(targetDate);
    const dayEnd = endOfDay(targetDate);

    // Parallel: fetch slots + providers
    const [slots, providers] = await Promise.all([
      db.slot.findMany({
        where: {
          clinicId,
          startTime: { gte: dayStart, lte: dayEnd },
          ...(providerId ? { providerId } : {}),
        },
        orderBy: [{ startTime: "asc" }, { providerId: "asc" }],
        include: {
          provider: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              credentials: true,
            },
          },
          appointment: {
            include: {
              service: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
      db.provider.findMany({
        where: {
          clinicId,
          status: "ACTIVE",
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          credentials: true,
        },
        orderBy: { firstName: "asc" },
      }),
    ]);

    // Group slots by hour (7am = 7, ..., 18:30 = 18)
    const slotsByHour: Record<number, typeof slots> = {};
    for (let h = 7; h <= 18; h++) {
      slotsByHour[h] = [];
    }
    for (const slot of slots) {
      const hour = slot.startTime.getHours();
      if (hour >= 7 && hour <= 18) {
        slotsByHour[hour].push(slot);
      }
    }

    // Summary stats
    const totalSlots = slots.length;
    const bookedSlots = slots.filter(
      (s) =>
        s.status === "BOOKED" ||
        s.status === "BOOKED_EXTERNALLY"
    ).length;
    const availableSlots = slots.filter(
      (s) => s.status === "AVAILABLE"
    ).length;
    const blockedSlots = slots.filter(
      (s) => s.status === "BLOCKED"
    ).length;

    // Checked-in count
    const checkedInSlots = slots.filter(
      (s) => s.appointment?.status === "CHECKED_IN"
    ).length;

    return NextResponse.json({
      date: dateStr,
      formattedDate: format(targetDate, "EEEE, MMMM d, yyyy"),
      isToday:
        format(targetDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"),
      providers,
      slots,
      slotsByHour,
      summary: {
        total: totalSlots,
        booked: bookedSlots,
        available: availableSlots,
        blocked: blockedSlots,
        checkedIn: checkedInSlots,
      },
    });
  } catch (error) {
    console.error("[STAFF_CALENDAR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}