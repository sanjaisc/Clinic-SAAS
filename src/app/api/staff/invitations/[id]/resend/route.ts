import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateSecureToken, hashToken } from "@/lib/crypto";
import { sendStaffEmail } from "@/lib/email";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
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

    const existing = await db.staffInvitation.findUnique({
      where: { id },
    });

    if (!existing || existing.clinicId !== clinicId) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (existing.acceptedAt) {
      return NextResponse.json(
        { error: "Invitation has already been accepted" },
        { status: 400 }
      );
    }

    // Generate a new token
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);

    // Update with new token and extend expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db.staffInvitation.update({
      where: { id },
      data: {
        tokenHash,
        expiresAt,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const invitationLink = `${baseUrl}/staff/accept-invitation?token=${rawToken}`;

    await sendStaffEmail({
      to: existing.email,
      subject: `Reminder: You're Invited to Join Our Clinic`,
      html: `<p>You've been invited to join a clinic as a staff member.</p><p><a href="${invitationLink}">Accept Invitation</a></p><p>This link expires in 7 days.</p>`,
    });

    await createAuditLog({
      userId: session.user.id,
      action: AUDIT_ACTIONS.CLINIC_UPDATED,
      targetType: "STAFF_INVITATION",
      targetId: id,
    });

    return NextResponse.json({ success: true, invitationLink });
  } catch (error) {
    console.error("[STAFF_INVITATIONS_RESEND]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}