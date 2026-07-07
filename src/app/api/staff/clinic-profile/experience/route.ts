import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
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

    // Fetch clinic experience data
    const clinic = await db.clinic.findUnique({
      where: { id: clinicId },
      select: {
        parkingInstructions: true,
        visitInstructions: true,
        faq: true,
      },
    });

    if (!clinic) {
      return NextResponse.json(
        { error: "Clinic not found" },
        { status: 404 }
      );
    }

    // Parse FAQ
    let faq: { q: string; a: string }[] = [];
    if (clinic.faq) {
      try {
        faq = JSON.parse(clinic.faq);
      } catch {
        faq = [];
      }
    }

    // Fetch all available amenities
    const allAmenities = await db.amenity.findMany({
      orderBy: { sortOrder: "asc" },
    });

    // Fetch current clinic amenities
    const clinicAmenities = await db.clinicAmenity.findMany({
      where: { clinicId },
      select: { amenityId: true },
    });
    const selectedAmenityIds = clinicAmenities.map((ca) => ca.amenityId);

    // Fetch all available languages
    const allLanguages = await db.language.findMany({
      orderBy: { sortOrder: "asc" },
    });

    // Fetch provider language assignments
    const providers = await db.provider.findMany({
      where: { clinicId, status: "ACTIVE" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        languages: {
          select: { languageId: true },
        },
      },
    });

    const providerLanguageMap = providers.map((p) => ({
      providerId: p.id,
      providerName: `${p.firstName} ${p.lastName}`,
      languageIds: p.languages.map((pl) => pl.languageId),
    }));

    return NextResponse.json({
      parkingInstructions: clinic.parkingInstructions || "",
      visitInstructions: clinic.visitInstructions || "",
      faq,
      allAmenities,
      selectedAmenityIds,
      allLanguages,
      providerLanguageMap,
    });
  } catch (error) {
    console.error("[CLINIC_EXPERIENCE_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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
    const updateData: Record<string, unknown> = {};

    if (body.parkingInstructions !== undefined) {
      updateData.parkingInstructions = body.parkingInstructions;
    }
    if (body.visitInstructions !== undefined) {
      updateData.visitInstructions = body.visitInstructions;
    }
    if (body.faq !== undefined) {
      // Validate FAQ structure
      if (!Array.isArray(body.faq)) {
        return NextResponse.json(
          { error: "FAQ must be an array" },
          { status: 400 }
        );
      }
      for (const item of body.faq) {
        if (!item.q || !item.a) {
          return NextResponse.json(
            { error: "Each FAQ item must have 'q' and 'a' fields" },
            { status: 400 }
          );
        }
      }
      updateData.faq = JSON.stringify(body.faq);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    await db.clinic.update({
      where: { id: clinicId },
      data: updateData,
    });

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
    console.error("[CLINIC_EXPERIENCE_PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}