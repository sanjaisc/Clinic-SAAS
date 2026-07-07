import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { cache, CacheKeys, CacheTTL } from "@/lib/cache";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinicId =
      request.nextUrl.searchParams.get("clinicId") || session.user.clinicId;
    if (!clinicId) {
      return NextResponse.json({ error: "No clinic specified" }, { status: 400 });
    }

    if (
      session.user.role !== "SYSTEM_MANAGER" &&
      session.user.clinicId &&
      clinicId !== session.user.clinicId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const cacheKey = CacheKeys.clinic(clinicId);
    const cached = cache.get<{ hoursOfOperation: unknown }>(cacheKey);
    let hoursOfOperation: unknown = null;

    if (cached) {
      hoursOfOperation = cached.hoursOfOperation;
    } else {
      const clinic = await db.clinic.findUnique({
        where: { id: clinicId },
        select: { hoursOfOperation: true },
      });
      if (!clinic) {
        return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
      }
      try {
        hoursOfOperation = clinic.hoursOfOperation
          ? JSON.parse(clinic.hoursOfOperation)
          : {};
      } catch {
        hoursOfOperation = {};
      }
    }

    const closures = await db.clinicClosure.findMany({
      where: { clinicId },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json({ hoursOfOperation, closures });
  } catch (error) {
    console.error("[STAFF_HOURS_GET]", error);
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
      return NextResponse.json({ error: "No clinic specified" }, { status: 400 });
    }

    if (
      session.user.role !== "SYSTEM_MANAGER" &&
      session.user.clinicId &&
      clinicId !== session.user.clinicId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { hoursOfOperation } = body;

    if (!hoursOfOperation || typeof hoursOfOperation !== "object") {
      return NextResponse.json(
        { error: "hoursOfOperation must be an object" },
        { status: 400 }
      );
    }

    // Validate the structure
    const validDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    for (const day of Object.keys(hoursOfOperation)) {
      if (!validDays.includes(day)) {
        return NextResponse.json(
          { error: `Invalid day key: ${day}` },
          { status: 400 }
        );
      }
      const dayData = hoursOfOperation[day];
      if (dayData && !Array.isArray(dayData.ranges) && typeof dayData !== "boolean" && typeof dayData !== "object") {
        return NextResponse.json(
          { error: `Invalid format for ${day}` },
          { status: 400 }
        );
      }
    }

    await db.clinic.update({
      where: { id: clinicId },
      data: {
        hoursOfOperation: JSON.stringify(hoursOfOperation),
      },
    });

    // Invalidate cache
    cache.deleteByPrefix("clinic:");

    await createAuditLog({
      userId: session.user.id,
      action: AUDIT_ACTIONS.CLINIC_UPDATED,
      targetType: "CLINIC",
      targetId: clinicId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[STAFF_HOURS_PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}