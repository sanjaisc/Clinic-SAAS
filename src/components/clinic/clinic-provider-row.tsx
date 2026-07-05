"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Star, Calendar, Bell, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ProviderSlot {
  id: string;
  startTime: string;
  endTime: string;
  modality: string;
}

interface ProviderData {
  id: string;
  firstName: string;
  lastName: string;
  credentials: string | null;
  rating: number;
  reviewCount: number;
  slug: string;
  slotDurationMinutes: number;
  specialty: string | null;
}

export interface ClinicProviderRowProps {
  provider: ProviderData;
  slots: ProviderSlot[];
  clinicSlug: string;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function RatingStars({ rating }: { rating: number }) {
  const filledCount = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`size-3.5 ${
            i < filledCount
              ? "fill-yellow-400 text-yellow-400"
              : "fill-gray-200 text-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatSlotTime(startTime: string): string {
  return format(new Date(startTime), "EEE, MMM d · h:mm a");
}

function ModalityBadge({ modality }: { modality: string }) {
  const isVideo = modality === "VIDEO";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
        isVideo
          ? "bg-blue-100 text-blue-700"
          : "bg-emerald-100 text-emerald-700"
      }`}
    >
      {isVideo ? "Video" : "In-Clinic"}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ClinicProviderRow({
  provider,
  slots,
  clinicSlug,
}: ClinicProviderRowProps) {
  const router = useRouter();

  const fullName = `${provider.firstName} ${provider.lastName}`;
  const displayName = provider.credentials
    ? `Dr. ${fullName}, ${provider.credentials}`
    : `Dr. ${fullName}`;

  const initials = getInitials(provider.firstName, provider.lastName);

  const handleSlotClick = (slotId: string) => {
    router.push(`/book?providerId=${provider.id}&slotId=${slotId}`);
  };

  const firstSlotId = slots.length > 0 ? slots[0].id : null;

  return (
    <Card className="w-full transition-all duration-200 hover:shadow-md py-0 gap-0">
      <CardContent className="p-4 space-y-3">
        {/* Provider info row */}
        <div className="flex items-start gap-3">
          {/* Avatar with initials */}
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 ring-2 ring-emerald-200 text-emerald-700 font-semibold text-sm">
            {initials}
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            {/* Provider name as link + specialty badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/providers/${provider.slug}`}
                className="text-lg font-semibold leading-tight text-emerald-700 hover:text-emerald-800 hover:underline underline-offset-2 transition-colors cursor-pointer"
              >
                {displayName}
              </Link>
              {provider.specialty && (
                <Badge
                  variant="outline"
                  className="border-emerald-200 text-emerald-600 bg-emerald-50/50 text-[11px] font-medium shrink-0 cursor-default"
                >
                  {provider.specialty}
                </Badge>
              )}
            </div>

            {/* Rating + View reviews + View full profile */}
            <div className="flex items-center gap-2 flex-wrap">
              <RatingStars rating={provider.rating} />
              <span className="text-sm text-muted-foreground">
                {provider.rating.toFixed(1)} ({provider.reviewCount}{" "}
                {provider.reviewCount === 1 ? "review" : "reviews"})
              </span>
              {provider.reviewCount > 0 && (
                <Link
                  href={`/providers/${provider.slug}`}
                  className="text-xs text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
                >
                  View reviews
                </Link>
              )}
            </div>
            {/* View full profile link */}
            <div>
              <Link
                href={`/providers/${provider.slug}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:translate-x-0.5 transition-all cursor-pointer"
              >
                View full profile
                <ChevronRight className="size-3" />
              </Link>
            </div>
          </div>

          {/* Slot duration badge */}
          <Badge
            variant="outline"
            className="shrink-0 border-emerald-300 text-emerald-700 bg-emerald-50/50"
          >
            {provider.slotDurationMinutes} min
          </Badge>
        </div>

        {/* Slots */}
        {slots.length > 0 ? (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">
                Available Times
              </h4>
              <div className="flex gap-2 flex-wrap">
                {slots.map((slot) => {
                  const isVideo = slot.modality === "VIDEO";
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => handleSlotClick(slot.id)}
                      className={`cursor-pointer group inline-flex items-center gap-3 rounded-lg border border-border overflow-hidden text-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-sm ${
                        isVideo
                          ? "hover:bg-blue-50/60 hover:border-blue-300"
                          : "hover:bg-emerald-50 hover:border-emerald-300"
                      }`}
                    >
                      {/* Left color accent */}
                      <div
                        className={`w-1 self-stretch shrink-0 ${
                          isVideo
                            ? "bg-blue-400 group-hover:bg-blue-500"
                            : "bg-emerald-400 group-hover:bg-emerald-500"
                        } transition-colors`}
                      />
                      {/* Content */}
                      <div className="flex items-center gap-2 px-3 py-2">
                        <Calendar
                          className={`size-4 shrink-0 ${
                            isVideo ? "text-blue-500" : "text-emerald-500"
                          }`}
                        />
                        <span className="text-foreground whitespace-nowrap">
                          {formatSlotTime(slot.startTime)}
                        </span>
                        <span
                          className={`text-xs font-medium transition-opacity ${
                            isVideo
                              ? "text-blue-500 opacity-0 group-hover:opacity-100"
                              : "text-emerald-600 opacity-0 group-hover:opacity-100"
                          }`}
                        >
                          Book
                        </span>
                      </div>
                      {/* Modality badge */}
                      <div className="pr-2">
                        <ModalityBadge modality={slot.modality} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            <Separator />
            <div className="flex items-center gap-2 text-muted-foreground">
              <Bell className="size-4 shrink-0" />
              <p className="text-sm italic">
                No upcoming availability — check back soon
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}