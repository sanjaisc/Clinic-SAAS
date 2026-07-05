import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cache, CacheKeys, CacheTTL } from "@/lib/cache";

export async function GET() {
  try {
    const data = await cache.getOrSet(
      CacheKeys.systemConfig(),
      async () => {
        const [specialties, insurances, providerCountResult] = await Promise.all([
          db.specialty.findMany({
            where: { isActive: true },
            select: { id: true, name: true, slug: true },
            orderBy: { sortOrder: "asc" },
          }),
          db.insurance.findMany({
            where: { isActive: true },
            select: { id: true, name: true, slug: true, isDemo: true },
            orderBy: { sortOrder: "asc" },
          }),
          db.provider.count({
            where: { status: "ACTIVE" },
          }),
        ]);

        return { specialties, insurances, providerCount: providerCountResult };
      },
      CacheTTL.SYSTEM_CONFIG,
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error("[/api/taxonomies] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}