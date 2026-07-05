import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse Clinics — ClinicBook",
  description:
    "Explore our network of verified medical clinics. Find the right healthcare provider for your needs.",
  openGraph: {
    title: "Browse Clinics — ClinicBook",
    description:
      "Explore our network of verified medical clinics. Find the right healthcare provider for your needs.",
  },
};

export default function ClinicsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}