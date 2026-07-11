import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { cache } from "@/lib/cache";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinicId = session.user.clinicId;
    if (!clinicId) {
      return NextResponse.json({ error: "No clinic context" }, { status: 400 });
    }

    const body = await request.json();
    const { serviceId, clinicPriceCents } = body;

    if (!serviceId) {
      return NextResponse.json({ error: "serviceId is required" }, { status: 400 });
    }

    if (typeof clinicPriceCents !== "number" || clinicPriceCents < 0) {
      return NextResponse.json(
        { error: "clinicPriceCents must be a non-negative number" },
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

    // Upsert the clinic-specific price
    const cs = await db.clinicService.upsert({
      where: { clinicId_serviceId: { clinicId, serviceId } },
      create: {
        clinicId,
        serviceId,
        clinicPriceCents: Math.round(clinicPriceCents),
      },
      update: {
        clinicPriceCents: Math.round(clinicPriceCents),
      },
    });

    // Invalidate caches
    cache.deleteByPrefix(`staff:services:${clinicId}`);
    cache.deleteByPrefix(`staff:financial:${clinicId}`);

    await createAuditLog({
      userId: session.user.id,
      action: AUDIT_ACTIONS.CLINIC_UPDATED,
      targetType: "ClinicService",
      targetId: cs.id,
    });

    return NextResponse.json({
      success: true,
      serviceId,
      clinicPriceCents: cs.clinicPriceCents,
    });
  } catch (error) {
    console.error("[STAFF_CLINIC_SERVICE_PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}