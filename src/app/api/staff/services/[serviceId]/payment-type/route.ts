import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { SELF_PAY_PAYMENT_TYPE } from "@/lib/enums";
import { cache } from "@/lib/cache";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";

type RouteContext = {
  params: Promise<{ serviceId: string }>;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinicId = session.user.clinicId;
    if (!clinicId) {
      return NextResponse.json({ error: "No clinic context" }, { status: 400 });
    }

    const { serviceId } = await context.params;

    const body = await request.json();
    const { selfPayPaymentType } = body;

    const validTypes = Object.values(SELF_PAY_PAYMENT_TYPE);
    if (!selfPayPaymentType || !validTypes.includes(selfPayPaymentType)) {
      return NextResponse.json(
        { error: `selfPayPaymentType must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify the service exists
    const service = await db.service.findUnique({
      where: { id: serviceId },
      select: { id: true, name: true },
    });

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    await db.service.update({
      where: { id: serviceId },
      data: { selfPayPaymentType },
    });

    // Invalidate caches
    cache.deleteByPrefix(`staff:services:${clinicId}`);
    cache.deleteByPrefix(`staff:financial:${clinicId}`);

    await createAuditLog({
      userId: session.user.id,
      action: AUDIT_ACTIONS.CLINIC_UPDATED,
      targetType: "Service",
      targetId: serviceId,
    });

    return NextResponse.json({
      success: true,
      serviceId,
      selfPayPaymentType,
    });
  } catch (error) {
    console.error("[STAFF_SERVICES_PAYMENT_TYPE_PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}