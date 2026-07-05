"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Star,
  MapPin,
  Building2,
  Quote,
  Phone,
  Calendar,
  ChevronRight,
  ShieldCheck,
  Navigation,
  Bell,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatDistance } from "@/lib/geo";

interface ProviderCardProps {
  provider: {
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
    earliestSlots: Array<{
      id: string;
      startTime: string;
      endTime: string;
      modality: string;
    }>;
    reviewSnippet: string | null;
    costBadge: string | null;
  };
  index?: number;
  specialtyId?: string;
  onSlotClick?: (providerId: string, slotId: string) => void;
}

function RatingStars({ rating }: { rating: number }) {
  const filledCount = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`size-4 ${
            i < filledCount
              ? "fill-yellow-400 text-yellow-400"
              : "fill-gray-200 text-gray-200"
          }`}
        />
      ))}
    </div>
  );
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

export function ProviderCard({ provider, index = 0, specialtyId, onSlotClick }: ProviderCardProps) {
  const router = useRouter();

  // Waitlist state
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistName, setWaitlistName] = useState("");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistPhone, setWaitlistPhone] = useState("");

  const initials = `${provider.firstName.charAt(0)}${provider.lastName.charAt(0)}`;
  const fullName = `${provider.firstName} ${provider.lastName}`;
  const displayName = provider.credentials
    ? `Dr. ${fullName}, ${provider.credentials}`
    : `Dr. ${fullName}`;

  const address = [
    provider.clinic.streetAddress,
    provider.clinic.city,
    provider.clinic.state,
    provider.clinic.zipCode,
  ]
    .filter(Boolean)
    .join(", ");

  const handleSlotClick = (slotId: string) => {
    if (onSlotClick) {
      onSlotClick(provider.id, slotId);
    } else {
      router.push(`/book?providerId=${provider.id}&slotId=${slotId}`);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!waitlistName.trim() || !waitlistEmail.trim() || !waitlistPhone.trim()) return;
    setWaitlistSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: provider.id,
          specialtyId: specialtyId || "",
          patientName: waitlistName.trim(),
          patientEmail: waitlistEmail.trim(),
          patientPhone: waitlistPhone.trim(),
          patientType: "ADULT",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to join waitlist");
      }
      setWaitlistOpen(false);
      setWaitlistName("");
      setWaitlistEmail("");
      setWaitlistPhone("");
      toast.success("You've been added to the waitlist!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join waitlist");
    } finally {
      setWaitlistSubmitting(false);
    }
  };

  const staggerDelay = Math.min(index * 80, 400);

  return (
    <Card
      className={`w-full max-w-3xl mx-auto transition-all duration-200 hover:scale-[1.005] hover:shadow-lg hover:border-l-4 hover:border-l-emerald-400 hover:bg-gradient-to-br hover:from-white hover:to-emerald-50/40 py-0 gap-0 stagger-fade-in`}
      style={{ animationDelay: `${staggerDelay}ms`, animationFillMode: "both" }}
    >
      <CardContent className="p-4 space-y-3">
        {/* Top row: Avatar + Info + Cost Badge */}
        <div className="flex gap-4">
          {/* Avatar with ring */}
          <Avatar className="size-16 shrink-0 rounded-full bg-emerald-100 ring-2 ring-emerald-200">
            {provider.photoUrl && <AvatarImage src={provider.photoUrl} alt={displayName} />}
            <AvatarFallback className="bg-emerald-100 text-emerald-700 text-base font-semibold rounded-full">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Name + Verified Badge + Cost Badge */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Link
                  href={`/providers/${provider.slug}`}
                  className="text-lg font-semibold leading-tight truncate hover:text-emerald-700 transition-colors cursor-pointer"
                >
                  {displayName}
                </Link>
                <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full border border-emerald-300 bg-emerald-50/80 px-1.5 py-0.5">
                  <ShieldCheck className="size-3 text-emerald-600" />
                  <span className="text-[10px] font-medium text-emerald-700 leading-none">Verified</span>
                </span>
              </div>
              {provider.costBadge && (
                <Badge
                  variant="outline"
                  className="shrink-0 border-emerald-300 text-sm font-semibold text-emerald-700 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50"
                >
                  {provider.costBadge}
                </Badge>
              )}
            </div>

            {/* Clinic name (clickable) + Phone icon */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
              <Building2 className="size-3.5 shrink-0" />
              <Link
                href={`/clinic/${provider.clinic.slug}`}
                className="truncate hover:underline hover:text-emerald-700 transition-colors cursor-pointer"
              >
                {provider.clinic.name}
              </Link>
              <a
                href={`tel:${provider.clinic.phoneNumber}`}
                className="shrink-0 text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
                title={`Call ${provider.clinic.name}`}
                aria-label={`Call ${provider.clinic.name} at ${provider.clinic.phoneNumber}`}
              >
                <Phone className="size-3.5" />
              </a>
            </div>

            {/* Address + Distance */}
            <div className="flex items-start gap-1.5 text-sm text-muted-foreground mt-0.5">
              <MapPin className="size-3.5 shrink-0 mt-0.5" />
              <span className="truncate">
                {address}
              </span>
              {provider.distance != null && (
                <span className="inline-flex items-center gap-1 shrink-0 font-medium text-emerald-600">
                  <Navigation className="size-3" />
                  {formatDistance(provider.distance)} away
                </span>
              )}
            </div>

            {/* Rating */}
            <div className="flex items-center gap-2 mt-1">
              <RatingStars rating={provider.rating} />
              <span className="text-sm text-muted-foreground">
                {provider.rating.toFixed(1)} ({provider.reviewCount}{" "}
                {provider.reviewCount === 1 ? "review" : "reviews"})
              </span>
            </div>
          </div>
        </div>

        {/* Available Times */}
        {provider.earliestSlots.length > 0 ? (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">
                Available Times
              </h4>
              <div className="flex gap-2 flex-wrap">
                {provider.earliestSlots.map((slot) => {
                  const isVideo = slot.modality === "VIDEO";
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => handleSlotClick(slot.id)}
                      className={`cursor-pointer inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-200 hover:shadow-sm animate-pulse-subtle
                        ${isVideo
                          ? "border-l-4 border-l-blue-400 border-border hover:bg-blue-50 hover:border-blue-300"
                          : "border-l-4 border-l-emerald-400 border-border hover:bg-emerald-50 hover:border-emerald-300"
                        }`}
                    >
                      <Calendar className="size-4 text-muted-foreground shrink-0" />
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-foreground">
                          {formatSlotTime(slot.startTime)}
                        </span>
                        <ModalityBadge modality={slot.modality} />
                      </div>
                    </button>
                  );
                })}
                <Link
                  href={`/providers/${provider.slug}`}
                  className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-dashed border-muted-foreground/30 px-4 py-2 text-sm font-medium text-emerald-700 transition-all duration-200 hover:border-emerald-400 hover:bg-emerald-50 hover:shadow-sm"
                >
                  MORE
                  <ChevronRight className="size-4" />
                </Link>
              </div>
            </div>
          </>
        ) : (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">
                Available Times
              </h4>
              <p className="text-sm text-muted-foreground">
                No available times found for this provider.
              </p>
              <Button
                type="button"
                variant="outline"
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-800 cursor-pointer"
                onClick={() => setWaitlistOpen(true)}
              >
                <Bell className="size-4 mr-2" />
                Join Waitlist
              </Button>
            </div>
          </>
        )}

        {/* Waitlist Dialog */}
        <Dialog open={waitlistOpen} onOpenChange={setWaitlistOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Join the Waitlist</DialogTitle>
              <DialogDescription>
                No available times for this provider. Join the waitlist and
                we&apos;ll notify you when a slot opens up.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="waitlist-name">Full Name *</Label>
                <Input
                  id="waitlist-name"
                  placeholder="John Doe"
                  value={waitlistName}
                  onChange={(e) => setWaitlistName(e.target.value)}
                  disabled={waitlistSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waitlist-email">Email *</Label>
                <Input
                  id="waitlist-email"
                  type="email"
                  placeholder="john@example.com"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  disabled={waitlistSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waitlist-phone">Phone *</Label>
                <Input
                  id="waitlist-phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={waitlistPhone}
                  onChange={(e) => setWaitlistPhone(e.target.value)}
                  disabled={waitlistSubmitting}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setWaitlistOpen(false)}
                disabled={waitlistSubmitting}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleJoinWaitlist}
                disabled={
                  waitlistSubmitting ||
                  !waitlistName.trim() ||
                  !waitlistEmail.trim() ||
                  !waitlistPhone.trim()
                }
                className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                {waitlistSubmitting && <Loader2 className="size-4 animate-spin mr-2" />}
                Join Waitlist
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Review Snippet */}
        {provider.reviewSnippet && (
          <>
            <Separator className="bg-gradient-to-r from-transparent via-emerald-200/60 to-transparent" />
            <div className="space-y-1">
              <div className="flex gap-2">
                <Quote className="size-4 shrink-0 text-muted-foreground/50 mt-0.5" />
                <p className="text-sm italic text-muted-foreground line-clamp-2">
                  &ldquo;{provider.reviewSnippet}&rdquo;
                </p>
              </div>
              <Link
                href={`/providers/${provider.slug}`}
                className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 hover:underline hover:translate-x-0.5 transition-all cursor-pointer pl-6"
              >
                Read more reviews
                <ChevronRight className="size-3" />
              </Link>
            </div>
          </>
        )}

        {/* View full profile link */}
        <Link
          href={`/providers/${provider.slug}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:translate-x-0.5 transition-all cursor-pointer"
        >
          View full profile →
          <ChevronRight className="size-3" />
        </Link>
      </CardContent>
    </Card>
  );
}