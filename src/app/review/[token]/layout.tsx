import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leave a Review — ClinicBook",
  description:
    "Share your experience and help other patients find the right healthcare provider.",
  openGraph: {
    title: "Leave a Review — ClinicBook",
    description:
      "Share your experience and help other patients find the right healthcare provider.",
  },
};

export default function ReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}