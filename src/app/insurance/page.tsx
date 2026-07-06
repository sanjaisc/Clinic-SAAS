"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Shield,
  CreditCard,
  Banknote,
  FileCheck,
  HelpCircle,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { PublicNavbar } from "@/components/public-navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicFooter } from "@/components/public-footer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InsuranceItem {
  id: string;
  name: string;
  slug: string;
  isDemo: boolean;
  description?: string;
}

// ---------------------------------------------------------------------------
// FAQ Data
// ---------------------------------------------------------------------------

const FAQ_ITEMS = [
  {
    question: "Do you accept my insurance?",
    answer:
      "DoctA works with a wide range of insurance providers. To check if your specific plan is accepted, visit the provider\u2019s profile page or contact the clinic directly. You can also use our search filters to find providers that accept your insurance.",
  },
  {
    question: "What if I don\u2019t have insurance?",
    answer:
      "No problem! Many of our providers offer self-pay options with transparent pricing. When searching, select the \u201cUninsured\u201d filter to see providers and their self-pay rates. We believe everyone deserves access to quality healthcare.",
  },
  {
    question: "How do I know my co-pay amount?",
    answer:
      "Your co-pay amount depends on your specific insurance plan and the type of service. During the booking process, if your insurance is recognized, we\u2019ll display the estimated co-pay. For exact amounts, we recommend contacting your insurance provider directly or checking your benefits summary.",
  },
  {
    question: "Can I pay with cash?",
    answer:
      "Yes! Most clinics accept cash payments at the front desk. You can also pay with credit or debit cards. Payment method details are typically available on the clinic\u2019s profile page, or you can confirm when you arrive for your appointment.",
  },
  {
    question: "What happens if my insurance claim is denied?",
    answer:
      "If your insurance claim is denied, you\u2019ll be responsible for the full cost of the visit. We recommend contacting your insurance provider to understand the reason for denial. Many clinics offer payment plans for larger balances. You can also appeal the decision with your insurance company.",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InsurancePage() {
  const [insurances, setInsurances] = useState<InsuranceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/taxonomies");
        if (!res.ok) throw new Error("Failed to load insurance data");
        const data = await res.json();
        setInsurances(data.insurances ?? []);
      } catch (err) {
        setError("Something went wrong loading insurance information.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white to-emerald-50/30">
      <PublicNavbar showHome />

      {/* ===== Main Content ===== */}
      <main className="flex-1 w-full px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Breadcrumb */}
          <nav
            className="flex items-center gap-1.5 text-sm text-muted-foreground"
            aria-label="Breadcrumb"
          >
            <Link
              href="/"
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Home
            </Link>
            <span className="text-border">/</span>
            <span className="text-foreground font-medium">
              Insurance &amp; Payments
            </span>
          </nav>

          {/* Page Title */}
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
              <Shield className="size-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Insurance &amp; Payments
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Find information about accepted insurance plans and payment options
              </p>
            </div>
          </div>

          {/* ===== Accepted Insurance Providers ===== */}
          <Card className="overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-emerald-400 to-teal-500" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="size-5 text-emerald-600" />
                Accepted Insurance Providers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-6 animate-spin text-emerald-600" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Loading insurance data...
                  </span>
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive text-center py-8">
                  {error}
                </p>
              )}

              {!loading && !error && insurances.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No insurance providers listed yet.
                </p>
              )}

              {!loading && !error && insurances.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {insurances.map((ins) => (
                    <div
                      key={ins.id}
                      className="flex items-start gap-3 rounded-lg border border-border p-4 hover:bg-emerald-50/30 transition-colors"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                        <Shield className="size-4 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground text-sm">
                            {ins.name}
                          </span>
                          <Badge
                            variant={
                              ins.isDemo ? "default" : "secondary"
                            }
                            className={
                              ins.isDemo
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-semibold"
                                : "bg-secondary text-secondary-foreground text-[10px]"
                            }
                          >
                            {ins.isDemo ? "Major Plan" : "Partner"}
                          </Badge>
                        </div>
                        {ins.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {ins.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ===== Payment Methods ===== */}
          <Card className="overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-emerald-400 to-teal-500" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="size-5 text-emerald-600" />
                Payment Methods
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Credit/Debit */}
                <div className="flex flex-col items-center text-center p-4 rounded-lg border border-border hover:bg-emerald-50/30 transition-colors">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 mb-3">
                    <CreditCard className="size-5 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-foreground text-sm">
                    Credit / Debit Cards
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Visa, Mastercard, American Express, and Discover accepted at
                    most locations
                  </p>
                </div>

                {/* Cash */}
                <div className="flex flex-col items-center text-center p-4 rounded-lg border border-border hover:bg-emerald-50/30 transition-colors">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 mb-3">
                    <Banknote className="size-5 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-foreground text-sm">
                    Cash at Desk
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pay with cash directly at the clinic front desk before or
                    after your appointment
                  </p>
                </div>

                {/* Insurance Co-Pay */}
                <div className="flex flex-col items-center text-center p-4 rounded-lg border border-border hover:bg-emerald-50/30 transition-colors">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 mb-3">
                    <FileCheck className="size-5 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-foreground text-sm">
                    Insurance Co-Pay
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your co-pay amount is determined by your insurance plan and
                    collected at the time of visit
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ===== FAQ ===== */}
          <Card className="overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-emerald-400 to-teal-500" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <HelpCircle className="size-5 text-emerald-600" />
                Frequently Asked Questions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {FAQ_ITEMS.map((item, idx) => (
                  <details key={idx} className="group">
                    <summary className="flex items-center justify-between py-4 text-foreground font-medium cursor-pointer hover:text-emerald-700 transition-colors list-none [&::-webkit-details-marker]:hidden">
                      {item.question}
                      <ChevronDown className="size-4 text-muted-foreground shrink-0 transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="pb-4 text-muted-foreground leading-relaxed text-sm">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* ===== Footer ===== */}
      <PublicFooter />
    </div>
  );
}