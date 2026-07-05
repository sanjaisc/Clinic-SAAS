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
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full border-red-200/60 shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="size-7 text-red-500" />
          </div>
          <CardTitle className="text-xl text-gray-900">
            Something went wrong
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred while loading this page. Please try
            again or return to the homepage.
          </p>
          {error.message && (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 border p-3 text-left">
              <code className="text-xs text-gray-600 dark:text-gray-400 break-all line-clamp-3">
                {error.message}
              </code>
            </div>
          )}
          {error.digest && (
            <p className="text-xs text-gray-400">
              Error ID: {error.digest}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex gap-3 justify-center">
          <Button
            onClick={() => reset()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Try Again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Go Home</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}