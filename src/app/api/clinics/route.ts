import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { addDays, startOfDay, format } from "date-fns";

export async function GET() {
  try {
    // Fetch all published clinics with their provider and service/specialty data
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
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            credentials: true,
            rating: true,
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

    const now = startOfDay(new Date());
    const weekEnd = startOfDay(addDays(new Date(), 7));

    const result = clinics.map((clinic) => {
      // Aggregate unique specialties from all providers
      const specialtySet = new Set<string>();
      if (clinic.provider) {
        for (const ps of clinic.provider.providerServices) {
          if (ps.service?.specialty?.name) {
            specialtySet.add(ps.service.specialty.name);
          }
        }
      }
      const specialties = Array.from(specialtySet);

      // Provider count (active providers — currently 1:1 but future-proofed)
      const providerCount = clinic.provider && clinic.provider.status === "ACTIVE" ? 1 : 0;

      // Aggregate rating from providers
      const rating = clinic.provider?.rating ?? 0;

      // First provider info
      const firstProvider = clinic.provider
        ? {
            firstName: clinic.provider.firstName,
            lastName: clinic.provider.lastName,
            credentials: clinic.provider.credentials,
          }
        : null;

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