import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white to-brand-muted/30">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
      </header>

      {/* Hero / Search Skeleton */}
      <div className="max-w-5xl mx-auto w-full px-4 pt-8 pb-4">
        <Skeleton className="h-10 w-full max-w-2xl mx-auto rounded-xl" />
        <div className="flex justify-center gap-3 mt-4">
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
      </div>

      {/* Provider Card Skeletons */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border bg-white shadow-sm overflow-hidden animate-pulse"
            >
              <Skeleton className="h-2 w-full bg-gradient-to-r from-brand to-brand" />
              <div className="p-5 space-y-4">
                {/* Avatar + Name */}
                <div className="flex items-center gap-3">
                  <Skeleton className="size-12 rounded-full shrink-0" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                {/* Specialty badge */}
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                {/* Info rows */}
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
                {/* Rating */}
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
                {/* Slot buttons */}
                <div className="flex gap-2 pt-1">
                  <Skeleton className="h-9 w-28 rounded-lg" />
                  <Skeleton className="h-9 w-28 rounded-lg" />
                  <Skeleton className="h-9 w-28 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}