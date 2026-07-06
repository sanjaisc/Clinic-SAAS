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
import { sendStaffEmail } from "@/lib/email";

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
// PATCH — Update appointment (status transition, contact details, or flags)
// =============================================================================

interface PatchBody {
  status?: string;
  cancellationReason?: string;
  patientName?: string;
  patientEmail?: string;
  patientPhone?: string;
  patientDob?: string;
  videoVisitLink?: string;
  insuranceVerified?: boolean;
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

    // Fetch current appointment (include ledger + tokens for side effects)
    const appointment = await db.appointment.findUnique({
      where: { id },
      include: {
        slot: true,
        ledger: true,
        tokens: true,
        provider: { select: { firstName: true, lastName: true } },
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

    const updateData: Record<string, unknown> = {};

    // ---- Contact detail updates ----
    const hasContactUpdate =
      body.patientName !== undefined ||
      body.patientEmail !== undefined ||
      body.patientPhone !== undefined ||
      body.patientDob !== undefined;

    if (hasContactUpdate) {
      if (body.patientName !== undefined) {
        const trimmed = body.patientName.trim();
        if (!trimmed) {
          return NextResponse.json({ error: "Patient name cannot be empty" }, { status: 400 });
        }
        updateData.patientName = trimmed;
      }
      if (body.patientEmail !== undefined) {
        const trimmed = body.patientEmail.trim();
        if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
          return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
        }
        updateData.patientEmail = trimmed;
      }
      if (body.patientPhone !== undefined) {
        updateData.patientPhone = body.patientPhone.trim();
      }
      if (body.patientDob !== undefined) {
        const dobStr = body.patientDob.trim();
        // Validate YYYY-MM-DD format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dobStr)) {
          return NextResponse.json(
            { error: "Invalid date format. Use YYYY-MM-DD" },
            { status: 400 }
          );
        }
        const parsed = new Date(dobStr + "T00:00:00.000Z");
        if (isNaN(parsed.getTime())) {
          return NextResponse.json(
            { error: "Invalid date. Please provide a valid date." },
            { status: 400 }
          );
        }
        updateData.patientDob = parsed;
      }
    }

    // ---- Video visit link (stored on provider, logged here for reference) ----
    if (body.videoVisitLink !== undefined) {
      // videoVisitLink is on the Provider model; log for now if needed
      console.log(`[VIDEO_LINK_UPDATE] appointment=${id} link=${body.videoVisitLink}`);
    }

    // ---- Insurance verified flag ----
    if (body.insuranceVerified !== undefined) {
      updateData.insuranceVerified = body.insuranceVerified;
    }

    // ---- Status transition (existing logic) ----
    if (body.status) {
      const newStatus = body.status as AppointmentStatus;

      if (!isValidAppointmentStatus(newStatus)) {
        return NextResponse.json({ error: `Invalid status: ${newStatus}` }, { status: 400 });
      }

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

      updateData.status = newStatus;

      if (newStatus === APPOINTMENT_STATUS.CANCELLED) {
        updateData.cancellationReason = body.cancellationReason || "CLINIC_CANCELLED";
        updateData.cancelledAt = new Date();
        updateData.cancelledBy = userId;
      }
    }

    // Nothing to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
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

    // ---- Side effects for status transitions ----

    // Release slot on cancellation
    if (body.status === APPOINTMENT_STATUS.CANCELLED) {
      await db.slot.update({
        where: { id: appointment.slotId },
        data: { status: SLOT_STATUS.AVAILABLE },
      });

      // Invalidate all active tokens
      await db.token.updateMany({
        where: { appointmentId: id, consumedAt: null },
        data: { consumedAt: new Date() },
      });

      // Refund deposit if DEPOSIT_AUTH exists and is AUTHORIZED
      if (appointment.ledger && appointment.ledger.type === "DEPOSIT_AUTH" && appointment.paymentStatus === "AUTHORIZED") {
        const refundAmount = appointment.ledger.amountCents;
        // Create REFUND ledger entry
        await db.appointmentLedger.create({
          data: {
            appointmentId: id,
            type: "REFUND",
            amountCents: refundAmount,
            description: `Refund for cancelled appointment`,
            processedBy: userId,
          },
        });
        // Update appointment payment status to REFUNDED
        await db.appointment.update({
          where: { id },
          data: { paymentStatus: "REFUNDED" },
        });

        createAuditLog({
          userId,
          action: AUDIT_ACTIONS.REFUND_COMPLETED,
          targetType: "APPOINTMENT",
          targetId: id,
          appointmentId: id,
          ipAddress: request.headers.get("x-forwarded-for") || undefined,
        });
      }
    }

    // COMPLETED — send review email
    if (body.status === APPOINTMENT_STATUS.COMPLETED) {
      try {
        const providerName = `Dr. ${appointment.provider.firstName} ${appointment.provider.lastName}`;
        const startTimeFormatted = new Date(appointment.startTime).toLocaleString();
        await sendStaffEmail({
          to: appointment.patientEmail,
          subject: "Your Appointment Review",
          html: `
            <h2>Thank you for your visit!</h2>
            <p>Dear ${appointment.patientName},</p>
            <p>Your appointment with <strong>${providerName}</strong> on <strong>${startTimeFormatted}</strong> has been completed.</p>
            <p>We'd love to hear about your experience. Please take a moment to leave a review:</p>
            <p><a href="#" style="display:inline-block;padding:12px 24px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Leave a Review</a></p>
            <p>Thank you for choosing us!</p>
          `,
        });
      } catch (emailErr) {
        console.error("[STAFF_APPOINTMENT_UPDATE] Failed to send review email:", emailErr);
      }
    }

    // NO_SHOW — capture deposit and invalidate tokens
    if (body.status === APPOINTMENT_STATUS.NO_SHOW) {
      // Invalidate all active tokens
      await db.token.updateMany({
        where: { appointmentId: id, consumedAt: null },
        data: { consumedAt: new Date() },
      });

      // Capture deposit if DEPOSIT_AUTH exists and is AUTHORIZED
      if (appointment.ledger && appointment.ledger.type === "DEPOSIT_AUTH" && appointment.paymentStatus === "AUTHORIZED") {
        const captureAmount = appointment.ledger.amountCents;
        // Create DEPOSIT_CAPTURE ledger entry
        await db.appointmentLedger.create({
          data: {
            appointmentId: id,
            type: "DEPOSIT_CAPTURE",
            amountCents: captureAmount,
            description: `Deposit captured for no-show appointment`,
            processedBy: userId,
          },
        });
        // Update appointment payment status to CAPTURED
        await db.appointment.update({
          where: { id },
          data: { paymentStatus: "CAPTURED" },
        });

        createAuditLog({
          userId,
          action: AUDIT_ACTIONS.DEPOSIT_CAPTURED,
          targetType: "APPOINTMENT",
          targetId: id,
          appointmentId: id,
          ipAddress: request.headers.get("x-forwarded-for") || undefined,
        });
      }
    }

    // Audit log
    let auditAction = "APPOINTMENT_UPDATED";
    if (body.status) {
      const auditActionMap: Record<string, string> = {
        [APPOINTMENT_STATUS.CHECKED_IN]: AUDIT_ACTIONS.BOOKING_CHECKED_IN,
        [APPOINTMENT_STATUS.COMPLETED]: AUDIT_ACTIONS.BOOKING_COMPLETED,
        [APPOINTMENT_STATUS.CANCELLED]: AUDIT_ACTIONS.BOOKING_CANCELLED,
        [APPOINTMENT_STATUS.NO_SHOW]: AUDIT_ACTIONS.BOOKING_NO_SHOW,
      };
      auditAction = auditActionMap[body.status] || "STATUS_CHANGED";
    } else if (hasContactUpdate) {
      auditAction = "PATIENT_DETAILS_EDITED";
    } else if (body.insuranceVerified !== undefined) {
      auditAction = "INSURANCE_VERIFIED_TOGGLED";
    }

    createAuditLog({
      userId,
      action: auditAction,
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