"use client";

import Link from "next/link";
import { Heart, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

interface PublicNavbarProps {
  /** Show an explicit "Home" button (for non-home pages) */
  showHome?: boolean;
}

/**
 * Shared public navbar used across all patient-facing pages.
 * - Always shows: DoctA branding (links to /), ThemeToggle, Staff Login
 * - When showHome=true: adds an explicit "Home" button
 */
export function PublicNavbar({ showHome = false }: PublicNavbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Heart className="size-6 text-emerald-600 fill-emerald-600" />
            <span className="text-lg font-bold tracking-tight text-foreground">
              DoctA
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {showHome && (
            <Link href="/">
              <Button variant="ghost" size="sm" className="cursor-pointer">
                <Home className="size-4 mr-1.5" />
                Home
              </Button>
            </Link>
          )}
          <ThemeToggle />
          <Link href="/staff/login">
            <Button variant="outline" size="sm" className="cursor-pointer">
              Staff Login
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}