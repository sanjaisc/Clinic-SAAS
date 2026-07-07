import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STAFF_ROLE } from "@/lib/enums";
import { Prisma } from "@prisma/client";

// =============================================================================
// GET /api/staff/admin/waitlist — Aggregated waitlist across ALL clinics (E2)
// SYSTEM_MANAGER only. Optional clinicId filter.
// Query: status filter, clinicId (optional)
// Include clinic name, provider name, service name
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    if (user.role !== STAFF_ROLE.SYSTEM_MANAGER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse query params
    const { searchParams } = request.nextUrl;
    const statusParam = searchParams.get("status");
    const clinicIdParam = searchParams.get("clinicId");

    // Build where clause
    const where: Prisma.WaitlistEntryWhereInput = {};

    // Optional status filter
    if (statusParam) {
      const validStatuses = ["ACTIVE", "OFFERED", "FULFILLED", "EXPIRED", "REMOVED"];
      const statuses = statusParam
        .split(",")
        .map((s) => s.trim())
        .filter((s) => validStatuses.includes(s));
      if (statuses.length > 0) {
        where.status = { in: statuses };
      }
    }

    // Optional clinic filter
    if (clinicIdParam) {
      where.clinicId = clinicIdParam;
    }

    const entries = await db.waitlistEntry.findMany({
      where,
      include: {
        clinic: { select: { id: true, name: true } },
        provider: {
          select: { firstName: true, lastName: true, credentials: true },
        },
        service: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = entries.map((entry) => ({
      id: entry.id,
      patientName: entry.patientName,
      patientEmail: entry.patientEmail,
      patientPhone: entry.patientPhone,
      patientType: entry.patientType,
      modality: entry.modality,
      status: entry.status,
      dateFrom: entry.dateFrom,
      dateTo: entry.dateTo,
      contactCount: entry.contactCount,
      lastContactAt: entry.lastContactAt,
      offeredAt: entry.offeredAt,
      offerExpiresAt: entry.offerExpiresAt,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      clinicId: entry.clinicId,
      clinicName: entry.clinic.name,
      providerName: `${entry.provider.firstName} ${entry.provider.lastName}${entry.provider.credentials ? `, ${entry.provider.credentials}` : ""}`,
      serviceName: entry.service.name,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("[ADMIN_WAITLIST_LIST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}