import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Patient Intake Form — ClinicBook",
  description:
    "Complete your intake form before your appointment to save time at the clinic.",
  openGraph: {
    title: "Patient Intake Form — ClinicBook",
    description:
      "Complete your intake form before your appointment to save time at the clinic.",
  },
};

export default function IntakeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}