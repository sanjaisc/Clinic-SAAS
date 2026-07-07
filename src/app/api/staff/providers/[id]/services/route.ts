import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cache } from "@/lib/cache";

type RouteParams = { params: Promise<{ id: string }> };

// ─── POST /api/staff/providers/[id]/services ────────────────────────────────────
// Assign a service to a provider.

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
    const { serviceId } = body;

    if (!serviceId) {
      return NextResponse.json({ error: "serviceId is required" }, { status: 400 });
    }

    // Verify service exists
    const service = await db.service.findUnique({
      where: { id: serviceId },
      select: { id: true, name: true },
    });

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // Check if already assigned
    const existing = await db.providerService.findUnique({
      where: {
        providerId_serviceId: { providerId, serviceId },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Service already assigned to this provider" }, { status: 409 });
    }

    const providerService = await db.providerService.create({
      data: { providerId, serviceId },
      include: { service: { include: { specialty: true } } },
    });

    // Invalidate caches
    cache.deleteByPrefix("search:");
    cache.deleteByPrefix("clinic:");

    return NextResponse.json({ providerService }, { status: 201 });
  } catch (error: unknown) {
    console.error("[STAFF_PROVIDER_SERVICES_POST]", error);
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Service already assigned to this provider" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}