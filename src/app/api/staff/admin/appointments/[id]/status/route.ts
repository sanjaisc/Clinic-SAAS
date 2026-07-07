import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STAFF_ROLE, APPOINTMENT_STATUS, isValidAppointmentStatus } from "@/lib/enums";
import { createAuditLog } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/constants";

// =============================================================================
// PATCH /api/staff/admin/appointments/[id]/status — Manual status override (E4)
// SYSTEM_MANAGER can override any appointment's status regardless of clinic scope.
// Takes: status, cancellationReason?
// Sets cancelledBy: session.user.id or "SYSTEM"
// =============================================================================

interface StatusUpdateBody {
  status: string;
  cancellationReason?: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    if (user.role !== STAFF_ROLE.SYSTEM_MANAGER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Parse body
    let body: StatusUpdateBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    if (!body.status || !isValidAppointmentStatus(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${APPOINTMENT_STATUS.BOOKED}, ${APPOINTMENT_STATUS.CHECKED_IN}, ${APPOINTMENT_STATUS.COMPLETED}, ${APPOINTMENT_STATUS.ARCHIVED}, ${APPOINTMENT_STATUS.CANCELLED}, ${APPOINTMENT_STATUS.NO_SHOW}` },
        { status: 400 }
      );
    }

    // Find the appointment — no clinic scope check
    const appointment = await db.appointment.findUnique({
      where: { id },
      include: {
        slot: { select: { id: true, status: true } },
      },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    const oldStatus = appointment.status;
    const newStatus = body.status;

    // Build update data
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updatedAt: new Date(),
    };

    // Handle cancellation-specific fields
    if (newStatus === APPOINTMENT_STATUS.CANCELLED) {
      updateData.cancellationReason = body.cancellationReason || "CLINIC_CANCELLED";
      updateData.cancelledAt = new Date();
      updateData.cancelledBy = user.id;
    }

    // Handle NO_SHOW
    if (newStatus === APPOINTMENT_STATUS.NO_SHOW) {
      updateData.cancellationReason = "NO_SHOW";
      updateData.cancelledAt = new Date();
      updateData.cancelledBy = user.id;
    }

    // If cancelling or no-show, release the slot
    if (
      (newStatus === APPOINTMENT_STATUS.CANCELLED || newStatus === APPOINTMENT_STATUS.NO_SHOW) &&
      appointment.slot
    ) {
      await db.slot.update({
        where: { id: appointment.slot.id },
        data: { status: "AVAILABLE" },
      });
    }

    const updated = await db.appointment.update({
      where: { id },
      data: updateData,
      include: {
        clinic: { select: { id: true, name: true } },
        provider: {
          select: { id: true, firstName: true, lastName: true, credentials: true },
        },
        service: { select: { id: true, name: true } },
        slot: { select: { id: true, modality: true, status: true } },
      },
    });

    // Audit log
    let auditAction = "ADMIN_STATUS_OVERRIDE";
    if (newStatus === APPOINTMENT_STATUS.CANCELLED) auditAction = AUDIT_ACTIONS.BOOKING_CANCELLED;
    else if (newStatus === APPOINTMENT_STATUS.NO_SHOW) auditAction = AUDIT_ACTIONS.BOOKING_NO_SHOW;
    else if (newStatus === APPOINTMENT_STATUS.COMPLETED) auditAction = AUDIT_ACTIONS.BOOKING_COMPLETED;
    else if (newStatus === APPOINTMENT_STATUS.CHECKED_IN) auditAction = AUDIT_ACTIONS.BOOKING_CHECKED_IN;

    createAuditLog({
      userId: user.id,
      action: auditAction,
      targetType: "APPOINTMENT",
      targetId: id,
      appointmentId: id,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({
      data: updated,
      previousStatus: oldStatus,
    });
  } catch (error) {
    console.error("[ADMIN_APPOINTMENT_STATUS_OVERRIDE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}