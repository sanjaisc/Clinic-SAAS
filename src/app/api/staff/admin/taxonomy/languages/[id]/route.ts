import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { cache } from "@/lib/cache";
import { Prisma } from "@prisma/client";

// ─── PATCH /api/staff/admin/taxonomy/languages/[id] ──────────────────────────

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
    const existing = await db.language.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, code, sortOrder } = body;

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      }
      updateData.name = name.trim();
    }
    if (code !== undefined) {
      if (typeof code !== "string" || code.trim().length === 0) {
        return NextResponse.json({ error: "Code cannot be empty" }, { status: 400 });
      }
      updateData.code = code.trim().toLowerCase();
    }
    if (sortOrder !== undefined) updateData.sortOrder = Number(sortOrder);

    const language = await db.language.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.TAXONOMY_LANGUAGE_UPDATED,
      targetType: "Language",
      targetId: id,
    });

    cache.deleteByPrefix("taxonomy:");

    return NextResponse.json(language);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "A language with this name or code already exists" },
        { status: 409 }
      );
    }
    console.error("[TAXONOMY_LANGUAGES_PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/staff/admin/taxonomy/languages/[id] ───────────────────────────
// Language has no isActive field — returns 405 to indicate archive is not supported.

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
    const existing = await db.language.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Language has no isActive — archive not supported
    return NextResponse.json(
      { error: "Languages do not support archive. Use PATCH to update or remove from provider associations." },
      { status: 405 }
    );
  } catch (error) {
    console.error("[TAXONOMY_LANGUAGES_DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}