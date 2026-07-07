import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STAFF_ROLE } from "@/lib/enums";

// ─── GET /api/staff/admin/payments/exceptions?type=...&page=1&limit=20 ─────

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    if (user.role !== STAFF_ROLE.SYSTEM_MANAGER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type"); // REFUND_FAILED | ORPHANED | DISPUTED
    const resolved = searchParams.get("resolved"); // "true" | "false"
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Build the exception list by querying three sources
    const exceptions: Array<{
      id: string;
      type: string;
      appointmentId: string;
      patientName: string;
      clinicName: string;
      amountCents: number;
      createdAt: string;
      resolved: boolean;
      resolvedNote?: string | null;
      ledgerId?: string;
      paymentStatus?: string;
      refundStatus?: string;
    }> = [];

    // 1. Failed Refunds: Ledger entries with refundStatus = "REFUND_FAILED"
    if (!type || type === "REFUND_FAILED") {
      const failedRefunds = await db.appointmentLedger.findMany({
        where: {
          type: "REFUND",
          refundStatus: "REFUND_FAILED",
          ...(resolved === "false" ? { appointment: { paymentStatus: { not: "REFUNDED" } } } : {}),
          ...(resolved === "true" ? { appointment: { paymentStatus: "REFUNDED" } } : {}),
        },
        include: {
          appointment: {
            include: {
              clinic: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      for (const entry of failedRefunds) {
        exceptions.push({
          id: `LEDGER_${entry.id}`,
          type: "REFUND_FAILED",
          appointmentId: entry.appointmentId,
          patientName: entry.appointment.patientName,
          clinicName: entry.appointment.clinic.name,
          amountCents: entry.amountCents,
          createdAt: entry.createdAt.toISOString(),
          resolved: entry.appointment.paymentStatus === "REFUNDED",
          resolvedNote: entry.description,
          ledgerId: entry.id,
          paymentStatus: entry.appointment.paymentStatus,
          refundStatus: entry.refundStatus,
        });
      }
    }

    // 2. Orphaned Payments: Appointments with paymentStatus = "PENDING" created > 30 min ago
    if (!type || type === "ORPHANED") {
      const orphaned = await db.appointment.findMany({
        where: {
          paymentStatus: "PENDING",
          createdAt: { lte: thirtyMinAgo },
          status: { not: "CANCELLED" },
        },
        include: {
          clinic: { select: { name: true } },
          ledger: { select: { id: true, refundStatus: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      for (const appt of orphaned) {
        exceptions.push({
          id: `APPT_${appt.id}`,
          type: "ORPHANED",
          appointmentId: appt.id,
          patientName: appt.patientName,
          clinicName: appt.clinic.name,
          amountCents: appt.depositCents,
          createdAt: appt.createdAt.toISOString(),
          resolved: false,
          ledgerId: appt.ledger?.id,
          paymentStatus: appt.paymentStatus,
          refundStatus: appt.ledger?.refundStatus,
        });
      }
    }

    // 3. Disputed: Ledger entries type="REFUND" with refundStatus="REFUND_PENDING" for > 7 days
    if (!type || type === "DISPUTED") {
      const disputed = await db.appointmentLedger.findMany({
        where: {
          type: "REFUND",
          refundStatus: "REFUND_PENDING",
          createdAt: { lte: sevenDaysAgo },
        },
        include: {
          appointment: {
            include: {
              clinic: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      for (const entry of disputed) {
        exceptions.push({
          id: `LEDGER_${entry.id}`,
          type: "DISPUTED",
          appointmentId: entry.appointmentId,
          patientName: entry.appointment.patientName,
          clinicName: entry.appointment.clinic.name,
          amountCents: entry.amountCents,
          createdAt: entry.createdAt.toISOString(),
          resolved: false,
          resolvedNote: entry.description,
          ledgerId: entry.id,
          paymentStatus: entry.appointment.paymentStatus,
          refundStatus: entry.refundStatus,
        });
      }
    }

    // Sort all exceptions by createdAt desc
    exceptions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = exceptions.length;
    const paged = exceptions.slice(skip, skip + limit);

    return NextResponse.json({
      data: paged,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[ADMIN_PAYMENTS_EXCEPTIONS]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}