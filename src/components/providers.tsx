"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/sonner";

/**
 * Client-side provider wrapper for NextAuth SessionProvider.
 * The root layout is a Server Component and cannot use Context providers directly.
 * This component bridges that gap.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster position="top-right" richColors closeButton />
    </SessionProvider>
  );
}