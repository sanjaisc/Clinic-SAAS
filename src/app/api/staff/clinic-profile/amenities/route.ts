import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinicId =
      request.nextUrl.searchParams.get("clinicId") || session.user.clinicId;
    if (!clinicId) {
      return NextResponse.json(
        { error: "No clinic specified" },
        { status: 400 }
      );
    }

    if (
      session.user.role !== "SYSTEM_MANAGER" &&
      session.user.clinicId &&
      clinicId !== session.user.clinicId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { amenityIds } = body as { amenityIds?: string[] };

    if (!Array.isArray(amenityIds)) {
      return NextResponse.json(
        { error: "amenityIds must be an array" },
        { status: 400 }
      );
    }

    // Verify all amenity IDs exist
    const existingAmenities = await db.amenity.findMany({
      where: { id: { in: amenityIds } },
      select: { id: true },
    });
    const existingIds = existingAmenities.map((a) => a.id);

    const invalidIds = amenityIds.filter((id) => !existingIds.includes(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `Invalid amenity IDs: ${invalidIds.join(", ")}` },
        { status: 400 }
      );
    }

    // Delete existing and recreate (atomic swap in transaction)
    await db.$transaction([
      db.clinicAmenity.deleteMany({ where: { clinicId } }),
      ...amenityIds.map((amenityId) =>
        db.clinicAmenity.create({
          data: { clinicId, amenityId },
        })
      ),
    ]);

    // Invalidate cache
    const { cache } = await import("@/lib/cache");
    cache.deleteByPrefix("clinic:");

    // Audit log
    const { createAuditLog } = await import("@/lib/audit");
    const { AUDIT_ACTIONS } = await import("@/lib/constants");
    createAuditLog({
      userId: session.user.id,
      action: AUDIT_ACTIONS.CLINIC_UPDATED,
      targetType: "Clinic",
      targetId: clinicId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CLINIC_AMENITIES_PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}