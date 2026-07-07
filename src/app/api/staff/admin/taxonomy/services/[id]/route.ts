import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { cache } from "@/lib/cache";
import { Prisma } from "@prisma/client";
import { SELF_PAY_PAYMENT_TYPE } from "@/lib/enums";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── PATCH /api/staff/admin/taxonomy/services/[id] ─────────────────────────────

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
    if (user.role !== "SYSTEM_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.service.findUnique({
      where: { id },
      include: { specialty: { select: { id: true, name: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, specialtyId, durationMinutes, selfPayPriceCents, selfPayPaymentType, isBookable, isActive, sortOrder } = body;

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      }
      updateData.name = name.trim();
      updateData.slug = toSlug(name.trim());
    }
    if (description !== undefined) updateData.description = description || null;
    if (specialtyId !== undefined) {
      const specialty = await db.specialty.findUnique({ where: { id: specialtyId } });
      if (!specialty) {
        return NextResponse.json({ error: "Specialty not found" }, { status: 400 });
      }
      updateData.specialtyId = specialtyId;
    }
    if (durationMinutes !== undefined) updateData.durationMinutes = Number(durationMinutes);
    if (selfPayPriceCents !== undefined) updateData.selfPayPriceCents = Math.max(0, Number(selfPayPriceCents));
    if (selfPayPaymentType !== undefined) {
      if (!Object.values(SELF_PAY_PAYMENT_TYPE).includes(selfPayPaymentType)) {
        return NextResponse.json({ error: "Invalid payment type" }, { status: 400 });
      }
      updateData.selfPayPaymentType = selfPayPaymentType;
    }
    if (isBookable !== undefined) updateData.isBookable = Boolean(isBookable);
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (sortOrder !== undefined) updateData.sortOrder = Number(sortOrder);

    const service = await db.service.update({
      where: { id },
      data: updateData,
      include: { specialty: { select: { id: true, name: true } } },
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.TAXONOMY_SERVICE_UPDATED,
      targetType: "Service",
      targetId: id,
    });

    cache.deleteByPrefix("taxonomy:");

    return NextResponse.json(service);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "A service with this name or slug already exists" },
        { status: 409 }
      );
    }
    console.error("[TAXONOMY_SERVICES_PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/staff/admin/taxonomy/services/[id] ────────────────────────────
// Soft-delete: toggles isActive instead of hard-deleting.

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    if (user.role !== "SYSTEM_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.service.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const service = await db.service.update({
      where: { id },
      data: { isActive: !existing.isActive },
      include: { specialty: { select: { id: true, name: true } } },
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.TAXONOMY_SERVICE_ARCHIVED,
      targetType: "Service",
      targetId: id,
    });

    cache.deleteByPrefix("taxonomy:");

    return NextResponse.json(service);
  } catch (error) {
    console.error("[TAXONOMY_SERVICES_DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}