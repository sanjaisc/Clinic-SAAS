import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  STAFF_ROLE,
  CLINIC_STATUS,
  CLINIC_STATUSES,
  isValidClinicStatus,
  type ClinicStatus,
} from "@/lib/enums";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { cache } from "@/lib/cache";

// ─── GET /api/staff/admin/clinics/[id] ──────────────────────────────────────
// Get full clinic details for emergency edit (B4)

export async function GET(
  _request: NextRequest,
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

    const clinic = await db.clinic.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        description: true,
        streetAddress: true,
        city: true,
        state: true,
        zipCode: true,
        latitude: true,
        longitude: true,
        phoneNumber: true,
        email: true,
        website: true,
        logoUrl: true,
        coverImageUrl: true,
        about: true,
        hoursOfOperation: true,
        faq: true,
        galleryUrls: true,
        status: true,
        inPersonDepositCents: true,
        videoDepositCents: true,
        selfPayFlatRateCents: true,
        cancellationLeadTimeMin: true,
        videoCancellationLeadTimeMin: true,
        reschedulePolicy: true,
        parkingInstructions: true,
        visitInstructions: true,
        emailFromName: true,
        customEmailHeader: true,
        commonInstructions: true,
        intakeReminderDays: true,
        intakeFormIds: true,
        isFeatured: true,
        featuredExpiry: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            providers: true,
            appointments: true,
            reviews: true,
            staff: true,
          },
        },
      },
    });

    if (!clinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    return NextResponse.json({ clinic });
  } catch (error) {
    console.error("[ADMIN_CLINIC_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/staff/admin/clinics/[id] ─────────────────────────────────────
// Change clinic status (B2). When suspending: set status to SUSPENDED.
// Block future slot generation (set a note on commonInstructions).
// Existing BOOKED appointments are preserved (do NOT cancel them).
// When archiving: set status to ARCHIVED.

export async function PATCH(
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
    const body = await request.json();
    const { status } = body;

    if (!status || !isValidClinicStatus(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${CLINIC_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    // Fetch current clinic
    const clinic = await db.clinic.findUnique({
      where: { id },
      select: { id: true, status: true, commonInstructions: true, name: true },
    });

    if (!clinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    if (clinic.status === status) {
      return NextResponse.json(
        { error: `Clinic is already in ${status} status` },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = { status };

    // When suspending: add note to commonInstructions about blocking future slot generation
    if (status === CLINIC_STATUS.SUSPENDED) {
      const suspensionNote = `\n\n[SUSPENDED by System Admin on ${new Date().toISOString()} — future slot generation is blocked. Existing booked appointments are preserved.]`;
      updateData.commonInstructions = (clinic.commonInstructions || "") + suspensionNote;
    }

    const updated = await db.clinic.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, status: true, updatedAt: true },
    });

    // Invalidate caches
    cache.deleteByPrefix("clinic:");
    cache.deleteByPrefix("search:");

    // Audit log
    const auditAction =
      status === CLINIC_STATUS.SUSPENDED
        ? AUDIT_ACTIONS.CLINIC_SUSPENDED
        : status === CLINIC_STATUS.ARCHIVED
          ? AUDIT_ACTIONS.CLINIC_ARCHIVED
          : status === CLINIC_STATUS.PUBLISHED
            ? AUDIT_ACTIONS.CLINIC_PUBLISHED
            : AUDIT_ACTIONS.CLINIC_UPDATED;

    await createAuditLog({
      userId: user.id,
      action: auditAction,
      targetType: "Clinic",
      targetId: id,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ clinic: updated });
  } catch (error) {
    console.error("[ADMIN_CLINIC_STATUS_PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}