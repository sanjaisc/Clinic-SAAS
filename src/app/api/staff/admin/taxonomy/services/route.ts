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

// ─── GET /api/staff/admin/taxonomy/services ─────────────────────────────────────

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

    const services = await db.service.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        specialty: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(services);
  } catch (error) {
    console.error("[TAXONOMY_SERVICES_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── POST /api/staff/admin/taxonomy/services ────────────────────────────────────

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
    const { name, description, specialtyId, durationMinutes, selfPayPriceCents, selfPayPaymentType, isBookable, sortOrder } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!specialtyId || typeof specialtyId !== "string") {
      return NextResponse.json({ error: "Specialty is required" }, { status: 400 });
    }

    // Validate specialty exists
    const specialty = await db.specialty.findUnique({ where: { id: specialtyId } });
    if (!specialty) {
      return NextResponse.json({ error: "Specialty not found" }, { status: 400 });
    }

    // Validate payment type
    if (selfPayPaymentType && !Object.values(SELF_PAY_PAYMENT_TYPE).includes(selfPayPaymentType)) {
      return NextResponse.json({ error: "Invalid payment type" }, { status: 400 });
    }

    const slug = toSlug(name.trim());

    const service = await db.service.create({
      data: {
        name: name.trim(),
        slug,
        description: description || null,
        specialtyId,
        durationMinutes: typeof durationMinutes === "number" ? durationMinutes : 30,
        selfPayPriceCents: typeof selfPayPriceCents === "number" ? Math.max(0, selfPayPriceCents) : 0,
        selfPayPaymentType: selfPayPaymentType || SELF_PAY_PAYMENT_TYPE.STANDARD_DEPOSIT,
        isBookable: isBookable !== undefined ? Boolean(isBookable) : true,
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      },
      include: { specialty: { select: { id: true, name: true } } },
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.TAXONOMY_SERVICE_CREATED,
      targetType: "Service",
      targetId: service.id,
    });

    cache.deleteByPrefix("taxonomy:");

    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "A service with this name or slug already exists" },
        { status: 409 }
      );
    }
    console.error("[TAXONOMY_SERVICES_POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}