import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STAFF_ROLE } from "@/lib/enums";
import { Prisma } from "@prisma/client";

// =============================================================================
// GET /api/staff/admin/patient-matches — Ambiguous patient matches (E3)
// SYSTEM_MANAGER only.
// Finds potential duplicate patients by grouping appointments that share
// email OR phone but have different patient names or are for different clinics.
// Returns groups of 2+ appointments.
// =============================================================================

interface MatchGroup {
  matchType: "email" | "phone";
  matchValue: string;
  hasNameMismatch: boolean;
  hasCrossClinic: boolean;
  appointments: Array<{
    id: string;
    patientName: string;
    patientEmail: string;
    patientPhone: string;
    clinicId: string;
    clinicName: string;
    providerName: string;
    serviceName: string;
    startTime: string;
    status: string;
  }>;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    if (user.role !== STAFF_ROLE.SYSTEM_MANAGER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all appointments with clinic, provider, service names
    // Only include appointments that have an email or phone (non-empty)
    const appointments = await db.appointment.findMany({
      where: {
        OR: [
          { patientEmail: { not: "" } },
          { patientPhone: { not: "" } },
        ],
      },
      select: {
        id: true,
        patientName: true,
        patientEmail: true,
        patientPhone: true,
        clinicId: true,
        startTime: true,
        status: true,
        clinic: { select: { name: true } },
        provider: {
          select: { firstName: true, lastName: true, credentials: true },
        },
        service: { select: { name: true } },
      },
      orderBy: { startTime: "desc" },
    });

    // Normalize email/phone for grouping
    const normalizeEmail = (e: string) => e.trim().toLowerCase();
    const normalizePhone = (p: string) => p.replace(/\D/g, ""); // strip non-digits

    // Group by email
    const emailGroups = new Map<string, typeof appointments>();
    for (const apt of appointments) {
      if (!apt.patientEmail || apt.patientEmail.trim() === "") continue;
      const key = normalizeEmail(apt.patientEmail);
      if (!emailGroups.has(key)) {
        emailGroups.set(key, []);
      }
      emailGroups.get(key)!.push(apt);
    }

    // Group by phone
    const phoneGroups = new Map<string, typeof appointments>();
    for (const apt of appointments) {
      if (!apt.patientPhone || apt.patientPhone.trim() === "") continue;
      const key = normalizePhone(apt.patientPhone);
      if (!phoneGroups.has(key)) {
        phoneGroups.set(key, []);
      }
      phoneGroups.get(key)!.push(apt);
    }

    // Build match groups from email groups
    const groups: MatchGroup[] = [];
    const seenIds = new Set<string>();

    const processGroup = (
      type: "email" | "phone",
      value: string,
      apts: typeof appointments
    ) => {
      // Only keep groups with 2+ distinct appointments
      if (apts.length < 2) return;

      // Check for name mismatch
      const names = new Set(apts.map((a) => a.patientName.trim().toLowerCase()));
      const hasNameMismatch = names.size > 1;

      // Check for cross-clinic
      const clinics = new Set(apts.map((a) => a.clinicId));
      const hasCrossClinic = clinics.size > 1;

      // Only include if names differ or clinics differ
      if (!hasNameMismatch && !hasCrossClinic) return;

      // Deduplicate appointment IDs already seen in another group
      const uniqueApts = apts.filter((a) => {
        if (seenIds.has(a.id)) return false;
        seenIds.add(a.id);
        return true;
      });

      if (uniqueApts.length < 2) return;

      groups.push({
        matchType: type,
        matchValue: type === "email" ? apts[0].patientEmail : apts[0].patientPhone,
        hasNameMismatch,
        hasCrossClinic,
        appointments: uniqueApts.map((a) => ({
          id: a.id,
          patientName: a.patientName,
          patientEmail: a.patientEmail,
          patientPhone: a.patientPhone,
          clinicId: a.clinicId,
          clinicName: a.clinic.name,
          providerName: `${a.provider.firstName} ${a.provider.lastName}${a.provider.credentials ? `, ${a.provider.credentials}` : ""}`,
          serviceName: a.service.name,
          startTime: a.startTime.toISOString(),
          status: a.status,
        })),
      });
    };

    for (const [key, apts] of emailGroups) {
      processGroup("email", key, apts);
    }

    for (const [key, apts] of phoneGroups) {
      processGroup("phone", key, apts);
    }

    // Sort by hasNameMismatch desc (most suspicious first), then by matchValue
    groups.sort((a, b) => {
      if (a.hasNameMismatch !== b.hasNameMismatch) {
        return a.hasNameMismatch ? -1 : 1;
      }
      return a.matchValue.localeCompare(b.matchValue);
    });

    return NextResponse.json({ data: groups });
  } catch (error) {
    console.error("[ADMIN_PATIENT_MATCHES]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}