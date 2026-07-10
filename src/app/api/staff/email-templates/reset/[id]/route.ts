import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/default-email-templates";
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

    const existing = await db.emailTemplate.findUnique({
      where: { id },
    });

    if (!existing || existing.clinicId !== clinicId) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    const defaultTemplate = DEFAULT_EMAIL_TEMPLATES[existing.type as keyof typeof DEFAULT_EMAIL_TEMPLATES];
    if (!defaultTemplate) {
      return NextResponse.json(
        { error: "No default template available for this type" },
        { status: 400 }
      );
    }

    const template = await db.emailTemplate.update({
      where: { id },
      data: {
        subject: defaultTemplate.subject,
        bodyHtml: defaultTemplate.bodyHtml,
      },
    });

    await createAuditLog({
      userId: session.user.id,
      action: AUDIT_ACTIONS.TEMPLATE_UPDATED,
      targetType: "EMAIL_TEMPLATE",
      targetId: id,
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error("[STAFF_EMAIL_TEMPLATE_RESET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}