import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STAFF_ROLE, PROVIDER_STATUSES, CLINIC_STATUSES, type ProviderStatus, type ClinicStatus } from "@/lib/enums";
import { Prisma } from "@prisma/client";

// ─── GET /api/staff/admin/providers?search=...&status=...&clinicId=...&page=1&limit=20 ─
// List ALL providers across ALL clinics with search, filter by status, clinic filter.

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    if (user.role !== STAFF_ROLE.SYSTEM_MANAGER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "";
    const clinicId = searchParams.get("clinicId") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    // Build WHERE clause
    const where: Prisma.ProviderWhereInput = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { credentials: { contains: search } },
        { npiNumber: { contains: search } },
      ];
    }

    if (status && PROVIDER_STATUSES.includes(status as ProviderStatus)) {
      where.status = status as ProviderStatus;
    }

    if (clinicId) {
      where.clinicId = clinicId;
    }

    const [providers, total] = await Promise.all([
      db.provider.findMany({
        where,
        select: {
          id: true,
          clinicId: true,
          firstName: true,
          lastName: true,
          credentials: true,
          slug: true,
          npiNumber: true,
          yearsExperience: true,
          rating: true,
          reviewCount: true,
          slotDurationMinutes: true,
          status: true,
          videoVisitLink: true,
          createdAt: true,
          updatedAt: true,
          clinic: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
            },
          },
          languages: {
            select: {
              language: {
                select: { id: true, name: true, code: true },
              },
            },
          },
          _count: {
            select: {
              appointments: true,
              providerServices: true,
              slotTemplates: { where: { isActive: true } },
            },
          },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip,
        take: limit,
      }),
      db.provider.count({ where }),
    ]);

    // Flatten language names
    const providerData = providers.map((p) => ({
      id: p.id,
      clinicId: p.clinicId,
      firstName: p.firstName,
      lastName: p.lastName,
      credentials: p.credentials,
      slug: p.slug,
      npiNumber: p.npiNumber,
      yearsExperience: p.yearsExperience,
      rating: p.rating,
      reviewCount: p.reviewCount,
      slotDurationMinutes: p.slotDurationMinutes,
      status: p.status,
      videoVisitLink: p.videoVisitLink,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      clinic: p.clinic,
      languages: p.languages.map((l) => l.language.name),
      _count: p._count,
    }));

    // For clinic filter dropdown — fetch all clinics
    const allClinics = await db.clinic.findMany({
      where: clinicId ? { id: clinicId } : {},
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      providers: providerData,
      clinics: allClinics,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[ADMIN_PROVIDERS_LIST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}