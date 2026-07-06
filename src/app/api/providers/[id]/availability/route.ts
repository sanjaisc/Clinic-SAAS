import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SLOT_STATUS, PUBLIC_PROVIDER_STATUSES } from "@/lib/enums";
import { startOfWeek, endOfWeek, addDays } from "date-fns";

// =============================================================================
// GET — Provider availability grouped by day for a given week
// =============================================================================
// Query params:
//   weekStart  — ISO date string (Monday of the desired week). Defaults to this week.
//   modality   — Optional filter: IN_PERSON | VIDEO
// =============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Provider ID is required", code: "MISSING_ID" },
        { status: 400 }
      );
    }

    // Validate provider exists and is active
    const provider = await db.provider.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        clinicId: true,
        providerServices: {
          select: { serviceId: true, service: { select: { id: true, name: true, specialtyId: true } } },
        },
      },
    });

    if (!provider || !PUBLIC_PROVIDER_STATUSES.includes(provider.status as typeof PUBLIC_PROVIDER_STATUSES[number])) {
      return NextResponse.json(
        { error: "Provider not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Parse query params
    const url = _request.nextUrl;
    const weekStartParam = url.searchParams.get("weekStart");
    const modalityParam = url.searchParams.get("modality");

    // Compute week boundaries (Monday 00:00:00 to Sunday 23:59:59 in local time → UTC)
    const now = new Date();
    let weekStart: Date;
    if (weekStartParam) {
      weekStart = new Date(weekStartParam + "T00:00:00");
      if (isNaN(weekStart.getTime())) {
        return NextResponse.json(
          { error: "Invalid weekStart format. Use YYYY-MM-DD", code: "INVALID_DATE" },
          { status: 400 }
        );
      }
    } else {
      weekStart = startOfWeek(now, { weekStartsOn: 1 });
    }

    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

    // Fetch available slots for the week
    const whereClause: Record<string, unknown> = {
      providerId: id,
      clinicId: provider.clinicId,
      status: SLOT_STATUS.AVAILABLE,
      startTime: { gte: weekStart, lte: weekEnd },
    };

    if (modalityParam && (modalityParam === "IN_PERSON" || modalityParam === "VIDEO")) {
      whereClause.modality = modalityParam;
    }

    const slots = await db.slot.findMany({
      where: whereClause,
      select: {
        id: true,
        startTime: true,
        endTime: true,
        modality: true,
      },
      orderBy: { startTime: "asc" },
    });

    // Group slots by day (using local date string as key)
    const days: Record<string, Array<{
      id: string;
      startTime: string;
      endTime: string;
      modality: string;
      timeLabel: string;
    }>> = {};

    // Initialize all 7 days of the week
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d);
      const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD
      days[dateKey] = [];
    }

    // Populate with slots
    for (const slot of slots) {
      const slotDate = new Date(slot.startTime);
      // Use the slot's local date to key into the days map
      const dateKey = slotDate.toISOString().split("T")[0];
      if (days[dateKey]) {
        const hours = slotDate.getHours();
        const minutes = slotDate.getMinutes();
        const ampm = hours >= 12 ? "PM" : "AM";
        const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        const displayMinutes = minutes === 0 ? "" : `:${minutes.toString().padStart(2, "0")}`;

        days[dateKey].push({
          id: slot.id,
          startTime: slot.startTime.toISOString(),
          endTime: slot.endTime.toISOString(),
          modality: slot.modality,
          timeLabel: `${displayHour}${displayMinutes} ${ampm}`,
        });
      }
    }

    // Build the response with day labels
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const fullDayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const weekDays: Array<{
      date: string;
      dayName: string;
      fullDayName: string;
      monthDay: string;
      isToday: boolean;
      isPast: boolean;
      slots: { id: string; startTime: string; endTime: string; modality: string; timeLabel: string }[];
    }> = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d);
      const dateKey = date.toISOString().split("T")[0];
      const today = new Date();
      const todayKey = today.toISOString().split("T")[0];

      weekDays.push({
        date: dateKey,
        dayName: dayNames[d],
        fullDayName: fullDayNames[d],
        monthDay: `${monthNames[date.getMonth()]} ${date.getDate()}`,
        isToday: dateKey === todayKey,
        isPast: date < new Date(new Date().toDateString()), // before today midnight
        slots: days[dateKey] || [],
      });
    }

    // Find the first available slot to hint the frontend which week has availability
    const firstSlotWhere: Record<string, unknown> = {
      providerId: id,
      clinicId: provider.clinicId,
      status: SLOT_STATUS.AVAILABLE,
      startTime: { gte: now },
    };

    if (modalityParam && (modalityParam === "IN_PERSON" || modalityParam === "VIDEO")) {
      firstSlotWhere.modality = modalityParam;
    }

    const firstSlot = await db.slot.findFirst({
      where: firstSlotWhere,
      select: { startTime: true },
      orderBy: { startTime: "asc" },
    });

    let firstAvailableWeekStart: string | null = null;
    if (firstSlot) {
      const firstSlotMonday = startOfWeek(firstSlot.startTime, { weekStartsOn: 1 });
      firstAvailableWeekStart = firstSlotMonday.toISOString().split("T")[0];
    }

    return NextResponse.json({
      providerId: id,
      weekStart: weekStart.toISOString().split("T")[0],
      weekEnd: weekEnd.toISOString().split("T")[0],
      days: weekDays,
      services: provider.providerServices.map((ps) => ({
        id: ps.service.id,
        name: ps.service.name,
        specialtyId: ps.service.specialtyId,
      })),
      totalSlots: slots.length,
      firstAvailableWeekStart,
    });
  } catch (error) {
    console.error("[PROVIDER_AVAILABILITY] Error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}