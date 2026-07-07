import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { RESCHEDULE_POLICY, isValidReschedulePolicy } from "@/lib/enums";
import { cache } from "@/lib/cache";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";

// =============================================================================
// GET /api/staff/financial?clinicId=xxx
// Returns all financial/policy settings for a clinic
// =============================================================================
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
    const cacheKey = `staff:financial:${clinicId}`;
    const cached = cache.get<unknown>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Fetch clinic financial settings
    const clinic = await db.clinic.findUnique({
      where: { id: clinicId },
      select: {
        inPersonDepositCents: true,
        videoDepositCents: true,
        selfPayFlatRateCents: true,
        cancellationLeadTimeMin: true,
        videoCancellationLeadTimeMin: true,
        reschedulePolicy: true,
      },
    });

    if (!clinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    // Fetch system config for validation boundaries
    const systemConfig = await db.systemConfig.findUnique({
      where: { id: "singleton" },
      select: { minDepositCents: true, maxDepositCents: true },
    });

    // Fetch clinic's provider service assignments with payment types
    const providerServices = await db.providerService.findMany({
      where: {
        provider: { clinicId },
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            selfPayPaymentType: true,
            selfPayPriceCents: true,
            durationMinutes: true,
          },
        },
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            credentials: true,
          },
        },
      },
    });

    // Build a unique list of services assigned to this clinic's providers
    const serviceMap = new Map<string, {
      id: string;
      name: string;
      selfPayPaymentType: string;
      selfPayPriceCents: number;
      durationMinutes: number;
      providers: Array<{ id: string; firstName: string; lastName: string; credentials: string | null }>;
    }>();

    for (const ps of providerServices) {
      const existing = serviceMap.get(ps.service.id);
      if (existing) {
        existing.providers.push(ps.provider);
      } else {
        serviceMap.set(ps.service.id, {
          ...ps.service,
          providers: [ps.provider],
        });
      }
    }

    const response = {
      inPersonDepositCents: clinic.inPersonDepositCents,
      videoDepositCents: clinic.videoDepositCents,
      selfPayFlatRateCents: clinic.selfPayFlatRateCents,
      cancellationLeadTimeMin: clinic.cancellationLeadTimeMin,
      videoCancellationLeadTimeMin: clinic.videoCancellationLeadTimeMin,
      reschedulePolicy: clinic.reschedulePolicy,
      system: {
        minDepositCents: systemConfig?.minDepositCents ?? 0,
        maxDepositCents: systemConfig?.maxDepositCents ?? 50000,
      },
      services: Array.from(serviceMap.values()),
    };

    // Cache for 60 seconds
    cache.set(cacheKey, response, 60);

    return NextResponse.json(response);
  } catch (error) {
    console.error("[STAFF_FINANCIAL_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =============================================================================
// PATCH /api/staff/financial
// Update financial settings with validation
// =============================================================================
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinicId = session.user.clinicId;
    if (!clinicId) {
      return NextResponse.json({ error: "No clinic context" }, { status: 400 });
    }

    const body = await request.json();
    const {
      inPersonDepositCents,
      videoDepositCents,
      cancellationLeadTimeMin,
      videoCancellationLeadTimeMin,
      reschedulePolicy,
      selfPayFlatRateCents,
    } = body;

    // Fetch system config for validation
    const systemConfig = await db.systemConfig.findUnique({
      where: { id: "singleton" },
      select: { minDepositCents: true, maxDepositCents: true },
    });

    const minDeposit = systemConfig?.minDepositCents ?? 0;
    const maxDeposit = systemConfig?.maxDepositCents ?? 50000;

    // Validate deposit amounts
    if (inPersonDepositCents !== undefined) {
      if (typeof inPersonDepositCents !== "number" || inPersonDepositCents < 0) {
        return NextResponse.json({ error: "In-person deposit must be a non-negative number" }, { status: 400 });
      }
      if (inPersonDepositCents < minDeposit || inPersonDepositCents > maxDeposit) {
        return NextResponse.json({
          error: `In-person deposit must be between $${(minDeposit / 100).toFixed(2)} and $${(maxDeposit / 100).toFixed(2)}`,
        }, { status: 400 });
      }
    }

    if (videoDepositCents !== undefined) {
      if (typeof videoDepositCents !== "number" || videoDepositCents < 0) {
        return NextResponse.json({ error: "Telehealth deposit must be a non-negative number" }, { status: 400 });
      }
      if (videoDepositCents < minDeposit || videoDepositCents > maxDeposit) {
        return NextResponse.json({
          error: `Telehealth deposit must be between $${(minDeposit / 100).toFixed(2)} and $${(maxDeposit / 100).toFixed(2)}`,
        }, { status: 400 });
      }
    }

    // Validate lead times
    if (cancellationLeadTimeMin !== undefined) {
      if (typeof cancellationLeadTimeMin !== "number" || cancellationLeadTimeMin < 0) {
        return NextResponse.json({ error: "In-person cancellation lead time must be a non-negative number" }, { status: 400 });
      }
    }

    if (videoCancellationLeadTimeMin !== undefined) {
      if (typeof videoCancellationLeadTimeMin !== "number" || videoCancellationLeadTimeMin < 0) {
        return NextResponse.json({ error: "Telehealth cancellation lead time must be a non-negative number" }, { status: 400 });
      }
    }

    // Validate reschedule policy
    if (reschedulePolicy !== undefined) {
      if (!isValidReschedulePolicy(reschedulePolicy)) {
        return NextResponse.json({
          error: `Invalid reschedule policy. Must be one of: ${Object.values(RESCHEDULE_POLICY).join(", ")}`,
        }, { status: 400 });
      }
    }

    // Validate self-pay flat rate
    if (selfPayFlatRateCents !== undefined) {
      if (typeof selfPayFlatRateCents !== "number" || selfPayFlatRateCents < 0) {
        return NextResponse.json({ error: "Self-pay flat rate must be a non-negative number" }, { status: 400 });
      }
    }

    // Build update data (only include fields that were provided)
    const updateData: Record<string, unknown> = {};
    if (inPersonDepositCents !== undefined) updateData.inPersonDepositCents = Math.round(inPersonDepositCents);
    if (videoDepositCents !== undefined) updateData.videoDepositCents = Math.round(videoDepositCents);
    if (cancellationLeadTimeMin !== undefined) updateData.cancellationLeadTimeMin = Math.round(cancellationLeadTimeMin);
    if (videoCancellationLeadTimeMin !== undefined) updateData.videoCancellationLeadTimeMin = Math.round(videoCancellationLeadTimeMin);
    if (reschedulePolicy !== undefined) updateData.reschedulePolicy = reschedulePolicy;
    if (selfPayFlatRateCents !== undefined) updateData.selfPayFlatRateCents = Math.round(selfPayFlatRateCents);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await db.clinic.update({
      where: { id: clinicId },
      data: updateData,
      select: {
        inPersonDepositCents: true,
        videoDepositCents: true,
        selfPayFlatRateCents: true,
        cancellationLeadTimeMin: true,
        videoCancellationLeadTimeMin: true,
        reschedulePolicy: true,
      },
    });

    // Invalidate caches
    cache.deleteByPrefix(`staff:services:${clinicId}`);
    cache.deleteByPrefix(`staff:financial:${clinicId}`);

    await createAuditLog({
      userId: session.user.id,
      action: AUDIT_ACTIONS.CLINIC_UPDATED,
      targetType: "Clinic",
      targetId: clinicId,
    });

    return NextResponse.json({ success: true, ...updated });
  } catch (error) {
    console.error("[STAFF_FINANCIAL_PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}