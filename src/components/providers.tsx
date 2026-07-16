"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  // next-themes injects <script> for FOUC prevention. React 19 warns
  // scripts inside components never run on client — harmless for SSR-only.
  useEffect(() => {
    const orig = console.error;
    console.error = (...args: unknown[]) => {
      if (typeof args[0] === "string" && args[0].includes("Encountered a script tag while rendering React component")) return;
      orig.apply(console, args);
    };
    return () => { console.error = orig; };
  }, []);

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