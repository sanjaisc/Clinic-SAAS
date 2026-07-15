"use client";

import Link from "next/link";
import { FileDown } from "lucide-react";
import { DoctALogo } from "@/components/docta-logo";

export function PublicFooter() {
  return (
    <footer className="mt-auto bg-white/80 backdrop-blur-sm">
      {/* Gradient top border separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-indigo-subtle/50 to-transparent" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Multi-Column Layout */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* Column 1: Brand */}
          <div className="col-span-2 md:col-span-1 space-y-3">
            <DoctALogo height={80} className="!w-full h-auto" />
            {/* Social Media Icons */}
            <div className="flex items-center gap-2.5 pt-1">
              {/* Twitter/X */}
              <a
                href="#"
                aria-label="Twitter"
                className="flex size-9 items-center justify-center rounded-full border border-border hover:border-lavender-border hover:bg-lavender-muted text-muted-foreground hover:text-lavender transition-colors"
              >
                <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              {/* LinkedIn */}
              <a
                href="#"
                aria-label="LinkedIn"
                className="flex size-9 items-center justify-center rounded-full border border-border hover:border-lavender-border hover:bg-lavender-muted text-muted-foreground hover:text-lavender transition-colors"
              >
                <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
              {/* Facebook */}
              <a
                href="#"
                aria-label="Facebook"
                className="flex size-9 items-center justify-center rounded-full border border-border hover:border-lavender-border hover:bg-lavender-muted text-muted-foreground hover:text-lavender transition-colors"
              >
                <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Column 2: For Patients */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-brand">
              For Patients
            </h4>
            <nav className="flex flex-col gap-2">
              <Link
                href="/"
                className="text-sm text-muted-foreground hover:text-brand-hover transition-colors cursor-pointer"
              >
                Find a Doctor
              </Link>
              <Link
                href="/clinics"
                className="text-sm text-muted-foreground hover:text-brand-hover transition-colors cursor-pointer"
              >
                Browse Clinics
              </Link>
              <Link
                href="/insurance"
                className="text-sm text-muted-foreground hover:text-brand-hover transition-colors cursor-pointer"
              >
                Insurance
              </Link>
              <Link
                href="/"
                className="text-sm text-muted-foreground hover:text-brand-hover transition-colors cursor-pointer"
              >
                How It Works
              </Link>
            </nav>
          </div>

          {/* Column 3: For Clinics */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-brand">
              For Clinics
            </h4>
            <nav className="flex flex-col gap-2">
              <Link
                href="/staff/login"
                className="text-sm text-muted-foreground hover:text-brand-hover transition-colors cursor-pointer"
              >
                Staff Login
              </Link>
              <Link
                href="#"
                className="text-sm text-muted-foreground hover:text-brand-hover transition-colors cursor-pointer"
              >
                Clinic Dashboard
              </Link>
            </nav>
          </div>

          {/* Column 4: Company */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-brand">
              Company
            </h4>
            <nav className="flex flex-col gap-2">
              <Link
                href="/about"
                className="text-sm text-muted-foreground hover:text-brand-hover transition-colors cursor-pointer"
              >
                About
              </Link>
              <Link
                href="#"
                className="text-sm text-muted-foreground hover:text-brand-hover transition-colors cursor-pointer"
              >
                Privacy Policy
              </Link>
              <Link
                href="#"
                className="text-sm text-muted-foreground hover:text-brand-hover transition-colors cursor-pointer"
              >
                Terms of Service
              </Link>
              <Link
                href="#"
                className="text-sm text-muted-foreground hover:text-brand-hover transition-colors cursor-pointer"
              >
                Contact
              </Link>
              <a
                href="/api/agents-md"
                download="docta-agents.md"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-brand-hover transition-colors cursor-pointer"
              >
                <FileDown className="size-3.5" />
                agents.md
              </a>
            </nav>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border/50 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            Made with{" "}
            <span className="text-red-500">&#10084;</span> in Canada
          </p>
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            &copy; 2026 DoctA — Clinic Listing &amp; Appointment Booking Platform. All rights reserved.
          </p>
          <DoctALogo height={18} />
        </div>
      </div>
    </footer>
  );
}