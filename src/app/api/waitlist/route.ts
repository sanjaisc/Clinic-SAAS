import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// =============================================================================
// POST /api/waitlist — Join the waitlist
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      providerId,
      specialtyId,
      patientName,
      patientEmail,
      patientPhone,
      patientType,
      preferredModality,
    } = body;

    // Validate required fields
    const missing: string[] = [];
    if (!providerId) missing.push("providerId");
    if (!specialtyId) missing.push("specialtyId");
    if (!patientName) missing.push("patientName");
    if (!patientEmail) missing.push("patientEmail");
    if (!patientPhone) missing.push("patientPhone");
    if (!patientType) missing.push("patientType");

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate patientType
    if (!["ADULT", "PEDIATRIC"].includes(patientType)) {
      return NextResponse.json(
        { error: "patientType must be ADULT or PEDIATRIC" },
        { status: 400 }
      );
    }

    // Validate preferredModality if provided
    if (preferredModality && !["IN_PERSON", "VIDEO"].includes(preferredModality)) {
      return NextResponse.json(
        { error: "preferredModality must be IN_PERSON or VIDEO" },
        { status: 400 }
      );
    }

    // Look up provider to get clinicId
    const provider = await db.provider.findUnique({
      where: { id: providerId },
      select: { id: true, clinicId: true },
    });

    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    // Check if patient already has an active waitlist entry for this provider
    const existing = await db.waitlistEntry.findFirst({
      where: {
        providerId,
        patientEmail: patientEmail.toLowerCase(),
        status: { in: ["WAITING", "OFFERED"] },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "You already have an active waitlist entry for this provider" },
        { status: 409 }
      );
    }

    // Create waitlist entry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const entry = await db.waitlistEntry.create({
      data: {
        clinicId: provider.clinicId,
        providerId,
        specialtyId,
        patientName,
        patientEmail: patientEmail.toLowerCase(),
        patientPhone,
        patientType,
        preferredModality: preferredModality || null,
        status: "WAITING",
        expiresAt,
      },
      include: {
        clinic: { select: { name: true } },
        provider: { select: { firstName: true, lastName: true } },
        specialty: { select: { name: true } },
      },
    });

    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (error) {
    console.error("Waitlist POST error:", error);
    return NextResponse.json(
      { error: "Failed to join waitlist. Please try again." },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET /api/waitlist — Check waitlist status
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const providerId = searchParams.get("providerId");

    if (!email) {
      return NextResponse.json(
        { error: "email query parameter is required" },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = {
      patientEmail: email.toLowerCase(),
      status: { in: ["WAITING", "OFFERED"] },
    };

    if (providerId) {
      where.providerId = providerId;
    }

    const entries = await db.waitlistEntry.findMany({
      where,
      include: {
        clinic: { select: { name: true } },
        provider: { select: { firstName: true, lastName: true } },
        specialty: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: entries });
  } catch (error) {
    console.error("Waitlist GET error:", error);
    return NextResponse.json(
      { error: "Failed to check waitlist status" },
      { status: 500 }
    );
  }
}