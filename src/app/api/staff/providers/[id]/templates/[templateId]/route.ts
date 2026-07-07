import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isValidSlotModality } from "@/lib/enums";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";

type RouteParams = { params: Promise<{ id: string; templateId: string }> };

// ─── PATCH /api/staff/providers/[id]/templates/[templateId] ─────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    const { id: providerId, templateId } = await params;

    if (!user.clinicId) {
      return NextResponse.json({ error: "No clinic context" }, { status: 400 });
    }

    // Validate ownership (provider belongs to this clinic)
    const provider = await db.provider.findFirst({
      where: { id: providerId, clinicId: user.clinicId },
      select: { id: true },
    });

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    // Validate template belongs to this provider
    const existing = await db.slotTemplate.findFirst({
      where: { id: templateId, providerId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.dayOfWeek !== undefined) {
      if (body.dayOfWeek < 0 || body.dayOfWeek > 6) {
        return NextResponse.json({ error: "dayOfWeek must be 0-6" }, { status: 400 });
      }
      updateData.dayOfWeek = Number(body.dayOfWeek);
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    if (body.startTime !== undefined) {
      if (!timeRegex.test(body.startTime)) {
        return NextResponse.json({ error: "startTime must be in HH:mm format" }, { status: 400 });
      }
      updateData.startTime = body.startTime;
    }

    if (body.endTime !== undefined) {
      if (!timeRegex.test(body.endTime)) {
        return NextResponse.json({ error: "endTime must be in HH:mm format" }, { status: 400 });
      }
      updateData.endTime = body.endTime;
    }

    // If both times are being updated, validate start < end
    const checkStart = body.startTime !== undefined ? body.startTime : existing.startTime;
    const checkEnd = body.endTime !== undefined ? body.endTime : existing.endTime;
    if (checkStart >= checkEnd) {
      return NextResponse.json({ error: "startTime must be before endTime" }, { status: 400 });
    }

    if (body.modality !== undefined) {
      if (!isValidSlotModality(body.modality)) {
        return NextResponse.json({ error: "modality must be IN_PERSON or VIDEO" }, { status: 400 });
      }
      updateData.modality = body.modality;
    }

    if (body.isActive !== undefined) {
      updateData.isActive = Boolean(body.isActive);
    }

    const template = await db.slotTemplate.update({
      where: { id: templateId },
      data: updateData,
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.TEMPLATE_UPDATED,
      targetType: "SlotTemplate",
      targetId: template.id,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ template });
  } catch (error: unknown) {
    console.error("[STAFF_PROVIDER_TEMPLATE_PATCH]", error);
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json(
        { error: "A template with this day, time, and modality already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── DELETE /api/staff/providers/[id]/templates/[templateId] ────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    const { id: providerId, templateId } = await params;

    if (!user.clinicId) {
      return NextResponse.json({ error: "No clinic context" }, { status: 400 });
    }

    // Validate ownership
    const provider = await db.provider.findFirst({
      where: { id: providerId, clinicId: user.clinicId },
      select: { id: true },
    });

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const existing = await db.slotTemplate.findFirst({
      where: { id: templateId, providerId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await db.slotTemplate.delete({ where: { id: templateId } });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.TEMPLATE_DEACTIVATED,
      targetType: "SlotTemplate",
      targetId: templateId,
      ipAddress: _request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[STAFF_PROVIDER_TEMPLATE_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}