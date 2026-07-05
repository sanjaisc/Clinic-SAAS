import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CLINIC_STATUS, PROVIDER_STATUS } from "@/lib/enums";

// =============================================================================
// GET — Fetch a single slot with provider, clinic, and specialty info
// =============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slotId: string }> }
) {
  try {
    const { slotId } = await params;

    if (!slotId) {
      return NextResponse.json(
        { error: "Slot ID is required", code: "MISSING_SLOT_ID" },
        { status: 400 }
      );
    }

    // Fetch the slot with its related data
    const slot = await db.slot.findUnique({
      where: { id: slotId },
      include: {
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            credentials: true,
            slug: true,
            clinicId: true,
            status: true,
            providerServices: {
              include: {
                service: {
                  include: {
                    specialty: true,
                  },
                },
              },
            },
          },
        },
        clinic: {
          select: {
            id: true,
            name: true,
            slug: true,
            streetAddress: true,
            city: true,
            state: true,
            zipCode: true,
            phoneNumber: true,
            selfPayFlatRateCents: true,
            inPersonDepositCents: true,
            videoDepositCents: true,
            status: true,
          },
        },
      },
    });

    if (!slot) {
      return NextResponse.json(
        { error: "Slot not found", code: "SLOT_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Determine the specialty from the provider's services
    // Use the first active service's specialty as the provider's primary specialty
    const firstService = slot.provider.providerServices?.[0]?.service;
    const specialty = firstService
      ? {
          id: firstService.specialty.id,
          name: firstService.specialty.name,
        }
      : null;

    const services = (slot.provider.providerServices ?? []).map((ps) => ({
      id: ps.service.id,
      name: ps.service.name,
    }));

    return NextResponse.json({
      slot: {
        id: slot.id,
        startTime: slot.startTime.toISOString(),
        endTime: slot.endTime.toISOString(),
        modality: slot.modality,
        status: slot.status,
      },
      provider: {
        id: slot.provider.id,
        firstName: slot.provider.firstName,
        lastName: slot.provider.lastName,
        credentials: slot.provider.credentials,
        slug: slot.provider.slug,
        clinicId: slot.provider.clinicId,
      },
      clinic: {
        id: slot.clinic.id,
        name: slot.clinic.name,
        slug: slot.clinic.slug,
        streetAddress: slot.clinic.streetAddress,
        city: slot.clinic.city,
        state: slot.clinic.state,
        zipCode: slot.clinic.zipCode,
        phoneNumber: slot.clinic.phoneNumber,
        selfPayFlatRateCents: slot.clinic.selfPayFlatRateCents,
        inPersonDepositCents: slot.clinic.inPersonDepositCents,
        videoDepositCents: slot.clinic.videoDepositCents,
      },
      specialty,
      serviceId: slot.provider.providerServices?.[0]?.serviceId ?? null,
      services,
    });
  } catch (error) {
    console.error("[SLOT_GET] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}