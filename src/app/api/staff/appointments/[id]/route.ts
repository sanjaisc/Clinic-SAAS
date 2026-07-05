import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  APPOINTMENT_STATUS,
  SLOT_STATUS,
  APPOINTMENT_TRANSITIONS,
  canTransitionTo,
  isValidAppointmentStatus,
  type AppointmentStatus,
} from "@/lib/enums";
import { AUDIT_ACTIONS } from "@/lib/constants";
import { createAuditLog } from "@/lib/audit";

// =============================================================================
// GET — Single appointment with full details
// =============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const appointment = await db.appointment.findUnique({
      where: { id },
      include: {
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            credentials: true,
            videoVisitLink: true,
          },
        },
        service: { select: { id: true, name: true, durationMinutes: true } },
        specialty: { select: { id: true, name: true } },
        slot: { select: { id: true, modality: true, status: true, startTime: true, endTime: true } },
        insurance: { select: { id: true, name: true, isDemo: true } },
        clinic: { select: { id: true, name: true, phoneNumber: true } },
        ledger: true,
        tokens: {
          select: { id: true, purpose: true, createdAt: true, expiresAt: true, consumedAt: true },
          orderBy: { createdAt: "desc" },
        },
        notes: {
          include: {
            author: { select: { id: true, name: true, role: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Check clinic access
    if (
      session.user.role !== "SYSTEM_MANAGER" &&
      session.user.clinicId &&
      appointment.clinicId !== session.user.clinicId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Compute valid transitions
    const currentStatus = appointment.status as AppointmentStatus;
    const validTransitions = APPOINTMENT_TRANSITIONS[currentStatus] || [];

    return NextResponse.json({
      ...appointment,
      validTransitions,
    });
  } catch (error) {
    console.error("[STAFF_APPOINTMENT_DETAIL]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH — Update appointment status (state machine)
// =============================================================================

interface PatchBody {
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

    const { id } = await params;
    const userId = session.user.id;

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

    if (!body.status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    const newStatus = body.status as AppointmentStatus;

    // Validate it's a real appointment status
    if (!isValidAppointmentStatus(newStatus)) {
      return NextResponse.json(
        { error: `Invalid status: ${newStatus}` },
        { status: 400 }
      );
    }

    // Only allow these transitions via this endpoint
    const allowedStatuses: AppointmentStatus[] = [
      APPOINTMENT_STATUS.CHECKED_IN,
      APPOINTMENT_STATUS.COMPLETED,
      APPOINTMENT_STATUS.CANCELLED,
      APPOINTMENT_STATUS.NO_SHOW,
    ];
    if (!allowedStatuses.includes(newStatus)) {
      return NextResponse.json(
        { error: `Cannot transition to ${newStatus} via this endpoint` },
        { status: 400 }
      );
    }

    // Fetch current appointment
    const appointment = await db.appointment.findUnique({
      where: { id },
      include: { slot: true },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Check clinic access
    if (
      session.user.role !== "SYSTEM_MANAGER" &&
      session.user.clinicId &&
      appointment.clinicId !== session.user.clinicId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate state machine transition
    const currentStatus = appointment.status as AppointmentStatus;
    if (!canTransitionTo(currentStatus, newStatus)) {
      return NextResponse.json(
        {
          error: `Cannot transition from ${currentStatus} to ${newStatus}`,
          validTransitions: APPOINTMENT_TRANSITIONS[currentStatus] || [],
        },
        { status: 409 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      status: newStatus,
    };

    // Cancellation-specific fields
    if (newStatus === APPOINTMENT_STATUS.CANCELLED) {
      updateData.cancellationReason = body.cancellationReason || "CLINIC_CANCELLED";
      updateData.cancelledAt = new Date();
      updateData.cancelledBy = userId;
    }

    // Perform the update
    const updated = await db.appointment.update({
      where: { id },
      data: updateData,
      include: {
        provider: {
          select: { id: true, firstName: true, lastName: true, credentials: true },
        },
        service: { select: { id: true, name: true } },
        slot: { select: { id: true, modality: true, status: true } },
        insurance: { select: { id: true, name: true, isDemo: true } },
      },
    });

    // Release slot on cancellation
    if (newStatus === APPOINTMENT_STATUS.CANCELLED) {
      await db.slot.update({
        where: { id: appointment.slotId },
        data: { status: SLOT_STATUS.AVAILABLE },
      });
    }

    // Audit log
    const auditActionMap: Record<string, string> = {
      [APPOINTMENT_STATUS.CHECKED_IN]: AUDIT_ACTIONS.BOOKING_CHECKED_IN,
      [APPOINTMENT_STATUS.COMPLETED]: AUDIT_ACTIONS.BOOKING_COMPLETED,
      [APPOINTMENT_STATUS.CANCELLED]: AUDIT_ACTIONS.BOOKING_CANCELLED,
      [APPOINTMENT_STATUS.NO_SHOW]: AUDIT_ACTIONS.BOOKING_NO_SHOW,
    };

    createAuditLog({
      userId,
      action: auditActionMap[newStatus] || "STATUS_CHANGED",
      targetType: "APPOINTMENT",
      targetId: id,
      appointmentId: id,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[STAFF_APPOINTMENT_UPDATE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}