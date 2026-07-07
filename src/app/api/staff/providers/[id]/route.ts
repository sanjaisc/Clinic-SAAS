import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isValidProviderStatus, PROVIDER_STATUS } from "@/lib/enums";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { cache } from "@/lib/cache";

type RouteParams = { params: Promise<{ id: string }> };

// ─── GET /api/staff/providers/[id]?clinicId=xxx ─────────────────────────────────

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    const { id } = await params;
    const clinicId = request.nextUrl.searchParams.get("clinicId") || user.clinicId;
    if (!clinicId) {
      return NextResponse.json({ error: "No clinic specified" }, { status: 400 });
    }

    if (user.role !== "SYSTEM_MANAGER" && user.clinicId && clinicId !== user.clinicId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const provider = await db.provider.findFirst({
      where: { id, clinicId },
      include: {
        providerServices: {
          include: {
            service: {
              include: {
                specialty: true,
              },
            },
          },
        },
        slotTemplates: {
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        },
        languages: {
          include: { language: true },
        },
      },
    });

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    return NextResponse.json({ provider });
  } catch (error) {
    console.error("[STAFF_PROVIDER_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── PATCH /api/staff/providers/[id] ────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    const { id } = await params;

    if (!user.clinicId) {
      return NextResponse.json({ error: "No clinic context" }, { status: 400 });
    }

    // Validate ownership
    const existing = await db.provider.findFirst({
      where: { id, clinicId: user.clinicId },
      select: { id: true, clinicId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.firstName !== undefined) {
      if (!body.firstName?.trim()) return NextResponse.json({ error: "First name cannot be empty" }, { status: 400 });
      updateData.firstName = body.firstName.trim();
    }
    if (body.lastName !== undefined) {
      if (!body.lastName?.trim()) return NextResponse.json({ error: "Last name cannot be empty" }, { status: 400 });
      updateData.lastName = body.lastName.trim();
    }
    if (body.credentials !== undefined) {
      if (!body.credentials?.trim()) return NextResponse.json({ error: "Credentials cannot be empty" }, { status: 400 });
      updateData.credentials = body.credentials.trim();
    }
    if (body.slotDurationMinutes !== undefined) {
      if (![15, 30, 45, 60].includes(Number(body.slotDurationMinutes))) {
        return NextResponse.json({ error: "Slot duration must be 15, 30, 45, or 60 minutes" }, { status: 400 });
      }
      updateData.slotDurationMinutes = Number(body.slotDurationMinutes);
    }
    if (body.npiNumber !== undefined) updateData.npiNumber = body.npiNumber?.trim() || null;
    if (body.yearsExperience !== undefined) updateData.yearsExperience = body.yearsExperience ? Number(body.yearsExperience) : null;
    if (body.bio !== undefined) updateData.bio = body.bio?.trim() || null;
    if (body.photoUrl !== undefined) updateData.photoUrl = body.photoUrl?.trim() || null;
    if (body.videoVisitLink !== undefined) updateData.videoVisitLink = body.videoVisitLink?.trim() || null;
    if (body.status !== undefined) {
      if (!isValidProviderStatus(body.status)) {
        return NextResponse.json({ error: "Invalid provider status" }, { status: 400 });
      }
      updateData.status = body.status;
    }

    const provider = await db.provider.update({
      where: { id },
      data: updateData,
    });

    // Invalidate caches
    cache.deleteByPrefix("search:");
    cache.deleteByPrefix("clinic:");

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.PROVIDER_UPDATED,
      targetType: "Provider",
      targetId: provider.id,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ provider });
  } catch (error) {
    console.error("[STAFF_PROVIDER_PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── DELETE /api/staff/providers/[id] ───────────────────────────────────────────
// Soft-delete (set INACTIVE) if appointments exist, hard-delete otherwise.

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    const { id } = await params;

    if (!user.clinicId) {
      return NextResponse.json({ error: "No clinic context" }, { status: 400 });
    }

    // Validate ownership
    const existing = await db.provider.findFirst({
      where: { id, clinicId: user.clinicId },
      select: { id: true, _count: { select: { appointments: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    if (existing._count.appointments > 0) {
      // Soft-delete
      await db.provider.update({
        where: { id },
        data: { status: PROVIDER_STATUS.INACTIVE },
      });
    } else {
      // Hard-delete
      await db.provider.delete({ where: { id } });
    }

    // Invalidate caches
    cache.deleteByPrefix("search:");
    cache.deleteByPrefix("clinic:");

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.PROVIDER_SUSPENDED,
      targetType: "Provider",
      targetId: id,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[STAFF_PROVIDER_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}