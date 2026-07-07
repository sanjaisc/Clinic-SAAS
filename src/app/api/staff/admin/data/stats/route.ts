// =============================================================================
// Data Management Stats — GET /api/staff/admin/data/stats
// =============================================================================
// Returns table counts for all models and DB file size.
// Auth-gated: SYSTEM_MANAGER only.
// =============================================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STAFF_ROLE } from "@/lib/enums";
import { promises as fs } from "fs";
import { resolve } from "path";

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

    // Run all count queries in parallel
    const [
      clinics,
      providers,
      services,
      specialties,
      insurances,
      amenities,
      languages,
      slots,
      appointments,
      reviews,
      waitlistEntries,
      users,
      slotLocks,
      slotTemplates,
      auditLogs,
      systemErrorLogs,
      emailTemplates,
      staffInvitations,
      conversionEvents,
      providerServices,
      clinicInsurances,
      clinicAmenities,
      providerLanguages,
      clinicClosures,
      appointmentLedgers,
      internalNotes,
      tokens,
      serviceInsurances,
    ] = await Promise.all([
      db.clinic.count(),
      db.provider.count(),
      db.service.count(),
      db.specialty.count(),
      db.insurance.count(),
      db.amenity.count(),
      db.language.count(),
      db.slot.count(),
      db.appointment.count(),
      db.review.count(),
      db.waitlistEntry.count(),
      db.user.count(),
      db.slotLock.count(),
      db.slotTemplate.count(),
      db.auditLog.count(),
      db.systemErrorLog.count(),
      db.emailTemplate.count(),
      db.staffInvitation.count(),
      db.conversionEvent.count(),
      db.providerService.count(),
      db.clinicInsurance.count(),
      db.clinicAmenity.count(),
      db.providerLanguage.count(),
      db.clinicClosure.count(),
      db.appointmentLedger.count(),
      db.internalNote.count(),
      db.token.count(),
      db.serviceInsurance.count(),
    ]);

    // Try to get DB file size
    let dbFileSize: string | null = null;
    try {
      const dbPath = process.env.DATABASE_URL?.replace("file:", "") || resolve(process.cwd(), "db", "dev.db");
      const stat = await fs.stat(dbPath);
      const bytes = stat.size;
      if (bytes < 1024) {
        dbFileSize = `${bytes} B`;
      } else if (bytes < 1024 * 1024) {
        dbFileSize = `${(bytes / 1024).toFixed(1)} KB`;
      } else {
        dbFileSize = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
      }
    } catch {
      // DB file not accessible or doesn't exist
    }

    // Count resolved error logs
    const resolvedErrorLogs = await db.systemErrorLog.count({
      where: { resolved: true },
    });

    return NextResponse.json({
      tables: {
        clinics,
        providers,
        services,
        specialties,
        insurances,
        amenities,
        languages,
        slots,
        appointments,
        reviews,
        waitlistEntries,
        users,
        slotLocks,
        slotTemplates,
        auditLogs,
        systemErrorLogs,
        emailTemplates,
        staffInvitations,
        conversionEvents,
        providerServices,
        clinicInsurances,
        clinicAmenities,
        providerLanguages,
        clinicClosures,
        appointmentLedgers,
        internalNotes,
        tokens,
        serviceInsurances,
      },
      dbFileSize,
      resolvedErrorLogs,
      totalRows: clinics + providers + services + specialties + insurances + amenities + languages + slots + appointments + reviews + waitlistEntries + users + slotLocks + slotTemplates + auditLogs + systemErrorLogs + emailTemplates + staffInvitations + conversionEvents + providerServices + clinicInsurances + clinicAmenities + providerLanguages + clinicClosures + appointmentLedgers + internalNotes + tokens + serviceInsurances,
    });
  } catch (error) {
    console.error("[DATA_STATS]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}