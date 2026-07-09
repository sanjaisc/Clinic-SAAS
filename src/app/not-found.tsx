import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white to-brand-muted/30">
      {/* Decorative background elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-24 -left-24 size-72 rounded-full bg-brand-subtle/40 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 size-72 rounded-full bg-coral-muted/30 blur-3xl" />
      </div>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="max-w-md w-full border-brand-border shadow-lg">
          <CardHeader className="text-center pb-2">
            {/* Large 404 */}
            <div className="relative mx-auto mb-2 w-fit">
              <span className="text-8xl font-black text-brand-muted select-none">
                404
              </span>
              <Search className="size-8 text-brand absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <CardTitle className="text-xl text-gray-900">
              Page not found
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              The page you&apos;re looking for doesn&apos;t exist or has been
              moved. Let&apos;s get you back on track.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button asChild className="bg-brand hover:bg-brand-hover text-white">
              <Link href="/">Go Home</Link>
            </Button>
          </CardFooter>
        </Card>
      </main>

      {/* Sticky Footer */}
      <footer className="border-t bg-muted/30 mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} DoctA. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <Link href="/" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}