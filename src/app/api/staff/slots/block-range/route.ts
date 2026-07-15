import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { parseISO, startOfDay } from "date-fns";

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { providerId, date, startTime, endTime } = body as {
      providerId: string;
      date: string;
      startTime: string;
      endTime: string;
      reason?: string;
    };

    // Validate required fields
    if (!providerId || !date || !startTime || !endTime) {
      return NextResponse.json(
        { error: "providerId, date, startTime, and endTime are required" },
        { status: 400 }
      );
    }

    // Validate date format
    let targetDate: Date;
    try {
      targetDate = parseISO(date);
    } catch {
      return NextResponse.json(
        { error: "Invalid date format, use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // Validate time format (HH:mm) and build range boundaries
    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return NextResponse.json(
        { error: "Invalid time format, use HH:mm" },
        { status: 400 }
      );
    }

    if (startTime >= endTime) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 }
      );
    }

    // Build UTC range for the query
    const dayStart = startOfDay(targetDate);

    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);

    const rangeStart = new Date(dayStart);
    rangeStart.setHours(startH, startM, 0, 0);

    const rangeEnd = new Date(dayStart);
    rangeEnd.setHours(endH, endM, 0, 0);

    // Find all AVAILABLE slots for this provider on this date
    // where the slot overlaps with the requested time range.
    // Overlap: slot.startTime < rangeEnd AND slot.endTime > rangeStart
    // We also constrain slot.startTime >= dayStart to stay within the day.
    // Since Prisma doesn't support OR at the field level, we widen startTime
    // to [dayStart, rangeEnd) and filter endTime separately.
    const slotsToBlock = await db.slot.findMany({
      where: {
        clinicId,
        providerId,
        status: "AVAILABLE",
        startTime: {
          gte: dayStart,
          lt: rangeEnd,
        },
        endTime: {
          gt: rangeStart,
        },
      },
    });

    if (slotsToBlock.length === 0) {
      return NextResponse.json({ blockedCount: 0 });
    }

    // Block all matching slots in a transaction
    const slotIds = slotsToBlock.map((s) => s.id);

    await db.$transaction(async (tx) => {
      // Update all slots to BLOCKED
      await tx.slot.updateMany({
        where: {
          id: { in: slotIds },
        },
        data: {
          status: "BLOCKED",
          updatedAt: new Date(),
        },
      });

      // Create audit log for each blocked slot
      const auditPromises = slotIds.map((slotId) =>
        createAuditLog({
          userId: session.user.id,
          action: AUDIT_ACTIONS.SLOT_BLOCKED,
          targetType: "SLOT",
          targetId: slotId,
          ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
        })
      );
      await Promise.all(auditPromises);
    });

    return NextResponse.json({
      blockedCount: slotIds.length,
    });
  } catch (error) {
    console.error("[STAFF_BLOCK_RANGE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}