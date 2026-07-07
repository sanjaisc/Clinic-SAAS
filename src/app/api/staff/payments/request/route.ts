import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/constants";
import { sendStaffEmail } from "@/lib/email";

// =============================================================================
// POST /api/staff/payments/request
// Generates a mock payment link and emails it to the patient
// =============================================================================

interface PaymentRequestBody {
  appointmentId: string;
  amountCents: number;
}

export async function POST(request: NextRequest) {
  try {
    // ---- Auth check ----
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const clinicId = session.user.clinicId;
    if (!clinicId) {
      return NextResponse.json(
        { error: "No clinic assigned to this user" },
        { status: 400 }
      );
    }

    // ---- Parse body ----
    let body: PaymentRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    if (!body.appointmentId) {
      return NextResponse.json(
        { error: "Missing required field: appointmentId" },
        { status: 400 }
      );
    }

    if (!body.amountCents || body.amountCents <= 0) {
      return NextResponse.json(
        { error: "amountCents must be a positive number" },
        { status: 400 }
      );
    }

    // ---- Verify appointment belongs to clinic ----
    const appointment = await db.appointment.findUnique({
      where: { id: body.appointmentId },
      select: {
        id: true,
        clinicId: true,
        patientName: true,
        patientEmail: true,
      },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    if (appointment.clinicId !== clinicId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ---- Generate mock payment link ----
    const paymentUrl = `https://checkout.stripe.com/mock-pay/${body.appointmentId}`;

    // ---- Send email to patient ----
    try {
      await sendStaffEmail({
        to: appointment.patientEmail,
        subject: "Payment Request for Your Upcoming Appointment",
        html: `
          <h2>Payment Request</h2>
          <p>Dear ${appointment.patientName},</p>
          <p>A payment of <strong>$${(body.amountCents / 100).toFixed(2)}</strong> is requested for your upcoming appointment.</p>
          <p><a href="${paymentUrl}" style="display:inline-block;padding:12px 24px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Pay Now</a></p>
          <p>If you have any questions, please contact us.</p>
        `,
      });
    } catch (emailErr) {
      console.error("[PAYMENT_REQUEST] Failed to send email:", emailErr);
    }

    // ---- Create ledger entry ----
    await db.appointmentLedger.create({
      data: {
        appointmentId: body.appointmentId,
        type: "BALANCE_PAYMENT",
        amountCents: body.amountCents,
        description: `Payment request: $${(body.amountCents / 100).toFixed(2)}`,
        processedBy: userId,
      },
    });

    // ---- Audit log ----
    createAuditLog({
      userId,
      action: AUDIT_ACTIONS.PAYMENT_REQUEST_SENT,
      targetType: "APPOINTMENT",
      targetId: body.appointmentId,
      appointmentId: body.appointmentId,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({
      success: true,
      paymentUrl,
    });
  } catch (error) {
    console.error("[STAFF_PAYMENT_REQUEST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}