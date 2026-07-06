import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { APPOINTMENT_STATUS, SLOT_STATUS } from "@/lib/enums";
import { createAuditLog } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/constants";
import { sendStaffEmail } from "@/lib/email";
import { format } from "date-fns";

// =============================================================================
// POST — Reschedule a BOOKED appointment to a new slot
// Preserves the old appointment as CANCELLED and creates a new one
// =============================================================================

interface RescheduleBody {
  newSlotId: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ---- 1. Auth check ----
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const staffId = session.user.id;
    const staffName = session.user.name || "Unknown Staff";
    const clinicId = session.user.clinicId;
    if (!clinicId) {
      return NextResponse.json(
        { error: "No clinic assigned to this user" },
        { status: 400 }
      );
    }

    const { id: appointmentId } = await params;

    // ---- 2. Parse body ----
    let body: RescheduleBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    if (!body.newSlotId) {
      return NextResponse.json(
        { error: "Missing required field: newSlotId" },
        { status: 400 }
      );
    }

    // ---- 3. Validate appointment ----
    const appointment = await db.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        slot: true,
        tokens: true,
        ledger: true,
      },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    // Check clinic access
    if (appointment.clinicId !== clinicId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check status — only BOOKED can be rescheduled
    if (appointment.status !== APPOINTMENT_STATUS.BOOKED) {
      return NextResponse.json(
        { error: `Cannot reschedule appointment with status: ${appointment.status}` },
        { status: 409 }
      );
    }

    // ---- 4. Validate new slot ----
    const newSlot = await db.slot.findUnique({
      where: { id: body.newSlotId },
      include: {
        provider: {
          include: {
            providerServices: {
              include: {
                service: {
                  select: { specialtyId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!newSlot) {
      return NextResponse.json(
        { error: "New slot not found" },
        { status: 404 }
      );
    }

    if (newSlot.clinicId !== clinicId) {
      return NextResponse.json(
        { error: "Slot does not belong to your clinic" },
        { status: 403 }
      );
    }

    if (newSlot.status !== SLOT_STATUS.AVAILABLE) {
      return NextResponse.json(
        { error: `Slot is no longer available (status: ${newSlot.status})` },
        { status: 409 }
      );
    }

    // ---- 5. Determine new specialtyId from the new slot's provider ----
    const firstProviderService = newSlot.provider.providerServices[0];
    const newSpecialtyId = firstProviderService?.service?.specialtyId || null;

    // Format old/new datetimes for the note
    const oldStart = format(new Date(appointment.startTime), "MMM d, yyyy 'at' h:mm a");
    const newStart = format(new Date(newSlot.startTime), "MMM d, yyyy 'at' h:mm a");
    const noteText = `Rescheduled from ${oldStart} to ${newStart} by ${staffName}`;

    // ---- 6. Atomic transaction ----
    const newAppointment = await db.$transaction(async (tx) => {
      // a. Mark old appointment as CANCELLED with reason RESCHEDULED
      await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: APPOINTMENT_STATUS.CANCELLED,
          cancellationReason: "RESCHEDULED",
          cancelledAt: new Date(),
          cancelledBy: staffId,
        },
      });

      // b. Release old slot back to AVAILABLE
      await tx.slot.update({
        where: { id: appointment.slotId },
        data: { status: SLOT_STATUS.AVAILABLE },
      });

      // c. Create a NEW appointment record copying all fields from the old one
      const created = await tx.appointment.create({
        data: {
          slotId: newSlot.id,
          clinicId: appointment.clinicId,
          providerId: newSlot.providerId,
          specialtyId: newSpecialtyId || appointment.specialtyId,
          serviceId: appointment.serviceId,
          patientName: appointment.patientName,
          patientDob: appointment.patientDob,
          patientPhone: appointment.patientPhone,
          patientEmail: appointment.patientEmail,
          patientType: appointment.patientType,
          guardianName: appointment.guardianName,
          guardianRelation: appointment.guardianRelation,
          reasonForVisit: appointment.reasonForVisit,
          insuranceId: appointment.insuranceId,
          modality: newSlot.modality,
          startTime: newSlot.startTime,
          endTime: newSlot.endTime,
          isDemoInsurance: appointment.isDemoInsurance,
          depositCents: appointment.depositCents,
          selfPayCents: appointment.selfPayCents,
          paymentStatus: appointment.paymentStatus,
          paymentMethod: appointment.paymentMethod,
          status: APPOINTMENT_STATUS.BOOKED,
          insuranceVerified: appointment.insuranceVerified,
          ipHash: appointment.ipHash,
          conversionRanking: appointment.conversionRanking,
        },
        include: {
          provider: {
            select: { id: true, firstName: true, lastName: true, credentials: true },
          },
          service: { select: { id: true, name: true } },
          slot: { select: { id: true, modality: true, status: true, startTime: true, endTime: true } },
          insurance: { select: { id: true, name: true, isDemo: true } },
        },
      });

      // d. Book the new slot
      await tx.slot.update({
        where: { id: newSlot.id },
        data: { status: SLOT_STATUS.BOOKED },
      });

      // e. Add internal note to the NEW appointment
      await tx.internalNote.create({
        data: {
          appointmentId: created.id,
          authorId: staffId,
          content: noteText,
        },
      });

      // f. Invalidate old tokens
      await tx.token.updateMany({
        where: { appointmentId, consumedAt: null },
        data: { consumedAt: new Date() },
      });

      return created;
    });

    // ---- 7. Send email notification ----
    try {
      const providerName = `Dr. ${newSlot.provider.firstName} ${newSlot.provider.lastName}`;
      await sendStaffEmail({
        to: appointment.patientEmail,
        subject: "Your Appointment Has Been Rescheduled",
        html: `
          <h2>Appointment Rescheduled</h2>
          <p>Dear ${appointment.patientName},</p>
          <p>Your appointment has been rescheduled.</p>
          <p><strong>Previous:</strong> ${oldStart}</p>
          <p><strong>New:</strong> ${newStart} with <strong>${providerName}</strong></p>
          <p>If you have any questions, please contact us.</p>
        `,
      });
    } catch (emailErr) {
      console.error("[RESCHEDULE] Failed to send email:", emailErr);
    }

    // ---- 8. Audit log ----
    createAuditLog({
      userId: staffId,
      action: AUDIT_ACTIONS.BOOKING_RESCHEDULED,
      targetType: "APPOINTMENT",
      targetId: newAppointment.id,
      appointmentId: newAppointment.id,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json(newAppointment);
  } catch (error) {
    console.error("[STAFF_APPOINTMENT_RESCHEDULE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}