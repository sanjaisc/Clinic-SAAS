"use client";

import { Building2, ChevronDown, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClinicOption } from "@/hooks/use-clinic-context";

const STATUS_STYLES: Record<string, string> = {
  PUBLISHED: "bg-brand-subtle text-brand-hover border-brand-border",
  DRAFT: "bg-gray-100 text-gray-600 border-gray-200",
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  SUSPENDED: "bg-red-100 text-red-700 border-red-200",
  ARCHIVED: "bg-gray-100 text-gray-500 border-gray-200",
};

interface ClinicSelectorBarProps {
  clinics: ClinicOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
}

export function ClinicSelectorBar({
  clinics,
  selectedId,
  onSelect,
  loading = false,
}: ClinicSelectorBarProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 mb-6 p-3 rounded-xl border border-border/50 bg-muted/30">
        <Skeleton className="size-5 rounded" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  if (clinics.length === 0) {
    return null;
  }

  const selected = clinics.find((c) => c.id === selectedId);

  return (
    <div className="flex items-center gap-3 mb-6 p-3 rounded-xl border border-purple-200/60 bg-purple-50/50 dark:bg-purple-950/10">
      <Building2 className="size-4 text-purple-600 shrink-0" />
      <span className="text-sm font-medium text-purple-800 dark:text-purple-300 whitespace-nowrap">
        Acting as clinic:
      </span>
      <Select value={selectedId ?? ""} onValueChange={onSelect}>
        <SelectTrigger className="w-auto min-w-[200px] max-w-xs h-8 text-sm bg-white dark:bg-background border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2 truncate">
            {selected && (
              <>
                <span className="truncate font-medium">{selected.name}</span>
                {selected.city && (
                  <span className="text-muted-foreground hidden sm:inline">
                    — {selected.city}
                  </span>
                )}
              </>
            )}
          </div>
          <SelectValue placeholder="Select a clinic…" />
        </SelectTrigger>
        <SelectContent>
          {clinics.map((clinic) => (
            <SelectItem key={clinic.id} value={clinic.id}>
              <div className="flex items-center gap-2">
                <span className="truncate">{clinic.name}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 font-normal shrink-0 ${
                    STATUS_STYLES[clinic.status] ?? ""
                  }`}
                >
                  {clinic.status}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}