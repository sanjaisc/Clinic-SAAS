// =============================================================================
// Next.js Middleware — Staff Route Protection & Clinic Status Checks
// =============================================================================
// Runs on the Edge Runtime. Uses NextAuth's getToken() for JWT validation.
//
// Responsibilities:
// 1. Protect (staff)/dashboard/* routes — require authenticated staff with valid role
// 2. Handle suspended/archived clinic direct URL hits → redirect with query param
// 3. Role hierarchy enforcement (CLINIC_ADMIN inherits CLINIC_RECEPTION access)
//
// NOTE: getToken() works in Edge Runtime with next-auth v4.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { STAFF_ROLE, hasMinimumRole, isValidStaffRole } from "@/lib/enums";

// Routes that require staff authentication (minimum CLINIC_RECEPTION role)
const STAFF_PROTECTED_PREFIX = "/staff/dashboard";

// Routes accessible by CLINIC_ADMIN and above only
const ADMIN_ONLY_ROUTES = [
  "/staff/dashboard/settings",
  "/staff/dashboard/slots",
  "/staff/dashboard/analytics",
];

// Routes accessible by SYSTEM_MANAGER only
const SYS_MANAGER_ONLY_ROUTES = [
  "/staff/dashboard/admin",
];

/**
 * Check if a user's role meets the minimum requirement for a given path.
 */
function getRequiredRoleForPath(pathname: string): string | null {
  // Check system manager routes first (highest restriction)
  for (const route of SYS_MANAGER_ONLY_ROUTES) {
    if (pathname.startsWith(route)) {
      return STAFF_ROLE.SYSTEM_MANAGER;
    }
  }

  // Check admin-only routes
  for (const route of ADMIN_ONLY_ROUTES) {
    if (pathname.startsWith(route)) {
      return STAFF_ROLE.CLINIC_ADMIN;
    }
  }

  // Default: any staff role (CLINIC_RECEPTION minimum)
  return STAFF_ROLE.CLINIC_RECEPTION;
}

/**
 * Create the sign-in redirect URL with the original path as a callback.
 */
function createSignInRedirect(request: NextRequest): NextResponse {
  const loginUrl = new URL("/staff/login", request.url);
  loginUrl.searchParams.set("callbackUrl", request.url);
  return NextResponse.redirect(loginUrl);
}

/**
 * Create the unauthorized redirect URL (wrong role).
 */
function createUnauthorizedRedirect(request: NextRequest): NextResponse {
  const unauthorizedUrl = new URL("/staff/unauthorized", request.url);
  return NextResponse.redirect(unauthorizedUrl);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // =========================================================================
  // 1. Staff Dashboard Protection
  // =========================================================================
  if (pathname.startsWith(STAFF_PROTECTED_PREFIX)) {
    // Get JWT token from the request
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    // No token → redirect to login
    if (!token) {
      return createSignInRedirect(request);
    }

    // Validate role exists and is known
    const role = token.role as string;
    if (!role || !isValidStaffRole(role)) {
      return createSignInRedirect(request);
    }

    // Check role hierarchy for the specific route
    const requiredRole = getRequiredRoleForPath(pathname);
    if (requiredRole && !hasMinimumRole(role, requiredRole as "CLINIC_RECEPTION" | "CLINIC_ADMIN" | "SYSTEM_MANAGER")) {
      return createUnauthorizedRedirect(request);
    }

    // SYSTEM_MANAGER should not have a clinicId — they access all clinics
    // CLINIC_ADMIN and CLINIC_RECEPTION must have a clinicId
    if (
      role !== STAFF_ROLE.SYSTEM_MANAGER &&
      !token.clinicId
    ) {
      return createUnauthorizedRedirect(request);
    }

    // Inject headers for downstream use in server components/actions
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", token.id as string);
    requestHeaders.set("x-user-role", role);
    requestHeaders.set("x-clinic-id", (token.clinicId as string) || "");

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // =========================================================================
  // 2. Clinic Direct URL — Suspended/Archived Check
  // =========================================================================
  // Pattern: /clinic/[slug]
  const clinicMatch = pathname.match(/^\/clinic\/([^/]+)$/);
  if (clinicMatch) {
    const slug = clinicMatch[1];

    // We can't do a DB query in Edge middleware directly with Prisma,
    // so we use a lightweight API call or handle this at the page level.
    // For the middleware, we'll set a header and let the page component
    // handle the actual check and redirect.
    //
    // NOTE: The actual suspended clinic redirect logic is implemented
    // in the clinic page component and a server-side check, since
    // Prisma Client requires Node.js runtime, not Edge.
    //
    // The middleware handles the redirect when the page sets a special
    // response header.

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-clinic-slug", slug);
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // =========================================================================
  // 3. Staff Auth Pages — Redirect if already authenticated
  // =========================================================================
  const AUTH_PAGES = ["/staff/login", "/staff/accept-invitation"];
  if (AUTH_PAGES.some((p) => pathname.startsWith(p))) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (token && token.role && isValidStaffRole(token.role as string)) {
      // Already authenticated — redirect to dashboard
      const dashboardUrl = new URL("/staff/dashboard", request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return NextResponse.next();
}

// =========================================================================
// Matcher Configuration
// =========================================================================
// Only run middleware on these path patterns for performance.
export const config = {
  matcher: [
    // Staff routes (including login page)
    "/staff/:path*",
    // Clinic detail pages (for suspended clinic check)
    "/clinic/:slug*",
  ],
};