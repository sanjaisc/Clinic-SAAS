import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateSecureToken, hashToken } from "@/lib/crypto";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { STAFF_ROLE, isValidStaffRole } from "@/lib/enums";

// =============================================================================
// POST /api/staff/admin/users/invite
// Send invitation with role selection (SYSTEM_MANAGER, CLINIC_ADMIN, CLINIC_RECEPTION).
// Can invite CLINIC_ADMIN (not just CLINIC_RECEPTION).
// SYSTEM_MANAGER only.
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== STAFF_ROLE.SYSTEM_MANAGER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { email, role, clinicId } = body;

    // Validate email
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate role
    const inviteRole = role || STAFF_ROLE.CLINIC_RECEPTION;
    if (!isValidStaffRole(inviteRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Validate clinic: required for CLINIC_ADMIN and CLINIC_RECEPTION, not for SYSTEM_MANAGER
    if (inviteRole === STAFF_ROLE.SYSTEM_MANAGER) {
      if (clinicId) {
        return NextResponse.json(
          { error: "SYSTEM_MANAGER invitations do not require a clinic" },
          { status: 400 }
        );
      }
    } else {
      if (!clinicId) {
        return NextResponse.json(
          { error: `${inviteRole} invitation requires a clinic` },
          { status: 400 }
        );
      }
      // Verify clinic exists
      const clinic = await db.clinic.findUnique({
        where: { id: clinicId },
        select: { id: true, name: true },
      });
      if (!clinic) {
        return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
      }
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    // Check for existing pending invitation to the same clinic
    const existingInvitation = await db.staffInvitation.findFirst({
      where: {
        email: normalizedEmail,
        clinicId: clinicId || null,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (existingInvitation) {
      return NextResponse.json(
        { error: "A pending invitation already exists for this email at this clinic" },
        { status: 409 }
      );
    }

    // Generate secure token
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);

    // Expires in 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // For SYSTEM_MANAGER invitations, we need a clinicId per schema.
    // Use a special sentinel or the first clinic. Actually, schema requires clinicId.
    // Let's use the first available clinic or require one.
    // For SYSTEM_MANAGER, the role is system-wide, but schema requires clinicId.
    // We'll assign the first published clinic as a placeholder.
    let resolvedClinicId = clinicId || null;
    if (inviteRole === STAFF_ROLE.SYSTEM_MANAGER && !resolvedClinicId) {
      // Find a clinic to satisfy the schema constraint
      const anyClinic = await db.clinic.findFirst({
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      if (!anyClinic) {
        return NextResponse.json(
          { error: "Cannot create invitation: no clinics exist in the system" },
          { status: 400 }
        );
      }
      resolvedClinicId = anyClinic.id;
    }

    const invitation = await db.staffInvitation.create({
      data: {
        clinicId: resolvedClinicId!,
        email: normalizedEmail,
        tokenHash,
        role: inviteRole,
        createdBy: session.user.id,
        expiresAt,
      },
    });

    // Build invitation link
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const invitationLink = `${baseUrl}/staff/accept-invitation?token=${rawToken}`;

    // Send email (mock)
    const { sendStaffEmail } = await import("@/lib/email");
    await sendStaffEmail({
      to: normalizedEmail,
      subject: "You're Invited to Join the Platform as Staff",
      html: `<p>You've been invited to join as a <strong>${inviteRole.replace(/_/g, " ")}</strong>.</p><p><a href="${invitationLink}">Accept Invitation</a></p><p>This link expires in 7 days.</p>`,
    });

    await createAuditLog({
      userId: session.user.id,
      action: AUDIT_ACTIONS.STAFF_INVITATION_CREATED,
      targetType: "STAFF_INVITATION",
      targetId: invitation.id,
    });

    return NextResponse.json(
      { invitation, invitationLink },
      { status: 201 }
    );
  } catch (error) {
    console.error("[ADMIN_USERS_INVITE_POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}