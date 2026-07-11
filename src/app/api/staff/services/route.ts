import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { cache } from "@/lib/cache";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinicId = request.nextUrl.searchParams.get("clinicId") || session.user.clinicId;
    if (!clinicId) {
      return NextResponse.json({ error: "No clinic specified" }, { status: 400 });
    }

    if (session.user.role !== "SYSTEM_MANAGER" && session.user.clinicId && clinicId !== session.user.clinicId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check cache
    const cacheKey = `staff:services:${clinicId}`;
    const cached = cache.get<unknown>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Fetch all specialties with their active services
    const specialties = await db.specialty.findMany({
      where: { isActive: true },
      include: {
        services: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    // Fetch clinic's accepted insurances
    const clinicInsurances = await db.clinicInsurance.findMany({
      where: { clinicId },
      include: { insurance: { select: { id: true, name: true, slug: true, isActive: true } } },
    });

    // Fetch clinic selfPayFlatRateCents
    const clinic = await db.clinic.findUnique({
      where: { id: clinicId },
      select: { selfPayFlatRateCents: true },
    });

    // Fetch provider service assignments for this clinic's providers
    const providerServices = await db.providerService.findMany({
      where: {
        provider: { clinicId },
      },
      include: {
        provider: {
          select: { id: true, firstName: true, lastName: true, credentials: true },
        },
        service: {
          select: { id: true, name: true, selfPayPaymentType: true, selfPayPriceCents: true },
        },
      },
    });

    // Fetch clinic-specific pricing overrides
    const clinicServices = await db.clinicService.findMany({
      where: { clinicId },
      select: { serviceId: true, clinicPriceCents: true, isActive: true },
    });
    const clinicPriceMap = new Map(clinicServices.map((cs) => [cs.serviceId, cs.clinicPriceCents]));

    // Fetch service-insurance links for this clinic's accepted insurances
    const acceptedInsuranceIds = clinicInsurances.map((ci) => ci.insuranceId);
    const serviceInsurances = acceptedInsuranceIds.length > 0
      ? await db.serviceInsurance.findMany({
          where: { insuranceId: { in: acceptedInsuranceIds } },
          include: { insurance: { select: { id: true, name: true, slug: true } } },
        })
      : [];
    const svcInsMap = new Map<string, Array<{ id: string; insuranceId: string; insuranceName: string; copayCents: number; isActive: boolean }>>();
    for (const si of serviceInsurances) {
      const existing = svcInsMap.get(si.serviceId) || [];
      existing.push({
        id: si.id,
        insuranceId: si.insuranceId,
        insuranceName: si.insurance.name,
        copayCents: si.copayCents,
        isActive: si.isActive,
      });
      svcInsMap.set(si.serviceId, existing);
    }

    // Build a map of serviceId -> assigned providers
    const serviceProviderMap = new Map<string, Array<{ id: string; firstName: string; lastName: string; credentials: string | null }>>();
    for (const ps of providerServices) {
      const existing = serviceProviderMap.get(ps.serviceId) || [];
      existing.push(ps.provider);
      serviceProviderMap.set(ps.serviceId, existing);
    }

    const response = {
      specialties: specialties.map((spec) => ({
        id: spec.id,
        name: spec.name,
        slug: spec.slug,
        services: spec.services.map((svc) => ({
          id: svc.id,
          name: svc.name,
          slug: svc.slug,
          description: svc.description,
          durationMinutes: svc.durationMinutes,
          globalPriceCents: svc.selfPayPriceCents,
          clinicPriceCents: clinicPriceMap.get(svc.id) ?? 0,
          selfPayPaymentType: svc.selfPayPaymentType,
          isActive: svc.isActive,
          assignedProviders: serviceProviderMap.get(svc.id) || [],
          linkedInsurances: svcInsMap.get(svc.id) || [],
        })),
      })),
      clinicInsurances: clinicInsurances.map((ci) => ci.insurance),
      selfPayFlatRateCents: clinic?.selfPayFlatRateCents ?? 0,
    };

    // Cache for 60 seconds
    cache.set(cacheKey, response, 60);

    return NextResponse.json(response);
  } catch (error) {
    console.error("[STAFF_SERVICES_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}