import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { cache } from "@/lib/cache";
import { AUDIT_ACTIONS } from "@/lib/constants";
import { STAFF_ROLE, hasMinimumRole } from "@/lib/enums";
import type { ClinicBookSessionUser } from "@/lib/auth";

const NOTIFICATION_ACTIONS = [
  AUDIT_ACTIONS.BOOKING_CREATED,
  AUDIT_ACTIONS.BOOKING_CANCELLED,
  AUDIT_ACTIONS.BOOKING_CHECKED_IN,
  AUDIT_ACTIONS.BOOKING_COMPLETED,
  AUDIT_ACTIONS.BOOKING_NO_SHOW,
] as const;

const UNREAD_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as ClinicBookSessionUser;

    // Determine clinicId: SYSTEM_MANAGER can use query param
    const { searchParams } = new URL(request.url);
    let clinicId = user.clinicId;

    if (!clinicId && hasMinimumRole(user.role, STAFF_ROLE.SYSTEM_MANAGER)) {
      clinicId = searchParams.get("clinicId") || null;
    }

    if (!clinicId) {
      return NextResponse.json({ error: "Clinic ID required" }, { status: 400 });
    }

    const cacheKey = `notifications:clinic:${clinicId}`;

    const result = await cache.getOrSet(
      cacheKey,
      async () => {
        // Fetch audit logs with appointment + provider + service + user data
        const logs = await db.auditLog.findMany({
          where: {
            action: { in: [...NOTIFICATION_ACTIONS] },
            appointment: { clinicId },
          },
          include: {
            appointment: {
              select: {
                id: true,
                patientName: true,
                startTime: true,
                status: true,
                provider: {
                  select: { firstName: true, lastName: true },
                },
                service: {
                  select: { name: true },
                },
              },
            },
            user: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        });

        const now = Date.now();
        const notifications = logs.map((log) => ({
          id: log.id,
          action: log.action,
          createdAt: log.createdAt.toISOString(),
          patientName: log.appointment?.patientName ?? null,
          startTime: log.appointment?.startTime?.toISOString() ?? null,
          providerName: log.appointment
            ? `${log.appointment.provider.firstName} ${log.appointment.provider.lastName}`
            : null,
          serviceName: log.appointment?.service?.name ?? null,
          appointmentStatus: log.appointment?.status ?? null,
          triggeredBy: log.user?.name ?? null,
        }));

        const unreadCount = logs.filter(
          (log) => now - log.createdAt.getTime() < UNREAD_THRESHOLD_MS
        ).length;

        return { notifications, unreadCount };
      },
      30 // 30 second cache
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[NOTIFICATIONS]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}