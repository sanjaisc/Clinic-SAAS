import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { cache } from "@/lib/cache";
import { Prisma } from "@prisma/client";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── PATCH /api/staff/admin/taxonomy/insurances/[id] ─────────────────────────

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
    const existing = await db.insurance.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, isDemo, isActive, sortOrder } = body;

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      }
      updateData.name = name.trim();
      updateData.slug = toSlug(name.trim());
    }
    if (isDemo !== undefined) updateData.isDemo = Boolean(isDemo);
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (sortOrder !== undefined) updateData.sortOrder = Number(sortOrder);

    const insurance = await db.insurance.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.TAXONOMY_INSURANCE_UPDATED,
      targetType: "Insurance",
      targetId: id,
    });

    cache.deleteByPrefix("taxonomy:");

    return NextResponse.json(insurance);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "An insurance with this name or slug already exists" },
        { status: 409 }
      );
    }
    console.error("[TAXONOMY_INSURANCES_PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/staff/admin/taxonomy/insurances/[id] ──────────────────────────
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
    const existing = await db.insurance.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const insurance = await db.insurance.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.TAXONOMY_INSURANCE_ARCHIVED,
      targetType: "Insurance",
      targetId: id,
    });

    cache.deleteByPrefix("taxonomy:");

    return NextResponse.json(insurance);
  } catch (error) {
    console.error("[TAXONOMY_INSURANCES_DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}