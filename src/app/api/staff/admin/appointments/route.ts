import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STAFF_ROLE, isValidAppointmentStatus } from "@/lib/enums";
import { Prisma } from "@prisma/client";
import { startOfDay, endOfDay, parseISO } from "date-fns";

// =============================================================================
// GET /api/staff/admin/appointments — Global appointment search (E1)
// SYSTEM_MANAGER only. Searches ALL clinics by default.
// Query: search, status, clinicId (optional filter), dateFrom, dateTo, page, limit
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
    const search = searchParams.get("search")?.trim() || "";
    const statusParam = searchParams.get("status");
    const clinicIdParam = searchParams.get("clinicId");
    const dateFromParam = searchParams.get("dateFrom");
    const dateToParam = searchParams.get("dateTo");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20)
    );

    // Build where clause — NO clinicId required
    const where: Prisma.AppointmentWhereInput = {};

    // Optional clinic filter
    if (clinicIdParam) {
      where.clinicId = clinicIdParam;
    }

    // Status filter
    if (statusParam) {
      const statuses = statusParam
        .split(",")
        .map((s) => s.trim())
        .filter((s) => isValidAppointmentStatus(s));
      if (statuses.length > 0) {
        where.status = { in: statuses };
      }
    }

    // Date range
    if (dateFromParam || dateToParam) {
      where.startTime = {};
      if (dateFromParam) {
        try {
          where.startTime.gte = startOfDay(parseISO(dateFromParam));
        } catch {
          // ignore invalid date
        }
      }
      if (dateToParam) {
        try {
          where.startTime.lte = endOfDay(parseISO(dateToParam));
        } catch {
          // ignore invalid date
        }
      }
    }

    // Search filter (patient name/email/phone/booking token)
    if (search) {
      where.OR = [
        { patientName: { contains: search } },
        { patientEmail: { contains: search } },
        { patientPhone: { contains: search } },
        { id: { contains: search } },
        { tokens: { some: { id: { contains: search } } } },
      ];
    }

    // Count and fetch
    const [total, appointments] = await Promise.all([
      db.appointment.count({ where }),
      db.appointment.findMany({
        where,
        orderBy: { startTime: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          clinic: { select: { id: true, name: true } },
          provider: {
            select: { id: true, firstName: true, lastName: true, credentials: true },
          },
          service: { select: { id: true, name: true } },
          slot: { select: { id: true, modality: true, status: true } },
        },
      }),
    ]);

    return NextResponse.json({
      data: appointments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[ADMIN_APPOINTMENTS_LIST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}