import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  STAFF_ROLE,
  CLINIC_STATUS,
  CLINIC_STATUSES,
  isValidClinicStatus,
  isValidReschedulePolicy,
  RESCHEDULE_POLICIES,
} from "@/lib/enums";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { cache } from "@/lib/cache";
import { Prisma } from "@prisma/client";

// ─── PATCH /api/staff/admin/clinics/[id]/edit ───────────────────────────────
// Emergency intervention: edit any clinic field (B4).
// SYSTEM_MANAGER can edit any field regardless of clinic status.

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

    // Verify clinic exists
    const existing = await db.clinic.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    const body = await request.json();

    // Build update payload — only include fields that are actually provided
    const data: Prisma.ClinicUpdateInput = {};

    // String fields
    const stringFields = [
      "name", "tagline", "description", "streetAddress", "city", "state",
      "zipCode", "phoneNumber", "email", "website", "logoUrl", "coverImageUrl",
      "about", "hoursOfOperation", "faq", "galleryUrls", "parkingInstructions",
      "visitInstructions", "emailFromName", "customEmailHeader", "commonInstructions",
      "intakeReminderDays", "intakeFormIds",
    ] as const;

    for (const field of stringFields) {
      if (field in body) {
        (data as Record<string, unknown>)[field] = body[field] === null ? null : String(body[field]);
      }
    }

    // Numeric fields
    if ("latitude" in body) data.latitude = Number(body.latitude);
    if ("longitude" in body) data.longitude = Number(body.longitude);
    if ("inPersonDepositCents" in body) data.inPersonDepositCents = Math.max(0, Number(body.inPersonDepositCents));
    if ("videoDepositCents" in body) data.videoDepositCents = Math.max(0, Number(body.videoDepositCents));
    if ("selfPayFlatRateCents" in body) data.selfPayFlatRateCents = Math.max(0, Number(body.selfPayFlatRateCents));
    if ("cancellationLeadTimeMin" in body) data.cancellationLeadTimeMin = Math.max(0, Number(body.cancellationLeadTimeMin));
    if ("videoCancellationLeadTimeMin" in body) data.videoCancellationLeadTimeMin = Math.max(0, Number(body.videoCancellationLeadTimeMin));

    // Boolean fields
    if ("isFeatured" in body) data.isFeatured = Boolean(body.isFeatured);
    if ("featuredExpiry" in body) {
      data.featuredExpiry = body.featuredExpiry ? new Date(body.featuredExpiry) : null;
    }

    // Enum fields with validation
    if ("status" in body) {
      if (!isValidClinicStatus(body.status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${CLINIC_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
      data.status = body.status;
    }

    if ("reschedulePolicy" in body) {
      if (!RESCHEDULE_POLICIES.includes(body.reschedulePolicy)) {
        return NextResponse.json(
          { error: `Invalid reschedule policy. Must be one of: ${RESCHEDULE_POLICIES.join(", ")}` },
          { status: 400 }
        );
      }
      data.reschedulePolicy = body.reschedulePolicy;
    }

    // Check if there's anything to update
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await db.clinic.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        updatedAt: true,
      },
    });

    // Invalidate caches
    cache.deleteByPrefix("clinic:");
    cache.deleteByPrefix("search:");

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.CLINIC_UPDATED,
      targetType: "Clinic",
      targetId: id,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ clinic: updated });
  } catch (error) {
    console.error("[ADMIN_CLINIC_EDIT_PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}