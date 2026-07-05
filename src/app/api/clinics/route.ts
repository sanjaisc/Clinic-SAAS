import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { addDays, startOfDay } from "date-fns";

export async function GET() {
  try {
    // Fetch all published clinics with their providers and service/specialty data
    const clinics = await db.clinic.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        streetAddress: true,
        city: true,
        state: true,
        zipCode: true,
        phoneNumber: true,
        email: true,
        website: true,
        coverImageUrl: true,
        providers: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            slug: true,
            firstName: true,
            lastName: true,
            credentials: true,
            rating: true,
            reviewCount: true,
            status: true,
            providerServices: {
              select: {
                service: {
                  select: {
                    specialty: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: [{ rating: "desc" }, { lastName: "asc" }],
          take: 5,
        },
        slots: {
          where: {
            status: "AVAILABLE",
            startTime: {
              gte: startOfDay(new Date()),
              lt: startOfDay(addDays(new Date(), 7)),
            },
          },
          select: { id: true },
        },
      },
    });

    const result = clinics.map((clinic) => {
      // Aggregate unique specialties from ALL providers
      const specialtySet = new Set<string>();
      const firstProviderRecord = clinic.providers[0] ?? null;

      for (const p of clinic.providers) {
        for (const ps of p.providerServices) {
          if (ps.service?.specialty?.name) {
            specialtySet.add(ps.service.specialty.name);
          }
        }
      }
      const specialties = Array.from(specialtySet);

      // Provider count (active providers, up to take limit)
      const providerCount = clinic.providers.length;

      // Aggregate rating from top provider
      const rating = firstProviderRecord?.rating ?? 0;

      // First provider info
      const firstProvider = firstProviderRecord
        ? {
            firstName: firstProviderRecord.firstName,
            lastName: firstProviderRecord.lastName,
            credentials: firstProviderRecord.credentials,
          }
        : null;

      // Top 3 providers for badge display
      const topProviders = clinic.providers.slice(0, 3).map((p) => ({
        slug: p.slug,
        firstName: p.firstName,
        lastName: p.lastName,
        credentials: p.credentials,
        rating: p.rating,
      }));

      // All provider names for display
      const allProviders = clinic.providers.map((p) => ({
        slug: p.slug,
        firstName: p.firstName,
        lastName: p.lastName,
        credentials: p.credentials,
        rating: p.rating,
      }));

      // Available slots in next 7 days
      const availableSlotsCount = clinic.slots.length;

      return {
        id: clinic.id,
        slug: clinic.slug,
        name: clinic.name,
        tagline: clinic.tagline,
        streetAddress: clinic.streetAddress,
        city: clinic.city,
        state: clinic.state,
        zipCode: clinic.zipCode,
        phoneNumber: clinic.phoneNumber,
        email: clinic.email,
        website: clinic.website,
        coverImageUrl: clinic.coverImageUrl,
        specialties,
        providerCount,
        rating,
        firstProvider,
        topProviders,
        allProviders,
        availableSlotsCount,
      };
    });

    return NextResponse.json({ clinics: result });
  } catch (error) {
    console.error("[/api/clinics] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}