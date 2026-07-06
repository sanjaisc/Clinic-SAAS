import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// =============================================================================
// GET /api/staff/appointments/conflicts?clinicId=X
// Finds potential double-bookings by matching patientEmail or patientPhone
// =============================================================================

interface ConflictGroup {
  matchField: "email" | "phone";
  matchValue: string;
  appointments: Array<{
    id: string;
    patientName: string;
    providerName: string;
    startTime: string;
    endTime: string;
    status: string;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinicId = session.user.clinicId;
    const role = session.user.role;

    // System managers can specify a different clinic
    const targetClinicId =
      role === "SYSTEM_MANAGER"
        ? (request.nextUrl.searchParams.get("clinicId") || clinicId)
        : clinicId;

    if (!targetClinicId) {
      return NextResponse.json(
        { error: "No clinic specified" },
        { status: 400 }
      );
    }

    if (role !== "SYSTEM_MANAGER" && clinicId && targetClinicId !== clinicId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch non-cancelled, non-no-show appointments for this clinic
    const appointments = await db.appointment.findMany({
      where: {
        clinicId: targetClinicId,
        status: { in: ["BOOKED", "CHECKED_IN"] },
      },
      select: {
        id: true,
        patientName: true,
        patientEmail: true,
        patientPhone: true,
        startTime: true,
        endTime: true,
        status: true,
        provider: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    const conflicts: ConflictGroup[] = [];

    // Group by email
    const emailGroups = new Map<string, typeof appointments>();
    for (const apt of appointments) {
      if (!apt.patientEmail) continue;
      const key = apt.patientEmail.toLowerCase();
      if (!emailGroups.has(key)) {
        emailGroups.set(key, []);
      }
      emailGroups.get(key)!.push(apt);
    }

    for (const [email, group] of emailGroups) {
      if (group.length > 1) {
        conflicts.push({
          matchField: "email",
          matchValue: email,
          appointments: group.map((a) => ({
            id: a.id,
            patientName: a.patientName,
            providerName: `Dr. ${a.provider.firstName} ${a.provider.lastName}`,
            startTime: a.startTime.toISOString(),
            endTime: a.endTime.toISOString(),
            status: a.status,
          })),
        });
      }
    }

    // Group by phone
    const phoneGroups = new Map<string, typeof appointments>();
    for (const apt of appointments) {
      if (!apt.patientPhone) continue;
      const key = apt.patientPhone.replace(/\D/g, ""); // normalize: digits only
      if (!phoneGroups.has(key)) {
        phoneGroups.set(key, []);
      }
      phoneGroups.get(key)!.push(apt);
    }

    for (const [phone, group] of phoneGroups) {
      if (group.length > 1) {
        conflicts.push({
          matchField: "phone",
          matchValue: phone,
          appointments: group.map((a) => ({
            id: a.id,
            patientName: a.patientName,
            providerName: `Dr. ${a.provider.firstName} ${a.provider.lastName}`,
            startTime: a.startTime.toISOString(),
            endTime: a.endTime.toISOString(),
            status: a.status,
          })),
        });
      }
    }

    return NextResponse.json({ conflicts });
  } catch (error) {
    console.error("[STAFF_CONFLICTS]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}