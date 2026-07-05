// =============================================================================
// Public Provider Reviews API
// =============================================================================
// GET /api/providers/[id]/reviews?page=1&limit=10
// Returns paginated reviews for a provider, with masked patient names.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Mask a patient name to show first name + last initial.
 * e.g., "John Smith" → "John S."
 */
function maskPatientName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return "Anonymous";
  if (parts.length === 1) return parts[0];

  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  return `${firstName} ${lastName.charAt(0).toUpperCase()}.`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // ---- 1. Fetch provider info ----
    const provider = await db.provider.findUnique({
      where: { id },
      select: {
        firstName: true,
        lastName: true,
        rating: true,
        reviewCount: true,
      },
    });

    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found", code: "PROVIDER_NOT_FOUND" },
        { status: 404 }
      );
    }

    // ---- 2. Parse pagination ----
    const url = request.nextUrl;
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 10));
    const skip = (page - 1) * limit;

    // ---- 3. Fetch reviews with pagination ----
    const [reviews, total] = await Promise.all([
      db.review.findMany({
        where: { providerId: id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          overallRating: true,
          waitTimeRating: true,
          bedsideRating: true,
          staffRating: true,
          comment: true,
          isVerified: true,
          createdAt: true,
          appointment: {
            select: {
              patientName: true,
            },
          },
        },
      }),
      db.review.count({
        where: { providerId: id },
      }),
    ]);

    // ---- 4. Format response ----
    const formattedReviews = reviews.map((review) => ({
      id: review.id,
      overallRating: review.overallRating,
      waitTimeRating: review.waitTimeRating,
      bedsideRating: review.bedsideRating,
      staffRating: review.staffRating,
      comment: review.comment,
      isVerified: review.isVerified,
      createdAt: review.createdAt.toISOString(),
      patientName: maskPatientName(review.appointment.patientName),
    }));

    return NextResponse.json({
      reviews: formattedReviews,
      total,
      providerName: `${provider.firstName} ${provider.lastName}`,
      providerRating: provider.rating,
      providerReviewCount: provider.reviewCount,
    });
  } catch (error) {
    console.error("[PROVIDER_REVIEWS] Error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}