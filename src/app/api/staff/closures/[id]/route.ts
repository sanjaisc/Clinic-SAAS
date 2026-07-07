import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";

export async function PATCH(
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

    const existing = await db.clinicClosure.findUnique({
      where: { id },
    });
    if (!existing || existing.clinicId !== clinicId) {
      return NextResponse.json({ error: "Closure not found" }, { status: 404 });
    }

    const body = await request.json();
    const { title, startDate, endDate, isRecurring, recurrenceRule } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (startDate !== undefined) {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
      }
      updateData.startDate = start;
    }
    if (endDate !== undefined) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return NextResponse.json({ error: "Invalid endDate" }, { status: 400 });
      }
      updateData.endDate = end;
    }
    if (isRecurring !== undefined) updateData.isRecurring = Boolean(isRecurring);
    if (recurrenceRule !== undefined)
      updateData.recurrenceRule = recurrenceRule || null;

    const closure = await db.clinicClosure.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      userId: session.user.id,
      action: AUDIT_ACTIONS.CLINIC_UPDATED,
      targetType: "CLINIC_CLOSURE",
      targetId: id,
    });

    return NextResponse.json({ closure });
  } catch (error) {
    console.error("[STAFF_CLOSURES_PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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

    const existing = await db.clinicClosure.findUnique({
      where: { id },
    });
    if (!existing || existing.clinicId !== clinicId) {
      return NextResponse.json({ error: "Closure not found" }, { status: 404 });
    }

    await db.clinicClosure.delete({
      where: { id },
    });

    await createAuditLog({
      userId: session.user.id,
      action: AUDIT_ACTIONS.CLINIC_UPDATED,
      targetType: "CLINIC_CLOSURE",
      targetId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[STAFF_CLOSURES_DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}