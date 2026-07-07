import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cache } from "@/lib/cache";

type RouteParams = { params: Promise<{ id: string; serviceId: string }> };

// ─── DELETE /api/staff/providers/[id]/services/[serviceId] ─────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    const { id: providerId, serviceId } = await params;

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

    const existing = await db.providerService.findUnique({
      where: {
        providerId_serviceId: { providerId, serviceId },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Service assignment not found" }, { status: 404 });
    }

    await db.providerService.delete({
      where: { id: existing.id },
    });

    // Invalidate caches
    cache.deleteByPrefix("search:");
    cache.deleteByPrefix("clinic:");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[STAFF_PROVIDER_SERVICES_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}