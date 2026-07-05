"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  MapPin,
  Heart,
  Building2,
  User,
  Baby,
  Clock,
  Navigation,
  Stethoscope,
  AlertCircle,
  Loader2,
  X,
  LocateFixed,
  Cross,
  CheckCircle2,
  Star,
  CalendarCheck,
  HeartPulse,
  Bone,
  Sparkles,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { ProviderCard } from "@/components/search/provider-card";
import { ThemeToggle } from "@/components/theme-toggle";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface TaxonomySpecialty {
  id: string;
  name: string;
  slug: string;
}

interface TaxonomyInsurance {
  id: string;
  name: string;
  slug: string;
  isDemo: boolean;
}

interface ProviderSlot {
  id: string;
  startTime: string;
  endTime: string;
  modality: string;
}

interface ProviderResult {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  credentials: string | null;
  photoUrl: string | null;
  rating: number;
  reviewCount: number;
  slotDurationMinutes: number;
  clinic: {
    id: string;
    slug: string;
    name: string;
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
    phoneNumber: string;
    logoUrl: string | null;
  };
  distance: number | null;
  earliestSlots: ProviderSlot[];
  reviewSnippet: string | null;
  costBadge: string | null;
}

interface SearchResponse {
  providers: ProviderResult[];
  hasMore: boolean;
  total: number;
}

interface FeaturedClinic {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string;
  email: string;
  website: string | null;
  coverImageUrl: string | null;
  specialties: string[];
  providerCount: number;
  rating: number;
  firstProvider: { firstName: string; lastName: string; credentials: string | null } | null;
  availableSlotsCount: number;
}

// -----------------------------------------------------------------------------
// Search Helpers
// -----------------------------------------------------------------------------

interface SearchParams {
  specialtyId: string;
  patientType: string;
  q?: string;
  insuranceId?: string;
  modality?: string;
  radius: number;
  lat?: number;
  lng?: number;
  sort: string;
  cursor: number;
  size: number;
}

function buildFetchUrl(params: SearchParams): string {
  const sp = new URLSearchParams();
  sp.set("specialtyId", params.specialtyId);
  sp.set("patientType", params.patientType);
  if (params.q) sp.set("q", params.q);
  if (params.insuranceId) sp.set("insuranceId", params.insuranceId);
  if (params.modality) sp.set("modality", params.modality);
  sp.set("radius", String(params.radius));
  if (params.lat != null) sp.set("lat", String(params.lat));
  if (params.lng != null) sp.set("lng", String(params.lng));
  sp.set("sort", params.sort);
  sp.set("cursor", String(params.cursor));
  sp.set("size", String(params.size));
  return `/api/search/providers?${sp.toString()}`;
}

// -----------------------------------------------------------------------------
// Specialty Icon Mapping
// -----------------------------------------------------------------------------

const SPECIALTY_ICON_MAP: Record<string, typeof Stethoscope> = {
  "Family Medicine": Stethoscope,
  "Cardiology": HeartPulse,
  "Dermatology": Sparkles,
  "Pediatrics": Baby,
  "Orthopedics": Bone,
};

function getSpecialtyIcon(name: string): typeof Stethoscope {
  return SPECIALTY_ICON_MAP[name] ?? Stethoscope;
}

// =============================================================================
// Component
// =============================================================================

export function SearchPage() {
  // ---- Taxonomy Data ----
  const [specialties, setSpecialties] = useState<TaxonomySpecialty[]>([]);
  const [insurances, setInsurances] = useState<TaxonomyInsurance[]>([]);
  const [providerCount, setProviderCount] = useState<number>(0);

  // ---- Filter State ----
  const [query, setQuery] = useState("");
  const [specialtyId, setSpecialtyId] = useState<string | null>(null);
  const [patientType, setPatientType] = useState<"ADULT" | "PEDIATRIC">("ADULT");
  const [insuranceId, setInsuranceId] = useState("");
  const [modality, setModality] = useState<"IN_PERSON" | "VIDEO" | "">("");
  const [radius, setRadius] = useState(5);
  const [sort, setSort] = useState<"distance" | "time">("distance");
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");

  // ---- Results State ----
  const [results, setResults] = useState<ProviderResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [searched, setSearched] = useState(false);

  // ---- Featured Clinics ----
  const [clinics, setClinics] = useState<FeaturedClinic[]>([]);

  // ---------------------------------------------------------------------------
  // Fetch Taxonomies & Clinics on Mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function fetchInitialData() {
      try {
        const [taxRes, clinicRes] = await Promise.all([
          fetch("/api/taxonomies"),
          fetch("/api/clinics"),
        ]);
        if (taxRes.ok) {
          const data = await taxRes.json();
          setSpecialties(data.specialties ?? []);
          setInsurances(data.insurances ?? []);
          setProviderCount(data.providerCount ?? 0);
        }
        if (clinicRes.ok) {
          const clinicData = await clinicRes.json();
          setClinics(clinicData.clinics ?? []);
        }
      } catch {
        // Silently fail
      }
    }
    fetchInitialData();

    // Attempt browser geolocation (non-blocking)
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLat(pos.coords.latitude);
          setUserLng(pos.coords.longitude);
          setGeoStatus("granted");
        },
        () => setGeoStatus("denied"),
        { timeout: 5000 }
      );
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Request Geolocation Manually
  // ---------------------------------------------------------------------------
  const requestGeoLocation = useCallback(() => {
    if (!navigator?.geolocation) return;
    setGeoStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setGeoStatus("granted");
      },
      () => setGeoStatus("denied"),
      { timeout: 8000 }
    );
  }, []);

  // ---------------------------------------------------------------------------
  // Build search params from current state + optional overrides
  // ---------------------------------------------------------------------------
  const getSearchParams = useCallback(
    (overrides?: Partial<SearchParams>): SearchParams => {
      return {
        specialtyId: overrides?.specialtyId ?? specialtyId ?? "",
        patientType: overrides?.patientType ?? patientType,
        q: overrides?.q ?? (query.trim() || undefined),
        insuranceId: (overrides?.insuranceId ?? insuranceId) || undefined,
        modality: (overrides?.modality ?? modality) || undefined,
        radius: overrides?.radius ?? radius,
        lat: userLat ?? undefined,
        lng: userLng ?? undefined,
        sort: overrides?.sort ?? sort,
        cursor: overrides?.cursor ?? 0,
        size: 10,
      };
    },
    [query, specialtyId, patientType, insuranceId, modality, radius, sort, userLat, userLng]
  );

  // ---------------------------------------------------------------------------
  // Primary Search (fresh results)
  // ---------------------------------------------------------------------------
  const executeSearch = useCallback(
    async (overrides?: Partial<SearchParams>) => {
      const params = getSearchParams(overrides);
      if (!params.specialtyId) return;

      setLoading(true);
      setResults([]);
      setCursor(0);
      setError(null);
      setSearched(true);
      setInitialLoad(false);

      try {
        const res = await fetch(buildFetchUrl(params));
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        const data: SearchResponse = await res.json();
        setResults(data.providers);
        setHasMore(data.hasMore);
        setTotal(data.total);
        setCursor(data.providers.length);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [getSearchParams]
  );

  // ---------------------------------------------------------------------------
  // Load More (append results)
  // ---------------------------------------------------------------------------
  const onLoadMore = useCallback(async () => {
    if (loadingMore) return;

    const params = getSearchParams({ cursor });
    setLoadingMore(true);

    try {
      const res = await fetch(buildFetchUrl(params));
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const data: SearchResponse = await res.json();
      setResults((prev) => [...prev, ...data.providers]);
      setHasMore(data.hasMore);
      setTotal(data.total);
      setCursor((prev) => prev + data.providers.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, cursor, getSearchParams]);

  // ---------------------------------------------------------------------------
  // Clear All Filters
  // ---------------------------------------------------------------------------
  const clearFilters = useCallback(() => {
    setQuery("");
    setSpecialtyId(null);
    setPatientType("ADULT");
    setInsuranceId("");
    setModality("");
    setRadius(5);
    setSort("distance");
    setResults([]);
    setSearched(false);
    setInitialLoad(true);
    setError(null);
    setTotal(0);
    setHasMore(false);
    setCursor(0);
  }, []);

  // ---------------------------------------------------------------------------
  // Form Submit
  // ---------------------------------------------------------------------------
  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch();
  };

  // ---------------------------------------------------------------------------
  // Smart Suggestion Handlers
  // ---------------------------------------------------------------------------
  const onExpandRadius = () => {
    setRadius(25);
    executeSearch({ radius: 25 });
  };

  const onRemoveInsurance = () => {
    setInsuranceId("");
    executeSearch({ insuranceId: undefined });
  };

  const onRemoveModality = () => {
    setModality("");
    executeSearch({ modality: undefined });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const activeFilterCount = [
    query,
    insuranceId,
    modality,
    patientType !== "ADULT" ? patientType : null,
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ===== Sticky Header ===== */}
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer">
            <Heart className="size-6 text-emerald-600 fill-emerald-600" />
            <span className="text-lg font-bold tracking-tight text-foreground">
              ClinicBook
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/staff/login">
              <Button variant="outline" size="sm" className="cursor-pointer">
                Staff Login
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ===== Hero Section ===== */}
      <section className="relative bg-gradient-to-br from-emerald-50 via-white to-teal-50/30 pb-8 pt-12 md:pt-16 overflow-hidden">
        {/* Dot pattern background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #059669 0.8px, transparent 0.8px)',
            backgroundSize: '32px 32px',
            opacity: 0.04,
          }}
          aria-hidden="true"
        />
        {/* Decorative background elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          {/* Large gradient blob — top right */}
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-emerald-100/40 blur-3xl animate-float-slow" />
          {/* Small circle — bottom left */}
          <div className="absolute bottom-0 -left-10 w-48 h-48 rounded-full bg-teal-100/30 blur-2xl" style={{ animation: "float-slow 8s ease-in-out infinite reverse" }} />
          {/* Tiny dot accents */}
          <div className="absolute top-12 left-[15%] w-2 h-2 rounded-full bg-emerald-300/40" />
          <div className="absolute top-24 right-[20%] w-1.5 h-1.5 rounded-full bg-emerald-400/30" />
          <div className="absolute bottom-16 left-[30%] w-1 h-1 rounded-full bg-teal-400/40" />
          {/* Heartbeat line */}
          <svg
            className="absolute bottom-4 left-0 w-full h-6 text-emerald-200/50 animate-heartbeat"
            viewBox="0 0 1200 24"
            preserveAspectRatio="none"
            fill="none"
          >
            <path
              d="M0 12 L200 12 L220 12 L240 4 L260 20 L280 2 L300 22 L320 12 L340 12 L500 12 L520 12 L540 4 L560 20 L580 2 L600 22 L620 12 L640 12 L800 12 L820 12 L840 4 L860 20 L880 2 L900 22 L920 12 L940 12 L1200 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {/* Medical cross icon — decorative */}
          <div className="absolute top-8 right-[10%] opacity-[0.07]">
            <Cross className="size-16 text-emerald-700 animate-heartbeat" />
          </div>
        </div>

        <div className="relative max-w-4xl mx-auto px-4 text-center space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              Find Your Doctor
            </h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
              Search for local providers, compare availability, and book an
              appointment in minutes.
            </p>
            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 pt-2">
              <span className="inline-flex items-center gap-1.5 text-xs md:text-sm text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                Trusted by 10,000+ patients
              </span>
              <span className="text-muted-foreground/30">·</span>
              <span className="inline-flex items-center gap-1.5 text-xs md:text-sm text-muted-foreground">
                <Building2 className="size-3.5 text-emerald-500" />
                6 clinics
              </span>
              <span className="text-muted-foreground/30">·</span>
              <Link href="/clinics" className="inline-flex items-center gap-1.5 text-xs md:text-sm text-emerald-600 hover:text-emerald-700 font-medium hover:underline transition-colors cursor-pointer">
                <MapPin className="size-3.5" />
                Browse all clinics
              </Link>
              <span className="text-muted-foreground/30">·</span>
              <span className="inline-flex items-center gap-1.5 text-xs md:text-sm text-muted-foreground">
                <Stethoscope className="size-3.5 text-emerald-500" />
                {providerCount > 0 ? `${providerCount} providers` : "Providers"}
              </span>
              <span className="text-muted-foreground/30">·</span>
              <span className="inline-flex items-center gap-1.5 text-xs md:text-sm text-muted-foreground">
                4.7★ average rating
              </span>
            </div>
          </div>

          {/* Search Form — Card Wrapper with animated gradient border */}
          <form onSubmit={onFormSubmit} className="text-left">
            <div className="p-[1px] rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400 bg-[length:200%_100%] animate-[shimmer_3s_ease-in-out_infinite]">
            <div className="rounded-[15px] border-0 bg-white/90 backdrop-blur-sm shadow-lg shadow-emerald-900/5 p-4 md:p-6 space-y-4">
              {/* Row 1: Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search by doctor name, clinic, or condition..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-12 pl-10 pr-10 text-base bg-white w-full"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              {/* Row 2: Filters Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Specialty Select (MANDATORY) */}
                <div className="relative">
                  <Select
                    value={specialtyId ?? undefined}
                    onValueChange={(val) => setSpecialtyId(val)}
                  >
                    <SelectTrigger className="h-10 w-full bg-white cursor-pointer">
                      <SelectValue placeholder="Select specialty *" />
                    </SelectTrigger>
                    <SelectContent>
                      {specialties.map((s) => (
                        <SelectItem
                          key={s.id}
                          value={s.id}
                          className="cursor-pointer"
                        >
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Checkmark indicator when specialty is selected */}
                  {specialtyId && (
                    <div className="absolute -top-1.5 -right-1.5 z-10 animate-in fade-in-0 zoom-in-95">
                      <div className="bg-emerald-500 rounded-full p-0.5">
                        <CheckCircle2 className="size-3 text-white" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Patient Type Toggle (MANDATORY) */}
                <div className="flex items-center">
                  <ToggleGroup
                    type="single"
                    value={patientType}
                    onValueChange={(val) => {
                      if (val) setPatientType(val as "ADULT" | "PEDIATRIC");
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    <ToggleGroupItem
                      value="ADULT"
                      className="flex-1 gap-1.5 cursor-pointer"
                    >
                      <User className="size-3.5" />
                      <span className="text-xs sm:text-sm">Adult</span>
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="PEDIATRIC"
                      className="flex-1 gap-1.5 cursor-pointer"
                    >
                      <Baby className="size-3.5" />
                      <span className="text-xs sm:text-sm">Pediatric</span>
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {/* Insurance Select (optional) */}
                <Select
                  value={insuranceId || undefined}
                  onValueChange={(val) =>
                    setInsuranceId(val === "__none__" ? "" : val)
                  }
                >
                  <SelectTrigger className="h-10 w-full bg-white cursor-pointer">
                    <SelectValue placeholder="Any Insurance" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="cursor-pointer">
                      Uninsured
                    </SelectItem>
                    {insurances.map((ins) => (
                      <SelectItem
                        key={ins.id}
                        value={ins.id}
                        className="cursor-pointer"
                      >
                        {ins.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Modality Select (optional) */}
                <Select
                  value={modality || undefined}
                  onValueChange={(val) =>
                    setModality(val as "IN_PERSON" | "VIDEO")
                  }
                >
                  <SelectTrigger className="h-10 w-full bg-white cursor-pointer">
                    <SelectValue placeholder="Any Visit Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN_PERSON" className="cursor-pointer">
                      In-Person
                    </SelectItem>
                    <SelectItem value="VIDEO" className="cursor-pointer">
                      Video
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Row 3: Radius Slider + Sort */}
              <div className="flex items-center gap-4 flex-wrap">
                {/* Radius Slider */}
                <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                  {geoStatus === "granted" ? (
                    <LocateFixed className="size-4 text-emerald-600 shrink-0" title="Location detected" />
                  ) : (
                    <MapPin className="size-4 text-muted-foreground shrink-0" title="Allow location for distance sorting" />
                  )}
                  <span className="text-sm text-muted-foreground whitespace-nowrap min-w-[45px]">
                    {radius} mi
                  </span>
                  <Slider
                    value={[radius]}
                    onValueChange={([val]) => setRadius(val)}
                    min={1}
                    max={50}
                    step={1}
                    className="flex-1 cursor-pointer"
                  />
                </div>

                {/* Use My Location button (when geo not granted) */}
                {geoStatus !== "granted" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={requestGeoLocation}
                    disabled={geoStatus === "requesting"}
                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer shrink-0"
                  >
                    {geoStatus === "requesting" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <LocateFixed className="size-3.5" />
                    )}
                    <span className="text-xs sm:text-sm ml-1.5">Use my location</span>
                  </Button>
                )}

                {/* Sort Toggle */}
                <ToggleGroup
                  type="single"
                  value={sort}
                  onValueChange={(val) => {
                    if (val) setSort(val as "distance" | "time");
                  }}
                  variant="outline"
                  className="cursor-pointer"
                >
                  <ToggleGroupItem
                    value="distance"
                    className="gap-1.5 cursor-pointer"
                  >
                    <Navigation className="size-3.5" />
                    <span className="text-xs sm:text-sm">Nearest</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="time"
                    className="gap-1.5 cursor-pointer"
                  >
                    <Clock className="size-3.5" />
                    <span className="text-xs sm:text-sm">Earliest</span>
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* Row 4: Search Button */}
              <div className="flex flex-col items-center gap-2">
                <Button
                  type="submit"
                  disabled={!specialtyId || loading}
                  className="h-12 px-10 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer text-base font-semibold shadow-lg shadow-emerald-600/25 hover:shadow-xl hover:shadow-emerald-600/30 transition-all"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}
                  Search Providers
                </Button>
                {!specialtyId && (
                  <span className="text-xs text-muted-foreground">
                    Please select a specialty to search
                  </span>
                )}
                {/* Popular search chip */}
                <button
                  type="button"
                  onClick={() => {
                    const familyMed = specialties.find(s => s.name === "Family Medicine");
                    if (familyMed) {
                      setSpecialtyId(familyMed.id);
                      executeSearch({ specialtyId: familyMed.id });
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all cursor-pointer"
                >
                  <span className="text-emerald-500">🔥</span>
                  Popular: Family Medicine
                </button>
              </div>
            </div>
            </div>
          </form>
        </div>
      </section>

      {/* ===== Results Section ===== */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
        {/* ===== Initial Load — Featured Content ===== */}
        {initialLoad && (
          <div className="space-y-14 pb-4">
            {/* Subtle hero illustration */}
            <div className="flex flex-col items-center justify-center text-center">
              <div className="relative w-16 h-16 mb-3">
                <div className="absolute inset-0 rounded-full bg-emerald-100/50" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Stethoscope className="size-7 text-emerald-500/50" />
                </div>
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">
                Ready to find your provider?
              </h2>
              <p className="text-muted-foreground text-sm max-w-sm">
                Select a specialty above and hit search. We&apos;ll show you available
                doctors near you with open appointment slots.
              </p>
            </div>

            {/* ----- Featured Clinics ----- */}
            {clinics.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-5 text-emerald-600" />
                    <h2 className="text-xl font-bold text-foreground">Featured Clinics</h2>
                  </div>
                  <Link
                    href="/clinics"
                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium hover:underline transition-colors cursor-pointer"
                  >
                    View all →
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {clinics.slice(0, 3).map((clinic, idx) => (
                    <div
                      key={clinic.id}
                      className="group relative rounded-xl border bg-card overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                      style={{ animationDelay: `${idx * 100}ms` }}
                    >
                      {/* Emerald gradient accent strip */}
                      <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400" />
                      <div className="p-5 space-y-3">
                        {/* Clinic Name */}
                        <Link
                          href={`/clinic/${clinic.slug}`}
                          className="block font-bold text-foreground group-hover:text-emerald-700 transition-colors cursor-pointer"
                        >
                          {clinic.name}
                        </Link>
                        {/* Tagline */}
                        {clinic.tagline && (
                          <p className="text-sm italic text-muted-foreground line-clamp-1">
                            {clinic.tagline}
                          </p>
                        )}
                        {/* City, State */}
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="size-3.5 shrink-0" />
                          <span>{clinic.city}, {clinic.state}</span>
                        </div>
                        {/* Rating */}
                        <div className="flex items-center gap-1.5 text-sm">
                          {Array.from({ length: 5 }).map((_, s) => (
                            <Star
                              key={s}
                              className={`size-3.5 ${
                                s < Math.round(clinic.rating)
                                  ? "text-amber-400 fill-amber-400"
                                  : "text-muted-foreground/30"
                              }`}
                            />
                          ))}
                          <span className="text-muted-foreground ml-0.5">
                            {clinic.rating > 0 ? clinic.rating.toFixed(1) : "New"}
                          </span>
                        </div>
                        {/* Specialty Badges */}
                        {clinic.specialties.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {clinic.specialties.slice(0, 3).map((spec) => (
                              <Badge
                                key={spec}
                                variant="outline"
                                className="text-xs border-emerald-200 text-emerald-700 bg-emerald-50/50"
                              >
                                {spec}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {/* Available Slots */}
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Clock className="size-3.5 text-emerald-500" />
                          <span>{clinic.availableSlotsCount} available this week</span>
                        </div>
                        {/* View Clinic Link */}
                        <Link
                          href={`/clinic/${clinic.slug}`}
                          className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer pt-1"
                        >
                          View Clinic →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ----- How It Works ----- */}
            <section className="space-y-6">
              <h2 className="text-xl font-bold text-foreground text-center">How It Works</h2>
              <div className="relative">
                {/* Dotted connector line — desktop only */}
                <div className="hidden md:block absolute top-7 left-[16.6%] right-[16.6%] border-t-2 border-dashed border-emerald-200" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
                  {[
                    {
                      num: 1,
                      Icon: Search,
                      title: "Find Your Provider",
                      desc: "Search by specialty, location, or provider name to see available doctors near you.",
                    },
                    {
                      num: 2,
                      Icon: CalendarCheck,
                      title: "Book an Appointment",
                      desc: "Choose a convenient time slot, enter your details, and confirm your booking in minutes.",
                    },
                    {
                      num: 3,
                      Icon: Heart,
                      title: "Get Care",
                      desc: "Visit your provider in-person or via video call. Check in online before your appointment.",
                    },
                  ].map((step, idx) => (
                    <div
                      key={step.num}
                      className="flex flex-col items-center text-center space-y-3"
                      style={{ animationDelay: `${idx * 120}ms` }}
                    >
                      {/* Step number circle with icon */}
                      <div className="relative z-10 size-14 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
                        <step.Icon className="size-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-semibold text-foreground">{step.title}</h3>
                        <p className="text-sm text-muted-foreground max-w-[260px]">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ----- Browse by Specialty ----- */}
            {specialties.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="size-5 text-emerald-600" />
                  <h2 className="text-xl font-bold text-foreground">Browse by Specialty</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {specialties.slice(0, 10).map((spec, idx) => {
                    const SpecialtyIcon = getSpecialtyIcon(spec.name);
                    return (
                      <button
                        key={spec.id}
                        type="button"
                        onClick={() => {
                          setSpecialtyId(spec.id);
                          executeSearch({ specialtyId: spec.id });
                        }}
                        className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center hover:shadow-md hover:border-emerald-300 hover:bg-emerald-50/50 transition-all duration-200 cursor-pointer"
                        style={{ animationDelay: `${idx * 60}ms` }}
                      >
                        <SpecialtyIcon className="size-6 text-emerald-600" />
                        <span className="text-sm font-medium text-foreground leading-tight">
                          {spec.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Loading Skeletons — Shimmer matching provider card structure */}
        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="w-full max-w-3xl mx-auto rounded-xl border p-4 space-y-3 bg-card overflow-hidden"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {/* Top row: Avatar + Info skeleton */}
                <div className="flex gap-4">
                  <div className="skeleton-shimmer size-16 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2.5">
                    {/* Name + Verified badge row */}
                    <div className="flex items-center gap-2">
                      <div className="skeleton-shimmer h-5 w-40 rounded-md" />
                      <div className="skeleton-shimmer h-5 w-14 rounded-full" />
                    </div>
                    {/* Clinic name + phone */}
                    <div className="flex items-center gap-2">
                      <div className="skeleton-shimmer h-3.5 w-4 rounded-sm" />
                      <div className="skeleton-shimmer h-4 w-32 rounded-md" />
                      <div className="skeleton-shimmer h-3.5 w-3.5 rounded-sm ml-auto" />
                    </div>
                    {/* Address + distance */}
                    <div className="flex items-center gap-2">
                      <div className="skeleton-shimmer h-3.5 w-4 rounded-sm" />
                      <div className="skeleton-shimmer h-4 w-56 rounded-md" />
                      <div className="skeleton-shimmer h-4 w-16 rounded-md" />
                    </div>
                    {/* Rating row */}
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, s) => (
                          <div key={s} className="skeleton-shimmer size-4 rounded-sm" />
                        ))}
                      </div>
                      <div className="skeleton-shimmer h-4 w-24 rounded-md" />
                    </div>
                  </div>
                </div>
                {/* Separator */}
                <div className="skeleton-shimmer h-px w-full" />
                {/* Available Times skeleton */}
                <div className="space-y-2.5">
                  <div className="skeleton-shimmer h-4 w-28 rounded-md" />
                  <div className="flex gap-2">
                    <div className="skeleton-shimmer h-14 w-44 rounded-lg border-l-4 border-l-emerald-300" />
                    <div className="skeleton-shimmer h-14 w-44 rounded-lg border-l-4 border-l-emerald-300" />
                    <div className="skeleton-shimmer h-14 w-44 rounded-lg border-l-4 border-l-emerald-300 hidden sm:block" />
                  </div>
                </div>
                {/* Separator before review */}
                <div className="skeleton-shimmer h-px w-full" />
                {/* Review snippet skeleton */}
                <div className="flex gap-2 pl-1">
                  <div className="skeleton-shimmer size-4 rounded-sm shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton-shimmer h-3.5 w-full rounded-md" />
                    <div className="skeleton-shimmer h-3.5 w-3/4 rounded-md" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && error && searched && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                <AlertCircle className="size-8 text-destructive" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">
                Something went wrong
              </p>
              <p className="text-sm text-muted-foreground max-w-md">{error}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => executeSearch()}
              className="cursor-pointer"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* No Results + Smart Suggestions — Medical-themed */}
        {!loading && !error && searched && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-5">
            {/* Medical-themed CSS illustration */}
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full bg-emerald-50" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Search className="size-8 text-emerald-400/60" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white border shadow-sm flex items-center justify-center">
                <X className="size-3.5 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">
                No providers found
              </p>
              <p className="text-sm text-muted-foreground max-w-sm">
                We couldn&apos;t find any providers matching your current filters.
                Try adjusting your search criteria below.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {radius < 25 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExpandRadius}
                  className="cursor-pointer"
                >
                  <MapPin className="size-3.5" />
                  Expand radius to 25 mi?
                </Button>
              )}
              {insuranceId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRemoveInsurance}
                  className="cursor-pointer"
                >
                  Remove insurance filter?
                </Button>
              )}
              {modality && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRemoveModality}
                  className="cursor-pointer"
                >
                  Try all visit types?
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Results List */}
        {!loading && !error && searched && results.length > 0 && (
          <>
            {/* Results Header */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <Badge
                  variant="secondary"
                  className="bg-emerald-100 text-emerald-700 font-semibold tabular-nums shrink-0"
                >
                  {total}
                </Badge>
                <span className="text-sm text-muted-foreground truncate">
                  {query.trim()
                    ? (
                      <>
                        Results for <strong className="text-foreground font-medium">&ldquo;{query.trim()}&rdquo;</strong>
                      </>
                    )
                    : (
                      <>
                        {total === 1 ? "provider" : "providers"} found
                      </>
                    )
                  }
                </span>
              </div>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                >
                  <X className="size-3.5" />
                  <span className="hidden sm:inline ml-1">Clear filters</span>
                </Button>
              )}
            </div>

            {/* Subtle divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            <div className="space-y-4">
              {results.map((provider, idx) => (
                <ProviderCard key={provider.id} provider={provider} index={idx} specialtyId={specialtyId ?? undefined} />
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  className="cursor-pointer"
                >
                  {loadingMore && <Loader2 className="size-4 animate-spin" />}
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {/* ===== Sticky Footer ===== */}
      <footer className="mt-auto bg-white/80 backdrop-blur-sm">
        {/* Gradient top border separator */}
        <div className="h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />
        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* 4-Column Layout */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-6">
            {/* Company */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company</h4>
              <nav className="flex flex-col gap-2">
                <Link href="/" className="text-sm text-muted-foreground hover:text-emerald-600 transition-colors cursor-pointer">Home</Link>
                <Link href="#" className="text-sm text-muted-foreground hover:text-emerald-600 transition-colors cursor-pointer">About</Link>
                <Link href="#" className="text-sm text-muted-foreground hover:text-emerald-600 transition-colors cursor-pointer">Careers</Link>
              </nav>
            </div>
            {/* For Patients */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">For Patients</h4>
              <nav className="flex flex-col gap-2">
                <Link href="/" className="text-sm text-muted-foreground hover:text-emerald-600 transition-colors cursor-pointer">Find Doctors</Link>
                <Link href="/" className="text-sm text-muted-foreground hover:text-emerald-600 transition-colors cursor-pointer">Book Online</Link>
                <Link href="#" className="text-sm text-muted-foreground hover:text-emerald-600 transition-colors cursor-pointer">Patient Portal</Link>
              </nav>
            </div>
            {/* For Clinics */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">For Clinics</h4>
              <nav className="flex flex-col gap-2">
                <Link href="#" className="text-sm text-muted-foreground hover:text-emerald-600 transition-colors cursor-pointer">List Your Clinic</Link>
                <Link href="/staff/login" className="text-sm text-muted-foreground hover:text-emerald-600 transition-colors cursor-pointer">Staff Login</Link>
              </nav>
            </div>
            {/* Legal */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Legal</h4>
              <nav className="flex flex-col gap-2">
                <Link href="#" className="text-sm text-muted-foreground hover:text-emerald-600 transition-colors cursor-pointer">Privacy Policy</Link>
                <Link href="#" className="text-sm text-muted-foreground hover:text-emerald-600 transition-colors cursor-pointer">Terms of Service</Link>
              </nav>
            </div>
          </div>
          {/* Bottom line */}
          <div className="border-t border-border/50 pt-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="text-center sm:text-left">
              <p className="text-xs text-muted-foreground">Made with ❤️ in New York</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">© 2026 ClinicBook. All rights reserved.</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Heart className="size-3.5 text-emerald-600 fill-emerald-600" />
              <span className="text-sm font-bold tracking-tight text-foreground">ClinicBook</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}