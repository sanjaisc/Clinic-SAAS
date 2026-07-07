import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendStaffEmail } from "@/lib/email";

// =============================================================================
// POST /api/staff/appointments/[id]/send-video-link
// Sends the provider's video visit link to the patient via email
// =============================================================================

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Fetch appointment with provider's video link
    const appointment = await db.appointment.findUnique({
      where: { id },
      include: {
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            credentials: true,
            videoVisitLink: true,
          },
        },
        clinic: {
          select: { id: true, name: true },
        },
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Check clinic access
    if (
      session.user.role !== "SYSTEM_MANAGER" &&
      session.user.clinicId &&
      appointment.clinicId !== session.user.clinicId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const videoLink = appointment.provider.videoVisitLink;

    if (!videoLink) {
      return NextResponse.json(
        { error: "No video visit link configured for this provider" },
        { status: 400 }
      );
    }

    // Send email to patient with the video link
    await sendStaffEmail({
      to: appointment.patientEmail,
      subject: "Video Visit Link for Your Upcoming Appointment",
      html: `
        <h2>Your Video Visit Link</h2>
        <p>Dear ${appointment.patientName},</p>
        <p>Your upcoming video appointment with <strong>Dr. ${appointment.provider.firstName} ${appointment.provider.lastName}${appointment.provider.credentials ? `, ${appointment.provider.credentials}` : ""}</strong> is ready.</p>
        <p><a href="${videoLink}" style="display:inline-block;padding:12px 24px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Join Video Visit</a></p>
        <p>If you have any issues joining, please contact the clinic.</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[STAFF_SEND_VIDEO_LINK]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}