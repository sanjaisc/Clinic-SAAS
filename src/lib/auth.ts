// =============================================================================
// NextAuth v4 Configuration — JWT Strategy with Role Injection
// =============================================================================
// This is the SOLE authentication entry point for the platform.
// - Strategy: JWT (stateless, no DB session table)
// - Provider: Credentials (email + password) for staff accounts only
// - Custom JWT callback: injects `role` and `clinicId` into the token
// - Custom session callback: exposes these fields to client components
// - NO patient user accounts exist — this is staff/admin only
// =============================================================================

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/crypto";
import { STAFF_ROLE, hasMinimumRole, isValidStaffRole } from "@/lib/enums";

/**
 * Custom session type with our extended fields.
 * Used in client components via useSession().
 */
export type DoctASessionUser = {
  id: string;
  email: string;
  name: string;
  /** Staff role: SYSTEM_MANAGER | CLINIC_ADMIN | CLINIC_RECEPTION */
  role: string;
  /** Assigned clinic ID (null for SYSTEM_MANAGER) */
  clinicId: string | null;
};

export type DoctASession = {
  user: DoctASessionUser;
  accessToken?: string;
};

/**
 * Custom JWT payload type.
 */
export type DoctAJWT = {
  id: string;
  email: string;
  name: string;
  role: string;
  clinicId: string | null;
  iat?: number;
  exp?: number;
  jti?: string;
};

// NOTE: NextAuth type augmentation has been moved to src/types/next-auth.d.ts
// Module augmentation MUST live in a .d.ts file (not a regular .ts with exports)
// for TypeScript to correctly merge declarations across the project.

export const authOptions: NextAuthOptions = {
  // ---- JWT Strategy (no DB sessions) ----
  // Staff work long shifts — use a 30-day JWT expiry to prevent session drops.
  // Tokens can be revoked via middleware checks against user.isActive.
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // ---- Pages ----
  pages: {
    signIn: "/staff/login",
    error: "/staff/login",
  },

  // ---- Providers ----
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Staff Login",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "admin@clinic.com",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("EMAIL_AND_PASSWORD_REQUIRED");
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            role: true,
            clinicId: true,
            isActive: true,
          },
        });


        // Security: return null for all failure cases (no user enumeration)
        if (!user || !user.isActive) {
          return null;
        }

        // Validate role is a known value
        if (!isValidStaffRole(user.role)) {
          console.error(`[AUTH] Unknown role '${user.role}' for user ${user.id}`);
          return null;
        }

        // Verify password
        const isPasswordValid = await verifyPassword(
          credentials.password,
          user.passwordHash
        );


        if (!isPasswordValid) {
          return null;
        }

        // Check clinic status for non-system roles
        if (user.clinicId) {
          const clinic = await db.clinic.findUnique({
            where: { id: user.clinicId },
            select: { id: true, status: true, name: true },
          });

          if (!clinic || clinic.status !== "PUBLISHED") {
            // Allow SYSTEM_MANAGER to bypass clinic status check
            // But CLINIC_ADMIN and CLINIC_RECEPTION cannot log into suspended clinics
            if (!hasMinimumRole(user.role, STAFF_ROLE.SYSTEM_MANAGER)) {
              return null;
            }
          }
        }

        // Update last login
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        }).catch(() => {
          // Non-critical — don't block login on this
        });

        // Return user object (NextAuth merges this into the JWT)
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          clinicId: user.clinicId,
        };
      },
    }),
  ],

  // ---- Callbacks ----
  callbacks: {
    /**
     * JWT Callback — runs on every token creation/refresh.
     * Injects role and clinicId into the JWT payload.
     * Also performs a lightweight DB check to verify the user is still active
     * and their role hasn't changed (token revocation without Redis).
     */
    async jwt({ token, user, trigger }) {
      // Initial sign-in: merge user data into token
      if (user) {
        token.id = user.id;
        token.email = user.email ?? "";
        token.name = user.name ?? "";
        token.role = user.role;
        token.clinicId = user.clinicId;
        return token;
      }

      // On session update, verify the user is still valid
      if (trigger === "update" && token?.id) {
        try {
          const dbUser = await db.user.findUnique({
            where: { id: token.id as string },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              clinicId: true,
              isActive: true,
            },
          });

          if (!dbUser || !dbUser.isActive) {
            // User deactivated or deleted — invalidate the token
            return {} as DoctAJWT;
          }

          // Refresh role and clinicId (they may have been changed by admin)
          token.role = dbUser.role;
          token.clinicId = dbUser.clinicId;
          token.name = dbUser.name;
          token.email = dbUser.email;
        } catch {
          // DB error — keep existing token (graceful degradation)
        }
      }

      return token;
    },

    /**
     * Session Callback — exposes JWT fields to the client.
     * This is what useSession() returns in client components.
     */
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.role = token.role as string;
        session.user.clinicId = token.clinicId as string | null;
      }
      return session;
    },
  },

  // ---- Events ----
  events: {
    async signIn({ user }) {
      // Could trigger audit log here in Sprint 4+
      console.log(`[AUTH] Staff login: ${user.email} (${user.role})`);
    },
    async signOut({ token }) {
      console.log(`[AUTH] Staff logout: ${token?.email}`);
    },
  },

  // ---- Security ----
  secret: process.env.NEXTAUTH_SECRET,
};