import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";

// Default email templates — used for reset functionality
const DEFAULT_TEMPLATES: Record<string, { subject: string; bodyHtml: string }> = {
  BOOKING_CONFIRMATION: {
    subject: "Your Appointment is Confirmed — {{clinicName}}",
    bodyHtml: "<p>Dear {{patientName}},</p><p>Your appointment has been confirmed.</p><p><strong>Date:</strong> {{date}}<br/><strong>Time:</strong> {{time}}<br/><strong>Provider:</strong> {{providerName}}<br/><strong>Service:</strong> {{serviceName}}</p><p>We look forward to seeing you!</p>",
  },
  CANCELLATION: {
    subject: "Appointment Cancelled — {{clinicName}}",
    bodyHtml: "<p>Dear {{patientName}},</p><p>Your appointment on {{date}} at {{time}} has been cancelled.</p><p>If you did not request this cancellation, please contact us immediately.</p>",
  },
  RESCHEDULE: {
    subject: "Appointment Rescheduled — {{clinicName}}",
    bodyHtml: "<p>Dear {{patientName}},</p><p>Your appointment has been rescheduled.</p><p><strong>New Date:</strong> {{date}}<br/><strong>New Time:</strong> {{time}}<br/><strong>Provider:</strong> {{providerName}}</p>",
  },
  REMINDER: {
    subject: "Appointment Reminder — {{clinicName}}",
    bodyHtml: "<p>Dear {{patientName}},</p><p>This is a friendly reminder about your upcoming appointment.</p><p><strong>Date:</strong> {{date}}<br/><strong>Time:</strong> {{time}}<br/><strong>Provider:</strong> {{providerName}}<br/><strong>Location:</strong> {{clinicName}}</p>",
  },
  INTAKE: {
    subject: "Complete Your Intake Form — {{clinicName}}",
    bodyHtml: "<p>Dear {{patientName}},</p><p>To prepare for your upcoming appointment, please complete the intake form using the link below.</p><p><a href=\"{{intakeLink}}\">Complete Intake Form</a></p>",
  },
  REVIEW_REQUEST: {
    subject: "How Was Your Visit? — {{clinicName}}",
    bodyHtml: "<p>Dear {{patientName}},</p><p>Thank you for visiting {{clinicName}}. We would appreciate your feedback!</p><p><a href=\"{{reviewLink}}\">Leave a Review</a></p>",
  },
  PAYMENT_REQUEST: {
    subject: "Payment Required — {{clinicName}}",
    bodyHtml: "<p>Dear {{patientName}},</p><p>A payment of <strong>${{amount}}</strong> is required for your appointment.</p><p><a href=\"{{paymentLink}}\">Pay Now</a></p>",
  },
};

export async function GET(
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

    const template = await db.emailTemplate.findUnique({
      where: { id },
    });

    if (!template || template.clinicId !== clinicId) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error("[STAFF_EMAIL_TEMPLATE_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
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

    const body = await request.json();
    const { subject, bodyHtml, isActive } = body;

    const updateData: Record<string, unknown> = {};
    if (subject !== undefined) updateData.subject = subject;
    if (bodyHtml !== undefined) updateData.bodyHtml = bodyHtml;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const template = await db.emailTemplate.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      userId: session.user.id,
      action: AUDIT_ACTIONS.TEMPLATE_UPDATED,
      targetType: "EMAIL_TEMPLATE",
      targetId: id,
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error("[STAFF_EMAIL_TEMPLATE_PUT]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}