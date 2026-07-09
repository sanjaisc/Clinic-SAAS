"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white to-brand-muted/30">
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 text-foreground">
            <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
              <path d="M5.5 8.5 2 2L12 12" />
            </svg>
            <span className="font-semibold">Book Appointment</span>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">Home</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="max-w-md w-full border-red-200/60 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="size-7 text-red-500" />
            </div>
            <CardTitle className="text-xl text-gray-900">
              Booking Error
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Something went wrong during the booking process. Your data has been
              preserved — please try again.
            </p>
            {error.message && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 border p-3 text-left">
                <code className="text-xs text-gray-600 dark:text-gray-400 break-all line-clamp-3">
                  {error.message}
                </code>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex gap-3 justify-center">
            <Button
              onClick={() => reset()}
              className="bg-brand hover:bg-brand-hover text-white"
            >
              Try Again
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Go Home</Link>
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}