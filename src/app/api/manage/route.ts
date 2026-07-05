// =============================================================================
// Patient Token Management API
// =============================================================================
// GET /api/manage?token=<raw_64_char_hex>
// GET /api/manage?tokenId=<cuid>  (QR code support — lookup by token record ID)
// Validates the patient token, returns appointment details, and handles check-in.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import { createAuditLog } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/constants";
import { APPOINTMENT_STATUS, TOKEN_PURPOSE } from "@/lib/enums";
import { isAfter, subHours } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const rawToken = request.nextUrl.searchParams.get("token");
    const tokenId = request.nextUrl.searchParams.get("tokenId");

    // Support two lookup modes: raw token hash or token record ID
    let tokenRecord: Awaited<ReturnType<typeof db.token.findUnique>> | null = null;

    if (tokenId) {
      // Token ID lookup (used by QR codes — no check-in side-effects)
      tokenRecord = await db.token.findUnique({
        where: { id: tokenId },
        include: {
          appointment: {
            include: {
              provider: true,
              service: true,
              specialty: true,
              clinic: true,
              slot: true,
              insurance: true,
              ledger: true,
            },
          },
        },
      });
    } else if (rawToken) {
      // Raw token hash lookup (original behavior — supports check-in)
      if (!/^[0-9a-fA-F]{64}$/.test(rawToken)) {
        return NextResponse.json(
          { error: "Invalid token format" },
          { status: 400 }
        );
      }

      const tokenHash = hashToken(rawToken);

      tokenRecord = await db.token.findUnique({
        where: { tokenHash },
        include: {
          appointment: {
            include: {
              provider: true,
              service: true,
              specialty: true,
              clinic: true,
              slot: true,
              insurance: true,
              ledger: true,
            },
          },
        },
      });
    } else {
      return NextResponse.json(
        { error: "Missing token or tokenId parameter" },
        { status: 400 }
      );
    }

    // Token not found
    if (!tokenRecord) {
      return NextResponse.json(
        { error: "Token not found" },
        { status: 404 }
      );
    }

    const { appointment } = tokenRecord;
    const now = new Date();

    // Check if token is expired
    if (isAfter(now, tokenRecord.expiresAt)) {
      return NextResponse.json(
        { error: "This link has expired", code: "TOKEN_EXPIRED" },
        { status: 410 }
      );
    }

    // Check if appointment is cancelled
    if (appointment.status === APPOINTMENT_STATUS.CANCELLED) {
      return NextResponse.json(
        { error: "This appointment has been cancelled", code: "APPOINTMENT_CANCELLED" },
        { status: 410 }
      );
    }

    // Handle CHECK_IN purpose (only when accessed via raw token, not tokenId/QR)
    let justCheckedIn = false;

    if (!tokenId && tokenRecord.purpose === TOKEN_PURPOSE.CHECK_IN) {
      // Check if already consumed
      if (!tokenRecord.consumedAt) {
        // Check if appointment is within 24 hours
        const windowStart = subHours(appointment.startTime, 24);
        const isWithinWindow = isAfter(now, windowStart);

        if (!isWithinWindow) {
          return NextResponse.json(
            {
              error: "Check-in is available 24 hours before your appointment",
              code: "CHECK_IN_TOO_EARLY",
              appointmentStartTime: appointment.startTime.toISOString(),
            },
            { status: 400 }
          );
        }

        // Mark token as consumed
        await db.token.update({
          where: { id: tokenRecord.id },
          data: { consumedAt: now },
        });

        // Update appointment status to CHECKED_IN
        await db.appointment.update({
          where: { id: appointment.id },
          data: { status: APPOINTMENT_STATUS.CHECKED_IN },
        });

        // Audit log
        await createAuditLog({
          action: AUDIT_ACTIONS.BOOKING_CHECKED_IN,
          targetType: "Appointment",
          targetId: appointment.id,
          appointmentId: appointment.id,
          ipAddress: request.headers.get("x-forwarded-for") || undefined,
        });

        justCheckedIn = true;
      }
    }

    // Build the response
    const response = {
      token: {
        purpose: tokenRecord.purpose,
        consumedAt: tokenRecord.consumedAt?.toISOString() ?? null,
        justCheckedIn,
      },
      appointment: {
        id: appointment.id,
        status: appointment.status,
        patientName: appointment.patientName,
        reasonForVisit: appointment.reasonForVisit,
        modality: appointment.modality,
        startTime: appointment.startTime.toISOString(),
        endTime: appointment.endTime.toISOString(),
        isDemoInsurance: appointment.isDemoInsurance,
        depositCents: appointment.depositCents,
        selfPayCents: appointment.selfPayCents,
        paymentStatus: appointment.paymentStatus,
        paymentMethod: appointment.paymentMethod,
        intakeCompleted: appointment.intakeCompleted,
      },
      provider: {
        firstName: appointment.provider.firstName,
        lastName: appointment.provider.lastName,
        credentials: appointment.provider.credentials,
        photoUrl: appointment.provider.photoUrl,
      },
      specialty: {
        name: appointment.specialty.name,
      },
      service: {
        name: appointment.service.name,
      },
      clinic: {
        name: appointment.clinic.name,
        logoUrl: appointment.clinic.logoUrl,
        streetAddress: appointment.clinic.streetAddress,
        city: appointment.clinic.city,
        state: appointment.clinic.state,
        zipCode: appointment.clinic.zipCode,
        phoneNumber: appointment.clinic.phoneNumber,
        videoVisitLink: appointment.provider.videoVisitLink,
      },
      insurance: appointment.insurance
        ? {
            name: appointment.insurance.name,
            isDemo: appointment.insurance.isDemo,
          }
        : null,
      ledger: appointment.ledger
        ? {
            type: appointment.ledger.type,
            amountCents: appointment.ledger.amountCents,
            description: appointment.ledger.description,
          }
        : null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[MANAGE] Error processing token:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}