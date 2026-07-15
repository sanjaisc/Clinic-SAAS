"use client";

import dynamic from "next/dynamic";

/**
 * Client-side wrapper that dynamically imports Providers with SSR disabled.
 * This avoids the React 19 + Next.js 16 standalone build issue where
 * SessionProvider/ThemeProvider's useState fails during static generation.
 */
const Providers = dynamic(
  () => import("@/components/providers").then((mod) => mod.Providers),
  { ssr: false }
);

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}