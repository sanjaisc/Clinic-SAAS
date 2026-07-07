import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { cache, CacheKeys, CacheTTL } from "@/lib/cache";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinicId =
      request.nextUrl.searchParams.get("clinicId") || session.user.clinicId;
    if (!clinicId) {
      return NextResponse.json({ error: "No clinic specified" }, { status: 400 });
    }

    if (
      session.user.role !== "SYSTEM_MANAGER" &&
      session.user.clinicId &&
      clinicId !== session.user.clinicId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const clinic = await db.clinic.findUnique({
      where: { id: clinicId },
      select: {
        emailFromName: true,
        customEmailHeader: true,
        commonInstructions: true,
        intakeReminderDays: true,
        intakeFormIds: true,
      },
    });

    if (!clinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    const emailTemplates = await db.emailTemplate.findMany({
      where: { clinicId },
      orderBy: { type: "asc" },
    });

    // Get available services for form mapping
    const availableServices = await db.service.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });

    let intakeFormIds: Record<string, string> = {};
    if (clinic.intakeFormIds) {
      try {
        intakeFormIds = JSON.parse(clinic.intakeFormIds);
      } catch {
        intakeFormIds = {};
      }
    }

    return NextResponse.json({
      emailFromName: clinic.emailFromName || "",
      customEmailHeader: clinic.customEmailHeader || "",
      commonInstructions: clinic.commonInstructions || "",
      intakeReminderDays: clinic.intakeReminderDays || "3,1",
      intakeFormIds,
      emailTemplates,
      availableServices,
    });
  } catch (error) {
    console.error("[STAFF_COMMUNICATIONS_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinicId =
      request.nextUrl.searchParams.get("clinicId") || session.user.clinicId;
    if (!clinicId) {
      return NextResponse.json({ error: "No clinic specified" }, { status: 400 });
    }

    if (
      session.user.role !== "SYSTEM_MANAGER" &&
      session.user.clinicId &&
      clinicId !== session.user.clinicId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      emailFromName,
      customEmailHeader,
      commonInstructions,
      intakeReminderDays,
      intakeFormIds,
    } = body;

    const updateData: Record<string, unknown> = {};

    if (emailFromName !== undefined) updateData.emailFromName = emailFromName;
    if (customEmailHeader !== undefined)
      updateData.customEmailHeader = customEmailHeader;
    if (commonInstructions !== undefined)
      updateData.commonInstructions = commonInstructions;
    if (intakeReminderDays !== undefined)
      updateData.intakeReminderDays = intakeReminderDays;
    if (intakeFormIds !== undefined) {
      updateData.intakeFormIds = JSON.stringify(intakeFormIds);
    }

    await db.clinic.update({
      where: { id: clinicId },
      data: updateData,
    });

    // Invalidate cache
    cache.deleteByPrefix("clinic:");

    await createAuditLog({
      userId: session.user.id,
      action: AUDIT_ACTIONS.CLINIC_UPDATED,
      targetType: "CLINIC",
      targetId: clinicId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[STAFF_COMMUNICATIONS_PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}