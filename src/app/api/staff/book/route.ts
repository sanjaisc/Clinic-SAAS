import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  APPOINTMENT_STATUS,
  SLOT_STATUS,
  PAYMENT_STATUS,
  LEDGER_TYPE,
  PAYMENT_METHOD,
  PATIENT_TYPE,
  TOKEN_PURPOSE,
  canTransitionTo,
} from "@/lib/enums";
import { generateSecureToken, hashToken } from "@/lib/crypto";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { cache } from "@/lib/cache";
import { TOKEN_EXPIRY_DAYS_AFTER_APPOINTMENT } from "@/lib/constants";
import { Prisma } from "@prisma/client";
import { startOfDay, endOfDay } from "date-fns";

// =============================================================================
// Custom Error
// =============================================================================

class ManualBookingError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ManualBookingError";
    this.code = code;
    this.status = status;
  }
}

// =============================================================================
// GET — Fetch booking form data
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinicId = session.user.clinicId;
    if (!clinicId) {
      return NextResponse.json(
        { error: "No clinic assigned to this user" },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const providerId = searchParams.get("providerId");
    const dateStr = searchParams.get("date");

    // Always return providers, services, and insurance for the clinic
    const [providers, services, insurances] = await Promise.all([
      db.provider.findMany({
        where: {
          clinicId,
          status: "ACTIVE",
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          credentials: true,
          slotDurationMinutes: true,
          providerServices: {
            include: {
              service: {
                select: { id: true, name: true, specialtyId: true },
              },
            },
          },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      db.service.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          specialtyId: true,
          durationMinutes: true,
          selfPayPriceCents: true,
        },
        orderBy: { sortOrder: "asc" },
      }),
      db.insurance.findMany({
        where: { isActive: true },
        select: { id: true, name: true, isDemo: true },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    // If providerId and date are provided, also return available slots
    let slots: Array<{
      id: string;
      startTime: string;
      endTime: string;
      modality: string;
    }> = [];

    if (providerId && dateStr) {
      // Validate the provider belongs to this clinic
      const provider = providers.find((p) => p.id === providerId);
      if (!provider) {
        return NextResponse.json(
          { error: "Provider not found for this clinic" },
          { status: 400 }
        );
      }

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return NextResponse.json(
          { error: "Invalid date format" },
          { status: 400 }
        );
      }

      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);

      const slotRecords = await db.slot.findMany({
        where: {
          providerId,
          clinicId,
          status: SLOT_STATUS.AVAILABLE,
          startTime: { gte: dayStart, lt: dayEnd },
        },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          modality: true,
        },
        orderBy: { startTime: "asc" },
      });

      slots = slotRecords.map((s) => ({
        id: s.id,
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
        modality: s.modality,
      }));
    }

    return NextResponse.json({
      providers,
      services,
      insurances,
      slots,
    });
  } catch (error) {
    console.error("[STAFF_BOOK_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST — Create a manual booking (phone booking)
// =============================================================================

interface ManualBookingBody {
  slotId: string;
  patientName: string;
  patientDob: string;
  patientPhone: string;
  patientEmail: string;
  patientType: "ADULT" | "PEDIATRIC";
  guardianName?: string;
  guardianRelation?: string;
  reasonForVisit: string;
  insuranceId?: string;
  serviceId: string;
  internalNotes?: string;
}

const REQUIRED_FIELDS: (keyof ManualBookingBody)[] = [
  "slotId",
  "patientName",
  "patientDob",
  "patientPhone",
  "patientEmail",
  "patientType",
  "reasonForVisit",
  "serviceId",
];

export async function POST(request: NextRequest) {
  try {
    // ---- 1. Auth check ----
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const staffId = session.user.id;
    const clinicId = session.user.clinicId;
    if (!clinicId) {
      return NextResponse.json(
        { error: "No clinic assigned to this user" },
        { status: 400 }
      );
    }

    // ---- 2. Parse and validate body ----
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    for (const field of REQUIRED_FIELDS) {
      if (!body[field] || (typeof body[field] === "string" && body[field].trim() === "")) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    const data = body as unknown as ManualBookingBody;

    // Validate patientType
    if (
      data.patientType !== PATIENT_TYPE.ADULT &&
      data.patientType !== PATIENT_TYPE.PEDIATRIC
    ) {
      return NextResponse.json(
        { error: "patientType must be ADULT or PEDIATRIC" },
        { status: 400 }
      );
    }

    // Pediatric requires guardian info
    if (data.patientType === PATIENT_TYPE.PEDIATRIC) {
      if (!data.guardianName || !data.guardianRelation) {
        return NextResponse.json(
          { error: "Pediatric appointments require guardianName and guardianRelation" },
          { status: 400 }
        );
      }
    }

    // Validate DOB
    const dob = new Date(data.patientDob);
    if (isNaN(dob.getTime())) {
      return NextResponse.json(
        { error: "patientDob must be a valid ISO date string" },
        { status: 400 }
      );
    }

    // ---- 3. Atomic booking transaction ----
    const appointment = await db.$transaction(async (tx) => {
      // a. Fetch the slot and validate
      const slot = await tx.slot.findUnique({
        where: { id: data.slotId },
        include: {
          provider: {
            include: {
              providerServices: {
                include: {
                  service: {
                    include: { specialty: true },
                  },
                },
              },
            },
          },
          clinic: true,
        },
      });

      if (!slot) {
        throw new ManualBookingError("SLOT_NOT_FOUND", "Slot not found", 404);
      }

      // Validate slot belongs to staff's clinic
      if (slot.clinicId !== clinicId) {
        throw new ManualBookingError("FORBIDDEN", "Slot does not belong to your clinic", 403);
      }

      // Validate slot is AVAILABLE
      if (slot.status !== SLOT_STATUS.AVAILABLE) {
        throw new ManualBookingError(
          "SLOT_UNAVAILABLE",
          `Slot is no longer available (status: ${slot.status})`,
          409
        );
      }

      // b. Validate the service belongs to this provider
      const providerService = slot.provider.providerServices.find(
        (ps) => ps.serviceId === data.serviceId
      );
      if (!providerService) {
        throw new ManualBookingError(
          "INVALID_SERVICE",
          "This service is not offered by the selected provider",
          400
        );
      }

      const service = providerService.service;
      const specialtyId = service.specialtyId;

      // c. Validate insurance if provided
      let isDemoInsurance = false;
      if (data.insuranceId) {
        const insuranceExists = await tx.insurance.findUnique({
          where: { id: data.insuranceId },
          select: { id: true, isDemo: true },
        });
        if (!insuranceExists) {
          throw new ManualBookingError("INSURANCE_NOT_FOUND", "Insurance not found", 400);
        }
        isDemoInsurance = insuranceExists.isDemo;
      }

      // d. Determine pricing
      // For manual bookings, we use self-pay pricing from the service
      const selfPayCents = service.selfPayPriceCents || 0;
      // Manual bookings are always cash at desk, deposit is 0
      const depositCents = 0;

      // e. Create the Appointment
      const newAppointment = await tx.appointment.create({
        data: {
          slotId: data.slotId,
          clinicId: slot.clinicId,
          providerId: slot.providerId,
          specialtyId,
          serviceId: data.serviceId,
          patientName: data.patientName.trim(),
          patientDob: dob,
          patientPhone: data.patientPhone.trim(),
          patientEmail: data.patientEmail.trim(),
          patientType: data.patientType,
          guardianName: data.guardianName?.trim() || null,
          guardianRelation: data.guardianRelation?.trim() || null,
          reasonForVisit: data.reasonForVisit.trim(),
          insuranceId: data.insuranceId || null,
          modality: slot.modality,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isDemoInsurance,
          depositCents,
          selfPayCents,
          paymentMethod: PAYMENT_METHOD.CASH_AT_DESK,
          paymentStatus: PAYMENT_STATUS.PENDING,
          status: APPOINTMENT_STATUS.BOOKED,
        },
        include: {
          clinic: true,
          provider: true,
          specialty: true,
          service: true,
        },
      });

      // f. Create the AppointmentLedger (CASH_AT_DESK type)
      await tx.appointmentLedger.create({
        data: {
          appointmentId: newAppointment.id,
          type: LEDGER_TYPE.DEPOSIT_AUTH,
          amountCents: depositCents,
          description: "Manual booking — cash payment pending at desk",
          processedBy: staffId,
        },
      });

      // g. Update the slot status to BOOKED
      await tx.slot.update({
        where: { id: data.slotId },
        data: { status: SLOT_STATUS.BOOKED },
      });

      // h. Create internal note if provided
      if (data.internalNotes && data.internalNotes.trim()) {
        await tx.internalNote.create({
          data: {
            appointmentId: newAppointment.id,
            authorId: staffId,
            content: data.internalNotes.trim(),
          },
        });
      }

      return newAppointment;
    });

    // ---- 4. Generate secure token (outside transaction) ----
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const tokenExpiresAt = new Date(
      appointment.startTime.getTime() +
        TOKEN_EXPIRY_DAYS_AFTER_APPOINTMENT * 24 * 60 * 60 * 1000
    );

    await db.token.create({
      data: {
        tokenHash,
        appointmentId: appointment.id,
        purpose: TOKEN_PURPOSE.MANAGE,
        expiresAt: tokenExpiresAt,
      },
    });

    // ---- 5. Audit log (fire-and-forget) ----
    createAuditLog({
      userId: staffId,
      action: AUDIT_ACTIONS.BOOKING_CREATED,
      targetType: "APPOINTMENT",
      targetId: appointment.id,
      appointmentId: appointment.id,
    });

    // ---- 6. Invalidate caches ----
    cache.deleteByPrefix("slots:");
    cache.deleteByPrefix("search:");

    // ---- 7. Return response with raw token ----
    return NextResponse.json({
      success: true,
      appointment: {
        id: appointment.id,
        startTime: appointment.startTime.toISOString(),
        endTime: appointment.endTime.toISOString(),
        modality: appointment.modality,
        status: appointment.status,
        patientName: appointment.patientName,
        patientType: appointment.patientType,
        reasonForVisit: appointment.reasonForVisit,
        paymentMethod: appointment.paymentMethod,
        paymentStatus: appointment.paymentStatus,
        depositCents: appointment.depositCents,
        selfPayCents: appointment.selfPayCents,
        clinicName: appointment.clinic.name,
        providerName: `${appointment.provider.firstName} ${appointment.provider.lastName}`,
        providerCredentials: appointment.provider.credentials || undefined,
        serviceName: appointment.service.name,
        specialtyName: appointment.specialty.name,
      },
      token: rawToken,
    });
  } catch (error) {
    if (error instanceof ManualBookingError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "This time slot was just booked. Please try another.", code: "SLOT_TAKEN" },
        { status: 409 }
      );
    }

    console.error("[STAFF_BOOK_POST] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}