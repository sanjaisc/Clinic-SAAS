"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  MapPin,
  Phone,
  Star,
  Users,
  Clock,
  Search,
  Building2,
  ChevronRight,
  X,
  Compass,
  Sparkles,
} from "lucide-react";
import { PublicNavbar } from "@/components/public-navbar";
import { PublicFooter } from "@/components/public-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProviderBrief {
  slug: string;
  firstName: string;
  lastName: string;
  credentials: string | null;
  rating: number;
}

interface ClinicData {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string;
  email: string | null;
  website: string | null;
  coverImageUrl: string | null;
  specialties: string[];
  providerCount: number;
  rating: number;
  firstProvider: {
    firstName: string;
    lastName: string;
    credentials: string | null;
  } | null;
  topProviders: ProviderBrief[];
  allProviders: ProviderBrief[];
  availableSlotsCount: number;
}

interface TaxonomySpecialty {
  id: string;
  name: string;
  slug: string;
}

// ---------------------------------------------------------------------------
// Skeleton Cards
// ---------------------------------------------------------------------------

function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <Skeleton className="h-2 w-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
          <div className="p-5 space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clinic Card
// ---------------------------------------------------------------------------

function ClinicCard({ clinic, index, isFeatured }: { clinic: ClinicData; index: number; isFeatured?: boolean }) {
  return (
    <div
      className={`group rounded-2xl border bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden relative ${isFeatured ? 'ring-1 ring-emerald-200' : ''}`}
      style={{
        animation: `fadeInUp 0.4s ease-out ${index * 0.06}s both`,
      }}
    >
      {/* Featured Badge */}
      {isFeatured && (
        <div className="absolute top-3 right-3 z-10">
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm">
            <Sparkles className="size-3" />
            Featured
          </span>
        </div>
      )}
      {/* Gradient accent strip */}
      <div className="h-2 w-full bg-gradient-to-r from-emerald-400 to-emerald-600" />

      <div className="p-5 flex flex-col gap-3">
        {/* Clinic name + link */}
        <Link
          href={`/clinic/${clinic.slug}`}
          className="hover:text-emerald-700 transition-colors"
        >
          <h3 className="text-lg font-semibold text-gray-900 leading-snug group-hover:text-emerald-700 transition-colors">
            {clinic.name}
          </h3>
        </Link>

        {/* Tagline */}
        {clinic.tagline && (
          <p className="text-sm text-gray-500 italic line-clamp-2">
            {clinic.tagline}
          </p>
        )}

        {/* Address */}
        <div className="flex items-start gap-1.5 text-sm text-gray-600">
          <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
          <span className="line-clamp-1 flex-1">
            {clinic.streetAddress}, {clinic.city}, {clinic.state} {clinic.zipCode}
          </span>
          <span title="View on map"><Compass className="h-3.5 w-3.5 shrink-0 text-emerald-400 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" /></span>
        </div>

        {/* Phone */}
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <Phone className="h-4 w-4 shrink-0 text-emerald-600" />
          <a
            href={`tel:${clinic.phoneNumber}`}
            className="hover:text-emerald-700 transition-colors"
          >
            {clinic.phoneNumber}
          </a>
        </div>

        {/* Specialties */}
        {clinic.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {clinic.specialties.map((s) => (
              <Badge
                key={s}
                variant="secondary"
                className="text-xs font-normal bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:scale-105 transition-transform border-emerald-200/60"
              >
                {s}
              </Badge>
            ))}
          </div>
        )}

        {/* Provider name badges */}
        {clinic.allProviders.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {clinic.allProviders.map((p) => (
              <Link
                key={p.slug}
                href={`/providers/${p.slug}`}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 text-xs font-medium text-emerald-700 hover:text-emerald-700 hover:bg-emerald-100/80 hover:border-emerald-300 transition-colors cursor-pointer"
              >
                {p.firstName} {p.lastName.charAt(0)}.
              </Link>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 pt-1">
          {/* Provider count with badge */}
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 text-xs font-medium text-emerald-700">
              <Users className="h-3 w-3" />
              {clinic.providerCount}{" "}
              {clinic.providerCount === 1 ? "provider" : "providers"}
            </span>
          </span>

          {/* Rating */}
          {clinic.rating > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="font-medium text-gray-700">
                {clinic.rating.toFixed(1)}
              </span>
            </span>
          )}

          {/* Available slots */}
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-emerald-600 font-medium">
              {clinic.availableSlotsCount} available this week
            </span>
          </span>
        </div>

        {/* CTA */}
        <div className="pt-2 mt-auto">
          <Link href={`/clinic/${clinic.slug}`}>
            <Button
              size="sm"
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0 shadow-sm transition-all"
            >
              View Clinic
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Subtle gradient overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white/60 to-transparent pointer-events-none rounded-b-2xl" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ClinicsDirectoryPage() {
  const [clinics, setClinics] = useState<ClinicData[]>([]);
  const [specialties, setSpecialties] = useState<TaxonomySpecialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("nearest");

  // Fetch data
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [clinicsRes, taxRes] = await Promise.all([
          fetch("/api/clinics"),
          fetch("/api/taxonomies"),
        ]);

        if (!clinicsRes.ok || !taxRes.ok) {
          throw new Error("Failed to fetch data");
        }

        const clinicsData = await clinicsRes.json();
        const taxData = await taxRes.json();

        if (!cancelled) {
          setClinics(clinicsData.clinics ?? []);
          setSpecialties(taxData.specialties ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError("Something went wrong. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Derive unique cities from clinics
  const cities = useMemo(() => {
    const citySet = new Set(clinics.map((c) => c.city));
    return Array.from(citySet).sort();
  }, [clinics]);

  // Filter and sort clinics
  const filteredClinics = useMemo(() => {
    let result = [...clinics];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q)
      );
    }

    // Specialty filter
    if (specialtyFilter !== "all") {
      result = result.filter((c) =>
        c.specialties.some((s) => s.toLowerCase() === specialtyFilter.toLowerCase())
      );
    }

    // City filter
    if (cityFilter !== "all") {
      result = result.filter((c) => c.city === cityFilter);
    }

    // Sort
    switch (sortBy) {
      case "rating":
        result.sort((a, b) => b.rating - a.rating);
        break;
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "nearest":
      default:
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return result;
  }, [clinics, searchQuery, specialtyFilter, cityFilter, sortBy]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    specialtyFilter !== "all" ||
    cityFilter !== "all";

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setSpecialtyFilter("all");
    setCityFilter("all");
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white to-emerald-50/30">
      <PublicNavbar showHome />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Browse Clinics</h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">Find the right healthcare provider for you</p>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by clinic name or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 bg-white border-gray-200 focus:border-emerald-400 focus:ring-emerald-400/20 rounded-xl text-base"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          {/* Specialty Filter */}
          <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
            <SelectTrigger className="w-full sm:w-[220px] bg-white border-gray-200 rounded-xl">
              <SelectValue placeholder="Specialty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Specialties</SelectItem>
              {specialties.map((s) => (
                <SelectItem key={s.id} value={s.name}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* City Filter */}
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-full sm:w-[200px] bg-white border-gray-200 rounded-xl">
              <SelectValue placeholder="City" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[180px] bg-white border-gray-200 rounded-xl">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nearest">Nearest</SelectItem>
              <SelectItem value="rating">Rating</SelectItem>
              <SelectItem value="name">Name A–Z</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear filters (shown when filters are active) */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-gray-500 hover:text-gray-700 h-11"
            >
              <X className="h-4 w-4 mr-1.5" />
              Clear
            </Button>
          )}
        </div>

        {/* Results count */}
        {!loading && !error && filteredClinics.length > 0 && (
          <p className="text-sm text-gray-500 mb-6">
            {filteredClinics.length}{" "}
            {filteredClinics.length === 1 ? "clinic" : "clinics"} found
          </p>
        )}

        {/* Loading State */}
        {loading && <SkeletonCards />}

        {/* Error State */}
        {error && (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredClinics.length === 0 && (
          <div className="text-center py-16 relative">
            {/* Subtle dot pattern background */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #059669 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
            <div className="relative">
              <div className="relative inline-block">
                <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <Compass className="h-5 w-5 text-emerald-300 absolute -top-1 -right-1" />
              </div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                No clinics match your filters
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                Try adjusting your search or filter criteria
              </p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  Clear all filters
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Clinic Grid */}
        {!loading && !error && filteredClinics.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredClinics.map((clinic, index) => (
              <ClinicCard key={clinic.id} clinic={clinic} index={index} isFeatured={index < 2} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <PublicFooter />

      {/* Animation keyframes */}
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}