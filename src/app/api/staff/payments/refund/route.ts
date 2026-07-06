import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/constants";

// =============================================================================
// POST /api/staff/payments/refund
// Manually refund a deposit for an appointment
// =============================================================================

interface RefundRequestBody {
  appointmentId: string;
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
    let body: RefundRequestBody;
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

    // ---- Verify appointment belongs to clinic ----
    const appointment = await db.appointment.findUnique({
      where: { id: body.appointmentId },
      select: {
        id: true,
        clinicId: true,
        paymentStatus: true,
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

    // ---- Find the DEPOSIT_AUTH ledger for this appointment ----
    const ledger = await db.appointmentLedger.findUnique({
      where: { appointmentId: body.appointmentId },
    });

    if (!ledger) {
      return NextResponse.json(
        { error: "No ledger entry found for this appointment" },
        { status: 404 }
      );
    }

    if (ledger.type !== "DEPOSIT_AUTH") {
      return NextResponse.json(
        { error: "Ledger entry is not a deposit authorization" },
        { status: 400 }
      );
    }

    if (!["AUTHORIZED", "CAPTURED"].includes(appointment.paymentStatus)) {
      return NextResponse.json(
        { error: `Cannot refund appointment with payment status: ${appointment.paymentStatus}` },
        { status: 409 }
      );
    }

    const refundAmountCents = ledger.amountCents;

    // ---- Process mock refund ----
    await db.appointment.update({
      where: { id: body.appointmentId },
      data: { paymentStatus: "REFUNDED" },
    });

    // Create a new REFUND ledger entry
    await db.appointmentLedger.create({
      data: {
        appointmentId: body.appointmentId,
        type: "REFUND",
        amountCents: refundAmountCents,
        description: `Manual refund processed by staff (originally ${ledger.type})`,
        processedBy: userId,
      },
    });

    // ---- Audit log ----
    createAuditLog({
      userId,
      action: AUDIT_ACTIONS.REFUND_COMPLETED,
      targetType: "APPOINTMENT",
      targetId: body.appointmentId,
      appointmentId: body.appointmentId,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({
      success: true,
      refundAmountCents,
    });
  } catch (error) {
    console.error("[STAFF_PAYMENT_REFUND]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}