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

    const clinic = await db.clinic.findUnique({
      where: { id: clinicId },
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        about: true,
        description: true,
        streetAddress: true,
        city: true,
        state: true,
        zipCode: true,
        latitude: true,
        longitude: true,
        phoneNumber: true,
        email: true,
        website: true,
        logoUrl: true,
        coverImageUrl: true,
        galleryUrls: true,
        faq: true,
        parkingInstructions: true,
        visitInstructions: true,
        status: true,
        amenities: {
          select: {
            amenityId: true,
            amenity: {
              select: { id: true, name: true, slug: true, icon: true },
            },
          },
        },
        providers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            languages: {
              select: {
                languageId: true,
                language: {
                  select: { id: true, name: true, code: true },
                },
              },
            },
          },
        },
      },
    });

    if (!clinic) {
      return NextResponse.json(
        { error: "Clinic not found" },
        { status: 404 }
      );
    }

    // Parse JSON fields
    let faq: { q: string; a: string }[] = [];
    if (clinic.faq) {
      try {
        faq = JSON.parse(clinic.faq);
      } catch {
        faq = [];
      }
    }

    let galleryUrls: string[] = [];
    if (clinic.galleryUrls) {
      try {
        galleryUrls = JSON.parse(clinic.galleryUrls);
      } catch {
        galleryUrls = [];
      }
    }

    // Collect all unique languages spoken across all providers
    const languageMap = new Map<
      string,
      { id: string; name: string; code: string }
    >();
    const providerLanguages = clinic.providers.map((p) => ({
      providerId: p.id,
      providerName: `${p.firstName} ${p.lastName}`,
      languages: p.languages.map((pl) => {
        if (!languageMap.has(pl.languageId)) {
          languageMap.set(pl.languageId, pl.language);
        }
        return pl.languageId;
      }),
    }));
    const allLanguages = Array.from(languageMap.values());

    // Amenity IDs
    const amenityIds = clinic.amenities.map((ca) => ca.amenityId);

    return NextResponse.json({
      id: clinic.id,
      slug: clinic.slug,
      name: clinic.name,
      tagline: clinic.tagline,
      about: clinic.about,
      description: clinic.description,
      streetAddress: clinic.streetAddress,
      city: clinic.city,
      state: clinic.state,
      zipCode: clinic.zipCode,
      latitude: clinic.latitude,
      longitude: clinic.longitude,
      phoneNumber: clinic.phoneNumber,
      email: clinic.email,
      website: clinic.website,
      logoUrl: clinic.logoUrl,
      coverImageUrl: clinic.coverImageUrl,
      galleryUrls,
      faq,
      parkingInstructions: clinic.parkingInstructions,
      visitInstructions: clinic.visitInstructions,
      status: clinic.status,
      amenityIds,
      amenities: clinic.amenities.map((ca) => ca.amenity),
      providerLanguages,
      allLanguages,
    });
  } catch (error) {
    console.error("[CLINIC_PROFILE_GET]", error);
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
    const allowedFields = [
      "name",
      "tagline",
      "about",
      "description",
      "phoneNumber",
      "email",
      "website",
      "streetAddress",
      "city",
      "state",
      "zipCode",
      "latitude",
      "longitude",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const clinic = await db.clinic.update({
      where: { id: clinicId },
      data: updateData,
      select: {
        id: true,
        name: true,
      },
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

    return NextResponse.json({ success: true, clinic });
  } catch (error) {
    console.error("[CLINIC_PROFILE_PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}