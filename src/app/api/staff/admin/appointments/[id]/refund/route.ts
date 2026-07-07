import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STAFF_ROLE, PAYMENT_STATUS } from "@/lib/enums";
import { createAuditLog } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/constants";

// =============================================================================
// POST /api/staff/admin/appointments/[id]/refund — Manual refund override (E4)
// SYSTEM_MANAGER can refund any appointment. No clinicId check.
// Takes: amountCents, reason
// Creates a refund ledger entry.
// =============================================================================

interface RefundBody {
  amountCents: number;
  reason: string;
}

export async function POST(
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
    let body: RefundBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    if (typeof body.amountCents !== "number" || body.amountCents < 0) {
      return NextResponse.json(
        { error: "amountCents must be a non-negative number" },
        { status: 400 }
      );
    }

    if (!body.reason || typeof body.reason !== "string" || body.reason.trim().length === 0) {
      return NextResponse.json(
        { error: "reason is required" },
        { status: 400 }
      );
    }

    // Find the appointment — no clinic scope check
    const appointment = await db.appointment.findUnique({
      where: { id },
      select: {
        id: true,
        paymentStatus: true,
        depositCents: true,
      },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    // Check payment status — can only refund from AUTHORIZED, CAPTURED, or even
    // PENDING (admin override)
    if (appointment.paymentStatus === PAYMENT_STATUS.REFUNDED) {
      return NextResponse.json(
        { error: "Appointment already refunded" },
        { status: 409 }
      );
    }

    // Update appointment payment status
    await db.appointment.update({
      where: { id },
      data: {
        paymentStatus: PAYMENT_STATUS.REFUNDED,
        updatedAt: new Date(),
      },
    });

    // Create refund ledger entry
    const ledger = await db.appointmentLedger.create({
      data: {
        appointmentId: id,
        type: "REFUND",
        amountCents: body.amountCents,
        refundStatus: "REFUNDED",
        description: `Admin manual refund: ${body.reason}`,
        processedBy: user.id,
      },
    });

    // Audit log
    createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.REFUND_COMPLETED,
      targetType: "APPOINTMENT",
      targetId: id,
      appointmentId: id,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({
      success: true,
      refundAmountCents: body.amountCents,
      ledger,
    });
  } catch (error) {
    console.error("[ADMIN_APPOINTMENT_REFUND]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}