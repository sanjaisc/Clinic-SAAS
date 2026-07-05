import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import {
  Star,
  MapPin,
  Phone,
  Building2,
  Heart,
  ChevronLeft,
  Clock,
  Users,
  Award,
  Stethoscope,
  Globe,
  CalendarCheck,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { PublicFooter } from "@/components/public-footer";
import { ExpandableText } from "@/components/ui/expandable-text";
import { db } from "@/lib/db";

// =============================================================================
// Dynamic SEO Metadata
// =============================================================================

interface ProviderPageParams {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProviderPageParams): Promise<Metadata> {
  try {
    const { slug } = await params;
    const provider = await db.provider.findUnique({
      where: { slug },
      include: {
        providerServices: {
          include: {
            service: {
              include: { specialty: true },
            },
          },
          take: 1,
        },
      },
    });

    if (!provider) {
      return {
        title: "Provider Not Found — ClinicBook",
        description: "The healthcare provider you are looking for could not be found.",
      };
    }

    const specialty = provider.providerServices[0]?.service.specialty.name ?? "Healthcare";
    const displayName = `Dr. ${provider.firstName} ${provider.lastName}`;

    const ratingSuffix =
      provider.rating > 0
        ? ` Rated ${provider.rating.toFixed(1)}/5 by ${provider.reviewCount} patients.`
        : "";

    const description = provider.bio
      ? provider.bio.length > 160
        ? provider.bio.substring(0, 157) + "..."
        : provider.bio
      : `Book an appointment with ${displayName} (${specialty}).${ratingSuffix} View availability and schedule your visit today.`;

    return {
      title: `${displayName} — ${specialty} | ClinicBook`,
      description,
      openGraph: {
        title: `${displayName} — ${specialty} | ClinicBook`,
        description,
        type: "profile",
        firstName: provider.firstName,
        lastName: provider.lastName,
      },
    };
  } catch {
    return {
      title: "Provider — ClinicBook",
      description: "Find and book appointments with top-rated healthcare providers.",
    };
  }
}

// =============================================================================
// Types
// =============================================================================

interface PageProps {
  params: Promise<{ slug: string }>;
}

// =============================================================================
// Helpers
// =============================================================================

function RatingStars({ rating, size = 4, shimmer = false }: { rating: number; size?: number; shimmer?: boolean }) {
  const filledCount = Math.round(rating);
  return (
    <div className={`flex items-center gap-0.5 ${shimmer ? 'star-shimmer' : ''}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`${size === 4 ? "size-4" : "size-3.5"} ${
            i < filledCount
              ? "fill-yellow-400 text-yellow-400"
              : "fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700"
          }`}
        />
      ))}
    </div>
  );
}

function RatingProgressBar({ label, value, max = 5 }: { label: string; value: number; max?: number }) {
  const percentage = (value / max) * 100;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 text-muted-foreground text-right">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="w-8 shrink-0 font-medium text-foreground">{value.toFixed(1)}</span>
    </div>
  );
}

function maskPatientName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name.charAt(0) + "***";
  const first = parts[0].charAt(0) + "***";
  const last = parts[parts.length - 1].charAt(0).toUpperCase() + parts[parts.length - 1].slice(1);
  return `${first} ${last}`;
}

// =============================================================================
// Page Component
// =============================================================================

export default async function ProviderProfilePage({ params }: PageProps) {
  const { slug } = await params;

  // ---------------------------------------------------------------------------
  // Fetch provider with all related data
  // ---------------------------------------------------------------------------
  const provider = await db.provider.findUnique({
    where: { slug },
    include: {
      clinic: true,
      reviews: {
        orderBy: { createdAt: "desc" },
        include: {
          appointment: {
            select: { patientName: true },
          },
        },
      },
      providerServices: {
        include: {
          service: {
            include: {
              specialty: true,
            },
          },
        },
      },
      languages: {
        include: {
          language: true,
        },
        orderBy: {
          language: { sortOrder: "asc" },
        },
      },
    },
  });

  if (!provider || provider.status !== "ACTIVE") {
    notFound();
  }

  // ---------------------------------------------------------------------------
  // Compute derived data
  // ---------------------------------------------------------------------------

  // Unique specialties
  const specialtyMap = new Map<string, { id: string; name: string; slug: string }>();
  for (const ps of provider.providerServices) {
    const spec = ps.service.specialty;
    if (!specialtyMap.has(spec.id)) {
      specialtyMap.set(spec.id, { id: spec.id, name: spec.name, slug: spec.slug });
    }
  }
  const specialtiesList = Array.from(specialtyMap.values());

  // First specialty for CTA link
  const firstSpecialtySlug = specialtiesList[0]?.slug ?? "";

  // Rating breakdown averages
  const reviewCount = provider.reviews.length;
  const avgOverall = reviewCount > 0
    ? provider.reviews.reduce((sum, r) => sum + r.overallRating, 0) / reviewCount
    : provider.rating;
  const avgWait = reviewCount > 0
    ? provider.reviews.reduce((sum, r) => sum + r.waitTimeRating, 0) / reviewCount
    : 0;
  const avgBedside = reviewCount > 0
    ? provider.reviews.reduce((sum, r) => sum + r.bedsideRating, 0) / reviewCount
    : 0;
  const avgStaff = reviewCount > 0
    ? provider.reviews.reduce((sum, r) => sum + r.staffRating, 0) / reviewCount
    : 0;

  // Total appointments (completed + current slots)
  const completedAppointments = await db.appointment.count({
    where: { providerId: provider.id, status: "COMPLETED" },
  });

  const displayName = provider.credentials
    ? `Dr. ${provider.firstName} ${provider.lastName}, ${provider.credentials}`
    : `Dr. ${provider.firstName} ${provider.lastName}`;

  const fullAddress = [
    provider.clinic.streetAddress,
    provider.clinic.city,
    provider.clinic.state,
    provider.clinic.zipCode,
  ]
    .filter(Boolean)
    .join(", ");

  const mapQuery = encodeURIComponent(fullAddress);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white to-emerald-50/30">
      {/* ===== Sticky Header ===== */}
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Heart className="size-6 text-emerald-600 fill-emerald-600" />
            <span className="text-lg font-bold tracking-tight text-foreground">
              ClinicBook
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" className="cursor-pointer">
              Staff Login
            </Button>
          </div>
        </div>
      </header>

      {/* ===== Main Content ===== */}
      <main className="flex-1 w-full px-4 py-8 animate-in fade-in duration-500">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Back link — Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-foreground transition-colors cursor-pointer">Home</Link>
            <span className="text-border">/</span>
            <span>Search</span>
            <span className="text-border">/</span>
            <span className="text-foreground font-medium">{provider.firstName} {provider.lastName}</span>
          </nav>

          {/* Back link (hidden, replaced by breadcrumb) */}
          <span className="sr-only">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="size-4" />
              Back to Search
            </Link>
          </span>

          {/* ===== Hero Section ===== */}
          <Card className="overflow-hidden shadow-md">
            {/* Parallax hero gradient — CSS only */}
            <div className="h-2 rounded-t-lg bg-gradient-to-r from-emerald-400 to-teal-500 bg-[length:200%_200%] bg-gradient-animated" />
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-5">
                {/* Avatar */}
                <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-emerald-100 ring-4 ring-emerald-200 text-emerald-700 text-2xl font-bold">
                  {provider.firstName.charAt(0)}{provider.lastName.charAt(0)}
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  {/* Name + Verified */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                          {displayName}
                        </h1>
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50/80 px-2 py-0.5">
                          <ShieldCheck className="size-3 text-emerald-600" />
                          <span className="text-[10px] font-medium text-emerald-700 leading-none">Verified</span>
                        </span>
                      </div>

                      {/* Specialty badges */}
                      {specialtiesList.length > 0 && (
                        <div className="flex gap-2 flex-wrap mt-2">
                          {specialtiesList.map((spec) => (
                            <Badge
                              key={spec.id}
                              className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 cursor-default"
                            >
                              <Stethoscope className="size-3 mr-1" />
                              {spec.name}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Clinic link */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                        <Building2 className="size-4 shrink-0" />
                        <Link
                          href={`/clinic/${provider.clinic.slug}`}
                          className="hover:text-emerald-700 hover:underline transition-colors cursor-pointer"
                        >
                          {provider.clinic.name}
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-3">
                    <RatingStars rating={avgOverall} size={5} shimmer />
                    <span className="text-lg font-semibold text-foreground">
                      {avgOverall.toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ({provider.reviewCount} {provider.reviewCount === 1 ? "review" : "reviews"})
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ===== Stats Bar ===== */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="text-center p-4">
              <div className="flex justify-center mb-2">
                <div className="size-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Clock className="size-5 text-emerald-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {provider.yearsExperience ?? 0}+
              </p>
              <p className="text-xs text-muted-foreground mt-1">Years Experience</p>
            </Card>
            <Card className="text-center p-4">
              <div className="flex justify-center mb-2">
                <div className="size-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CalendarCheck className="size-5 text-emerald-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {completedAppointments}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Total Appointments</p>
            </Card>
            <Card className="text-center p-4">
              <div className="flex justify-center mb-2">
                <div className="size-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Award className="size-5 text-emerald-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {avgOverall.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Patient Rating</p>
            </Card>
          </div>

          {/* ===== About Section ===== */}
          {provider.bio && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="size-5 text-emerald-600" />
                  About
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border-l-4 border-l-emerald-400 pl-4">
                  <ExpandableText maxLines={3}>
                    {provider.bio}
                  </ExpandableText>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ===== Services + Languages (side by side on desktop) ===== */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Services */}
            {provider.providerServices.length > 0 && (
              <Card className="overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Stethoscope className="size-5 text-emerald-600" />
                    Services
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {provider.providerServices.map((ps) => (
                      <Badge
                        key={ps.serviceId}
                        variant="outline"
                        className="border-emerald-300 text-emerald-700 bg-emerald-50/50 px-3 py-1 text-sm hover:bg-emerald-100/60 transition-colors cursor-default"
                      >
                        {ps.service.name}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Languages */}
            {provider.languages.length > 0 && (
              <Card className="overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Globe className="size-5 text-emerald-600" />
                    Languages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {provider.languages.map((pl) => (
                      <Badge
                        key={pl.languageId}
                        variant="outline"
                        className="border-emerald-300 text-emerald-700 bg-emerald-50/50 px-3 py-1 text-sm hover:bg-emerald-100/60 transition-colors cursor-default"
                      >
                        {pl.language.name}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ===== Reviews Section ===== */}
          {provider.reviews.length > 0 && (
            <div className="space-y-6">
              <div className="h-px bg-gradient-to-r from-transparent via-emerald-300 to-transparent" />

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Star className="size-5 text-emerald-600 fill-emerald-600" />
                      Patient Reviews
                    </CardTitle>
                    <span className="text-sm text-muted-foreground">
                      {provider.reviews.length} {provider.reviews.length === 1 ? "review" : "reviews"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Rating Breakdown */}
                  <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/20">
                    <h3 className="text-sm font-semibold text-foreground mb-2">Rating Breakdown</h3>
                    <RatingProgressBar label="Overall" value={avgOverall} />
                    <RatingProgressBar label="Wait Time" value={avgWait} />
                    <RatingProgressBar label="Bedside Manner" value={avgBedside} />
                    <RatingProgressBar label="Staff" value={avgStaff} />
                  </div>

                  <Separator />

                  {/* Individual Reviews */}
                  <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
                    {provider.reviews.map((review) => (
                      <div
                        key={review.id}
                        className="rounded-lg border border-border p-4 space-y-2 hover:bg-muted/20 transition-all duration-200 border-l-2 hover:border-l-4 hover:border-l-emerald-400"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <RatingStars rating={review.overallRating} size={3} />
                            <span className="text-sm font-medium text-foreground">
                              {review.overallRating}/5
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(review.createdAt), "MMM d, yyyy")}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {review.comment || "No comment provided."}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Users className="size-3" />
                            {maskPatientName(review.appointment?.patientName ?? "Anonymous")}
                          </span>
                          {review.isVerified && (
                            <span className="inline-flex items-center gap-0.5 text-emerald-600">
                              <ShieldCheck className="size-3" />
                              Verified
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ===== CTA + Contact Info (side by side on desktop) ===== */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Book CTA */}
            <Card className="overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
              <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                <div className="size-14 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CalendarCheck className="size-7 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Book with {provider.firstName} {provider.lastName}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose from available appointment times
                  </p>
                </div>
                <Link href={`/?specialtyId=${firstSpecialtySlug}`} className="w-full">
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer text-base py-6">
                    <CalendarCheck className="size-5 mr-2" />
                    Find Available Times
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <Card className="overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="size-5 text-emerald-600" />
                  Contact Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Clinic Name */}
                <Link
                  href={`/clinic/${provider.clinic.slug}`}
                  className="font-semibold text-foreground hover:text-emerald-700 transition-colors cursor-pointer"
                >
                  {provider.clinic.name}
                </Link>

                {/* Address */}
                <div className="flex items-start gap-3">
                  <MapPin className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-emerald-700 transition-colors cursor-pointer"
                  >
                    {fullAddress}
                    <ExternalLink className="inline size-3 ml-1" />
                  </a>
                </div>

                {/* Phone */}
                <div className="flex items-center gap-3">
                  <Phone className="size-4 text-emerald-600 shrink-0" />
                  <a
                    href={`tel:${provider.clinic.phoneNumber}`}
                    className="text-sm text-muted-foreground hover:text-emerald-700 transition-colors cursor-pointer"
                  >
                    {provider.clinic.phoneNumber}
                  </a>
                </div>

                {/* Map Link */}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    variant="outline"
                    className="w-full mt-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 cursor-pointer"
                  >
                    <MapPin className="size-4 mr-2" />
                    View on Google Maps
                  </Button>
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* ===== Footer ===== */}
      <PublicFooter />
    </div>
  );
}