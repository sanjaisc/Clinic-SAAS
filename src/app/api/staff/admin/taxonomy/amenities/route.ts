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

// ─── GET /api/staff/admin/taxonomy/amenities ──────────────────────────────────

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    if (user.role !== "SYSTEM_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const amenities = await db.amenity.findMany({
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(amenities);
  } catch (error) {
    console.error("[TAXONOMY_AMENITIES_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── POST /api/staff/admin/taxonomy/amenities ─────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    if (user.role !== "SYSTEM_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, icon, sortOrder } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const slug = toSlug(name.trim());

    const amenity = await db.amenity.create({
      data: {
        name: name.trim(),
        slug,
        icon: icon || null,
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.TAXONOMY_AMENITY_CREATED,
      targetType: "Amenity",
      targetId: amenity.id,
    });

    cache.deleteByPrefix("taxonomy:");

    return NextResponse.json(amenity, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "An amenity with this name or slug already exists" },
        { status: 409 }
      );
    }
    console.error("[TAXONOMY_AMENITIES_POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}