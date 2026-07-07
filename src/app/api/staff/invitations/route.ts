import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinicId =
      request.nextUrl.searchParams.get("clinicId") || session.user.clinicId;
    if (!clinicId) {
      return NextResponse.json({ error: "No clinic specified" }, { status: 400 });
    }

    if (
      session.user.role !== "SYSTEM_MANAGER" &&
      session.user.clinicId &&
      clinicId !== session.user.clinicId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const invitations = await db.staffInvitation.findMany({
      where: { clinicId },
      orderBy: { createdAt: "desc" },
    });

    // Enrich with accepted-by user info
    const enriched = await Promise.all(
      invitations.map(async (inv) => {
        let acceptedByName: string | null = null;
        if (inv.acceptedBy) {
          const user = await db.user.findUnique({
            where: { id: inv.acceptedBy },
            select: { name: true },
          });
          acceptedByName = user?.name || null;
        }
        return {
          ...inv,
          acceptedByName,
        };
      })
    );

    return NextResponse.json({ invitations: enriched });
  } catch (error) {
    console.error("[STAFF_INVITATIONS_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinicId =
      request.nextUrl.searchParams.get("clinicId") || session.user.clinicId;
    if (!clinicId) {
      return NextResponse.json({ error: "No clinic specified" }, { status: 400 });
    }

    if (
      session.user.role !== "SYSTEM_MANAGER" &&
      session.user.clinicId &&
      clinicId !== session.user.clinicId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { email, role } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "email is required" },
        { status: 400 }
      );
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

    // Check for existing pending invitation
    const existingInvitation = await db.staffInvitation.findFirst({
      where: {
        clinicId,
        email: normalizedEmail,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (existingInvitation) {
      return NextResponse.json(
        { error: "A pending invitation already exists for this email" },
        { status: 409 }
      );
    }

    // Generate secure token
    const { generateSecureToken, hashToken } = await import("@/lib/crypto");
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);

    // Expires in 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await db.staffInvitation.create({
      data: {
        clinicId,
        email: normalizedEmail,
        tokenHash,
        role: role || "CLINIC_RECEPTION",
        createdBy: session.user.id,
        expiresAt,
      },
    });

    // Build invitation link (one-time-use)
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const invitationLink = `${baseUrl}/staff/accept-invitation?token=${rawToken}`;

    // Send email (mock)
    const { sendStaffEmail } = await import("@/lib/email");
    await sendStaffEmail({
      to: normalizedEmail,
      subject: `You're Invited to Join ${session.user.name}'s Clinic`,
      html: `<p>You've been invited to join a clinic as a staff member.</p><p><a href="${invitationLink}">Accept Invitation</a></p><p>This link expires in 7 days.</p>`,
    });

    const { createAuditLog } = await import("@/lib/audit");
    const { AUDIT_ACTIONS } = await import("@/lib/constants");
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
    console.error("[STAFF_INVITATIONS_POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}