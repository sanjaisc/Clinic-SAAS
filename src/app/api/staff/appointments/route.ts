import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { APPOINTMENT_STATUS, isValidAppointmentStatus } from "@/lib/enums";
import { Prisma } from "@prisma/client";
import { startOfDay, endOfDay, parseISO } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
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

    // Parse query params
    const { searchParams } = request.nextUrl;
    const statusParam = searchParams.get("status"); // comma-separated
    const dateFromParam = searchParams.get("dateFrom");
    const dateToParam = searchParams.get("dateTo");
    const search = searchParams.get("search")?.trim() || "";
    const providerId = searchParams.get("providerId") || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20)
    );

    // Build where clause
    const where: Prisma.AppointmentWhereInput = {
      clinicId: targetClinicId,
    };

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

    // Date range — default to today
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
    } else {
      // Default: today's appointments
      const today = new Date();
      where.startTime = {
        gte: startOfDay(today),
        lte: endOfDay(today),
      };
    }

    // Search filter (patient name/email/phone)
    if (search) {
      where.OR = [
        { patientName: { contains: search } },
        { patientEmail: { contains: search } },
        { patientPhone: { contains: search } },
      ];
    }

    // Provider filter
    if (providerId) {
      where.providerId = providerId;
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
          provider: {
            select: { id: true, firstName: true, lastName: true, credentials: true },
          },
          service: { select: { id: true, name: true } },
          slot: { select: { id: true, modality: true, status: true } },
          insurance: { select: { id: true, name: true, isDemo: true } },
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
    console.error("[STAFF_APPOINTMENTS_LIST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}