"use client";

import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/sonner";

/**
 * Client-side provider wrapper for NextAuth SessionProvider and ThemeProvider.
 * The root layout is a Server Component and cannot use Context providers directly.
 * This component bridges that gap.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
    >
      <SessionProvider>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </SessionProvider>
    </ThemeProvider>
  );
}