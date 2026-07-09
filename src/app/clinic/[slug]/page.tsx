import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  Shield,
  Star,
  Building2,
  ChevronLeft,
  Users,
} from "lucide-react";
import { PublicNavbar } from "@/components/public-navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PublicFooter } from "@/components/public-footer";
import { ClinicProviderRow } from "@/components/clinic/clinic-provider-row";
import { AboutText } from "@/components/clinic/about-text";
import { db } from "@/lib/db";

// =============================================================================
// Dynamic SEO Metadata
// =============================================================================

interface ClinicPageParams {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ClinicPageParams): Promise<Metadata> {
  try {
    const { slug } = await params;
    const clinic = await db.clinic.findUnique({
      where: { slug },
    });

    if (!clinic) {
      return {
        title: "Clinic Not Found — DoctA",
        description: "The clinic you are looking for could not be found.",
      };
    }

    const description = clinic.about
      ? clinic.about.length > 160
        ? clinic.about.substring(0, 157) + "..."
        : clinic.about
      : `Book appointments at ${clinic.name}. View providers, hours, and availability.`;

    const ogImages = clinic.coverImageUrl
      ? [{ url: clinic.coverImageUrl }]
      : undefined;

    return {
      title: `${clinic.name} — DoctA`,
      description,
      openGraph: {
        title: `${clinic.name} — DoctA`,
        description,
        type: "website",
        url: `https://clinicbook.app/clinic/${clinic.slug}`,
        siteName: "DoctA",
        ...(ogImages ? { images: ogImages } : {}),
      },
    };
  } catch {
    return {
      title: "Clinic — DoctA",
      description: "Find and book medical appointments at top-rated clinics.",
    };
  }
}

// =============================================================================
// Types
// =============================================================================

interface DayHours {
  open: string;
  close: string;
}

type HoursOfWeek = Record<string, DayHours | null>;

// =============================================================================
// Helpers
// =============================================================================

const DAY_LABELS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

function formatTime24to12(time24: string): string {
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

// Map JS getDay() (0=Sun..6=Sat) to our day keys
const JS_DAY_TO_KEY: Record<number, string> = {
  0: "sun",
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
};

// =============================================================================
// Page Component
// =============================================================================

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ClinicDetailPage({ params }: PageProps) {
  const { slug } = await params;

  // ---------------------------------------------------------------------------
  // Fetch clinic with related data
  // ---------------------------------------------------------------------------
  const clinic = await db.clinic.findUnique({
    where: { slug },
    include: {
      insurances: {
        include: { insurance: true },
        orderBy: { insurance: { sortOrder: "asc" } },
      },
      amenities: {
        include: { amenity: true },
        orderBy: { amenity: { sortOrder: "asc" } },
      },
    },
  });

  // Redirect if not found or not PUBLISHED
  if (!clinic || clinic.status !== "PUBLISHED") {
    redirect("/?status=suspended");
  }

  // ---------------------------------------------------------------------------
  // Fetch all providers for this clinic with their 3 earliest AVAILABLE slots
  // ---------------------------------------------------------------------------
  const providers = await db.provider.findMany({
    where: {
      clinicId: clinic.id,
      status: "ACTIVE",
    },
    orderBy: [{ rating: "desc" }, { lastName: "asc" }],
    include: {
      slots: {
        where: {
          status: "AVAILABLE",
          startTime: { gte: new Date() },
        },
        orderBy: { startTime: "asc" },
        take: 3,
      },
      providerServices: {
        include: {
          service: {
            include: {
              specialty: true,
            },
          },
        },
        take: 1,
      },
    },
  });

  // ---------------------------------------------------------------------------
  // Parse hours of operation & determine today's status
  // ---------------------------------------------------------------------------
  let hours: HoursOfWeek | null = null;
  if (clinic.hoursOfOperation) {
    try {
      hours = JSON.parse(clinic.hoursOfOperation) as HoursOfWeek;
    } catch {
      hours = null;
    }
  }

  const now = new Date();
  const todayKey = JS_DAY_TO_KEY[now.getDay()];
  const todayDayData = hours?.[todayKey] ?? null;
  const todayHasHours =
    todayDayData && todayDayData.open && todayDayData.close;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let isCurrentlyOpen = false;
  if (todayHasHours) {
    const [openH, openM] = todayDayData!.open.split(":").map(Number);
    const [closeH, closeM] = todayDayData!.close.split(":").map(Number);
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;
    isCurrentlyOpen =
      currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  }

  // ---------------------------------------------------------------------------
  // Build display values
  // ---------------------------------------------------------------------------
  const fullAddress = [
    clinic.streetAddress,
    clinic.city,
    clinic.state,
    clinic.zipCode,
  ]
    .filter(Boolean)
    .join(", ");

  const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white to-brand-muted/30">
      <PublicNavbar showHome />

      {/* ===== Main Content ===== */}
      <main className="flex-1 w-full px-4 py-8 animate-in fade-in duration-500">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Back link — Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-foreground transition-colors cursor-pointer">Home</Link>
            <span className="text-border">/</span>
            <span>Clinics</span>
            <span className="text-border">/</span>
            <span className="text-foreground font-medium">{clinic.name}</span>
          </nav>

          <span className="sr-only">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="size-4" />
              Back to Search
            </Link>
          </span>

          {/* ===== Clinic Header Card ===== */}
          <Card className="overflow-hidden shadow-md">
            {/* Subtle gradient overlay on header */}
            <div className="absolute inset-0 h-24 bg-gradient-to-b from-white/30 to-transparent pointer-events-none z-10 rounded-t-lg" />
            {/* Gradient strip */}
            <div className="h-2 rounded-t-lg bg-gradient-to-r from-brand to-coral bg-[length:200%_200%] bg-gradient-animated relative" />
            <CardContent className="p-6 space-y-4">
              {/* Name + Verified Badge + Tagline */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Building2 className="size-6 text-brand shrink-0" />
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                    {clinic.name}
                  </h1>
                  <span className="inline-flex items-center gap-1 text-brand">
                    <Shield className="size-4" />
                    <span className="text-xs font-medium">Verified Clinic</span>
                  </span>
                </div>
                {clinic.tagline && (
                  <p className="text-muted-foreground text-base md:text-lg italic ml-0 md:ml-8">
                    &ldquo;{clinic.tagline}&rdquo;
                  </p>
                )}
              </div>

              <Separator />

              {/* Contact info — individual cards */}
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Address */}
                <div className="flex items-start gap-3 rounded-lg border border-border p-3 transition-all duration-200 hover:bg-muted/50 hover:shadow-md cursor-default">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-muted">
                    <MapPin className="size-4 text-brand" />
                  </div>
                  <span className="text-sm text-foreground leading-snug">
                    {fullAddress}
                  </span>
                </div>

                {/* Phone */}
                {clinic.phoneNumber && (
                  <div className="flex items-center gap-3 rounded-lg border border-border p-3 transition-all duration-200 hover:bg-muted/50 hover:shadow-md">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-muted">
                      <Phone className="size-4 text-brand" />
                    </div>
                    <a
                      href={`tel:${clinic.phoneNumber}`}
                      className="text-sm text-foreground hover:text-brand-hover transition-colors cursor-pointer"
                    >
                      {clinic.phoneNumber}
                    </a>
                  </div>
                )}

                {/* Email */}
                {clinic.email && (
                  <div className="flex items-center gap-3 rounded-lg border border-border p-3 transition-all duration-200 hover:bg-muted/50 hover:shadow-md">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-muted">
                      <Mail className="size-4 text-brand" />
                    </div>
                    <a
                      href={`mailto:${clinic.email}`}
                      className="text-sm text-foreground hover:text-brand-hover transition-colors cursor-pointer"
                    >
                      {clinic.email}
                    </a>
                  </div>
                )}

                {/* Website */}
                {clinic.website && (
                  <div className="flex items-center gap-3 rounded-lg border border-border p-3 transition-all duration-200 hover:bg-muted/50 hover:shadow-md">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-muted">
                      <Globe className="size-4 text-brand" />
                    </div>
                    <a
                      href={clinic.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-foreground hover:text-brand-hover transition-colors truncate cursor-pointer"
                    >
                      {clinic.website
                        .replace(/^https?:\/\//, "")
                        .replace(/\/$/, "")}
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ===== About Section ===== */}
          {clinic.about && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="size-5 text-brand" />
                  About
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border-l-4 border-l-brand pl-4">
                  <AboutText text={clinic.about} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* ===== Hours of Operation ===== */}
          {hours && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="size-5 text-brand" />
                    Hours of Operation
                  </CardTitle>
                  {todayHasHours && (
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <span
                        className={`size-2.5 rounded-full ${
                          isCurrentlyOpen ? "bg-green-500" : "bg-red-500"
                        }`}
                      />
                      <span
                        className={
                          isCurrentlyOpen
                            ? "text-green-700"
                            : "text-red-600"
                        }
                      >
                        {isCurrentlyOpen ? "Open Now" : "Closed"}
                      </span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border overflow-hidden">
                  {dayKeys.map((dayKey, index) => {
                    const dayData = hours[dayKey];
                    const isClosed =
                      !dayData || !dayData.open || !dayData.close;
                    const isToday = dayKey === todayKey;
                    return (
                      <div
                        key={dayKey}
                        className={`flex items-center justify-between text-sm px-4 py-2.5 ${
                          isToday
                            ? "bg-brand-muted/80"
                            : index % 2 === 1
                              ? "bg-muted/30"
                              : ""
                        } ${
                          index < dayKeys.length - 1 ? "border-b border-border" : ""
                        }`}
                      >
                        <span className="font-medium text-foreground min-w-[90px] flex items-center gap-2">
                          {isToday && (
                            <span className="size-1.5 rounded-full bg-brand-muted shrink-0" />
                          )}
                          {DAY_LABELS[dayKey]}
                        </span>
                        <span
                          className={
                            isClosed
                              ? "text-muted-foreground italic"
                              : "text-foreground"
                          }
                        >
                          {isClosed
                            ? "Closed"
                            : `${formatTime24to12(dayData!.open)} – ${formatTime24to12(dayData!.close)}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ===== Insurance & Amenities (side by side on desktop) ===== */}
          {(clinic.insurances.length > 0 || clinic.amenities.length > 0) && (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Insurance Accepted */}
              {clinic.insurances.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-brand to-coral" />
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Shield className="size-5 text-brand" />
                        Insurance Accepted
                      </CardTitle>
                      <span className="text-xs text-muted-foreground font-medium">
                        {clinic.insurances.length}{" "}
                        {clinic.insurances.length === 1
                          ? "insurance"
                          : "insurances"}{" "}
                        accepted
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {clinic.insurances.map((ci) => (
                        <Badge
                          key={ci.insuranceId}
                          variant="outline"
                          className="border-brand-border text-brand-hover bg-brand-muted/50 px-3 py-1 text-sm hover:bg-brand-subtle/60 hover:scale-105 transition-all cursor-default"
                        >
                          {ci.insurance.name}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Amenities */}
              {clinic.amenities.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-brand to-coral" />
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Star className="size-5 text-brand" />
                        Amenities
                      </CardTitle>
                      <span className="text-xs text-muted-foreground font-medium">
                        {clinic.amenities.length}{" "}
                        {clinic.amenities.length === 1
                          ? "amenity"
                          : "amenities"}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {clinic.amenities.map((ca) => (
                        <Badge
                          key={ca.amenityId}
                          variant="outline"
                          className="border-brand-border text-brand-hover bg-brand-muted/50 px-3 py-1 text-sm hover:bg-brand-subtle/60 hover:scale-105 transition-all cursor-default"
                        >
                          {ca.amenity.name}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ===== Providers Section ===== */}
          {providers.length > 0 && (
            <div className="space-y-6">
              {/* Gradient divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-brand-subtle to-transparent" />

              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Users className="size-5 text-brand" />
                    {providers.length}{" "}
                    {providers.length === 1 ? "provider" : "providers"} at this clinic
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Meet our team of healthcare professionals at {clinic.name}
                  </p>
                </div>
                <Link
                  href="/"
                  className="text-sm font-medium text-brand hover:text-brand-hover transition-colors cursor-pointer shrink-0"
                >
                  View all providers →
                </Link>
              </div>

              <div className={`grid gap-4 ${providers.length >= 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                {providers.map((provider) => {
                  const specialty =
                    provider.providerServices[0]?.service.specialty.name ?? null;
                  return (
                    <ClinicProviderRow
                      key={provider.id}
                      provider={{
                        id: provider.id,
                        firstName: provider.firstName,
                        lastName: provider.lastName,
                        credentials: provider.credentials,
                        rating: provider.rating,
                        reviewCount: provider.reviewCount,
                        slug: provider.slug,
                        slotDurationMinutes: provider.slotDurationMinutes,
                        specialty,
                      }}
                      slots={provider.slots.map((slot) => ({
                        id: slot.id,
                        startTime: slot.startTime.toISOString(),
                        endTime: slot.endTime.toISOString(),
                        modality: slot.modality,
                      }))}
                      clinicSlug={clinic.slug}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ===== Footer ===== */}
      <PublicFooter />
    </div>
  );
}