import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { cache } from "@/lib/cache";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";

export async function POST(request: NextRequest) {
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
    const { serviceId, insuranceId, copayCents } = body;

    if (!serviceId || !insuranceId) {
      return NextResponse.json(
        { error: "serviceId and insuranceId are required" },
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

    // Verify the insurance exists and this clinic accepts it
    const clinicInsurance = await db.clinicInsurance.findUnique({
      where: { clinicId_insuranceId: { clinicId, insuranceId } },
    });
    if (!clinicInsurance) {
      return NextResponse.json(
        { error: "Insurance not accepted by your clinic. Add it in Insurance management first." },
        { status: 404 }
      );
    }

    // Upsert: create or update
    const si = await db.serviceInsurance.upsert({
      where: { serviceId_insuranceId: { serviceId, insuranceId } },
      create: {
        serviceId,
        insuranceId,
        copayCents: typeof copayCents === "number" ? Math.round(copayCents) : 0,
        isActive: true,
      },
      update: {
        copayCents: typeof copayCents === "number" ? Math.round(copayCents) : 0,
        isActive: true,
      },
    });

    // Invalidate caches
    cache.deleteByPrefix(`staff:services:${clinicId}`);
    cache.deleteByPrefix(`staff:service-insurances:${clinicId}`);
    cache.deleteByPrefix(`staff:financial:${clinicId}`);

    await createAuditLog({
      userId: session.user.id,
      action: AUDIT_ACTIONS.CLINIC_UPDATED,
      targetType: "ServiceInsurance",
      targetId: si.id,
    });

    return NextResponse.json({
      success: true,
      id: si.id,
      serviceId,
      insuranceId,
      copayCents: si.copayCents,
    });
  } catch (error) {
    console.error("[STAFF_SERVICE_INSURANCES_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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
    const { serviceId, insuranceId } = body;

    if (!serviceId || !insuranceId) {
      return NextResponse.json(
        { error: "serviceId and insuranceId are required" },
        { status: 400 }
      );
    }

    const existing = await db.serviceInsurance.findUnique({
      where: { serviceId_insuranceId: { serviceId, insuranceId } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Service-insurance link not found" }, { status: 404 });
    }

    await db.serviceInsurance.delete({
      where: { id: existing.id },
    });

    // Invalidate caches
    cache.deleteByPrefix(`staff:services:${clinicId}`);
    cache.deleteByPrefix(`staff:service-insurances:${clinicId}`);
    cache.deleteByPrefix(`staff:financial:${clinicId}`);

    await createAuditLog({
      userId: session.user.id,
      action: AUDIT_ACTIONS.CLINIC_UPDATED,
      targetType: "ServiceInsurance",
      targetId: existing.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[STAFF_SERVICE_INSURANCES_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}