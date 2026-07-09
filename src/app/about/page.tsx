"use client";

import Link from "next/link";
import {
  Search,
  CalendarCheck,
  ShieldCheck,
  Lock,
  Users,
  Building2,
  Star,
  Clock,
  UserCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DoctALogo } from "@/components/docta-logo";
import { PublicFooter } from "@/components/public-footer";
import { PublicNavbar } from "@/components/public-navbar";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const VALUES = [
  {
    icon: UserCheck,
    title: "Patient First",
    description:
      "Every decision we make starts with the patient experience. From search to booking to visit, we prioritize simplicity and clarity.",
    gradient: "from-brand to-brand",
  },
  {
    icon: CalendarCheck,
    title: "Easy Booking",
    description:
      "No phone tag, no hold music. Book your appointment in seconds with real-time availability and instant confirmation.",
    gradient: "from-teal-400 to-teal-600",
  },
  {
    icon: ShieldCheck,
    title: "Verified Providers",
    description:
      "Every provider on DoctA is verified. We check credentials, licenses, and clinic standing so you can book with confidence.",
    gradient: "from-cyan-400 to-cyan-600",
  },
  {
    icon: Lock,
    title: "Secure Platform",
    description:
      "Your health data is protected with industry-standard encryption. We never share your personal information without consent.",
    gradient: "from-brand to-teal-500",
  },
];

const STATS = [
  {
    icon: Building2,
    value: "500+",
    label: "Clinics",
    description: "Partnered healthcare facilities",
  },
  {
    icon: Users,
    value: "2,000+",
    label: "Providers",
    description: "Verified healthcare professionals",
  },
  {
    icon: CalendarCheck,
    value: "50,000+",
    label: "Appointments Booked",
    description: "Successfully completed bookings",
  },
  {
    icon: Star,
    value: "4.8/5",
    label: "Patient Satisfaction",
    description: "Average rating across all reviews",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white to-brand-muted/30">
      <PublicNavbar showHome />

      {/* ===== Main Content ===== */}
      <main className="flex-1 w-full px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-10">
          {/* Breadcrumb */}
          <nav
            className="flex items-center gap-1.5 text-sm text-muted-foreground"
            aria-label="Breadcrumb"
          >
            <Link
              href="/"
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Home
            </Link>
            <span className="text-border">/</span>
            <span className="text-foreground font-medium">About</span>
          </nav>

          {/* ===== Hero Section ===== */}
          <section className="text-center space-y-4 py-4">
            <div className="flex justify-center">
              <DoctALogo height={48} />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
              About DoctA
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
              We&apos;re on a mission to make healthcare accessible by
              connecting patients with the right providers, instantly.
            </p>
          </section>

          {/* ===== Mission Statement ===== */}
          <Card className="overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-brand to-teal-500" />
            <CardContent className="p-6 md:p-8">
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-subtle">
                  <Search className="size-6 text-brand" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-foreground">
                    Our Mission
                  </h2>
                  <p className="text-muted-foreground leading-relaxed">
                    DoctA was founded with a simple belief: booking a
                    doctor&apos;s appointment should be as easy as booking a
                    restaurant reservation. Too many patients spend hours calling
                    clinics, navigating complex phone trees, and waiting on hold
                    — only to find out the slot they wanted is already taken. We
                    built DoctA to eliminate that friction entirely. Our
                    platform gives patients real-time visibility into provider
                    availability, transparent pricing information, and the
                    ability to book in seconds. For clinics, we provide tools to
                    manage appointments efficiently, reduce no-shows, and reach
                    more patients.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ===== Our Values ===== */}
          <section className="space-y-5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-brand" />
              <h2 className="text-xl font-bold text-foreground">Our Values</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {VALUES.map((val) => (
                <Card
                  key={val.title}
                  className="overflow-hidden card-hover-lift"
                >
                  <div
                    className={`h-1.5 w-full bg-gradient-to-r ${val.gradient}`}
                  />
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-subtle">
                        <val.icon className="size-5 text-brand" />
                      </div>
                      <h3 className="font-semibold text-foreground">
                        {val.title}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {val.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* ===== By the Numbers ===== */}
          <section className="space-y-5">
            <div className="flex items-center gap-2">
              <Clock className="size-5 text-brand" />
              <h2 className="text-xl font-bold text-foreground">
                By the Numbers
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {STATS.map((stat) => (
                <Card key={stat.label} className="text-center overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-brand to-teal-500" />
                  <CardContent className="p-5 space-y-2">
                    <div className="flex justify-center mb-1">
                      <div className="size-10 rounded-full bg-brand-subtle flex items-center justify-center">
                        <stat.icon className="size-5 text-brand" />
                      </div>
                    </div>
                    <p className="text-2xl md:text-3xl font-bold text-foreground">
                      {stat.value}
                    </p>
                    <p className="text-xs font-medium text-brand">
                      {stat.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {stat.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* ===== Team — Coming Soon ===== */}
          <section className="space-y-5">
            <div className="flex items-center gap-2">
              <Users className="size-5 text-brand" />
              <h2 className="text-xl font-bold text-foreground">Our Team</h2>
            </div>
            <Card className="overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-brand to-teal-500" />
              <CardContent className="p-8 text-center space-y-3">
                <div className="flex justify-center mb-2">
                  <div className="flex size-16 items-center justify-center rounded-full bg-brand-muted ring-2 ring-brand/20">
                    <Users className="size-7 text-brand" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  Coming Soon
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                  We&apos;re a passionate team of healthcare professionals and
                  engineers working to improve how patients connect with
                  providers. Our team page is coming soon — stay tuned!
                </p>
                <Link href="/">
                  <Button
                    variant="outline"
                    className="mt-2 border-brand-border text-brand-hover hover:bg-brand-muted cursor-pointer"
                  >
                    Back to Search
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>

      {/* ===== Footer ===== */}
      <PublicFooter />
    </div>
  );
}