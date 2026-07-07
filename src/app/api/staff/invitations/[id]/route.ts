import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";

export async function DELETE(
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

    await db.staffInvitation.delete({
      where: { id },
    });

    await createAuditLog({
      userId: session.user.id,
      action: AUDIT_ACTIONS.STAFF_INVITATION_REVOKED,
      targetType: "STAFF_INVITATION",
      targetId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[STAFF_INVITATIONS_DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}