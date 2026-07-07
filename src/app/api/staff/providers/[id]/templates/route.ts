import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isValidSlotModality, SLOT_MODALITY, DAYS_OF_WEEK } from "@/lib/enums";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";

type RouteParams = { params: Promise<{ id: string }> };

// ─── GET /api/staff/providers/[id]/templates ────────────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    const { id: providerId } = await params;

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

    const templates = await db.slotTemplate.findMany({
      where: { providerId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("[STAFF_PROVIDER_TEMPLATES_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST /api/staff/providers/[id]/templates ───────────────────────────────────

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    const { id: providerId } = await params;

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

    const body = await request.json();
    const { dayOfWeek, startTime, endTime, modality, isActive } = body;

    // Validate dayOfWeek
    if (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json({ error: "dayOfWeek must be 0-6 (Sunday-Saturday)" }, { status: 400 });
    }

    // Validate time format HH:mm
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime)) {
      return NextResponse.json({ error: "startTime must be in HH:mm format" }, { status: 400 });
    }
    if (!timeRegex.test(endTime)) {
      return NextResponse.json({ error: "endTime must be in HH:mm format" }, { status: 400 });
    }

    // Validate startTime < endTime
    if (startTime >= endTime) {
      return NextResponse.json({ error: "startTime must be before endTime" }, { status: 400 });
    }

    // Validate modality
    const mod = modality || SLOT_MODALITY.IN_PERSON;
    if (!isValidSlotModality(mod)) {
      return NextResponse.json({ error: "modality must be IN_PERSON or VIDEO" }, { status: 400 });
    }

    const template = await db.slotTemplate.create({
      data: {
        providerId,
        dayOfWeek: Number(dayOfWeek),
        startTime,
        endTime,
        modality: mod,
        isActive: isActive !== false,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.TEMPLATE_CREATED,
      targetType: "SlotTemplate",
      targetId: template.id,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error: unknown) {
    console.error("[STAFF_PROVIDER_TEMPLATES_POST]", error);
    // Handle unique constraint violation
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json(
        { error: "A template with this day, time, and modality already exists for this provider" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}