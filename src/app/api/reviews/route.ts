// =============================================================================
// Review Submission API
// =============================================================================
// POST /api/reviews
// Public endpoint — patients submit reviews via a secure token link.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { cache } from "@/lib/cache";
import { TOKEN_PURPOSE, APPOINTMENT_STATUS } from "@/lib/enums";
import { REVIEW_RATING_MIN, REVIEW_RATING_MAX } from "@/lib/constants";
import { Prisma } from "@prisma/client";

// ---- Types ----

interface SubmitReviewBody {
  token: string;
  overallRating: number;
  waitTimeRating: number;
  bedsideRating: number;
  staffRating: number;
  comment?: string;
}

// ---- Validation ----

const TOKEN_REGEX = /^[0-9a-fA-F]{64}$/;

function validateRating(value: unknown, field: string): string | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < REVIEW_RATING_MIN || n > REVIEW_RATING_MAX) {
    return `${field} must be an integer between ${REVIEW_RATING_MIN} and ${REVIEW_RATING_MAX}`;
  }
  return null;
}

function validateBody(body: Record<string, unknown>): {
  valid: boolean;
  error?: string;
} {
  // Token
  if (typeof body.token !== "string" || !TOKEN_REGEX.test(body.token)) {
    return { valid: false, error: "Invalid or missing token" };
  }

  // Required ratings
  const ratingFields = ["overallRating", "waitTimeRating", "bedsideRating", "staffRating"] as const;
  for (const field of ratingFields) {
    const err = validateRating(body[field], field);
    if (err) return { valid: false, error: err };
  }

  // Optional comment
  if (body.comment !== undefined && body.comment !== null) {
    if (typeof body.comment !== "string") {
      return { valid: false, error: "comment must be a string" };
    }
    if (body.comment.length > 1000) {
      return { valid: false, error: "comment must be 1000 characters or less" };
    }
  }

  return { valid: true };
}

// =============================================================================
// POST — Submit a review
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
        { error: validation.error, code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const data = body as unknown as SubmitReviewBody;

    // ---- 2. Look up token ----
    const tokenHash = hashToken(data.token);

    const tokenRecord = await db.token.findUnique({
      where: { tokenHash },
      include: {
        appointment: {
          include: {
            provider: true,
            clinic: true,
          },
        },
      },
    });

    if (!tokenRecord) {
      return NextResponse.json(
        { error: "Invalid review link", code: "TOKEN_NOT_FOUND" },
        { status: 404 }
      );
    }

    // ---- 3. Validate token purpose ----
    if (tokenRecord.purpose !== TOKEN_PURPOSE.REVIEW) {
      return NextResponse.json(
        { error: "This link is not a review link", code: "WRONG_TOKEN_PURPOSE" },
        { status: 400 }
      );
    }

    // ---- 4. Check token not already consumed ----
    if (tokenRecord.consumedAt) {
      return NextResponse.json(
        { error: "This review link has already been used", code: "TOKEN_CONSUMED" },
        { status: 410 }
      );
    }

    // ---- 5. Check token expiry ----
    if (new Date() > tokenRecord.expiresAt) {
      return NextResponse.json(
        { error: "This review link has expired", code: "TOKEN_EXPIRED" },
        { status: 410 }
      );
    }

    const appointment = tokenRecord.appointment;

    // ---- 6. Validate appointment is COMPLETED ----
    if (appointment.status !== APPOINTMENT_STATUS.COMPLETED) {
      return NextResponse.json(
        { error: "Reviews can only be submitted for completed appointments", code: "APPOINTMENT_NOT_COMPLETED" },
        { status: 400 }
      );
    }

    // ---- 7. Check review doesn't already exist ----
    const existingReview = await db.review.findUnique({
      where: { appointmentId: appointment.id },
    });

    if (existingReview) {
      return NextResponse.json(
        { error: "A review has already been submitted for this appointment", code: "REVIEW_EXISTS" },
        { status: 409 }
      );
    }

    // ---- 8. Transaction: Create review, consume token, update provider rating ----
    const now = new Date();

    const review = await db.$transaction(async (tx) => {
      // a. Create the Review
      const newReview = await tx.review.create({
        data: {
          appointmentId: appointment.id,
          clinicId: appointment.clinicId,
          providerId: appointment.providerId,
          overallRating: data.overallRating,
          waitTimeRating: data.waitTimeRating,
          bedsideRating: data.bedsideRating,
          staffRating: data.staffRating,
          comment: data.comment || null,
          isVerified: true,
        },
      });

      // b. Consume the token
      await tx.token.update({
        where: { id: tokenRecord.id },
        data: { consumedAt: now },
      });

      // c. Update provider rating (compute running average)
      const provider = await tx.provider.findUnique({
        where: { id: appointment.providerId },
        select: { rating: true, reviewCount: true },
      });

      if (provider) {
        const oldCount = provider.reviewCount;
        const oldRating = provider.rating;
        const newCount = oldCount + 1;
        const newRating = (oldRating * oldCount + data.overallRating) / newCount;

        await tx.provider.update({
          where: { id: appointment.providerId },
          data: {
            rating: Math.round(newRating * 100) / 100, // 2 decimal places
            reviewCount: newCount,
          },
        });
      }

      return newReview;
    });

    // ---- 9. Audit log ----
    createAuditLog({
      action: AUDIT_ACTIONS.REVIEW_SUBMITTED,
      targetType: "REVIEW",
      targetId: review.id,
      appointmentId: appointment.id,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    // ---- 10. Invalidate caches ----
    cache.deleteByPrefix("search:");
    cache.deleteByPrefix("clinics:");

    // ---- 11. Return success ----
    return NextResponse.json(
      { success: true, reviewId: review.id },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A review has already been submitted for this appointment", code: "REVIEW_EXISTS" },
        { status: 409 }
      );
    }

    console.error("[REVIEWS] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}