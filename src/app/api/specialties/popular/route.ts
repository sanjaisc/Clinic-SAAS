import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cache, CacheKeys, CacheTTL } from "@/lib/cache";

/**
 * GET /api/specialties/popular
 *
 * Returns active specialties ordered by appointment booking count (descending).
 * Includes each specialty's icon for frontend rendering.
 * Falls back to sortOrder for specialties with zero bookings.
 * Cached for 1 hour.
 */
export async function GET() {
  try {
    const data = await cache.getOrSet(
      CacheKeys.popularSpecialties(),
      async () => {
        // Raw query to count appointments per specialty and order by popularity
        const rawResults = await db.$queryRaw`
          SELECT
            s.id,
            s.name,
            s.slug,
            s.icon,
            COUNT(a.id) as "appointmentCount",
            s."sortOrder"
          FROM Specialty s
          LEFT JOIN Appointment a ON a."specialtyId" = s.id
          WHERE s."isActive" = 1
          GROUP BY s.id
          ORDER BY "appointmentCount" DESC, s."sortOrder" ASC
        `;

        // Convert BigInt fields to Number for JSON serialization
        return (rawResults as Array<Record<string, unknown>>).map((row) => ({
          id: row.id as string,
          name: row.name as string,
          slug: row.slug as string,
          icon: (row.icon as string) ?? null,
          appointmentCount: Number(row.appointmentCount ?? 0),
          sortOrder: Number(row.sortOrder ?? 0),
        }));
      },
      CacheTTL.SYSTEM_CONFIG,
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error("[/api/specialties/popular] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}