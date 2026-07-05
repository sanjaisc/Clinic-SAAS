import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://clinicbook.app"),
  title: "ClinicBook — Find & Book Medical Appointments",
  description:
    "Search for local clinics and providers, compare availability, and book appointments instantly. Telehealth and in-person visits available.",
  keywords: [
    "medical",
    "clinic",
    "doctor",
    "appointment",
    "booking",
    "telehealth",
    "healthcare",
  ],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    siteName: "ClinicBook",
    locale: "en_US",
    type: "website",
    title: "ClinicBook — Find & Book Medical Appointments",
    description:
      "Search for local clinics and providers, compare availability, and book appointments instantly. Telehealth and in-person visits available.",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}