import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isValidProviderStatus, PROVIDER_STATUS, isValidSlotModality } from "@/lib/enums";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { cache } from "@/lib/cache";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function generateSlug(firstName: string, lastName: string): string {
  const base = `${firstName.toLowerCase()}-${lastName.toLowerCase()}`
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base;
}

// ─── GET /api/staff/providers?clinicId=xxx ──────────────────────────────────────
// List all providers for a clinic (including INACTIVE, for admin management).

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    const clinicId = request.nextUrl.searchParams.get("clinicId") || user.clinicId;
    if (!clinicId) {
      return NextResponse.json({ error: "No clinic specified" }, { status: 400 });
    }

    if (user.role !== "SYSTEM_MANAGER" && user.clinicId && clinicId !== user.clinicId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const providers = await db.provider.findMany({
      where: { clinicId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        credentials: true,
        slug: true,
        photoUrl: true,
        npiNumber: true,
        yearsExperience: true,
        slotDurationMinutes: true,
        status: true,
        videoVisitLink: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            providerServices: true,
            slotTemplates: { where: { isActive: true } },
            languages: true,
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return NextResponse.json({ providers });
  } catch (error) {
    console.error("[STAFF_PROVIDERS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST /api/staff/providers ──────────────────────────────────────────────────
// Create a new provider.

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    const clinicId = user.clinicId;
    if (!clinicId) {
      return NextResponse.json({ error: "No clinic context" }, { status: 400 });
    }

    const body = await request.json();
    const { firstName, lastName, credentials, slotDurationMinutes, npiNumber, yearsExperience, bio, photoUrl, videoVisitLink, status } = body;

    // Validate required fields
    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: "First name and last name are required" }, { status: 400 });
    }
    if (!credentials?.trim()) {
      return NextResponse.json({ error: "Credentials are required" }, { status: 400 });
    }
    if (!slotDurationMinutes || ![15, 30, 45, 60].includes(Number(slotDurationMinutes))) {
      return NextResponse.json({ error: "Slot duration must be 15, 30, 45, or 60 minutes" }, { status: 400 });
    }
    if (status && !isValidProviderStatus(status)) {
      return NextResponse.json({ error: "Invalid provider status" }, { status: 400 });
    }

    // Generate slug and ensure uniqueness
    let slug = generateSlug(firstName.trim(), lastName.trim());
    const existing = await db.provider.findUnique({ where: { slug }, select: { id: true } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const provider = await db.provider.create({
      data: {
        clinicId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        credentials: credentials.trim(),
        slug,
        slotDurationMinutes: Number(slotDurationMinutes),
        npiNumber: npiNumber?.trim() || null,
        yearsExperience: yearsExperience ? Number(yearsExperience) : null,
        bio: bio?.trim() || null,
        photoUrl: photoUrl?.trim() || null,
        videoVisitLink: videoVisitLink?.trim() || null,
        status: status || PROVIDER_STATUS.ACTIVE,
      },
    });

    // Invalidate caches
    cache.deleteByPrefix("search:");
    cache.deleteByPrefix("clinic:");

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.PROVIDER_CREATED,
      targetType: "Provider",
      targetId: provider.id,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ provider }, { status: 201 });
  } catch (error) {
    console.error("[STAFF_PROVIDERS_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}