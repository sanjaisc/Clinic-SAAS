import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { cache } from "@/lib/cache";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinicId = session.user.clinicId;
    if (!clinicId) {
      return NextResponse.json({ error: "No clinic context" }, { status: 400 });
    }

    const body = await request.json();
    const { selfPayFlatRateCents } = body;

    if (typeof selfPayFlatRateCents !== "number" || selfPayFlatRateCents < 0) {
      return NextResponse.json(
        { error: "selfPayFlatRateCents must be a non-negative number" },
        { status: 400 }
      );
    }

    await db.clinic.update({
      where: { id: clinicId },
      data: { selfPayFlatRateCents: Math.round(selfPayFlatRateCents) },
    });

    // Invalidate cache
    cache.deleteByPrefix(`staff:services:${clinicId}`);
    cache.deleteByPrefix(`staff:financial:${clinicId}`);

    await createAuditLog({
      userId: session.user.id,
      action: AUDIT_ACTIONS.CLINIC_UPDATED,
      targetType: "Clinic",
      targetId: clinicId,
    });

    return NextResponse.json({ success: true, selfPayFlatRateCents: Math.round(selfPayFlatRateCents) });
  } catch (error) {
    console.error("[STAFF_SERVICES_CLINIC_PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}