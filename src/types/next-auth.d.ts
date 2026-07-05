// =============================================================================
// NextAuth Type Augmentation
// =============================================================================
// This file augments the NextAuth types so that getServerSession() returns
// our custom fields (id, role, clinicId) on session.user.
// =============================================================================

// We re-declare the module with only the augmented parts.
// TypeScript will merge (intersection) these with the base types from next-auth.
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      clinicId: string | null;
      image?: string | null;
    };
    accessToken?: string;
  }

  interface User {
    id: string;
    role: string;
    clinicId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    name: string;
    role: string;
    clinicId: string | null;
  }
}