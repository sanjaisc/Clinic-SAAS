import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashToken, verifyToken, hashPassword } from "@/lib/crypto";

// =============================================================================
// GET /api/staff/accept-invitation?token=xxx
// Validates the invitation token and returns non-sensitive info for the form.
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json(
        { error: "Invitation token is required" },
        { status: 400 }
      );
    }

    // Hash the raw token to look it up in the DB
    const tokenHash = hashToken(token);

    const invitation = await db.staffInvitation.findUnique({
      where: { tokenHash },
      include: {
        clinic: {
          select: { id: true, name: true },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invalid or expired invitation" },
        { status: 404 }
      );
    }

    // Check if already accepted (one-time use)
    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: "This invitation has already been used" },
        { status: 410 }
      );
    }

    // Check expiry
    if (new Date() > invitation.expiresAt) {
      return NextResponse.json(
        {
          error: "This invitation has expired",
          expired: true,
          expiresAt: invitation.expiresAt.toISOString(),
        },
        { status: 410 }
      );
    }

    // Return only the info needed for the form (no token hash)
    return NextResponse.json({
      email: invitation.email,
      role: invitation.role,
      clinicName: invitation.clinic.name,
      clinicId: invitation.clinic.id,
      expiresAt: invitation.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[ACCEPT_INVITATION_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/staff/accept-invitation
// Accepts the invitation: creates User, binds role + clinic, invalidates token.
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, name, password } = body;

    if (!token || !name || !password) {
      return NextResponse.json(
        { error: "Token, name, and password are required" },
        { status: 400 }
      );
    }

    // Validate name
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      return NextResponse.json(
        { error: "Name must be at least 2 characters" },
        { status: 400 }
      );
    }

    // Validate password (minimum 8 chars)
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Hash the raw token to look it up
    const tokenHash = hashToken(token);

    // Find the invitation
    const invitation = await db.staffInvitation.findUnique({
      where: { tokenHash },
      include: {
        clinic: {
          select: { id: true, name: true, status: true },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invalid or expired invitation" },
        { status: 404 }
      );
    }

    // Check if already accepted
    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: "This invitation has already been used" },
        { status: 410 }
      );
    }

    // Check expiry
    if (new Date() > invitation.expiresAt) {
      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 410 }
      );
    }

    // Check if user with this email already exists (race condition guard)
    const existingUser = await db.user.findUnique({
      where: { email: invitation.email },
    });
    if (existingUser) {
      // Mark invitation as accepted by the existing user
      await db.staffInvitation.update({
        where: { id: invitation.id },
        data: {
          acceptedAt: new Date(),
          acceptedBy: existingUser.id,
          tokenHash: `consumed_${Date.now()}`, // invalidate token
        },
      });
      return NextResponse.json(
        { error: "An account with this email already exists. Please log in." },
        { status: 409 }
      );
    }

    // Hash the password
    const passwordHash = await hashPassword(password);

    // Create the new user with the invitation's role and clinic binding
    const newUser = await db.user.create({
      data: {
        email: invitation.email,
        name: trimmedName,
        passwordHash,
        role: invitation.role, // CLINIC_RECEPTION
        clinicId: invitation.clinicId,
        isActive: true,
      },
    });

    // Mark the invitation as accepted and invalidate the token (one-time use)
    await db.staffInvitation.update({
      where: { id: invitation.id },
      data: {
        acceptedAt: new Date(),
        acceptedBy: newUser.id,
        tokenHash: `consumed_${Date.now()}_${newUser.id}`, // permanently invalidate
      },
    });

    // Create audit log
    const { createAuditLog } = await import("@/lib/audit");
    const { AUDIT_ACTIONS } = await import("@/lib/constants");
    await createAuditLog({
      userId: newUser.id,
      action: AUDIT_ACTIONS.STAFF_INVITATION_ACCEPTED,
      targetType: "STAFF_INVITATION",
      targetId: invitation.id,
    });

    // Send welcome email (mock)
    const { sendStaffEmail } = await import("@/lib/email");
    await sendStaffEmail({
      to: invitation.email,
      subject: `Welcome to ${invitation.clinic.name}!`,
      html: `<p>Welcome aboard, ${trimmedName}!</p><p>Your account has been created and you've been added to <strong>${invitation.clinic.name}</strong> as a staff member.</p><p>You can now log in at the staff portal.</p>`,
    });

    // Invalidate cache for this clinic
    try {
      const { deleteByPrefix } = await import("@/lib/cache");
      await deleteByPrefix(`clinic:${invitation.clinicId}`);
    } catch {
      // Non-critical
    }

    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully",
        redirectUrl: "/staff/login",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[ACCEPT_INVITATION_POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}