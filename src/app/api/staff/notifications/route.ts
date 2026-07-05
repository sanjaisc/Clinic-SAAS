import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
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

    // Use a simple in-memory cache to avoid re-querying within 30s
    const cacheMap = (globalThis as Record<string, unknown>).__notificationsCache as Record<string, { data: unknown; ts: number }> | undefined;
    const cached = cacheMap?.[cacheKey];
    if (cached && Date.now() - cached.ts < 30_000) {
      return NextResponse.json(cached.data);
    }

    // Fetch audit logs with appointment + provider + service + user data
    // NOTE: AuditLog has appointmentId but NO direct relation to Appointment.
    // We fetch logs first, then batch-lookup the referenced appointments.
    const logs = await db.auditLog.findMany({
      where: {
        action: { in: [...NOTIFICATION_ACTIONS] },
        appointmentId: { not: null },
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50, // Fetch more to allow filtering by clinic
    });

    // Collect unique appointment IDs and batch-fetch them
    const appointmentIds = [...new Set(logs.map((l) => l.appointmentId!).filter(Boolean))];
    const appointmentsMap = new Map<string, {
      patientName: string;
      startTime: Date;
      status: string;
      provider: { firstName: string; lastName: string };
      service: { name: string } | null;
      clinicId: string;
    }>();

    if (appointmentIds.length > 0) {
      const appointments = await db.appointment.findMany({
        where: { id: { in: appointmentIds } },
        select: {
          id: true,
          patientName: true,
          startTime: true,
          status: true,
          clinicId: true,
          provider: { select: { firstName: true, lastName: true } },
          service: { select: { name: true } },
        },
      });
      for (const apt of appointments) {
        appointmentsMap.set(apt.id, apt);
      }
    }

    // Filter to only this clinic and build notification objects
    const clinicNotifications = logs.filter((log) => {
      const apt = appointmentsMap.get(log.appointmentId!);
      return apt && apt.clinicId === clinicId;
    }).slice(0, 20);

    const now = Date.now();
    const notifications = clinicNotifications.map((log) => {
      const apt = appointmentsMap.get(log.appointmentId!);
      return {
        id: log.id,
        action: log.action,
        createdAt: log.createdAt.toISOString(),
        patientName: apt?.patientName ?? null,
        startTime: apt?.startTime?.toISOString() ?? null,
        providerName: apt
          ? `${apt.provider.firstName} ${apt.provider.lastName}`
          : null,
        serviceName: apt?.service?.name ?? null,
        appointmentStatus: apt?.status ?? null,
        triggeredBy: log.user?.name ?? null,
      };
    });

    const unreadCount = clinicNotifications.filter(
      (log) => now - log.createdAt.getTime() < UNREAD_THRESHOLD_MS
    ).length;

    const result = { notifications, unreadCount };

    // Store in cache
    if (!cacheMap) {
      (globalThis as Record<string, unknown>).__notificationsCache = {};
    }
    ((globalThis as Record<string, unknown>).__notificationsCache as Record<string, { data: unknown; ts: number }>)[cacheKey] = {
      data: result,
      ts: Date.now(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("[NOTIFICATIONS]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}