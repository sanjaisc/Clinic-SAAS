import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  APPOINTMENT_STATUS,
  SLOT_STATUS,
  PAYMENT_STATUS,
  LEDGER_TYPE,
  PAYMENT_METHOD,
  PATIENT_TYPE,
  TOKEN_PURPOSE,
} from "@/lib/enums";
import { generateSecureToken, hashToken, hashIpAddress } from "@/lib/crypto";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { cache } from "@/lib/cache";
import { TOKEN_EXPIRY_DAYS_AFTER_APPOINTMENT } from "@/lib/constants";
import { Prisma } from "@prisma/client";

// =============================================================================
// Types
// =============================================================================

interface CreateAppointmentBody {
  slotId: string;
  lockKey: string;
  patientName: string;
  patientDob: string;
  patientPhone: string;
  patientEmail: string;
  patientType: "ADULT" | "PEDIATRIC";
  reasonForVisit: string;
  specialtyId: string;
  serviceId: string;
  insuranceId?: string;
  guardianName?: string;
  guardianRelation?: string;
  paymentMethod: "STRIPE" | "CASH_AT_DESK" | "MANUAL_WAIVER";
  depositCents: number;
  selfPayCents: number;
  isDemoInsurance: boolean;
}

// =============================================================================
// Validation
// =============================================================================

const REQUIRED_FIELDS: (keyof CreateAppointmentBody)[] = [
  "patientName",
  "patientDob",
  "patientPhone",
  "patientEmail",
  "patientType",
  "reasonForVisit",
  "slotId",
  "lockKey",
  "specialtyId",
  "serviceId",
  "paymentMethod",
  "depositCents",
  "selfPayCents",
  "isDemoInsurance",
];

function validateBody(body: Record<string, unknown>): {
  valid: boolean;
  error?: string;
  code?: string;
} {
  for (const field of REQUIRED_FIELDS) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      return {
        valid: false,
        error: `Missing required field: ${field}`,
        code: "MISSING_FIELD",
      };
    }
  }

  // Validate patientType
  if (
    body.patientType !== PATIENT_TYPE.ADULT &&
    body.patientType !== PATIENT_TYPE.PEDIATRIC
  ) {
    return {
      valid: false,
      error: "patientType must be ADULT or PEDIATRIC",
      code: "INVALID_FIELD",
    };
  }

  // Validate paymentMethod
  if (
    body.paymentMethod !== PAYMENT_METHOD.STRIPE &&
    body.paymentMethod !== PAYMENT_METHOD.CASH_AT_DESK &&
    body.paymentMethod !== PAYMENT_METHOD.MANUAL_WAIVER
  ) {
    return {
      valid: false,
      error: "paymentMethod must be STRIPE, CASH_AT_DESK, or MANUAL_WAIVER",
      code: "INVALID_FIELD",
    };
  }

  // Pediatric patients require guardian info
  if (body.patientType === PATIENT_TYPE.PEDIATRIC) {
    if (!body.guardianName || !body.guardianRelation) {
      return {
        valid: false,
        error: "Pediatric appointments require guardianName and guardianRelation",
        code: "MISSING_GUARDIAN_INFO",
      };
    }
  }

  // Validate dates
  const dob = new Date(body.patientDob as string);
  if (isNaN(dob.getTime())) {
    return {
      valid: false,
      error: "patientDob must be a valid ISO date string",
      code: "INVALID_DATE",
    };
  }

  // Validate monetary values
  const depositCents = Number(body.depositCents);
  const selfPayCents = Number(body.selfPayCents);
  if (depositCents < 0 || selfPayCents < 0 || !Number.isInteger(depositCents) || !Number.isInteger(selfPayCents)) {
    return {
      valid: false,
      error: "Monetary values must be non-negative integers (cents)",
      code: "INVALID_AMOUNT",
    };
  }

  return { valid: true };
}

// =============================================================================
// POST — Create an appointment (after payment or for cash/manual bookings)
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // ---- 1. Parse and validate body ----
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body", code: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const validation = validateBody(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error, code: validation.code },
        { status: 400 }
      );
    }

    const data = body as unknown as CreateAppointmentBody;

    // ---- 2. Atomic booking transaction ----
    const appointment = await db.$transaction(async (tx) => {
      // a. Verify the SlotLock exists for this slotId + lockKey
      const lock = await tx.slotLock.findUnique({
        where: { slotId: data.slotId },
      });

      if (!lock || lock.lockKey !== data.lockKey) {
        throw new BookingError("LOCK_NOT_HELD", "You do not hold a lock on this slot", 409);
      }

      // b. Verify slot status is LOCKED
      const slot = await tx.slot.findUnique({
        where: { id: data.slotId },
        include: {
          clinic: true,
          provider: {
            include: {
              providerServices: {
                include: {
                  service: {
                    include: {
                      specialty: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!slot || slot.status !== SLOT_STATUS.LOCKED) {
        throw new BookingError("SLOT_NOT_LOCKED", "Slot is not in a locked state", 409);
      }

      // c. Verify insurance exists if provided
      if (data.insuranceId) {
        const insuranceExists = await tx.insurance.findUnique({
          where: { id: data.insuranceId },
          select: { id: true },
        });
        if (!insuranceExists) {
          throw new BookingError("INSURANCE_NOT_FOUND", "Insurance not found", 400);
        }
      }

      // Determine payment status
      let paymentStatus: string;
      switch (data.paymentMethod) {
        case PAYMENT_METHOD.STRIPE:
          paymentStatus = PAYMENT_STATUS.AUTHORIZED;
          break;
        case PAYMENT_METHOD.CASH_AT_DESK:
          paymentStatus = PAYMENT_STATUS.PENDING;
          break;
        case PAYMENT_METHOD.MANUAL_WAIVER:
          paymentStatus = PAYMENT_STATUS.PENDING;
          break;
        default:
          paymentStatus = PAYMENT_STATUS.PENDING;
      }

      // d. Create the Appointment record
      const newAppointment = await tx.appointment.create({
        data: {
          slotId: data.slotId,
          clinicId: slot.clinicId,
          providerId: slot.providerId,
          specialtyId: data.specialtyId,
          serviceId: data.serviceId,
          patientName: data.patientName,
          patientDob: new Date(data.patientDob),
          patientPhone: data.patientPhone,
          patientEmail: data.patientEmail,
          patientType: data.patientType,
          guardianName: data.guardianName || null,
          guardianRelation: data.guardianRelation || null,
          reasonForVisit: data.reasonForVisit,
          insuranceId: data.insuranceId || null,
          modality: slot.modality,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isDemoInsurance: data.isDemoInsurance,
          depositCents: data.depositCents,
          selfPayCents: data.selfPayCents,
          paymentMethod: data.paymentMethod,
          paymentStatus,
          status: APPOINTMENT_STATUS.BOOKED,
          ipHash: request.headers.get("x-forwarded-for")
            ? hashIpAddress(request.headers.get("x-forwarded-for")!)
            : undefined,
        },
        include: {
          clinic: true,
          provider: true,
          specialty: true,
          service: true,
        },
      });

      // e. Create the AppointmentLedger record
      await tx.appointmentLedger.create({
        data: {
          appointmentId: newAppointment.id,
          type: LEDGER_TYPE.DEPOSIT_AUTH,
          amountCents: data.depositCents,
          description:
            data.paymentMethod === PAYMENT_METHOD.CASH_AT_DESK
              ? "Deposit pending — cash at desk"
              : data.paymentMethod === PAYMENT_METHOD.MANUAL_WAIVER
              ? "Deposit waived — manual override"
              : "Deposit authorized via Stripe",
          processedBy:
            data.paymentMethod === PAYMENT_METHOD.MANUAL_WAIVER ? "SYSTEM" : null,
        },
      });

      // f. Delete the SlotLock
      await tx.slotLock.delete({
        where: { slotId: data.slotId },
      });

      // g. Update the slot status to BOOKED
      await tx.slot.update({
        where: { id: data.slotId },
        data: { status: SLOT_STATUS.BOOKED },
      });

      return newAppointment;
    });

    // ---- 3. Generate secure tokens (outside transaction — tokens are separate) ----
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

    // Create a REVIEW token with 30-day expiry after appointment end time
    const reviewRawToken = generateSecureToken();
    const reviewTokenHash = hashToken(reviewRawToken);
    const reviewTokenExpiresAt = new Date(
      appointment.endTime.getTime() +
        30 * 24 * 60 * 60 * 1000
    );

    await db.token.create({
      data: {
        tokenHash: reviewTokenHash,
        appointmentId: appointment.id,
        purpose: TOKEN_PURPOSE.REVIEW,
        expiresAt: reviewTokenExpiresAt,
      },
    });

    // ---- 4. Audit log (fire-and-forget) ----
    createAuditLog({
      action: AUDIT_ACTIONS.BOOKING_CREATED,
      targetType: "APPOINTMENT",
      targetId: appointment.id,
      appointmentId: appointment.id,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    // ---- 5. Invalidate caches ----
    cache.deleteByPrefix("slots:");
    cache.deleteByPrefix("search:");

    // ---- 6. Return response with the raw token (only returned once!) ----
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
        depositCents: appointment.depositCents,
        selfPayCents: appointment.selfPayCents,
        isDemoInsurance: appointment.isDemoInsurance,
        clinicName: appointment.clinic.name,
        providerName: `${appointment.provider.firstName} ${appointment.provider.lastName}`,
        providerCredentials: appointment.provider.credentials || undefined,
      },
      token: rawToken,
    });
  } catch (error) {
    // Handle custom booking errors
    if (error instanceof BookingError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    // Handle Prisma unique constraint (shouldn't happen in normal flow but be safe)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error:
            "This time slot was just booked by someone else. Please try another.",
          code: "SLOT_TAKEN",
        },
        { status: 409 }
      );
    }

    console.error("[APPOINTMENT_CREATE] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// =============================================================================
// Custom Error Class (not leaked outside)
// =============================================================================

class BookingError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "BookingError";
    this.code = code;
    this.status = status;
  }
}