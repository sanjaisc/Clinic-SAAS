import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { cache, CacheKeys, CacheTTL } from "@/lib/cache";
import { haversineDistance, getBoundingBox } from "@/lib/geo";
import {
  PATIENT_TYPE,
  isValidSlotModality,
  CLINIC_STATUS,
  PROVIDER_STATUS,
  SLOT_STATUS,
} from "@/lib/enums";
import {
  SEARCH_PAGE_SIZE,
  DEFAULT_SEARCH_RADIUS_MILES,
  MAX_SEARCH_RADIUS_MILES,
} from "@/lib/constants";

// =============================================================================
// Types
// =============================================================================

interface SearchParams {
  q?: string;
  specialtyId: string;
  patientType: string;
  insuranceId?: string;
  modality?: string;
  radius: number;
  lat?: number;
  lng?: number;
  sort: "distance" | "time";
  cursor: number;
  size: number;
}

interface ProviderSlot {
  id: string;
  startTime: string;
  endTime: string;
  modality: string;
}

interface ProviderClinic {
  id: string;
  slug: string;
  name: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string;
  logoUrl: string | null;
}

export interface ProviderResult {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  credentials: string | null;
  photoUrl: string | null;
  rating: number;
  reviewCount: number;
  slotDurationMinutes: number;
  clinic: ProviderClinic;
  distance: number | null;
  earliestSlots: ProviderSlot[];
  reviewSnippet: string | null;
  costBadge: string | null;
}

interface SearchResponse {
  providers: ProviderResult[];
  hasMore: boolean;
  total: number;
}

/** Internal type that carries sort-comparator helpers (stripped before response). */
interface SortableProvider extends ProviderResult {
  _earliestSlotTime: number;
  _random: number;
}

// =============================================================================
// Helpers
// =============================================================================

/** Deterministic short hash for building cache keys from query params. */
function hashParams(obj: Record<string, unknown>): string {
  return createHash("md5").update(JSON.stringify(obj)).digest("hex").slice(0, 12);
}

// =============================================================================
// GET Handler
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    // ---------------------------------------------------------------------------
    // 1. Validate required params
    // ---------------------------------------------------------------------------
    const specialtyId = searchParams.get("specialtyId");
    const patientType = searchParams.get("patientType");

    if (!specialtyId) {
      return NextResponse.json(
        { error: "Missing required parameter: specialtyId" },
        { status: 400 },
      );
    }

    if (
      !patientType ||
      (patientType !== PATIENT_TYPE.ADULT && patientType !== PATIENT_TYPE.PEDIATRIC)
    ) {
      return NextResponse.json(
        { error: "Missing or invalid patientType. Must be ADULT or PEDIATRIC" },
        { status: 400 },
      );
    }

    // ---------------------------------------------------------------------------
    // 2. Parse optional params
    // ---------------------------------------------------------------------------
    const q = searchParams.get("q") || undefined;
    const insuranceId = searchParams.get("insuranceId") || undefined;

    const modalityRaw = searchParams.get("modality");
    const modality =
      modalityRaw && isValidSlotModality(modalityRaw) ? modalityRaw : undefined;

    const radius = Math.min(
      Math.max(Number(searchParams.get("radius")) || DEFAULT_SEARCH_RADIUS_MILES, 1),
      MAX_SEARCH_RADIUS_MILES,
    );

    const latRaw = searchParams.get("lat");
    const lngRaw = searchParams.get("lng");
    const lat = latRaw ? Number(latRaw) : NaN;
    const lng = lngRaw ? Number(lngRaw) : NaN;
    const hasGeo =
      !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

    const sortParam = searchParams.get("sort");
    const sort: "distance" | "time" =
      sortParam === "time" ? "time" : "distance";

    const cursor = Math.max(Number(searchParams.get("cursor")) || 0, 0);
    const size = Math.min(
      Math.max(Number(searchParams.get("size")) || SEARCH_PAGE_SIZE, 1),
      50,
    );

    // ---------------------------------------------------------------------------
    // 3. Cache key
    // ---------------------------------------------------------------------------
    const cacheKey = CacheKeys.search(
      hashParams({
        q,
        specialtyId,
        patientType,
        insuranceId,
        modality,
        radius,
        lat: hasGeo ? lat : null,
        lng: hasGeo ? lng : null,
        sort,
        cursor,
        size,
      }),
    );

    // ---------------------------------------------------------------------------
    // 4. Execute search (cache-first, but never cache empty results)
    // ---------------------------------------------------------------------------
    const execute = () =>
      executeSearch({
        q,
        specialtyId,
        patientType,
        insuranceId,
        modality,
        radius,
        lat: hasGeo ? lat : undefined,
        lng: hasGeo ? lng : undefined,
        sort,
        cursor,
        size,
      });

    const cached = cache.get<SearchResponse>(cacheKey);
    if (cached !== null && cached.total > 0) {
      return NextResponse.json(cached);
    }

    const result = await execute();

    // Only cache non-empty results to avoid serving stale empty responses
    if (result.total > 0) {
      cache.set(cacheKey, result, CacheTTL.SEARCH_RESULTS);
    } else {
      console.log(`[/api/search/providers] No results for specialty=${specialtyId} q=${q || "(none)"} patientType=${patientType} insurance=${insuranceId || "(none)"} modality=${modality || "(none)"} radius=${radius} geo=${hasGeo ? `${lat},${lng}` : "(none)"}`);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/search/providers] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// =============================================================================
// Core Search Logic
// =============================================================================

async function executeSearch(params: SearchParams): Promise<SearchResponse> {
  const now = new Date();

  // ---------------------------------------------------------------------------
  // Bounding box pre-filter (reduces Haversine calculations)
  // ---------------------------------------------------------------------------
  const bbox =
    params.lat != null && params.lng != null
      ? getBoundingBox(params.lat, params.lng, params.radius)
      : null;

  // ---------------------------------------------------------------------------
  // Build Prisma where clause
  // ---------------------------------------------------------------------------
  const where: Record<string, unknown> = {
    status: PROVIDER_STATUS.ACTIVE,
    clinic: {
      status: CLINIC_STATUS.PUBLISHED,

      // Insurance filter via ClinicInsurance junction
      ...(params.insuranceId
        ? { insurances: { some: { insuranceId: params.insuranceId } } }
        : {}),

      // Bounding box geo pre-filter
      ...(bbox
        ? {
            latitude: { gte: bbox.minLat, lte: bbox.maxLat },
            longitude: { gte: bbox.minLon, lte: bbox.maxLon },
          }
        : {}),
    },

    // Provider must offer a service in the requested specialty
    providerServices: {
      some: {
        service: {
          specialtyId: params.specialtyId,
          isActive: true,
        },
      },
    },

    // Provider must have at least one available slot (optionally by modality)
    slots: {
      some: {
        status: SLOT_STATUS.AVAILABLE,
        startTime: { gte: now },
        ...(params.modality ? { modality: params.modality } : {}),
      },
    },
  };

  // Unified smart text search across provider name + clinic info
  if (params.q) {
    (where as Record<string, unknown>).OR = [
      { firstName: { contains: params.q } },
      { lastName: { contains: params.q } },
      { clinic: { name: { contains: params.q } } },
      { clinic: { city: { contains: params.q } } },
      { clinic: { streetAddress: { contains: params.q } } },
    ];
  }

  // ---------------------------------------------------------------------------
  // Fetch matching providers from DB
  // ---------------------------------------------------------------------------
  const providers = await db.provider.findMany({
    where,
    include: {
      clinic: true,

      // 3 earliest available slots
      slots: {
        where: {
          status: SLOT_STATUS.AVAILABLE,
          startTime: { gte: now },
          ...(params.modality ? { modality: params.modality } : {}),
        },
        orderBy: { startTime: "asc" },
        take: 3,
      },

      // Most recent review snippet
      reviews: {
        where: { comment: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { comment: true },
      },

      // Service IDs for cost-badge lookup
      providerServices: {
        where: {
          service: { specialtyId: params.specialtyId, isActive: true },
        },
        select: { serviceId: true },
      },
    },
  });

  // ---------------------------------------------------------------------------
  // Cost badge: determine if insurance is demo
  // ---------------------------------------------------------------------------
  let isDemoInsurance = false;

  if (params.insuranceId) {
    const insurance = await db.insurance.findUnique({
      where: { id: params.insuranceId },
      select: { isDemo: true },
    });
    isDemoInsurance = insurance?.isDemo ?? false;
  }

  // ---------------------------------------------------------------------------
  // Batch-fetch copay data for demo insurance
  // ---------------------------------------------------------------------------
  const copayMap = new Map<string, number>();

  if (isDemoInsurance) {
    const serviceIds = Array.from(
      new Set(
        providers.flatMap((p) => p.providerServices.map((ps) => ps.serviceId)),
      ),
    );

    if (serviceIds.length > 0) {
      const serviceInsurances = await db.serviceInsurance.findMany({
        where: {
          serviceId: { in: serviceIds },
          insuranceId: params.insuranceId,
          isActive: true,
        },
        select: { serviceId: true, copayCents: true },
      });

      for (const si of serviceInsurances) {
        copayMap.set(si.serviceId, si.copayCents);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Build enriched provider results with distance + cost badge
  // ---------------------------------------------------------------------------
  let results: SortableProvider[] = providers.map((p) => {
    const distance =
      params.lat != null && params.lng != null
        ? haversineDistance(
            params.lat,
            params.lng,
            p.clinic.latitude,
            p.clinic.longitude,
          )
        : null;

    // --- Cost badge logic ---
    let costBadge: string | null = null;

    if (params.insuranceId) {
      if (isDemoInsurance) {
        // Demo insurance: look up ServiceInsurance copay
        const serviceId = p.providerServices[0]?.serviceId;
        if (serviceId != null && copayMap.has(serviceId)) {
          const copayCents = copayMap.get(serviceId)!;
          costBadge =
            copayCents === 0 ? "Free" : `$${copayCents / 100} Copay`;
        }
      }
      // Non-demo insurance: no cost badge
    } else {
      // Uninsured: self-pay flat rate
      const cents = p.clinic.selfPayFlatRateCents;
      if (cents > 0) {
        costBadge = `$${cents / 100}`;
      }
    }

    const earliestSlotTime =
      p.slots.length > 0 ? p.slots[0].startTime.getTime() : Infinity;

    return {
      id: p.id,
      slug: p.slug,
      firstName: p.firstName,
      lastName: p.lastName,
      credentials: p.credentials,
      photoUrl: p.photoUrl,
      rating: p.rating,
      reviewCount: p.reviewCount,
      slotDurationMinutes: p.slotDurationMinutes,
      clinic: {
        id: p.clinic.id,
        slug: p.clinic.slug,
        name: p.clinic.name,
        streetAddress: p.clinic.streetAddress,
        city: p.clinic.city,
        state: p.clinic.state,
        zipCode: p.clinic.zipCode,
        phoneNumber: p.clinic.phoneNumber,
        logoUrl: p.clinic.logoUrl,
      },
      distance,
      earliestSlots: p.slots.map((s) => ({
        id: s.id,
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
        modality: s.modality,
      })),
      reviewSnippet: p.reviews[0]?.comment ?? null,
      costBadge,
      _earliestSlotTime: earliestSlotTime,
      _random: Math.random(),
    };
  });

  // ---------------------------------------------------------------------------
  // Precise Haversine radius filter (after bounding box pre-filter)
  // ---------------------------------------------------------------------------
  if (params.lat != null && params.lng != null) {
    results = results.filter(
      (r) => r.distance !== null && r.distance <= params.radius,
    );
  }

  // ---------------------------------------------------------------------------
  // Sort with tie-breaking (per spec)
  // ---------------------------------------------------------------------------
  results.sort((a, b) => {
    if (params.sort === "distance") {
      // Distance ASC → Earliest Slot ASC → Rating DESC → Name ASC → random
      const distA = a.distance ?? Infinity;
      const distB = b.distance ?? Infinity;
      if (distA !== distB) return distA - distB;

      if (a._earliestSlotTime !== b._earliestSlotTime) {
        return a._earliestSlotTime - b._earliestSlotTime;
      }
    } else {
      // sort === "time"
      // Earliest Slot ASC → Distance ASC → Rating DESC → Name ASC → random
      if (a._earliestSlotTime !== b._earliestSlotTime) {
        return a._earliestSlotTime - b._earliestSlotTime;
      }

      const distA = a.distance ?? Infinity;
      const distB = b.distance ?? Infinity;
      if (distA !== distB) return distA - distB;
    }

    // Rating DESC
    if (a.rating !== b.rating) return b.rating - a.rating;

    // Name ASC (lastName then firstName for deterministic ordering)
    const nameA = `${a.lastName} ${a.firstName}`;
    const nameB = `${b.lastName} ${b.firstName}`;
    const nameCmp = nameA.localeCompare(nameB);
    if (nameCmp !== 0) return nameCmp;

    // Random shuffle — breaks persistent ties to prevent ranking bias.
    // Randomness is per-cache-entry, so identical requests within the TTL
    // see the same order, but a fresh cache miss produces a different shuffle.
    return a._random - b._random;
  });

  // ---------------------------------------------------------------------------
  // Cursor-based pagination
  // ---------------------------------------------------------------------------
  const total = results.length;
  const page = results.slice(params.cursor, params.cursor + params.size);

  // Strip internal sort fields before returning
  const finalProviders: ProviderResult[] = page.map((p) => {
    const { _earliestSlotTime: _t, _random: _r, ...rest } = p;
    return rest;
  });

  return {
    providers: finalProviders,
    hasMore: params.cursor + params.size < total,
    total,
  };
}