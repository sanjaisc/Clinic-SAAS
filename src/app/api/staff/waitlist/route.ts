import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// =============================================================================
// GET /api/staff/waitlist — Fetch waitlist entries for the staff's clinic
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinicId = session.user.clinicId;
    const role = session.user.role;

    // System managers must specify a clinic
    const targetClinicId =
      request.nextUrl.searchParams.get("clinicId") || clinicId;
    if (!targetClinicId) {
      return NextResponse.json(
        { error: "No clinic specified" },
        { status: 400 }
      );
    }

    // Non-system managers can only see their own clinic
    if (role !== "SYSTEM_MANAGER" && clinicId && targetClinicId !== clinicId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const status = request.nextUrl.searchParams.get("status") || undefined;

    // Build where clause
    const where: Prisma.WaitlistEntryWhereInput = {
      clinicId: targetClinicId,
    };

    if (status) {
      where.status = status;
    } else {
      // By default, only show active entries
      where.status = { in: ["ACTIVE", "OFFERED"] };
    }

    const entries = await db.waitlistEntry.findMany({
      where,
      include: {
        provider: {
          select: { firstName: true, lastName: true, credentials: true },
        },
        service: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Map to a clean response format
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
      providerName: `Dr. ${entry.provider.firstName} ${entry.provider.lastName}${entry.provider.credentials ? `, ${entry.provider.credentials}` : ""}`,
      serviceName: entry.service.name,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Staff waitlist GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch waitlist entries" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH /api/staff/waitlist — Update a waitlist entry (status or incrementContact)
// =============================================================================
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, status, incrementContact } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    // Validate status transition
    const validStatuses = ["ACTIVE", "OFFERED", "FULFILLED", "EXPIRED", "REMOVED"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify the entry belongs to the staff's clinic
    const existing = await db.waitlistEntry.findUnique({
      where: { id },
      select: { clinicId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Waitlist entry not found" },
        { status: 404 }
      );
    }

    const clinicId = session.user.clinicId;
    const role = session.user.role;

    if (role !== "SYSTEM_MANAGER" && clinicId && existing.clinicId !== clinicId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Handle incrementContact separately
    if (incrementContact === true) {
      const updated = await db.waitlistEntry.update({
        where: { id },
        data: {
          contactCount: { increment: 1 },
          lastContactAt: new Date(),
        },
        include: {
          provider: {
            select: { firstName: true, lastName: true, credentials: true },
          },
          service: {
            select: { name: true },
          },
        },
      });

      return NextResponse.json({
        data: {
          id: updated.id,
          patientName: updated.patientName,
          patientEmail: updated.patientEmail,
          patientPhone: updated.patientPhone,
          patientType: updated.patientType,
          modality: updated.modality,
          status: updated.status,
          dateFrom: updated.dateFrom,
          dateTo: updated.dateTo,
          contactCount: updated.contactCount,
          lastContactAt: updated.lastContactAt,
          offeredAt: updated.offeredAt,
          offerExpiresAt: updated.offerExpiresAt,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          providerName: `Dr. ${updated.provider.firstName} ${updated.provider.lastName}${updated.provider.credentials ? `, ${updated.provider.credentials}` : ""}`,
          serviceName: updated.service.name,
        },
      });
    }

    // Build update data for status changes
    const updateData: Prisma.WaitlistEntryUpdateInput = {};

    if (status) {
      updateData.status = status;
    }

    const updated = await db.waitlistEntry.update({
      where: { id },
      data: updateData,
      include: {
        provider: {
          select: { firstName: true, lastName: true, credentials: true },
        },
        service: {
          select: { name: true },
        },
      },
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        patientName: updated.patientName,
        patientEmail: updated.patientEmail,
        patientPhone: updated.patientPhone,
        patientType: updated.patientType,
        modality: updated.modality,
        status: updated.status,
        dateFrom: updated.dateFrom,
        dateTo: updated.dateTo,
        contactCount: updated.contactCount,
        lastContactAt: updated.lastContactAt,
        offeredAt: updated.offeredAt,
        offerExpiresAt: updated.offerExpiresAt,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        providerName: `Dr. ${updated.provider.firstName} ${updated.provider.lastName}${updated.provider.credentials ? `, ${updated.provider.credentials}` : ""}`,
        serviceName: updated.service.name,
      },
    });
  } catch (error) {
    console.error("Staff waitlist PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update waitlist entry" },
      { status: 500 }
    );
  }
}