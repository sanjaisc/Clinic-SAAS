import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  SLOT_STATUS,
  AUDIT_ACTIONS,
  isValidSlotStatus,
} from "@/lib/enums";
import { createAuditLog } from "@/lib/audit";
import { parseISO, startOfDay, endOfDay } from "date-fns";

// =============================================================================
// GET — List slots for a provider on a date range
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinicId = session.user.clinicId;
    const role = session.user.role;

    // System managers must specify a clinic
    const targetClinicId =
      request.nextUrl.searchParams.get("clinicId") || clinicId;
    if (!targetClinicId) {
      return NextResponse.json(
        { error: "No clinic specified" },
        { status: 400 }
      );
    }

    if (role !== "SYSTEM_MANAGER" && clinicId && targetClinicId !== clinicId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const providerId = searchParams.get("providerId");
    const dateFromParam = searchParams.get("dateFrom");
    const dateToParam = searchParams.get("dateTo");
    const statusParam = searchParams.get("status");

    if (!providerId) {
      return NextResponse.json(
        { error: "providerId is required" },
        { status: 400 }
      );
    }

    if (!dateFromParam || !dateToParam) {
      return NextResponse.json(
        { error: "dateFrom and dateTo are required" },
        { status: 400 }
      );
    }

    // Build where clause
    const where: Record<string, unknown> = {
      clinicId: targetClinicId,
      providerId,
      startTime: {
        gte: startOfDay(parseISO(dateFromParam)),
        lte: endOfDay(parseISO(dateToParam)),
      },
    };

    if (statusParam) {
      const statuses = statusParam
        .split(",")
        .map((s) => s.trim())
        .filter((s) => isValidSlotStatus(s));
      if (statuses.length > 0) {
        where.status = { in: statuses };
      }
    }

    const slots = await db.slot.findMany({
      where,
      orderBy: { startTime: "asc" },
      include: {
        provider: {
          select: { id: true, firstName: true, lastName: true, credentials: true },
        },
        appointment: {
          select: { id: true, patientName: true, status: true },
        },
      },
    });

    return NextResponse.json(slots);
  } catch (error) {
    console.error("[STAFF_SLOTS_LIST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH — Block/Unblock/Mark externally booked
// =============================================================================

interface PatchBody {
  slotIds: string[];
  action: "BLOCK" | "UNBLOCK" | "BOOKED_EXTERNALLY";
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const clinicId = session.user.clinicId;
    const role = session.user.role;

    const targetClinicId =
      request.nextUrl.searchParams.get("clinicId") || clinicId;
    if (!targetClinicId) {
      return NextResponse.json(
        { error: "No clinic specified" },
        { status: 400 }
      );
    }

    if (role !== "SYSTEM_MANAGER" && clinicId && targetClinicId !== clinicId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse body
    let body: PatchBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    if (!body.slotIds || !Array.isArray(body.slotIds) || body.slotIds.length === 0) {
      return NextResponse.json(
        { error: "slotIds must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!["BLOCK", "UNBLOCK", "BOOKED_EXTERNALLY"].includes(body.action)) {
      return NextResponse.json(
        { error: 'action must be "BLOCK", "UNBLOCK", or "BOOKED_EXTERNALLY"' },
        { status: 400 }
      );
    }

    // Determine the target status and validation
    let targetStatus: string;
    let allowedFrom: string[];

    switch (body.action) {
      case "BLOCK":
        targetStatus = SLOT_STATUS.BLOCKED;
        allowedFrom = [SLOT_STATUS.AVAILABLE];
        break;
      case "UNBLOCK":
        targetStatus = SLOT_STATUS.AVAILABLE;
        allowedFrom = [SLOT_STATUS.BLOCKED];
        break;
      case "BOOKED_EXTERNALLY":
        targetStatus = SLOT_STATUS.BOOKED_EXTERNALLY;
        allowedFrom = [SLOT_STATUS.AVAILABLE, SLOT_STATUS.BLOCKED];
        break;
    }

    // Validate slots belong to this clinic and have correct current status
    const slots = await db.slot.findMany({
      where: {
        id: { in: body.slotIds },
        clinicId: targetClinicId,
      },
    });

    const validSlotIds: string[] = [];
    const skipped: { id: string; reason: string }[] = [];

    for (const slot of slots) {
      if (!allowedFrom.includes(slot.status)) {
        skipped.push({
          id: slot.id,
          reason: `Cannot transition from ${slot.status}`,
        });
        continue;
      }
      validSlotIds.push(slot.id);
    }

    // Batch update
    let updatedCount = 0;
    if (validSlotIds.length > 0) {
      const result = await db.slot.updateMany({
        where: { id: { in: validSlotIds } },
        data: { status: targetStatus },
      });
      updatedCount = result.count;

      // Audit logs (fire-and-forget)
      const auditAction =
        body.action === "BLOCK"
          ? AUDIT_ACTIONS.SLOT_BLOCKED
          : body.action === "UNBLOCK"
            ? AUDIT_ACTIONS.SLOT_UNBLOCKED
            : AUDIT_ACTIONS.SLOT_BOOKED_EXTERNALLY;

      for (const slotId of validSlotIds) {
        createAuditLog({
          userId,
          action: auditAction,
          targetType: "SLOT",
          targetId: slotId,
          ipAddress: request.headers.get("x-forwarded-for") || undefined,
        });
      }
    }

    return NextResponse.json({
      updatedCount,
      skipped,
    });
  } catch (error) {
    console.error("[STAFF_SLOTS_UPDATE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}