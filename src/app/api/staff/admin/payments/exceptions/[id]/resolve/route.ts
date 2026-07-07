import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STAFF_ROLE } from "@/lib/enums";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";

type RouteParams = { params: Promise<{ id: string }> };

// ─── PATCH /api/staff/admin/payments/exceptions/[id]/resolve ───────────────
// id is the composite key: "LEDGER_xxx" or "APPT_xxx"
// Body: { note?: string }

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
    const body = await request.json();
    const note = body.note as string | undefined;

    if (!id.startsWith("LEDGER_") && !id.startsWith("APPT_")) {
      return NextResponse.json({ error: "Invalid exception ID format" }, { status: 400 });
    }

    const prefix = id.split("_")[0];
    const entityId = id.substring(prefix.length + 1);

    if (prefix === "LEDGER") {
      // Resolve a ledger exception — update refundStatus and add note
      const ledger = await db.appointmentLedger.findUnique({
        where: { id: entityId },
        select: { id: true, appointmentId: true, refundStatus: true },
      });

      if (!ledger) {
        return NextResponse.json({ error: "Ledger entry not found" }, { status: 404 });
      }

      const description = note
        ? `[Resolved] ${note}`
        : "[Resolved by system manager]";

      await db.appointmentLedger.update({
        where: { id: entityId },
        data: {
          refundStatus: "REFUNDED",
          description,
          processedBy: user.id,
        },
      });

      await createAuditLog({
        userId: user.id,
        action: AUDIT_ACTIONS.PAYMENT_EXCEPTION_RESOLVED,
        targetType: "APPOINTMENT_LEDGER",
        targetId: entityId,
        appointmentId: ledger.appointmentId,
      });
    } else if (prefix === "APPT") {
      // Resolve an orphaned appointment — update paymentStatus to FORFEITED
      const appointment = await db.appointment.findUnique({
        where: { id: entityId },
        select: { id: true, paymentStatus: true },
      });

      if (!appointment) {
        return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
      }

      if (appointment.paymentStatus !== "PENDING") {
        return NextResponse.json(
          { error: "Appointment is no longer in PENDING state" },
          { status: 400 }
        );
      }

      await db.appointment.update({
        where: { id: entityId },
        data: {
          paymentStatus: "FORFEITED",
        },
      });

      // Also update or create ledger entry
      const existingLedger = await db.appointmentLedger.findUnique({
        where: { appointmentId: entityId },
      });

      if (existingLedger) {
        await db.appointmentLedger.update({
          where: { id: existingLedger.id },
          data: {
            refundStatus: "FORFEITED",
            description: note || "[Orphaned payment forfeited]",
            processedBy: user.id,
          },
        });
      }

      await createAuditLog({
        userId: user.id,
        action: AUDIT_ACTIONS.PAYMENT_EXCEPTION_RESOLVED,
        targetType: "APPOINTMENT",
        targetId: entityId,
        appointmentId: entityId,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADMIN_PAYMENTS_EXCEPTIONS_RESOLVE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}