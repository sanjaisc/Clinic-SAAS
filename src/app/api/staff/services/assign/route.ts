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
    const { providerId, serviceId } = body;

    if (!providerId || !serviceId) {
      return NextResponse.json(
        { error: "providerId and serviceId are required" },
        { status: 400 }
      );
    }

    // Verify the provider belongs to this clinic
    const provider = await db.provider.findFirst({
      where: { id: providerId, clinicId },
      select: { id: true },
    });

    if (!provider) {
      return NextResponse.json({ error: "Provider not found or not in your clinic" }, { status: 404 });
    }

    // Verify the service exists
    const service = await db.service.findUnique({
      where: { id: serviceId },
      select: { id: true, name: true },
    });

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // Check if already assigned
    const existing = await db.providerService.findUnique({
      where: {
        providerId_serviceId: { providerId, serviceId },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Service already assigned to this provider" }, { status: 409 });
    }

    await db.providerService.create({
      data: { providerId, serviceId },
    });

    // Invalidate caches
    cache.deleteByPrefix(`staff:services:${clinicId}`);
    cache.deleteByPrefix(`staff:financial:${clinicId}`);

    await createAuditLog({
      userId: session.user.id,
      action: AUDIT_ACTIONS.PROVIDER_UPDATED,
      targetType: "ProviderService",
      targetId: providerId,
    });

    return NextResponse.json({
      success: true,
      message: `Assigned "${service.name}" to provider`,
    });
  } catch (error) {
    console.error("[STAFF_SERVICES_ASSIGN_POST]", error);
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
    const { providerId, serviceId } = body;

    if (!providerId || !serviceId) {
      return NextResponse.json(
        { error: "providerId and serviceId are required" },
        { status: 400 }
      );
    }

    // Verify the provider belongs to this clinic
    const provider = await db.provider.findFirst({
      where: { id: providerId, clinicId },
      select: { id: true },
    });

    if (!provider) {
      return NextResponse.json({ error: "Provider not found or not in your clinic" }, { status: 404 });
    }

    const existing = await db.providerService.findUnique({
      where: {
        providerId_serviceId: { providerId, serviceId },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    await db.providerService.delete({
      where: { id: existing.id },
    });

    // Invalidate caches
    cache.deleteByPrefix(`staff:services:${clinicId}`);
    cache.deleteByPrefix(`staff:financial:${clinicId}`);

    await createAuditLog({
      userId: session.user.id,
      action: AUDIT_ACTIONS.PROVIDER_UPDATED,
      targetType: "ProviderService",
      targetId: providerId,
    });

    return NextResponse.json({ success: true, message: "Service removed from provider" });
  } catch (error) {
    console.error("[STAFF_SERVICES_ASSIGN_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}