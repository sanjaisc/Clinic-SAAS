"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CreditCard,
  Key,
  Globe,
  Clock,
  Play,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Database,
  Trash2,
  RotateCcw,
  RefreshCw,
  Loader2,
  Shield,
  HardDrive,
  BarChart3,
  Info,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

// =============================================================================
// Types
// =============================================================================

type IntegrationStatus = {
  stripe: { configured: boolean; publicKey: string };
  jwt: { configured: boolean; secretMasked: string };
  gravityForms: { configured: boolean };
};

type CronJob = {
  name: string;
  key: string;
  status: string;
  lastRun: string | null;
  successRate: string | null;
  description: string;
};

type CronData = {
  jobs: CronJob[];
  counts: {
    expiredLocks: number;
    activeWaitlist: number;
    pendingAppointments: number;
  };
};

type DataStats = {
  tables: Record<string, number>;
  dbFileSize: string | null;
  resolvedErrorLogs: number;
  totalRows: number;
};

type TestResult = {
  success: boolean;
  message: string;
} | null;

type TriggerResult = {
  success: boolean;
  message: string;
} | null;

// =============================================================================
// Helpers
// =============================================================================

const TABLE_LABELS: Record<string, string> = {
  clinics: "Clinics",
  providers: "Providers",
  services: "Services",
  specialties: "Specialties",
  insurances: "Insurances",
  amenities: "Amenities",
  languages: "Languages",
  slots: "Slots",
  appointments: "Appointments",
  reviews: "Reviews",
  waitlistEntries: "Waitlist Entries",
  users: "Users",
  slotLocks: "Slot Locks",
  slotTemplates: "Slot Templates",
  auditLogs: "Audit Logs",
  systemErrorLogs: "Error Logs",
  emailTemplates: "Email Templates",
  staffInvitations: "Staff Invitations",
  conversionEvents: "Conversion Events",
  providerServices: "Provider Services",
  clinicInsurances: "Clinic Insurances",
  clinicAmenities: "Clinic Amenities",
  providerLanguages: "Provider Languages",
  clinicClosures: "Clinic Closures",
  appointmentLedgers: "Appointment Ledgers",
  internalNotes: "Internal Notes",
  tokens: "Tokens",
  serviceInsurances: "Service Insurances",
};

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { color: string; label: string }> = {
    IDLE: { color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", label: "IDLE" },
    RUNNING: { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", label: "RUNNING" },
    ERROR: { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", label: "ERROR" },
    "N/A": { color: "bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-500", label: "N/A" },
  };
  const v = variants[status] || { color: "bg-gray-100 text-gray-600", label: status };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${v.color}`}>
      {v.label}
    </span>
  );
}

// =============================================================================
// Page Component
// =============================================================================

export default function InfrastructurePage() {
  const { toast } = useToast();

  // Tab 1: Integrations
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [integrationsLoading, setIntegrationsLoading] = useState(true);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});

  // Tab 2: Cron
  const [cronData, setCronData] = useState<CronData | null>(null);
  const [cronLoading, setCronLoading] = useState(true);
  const [triggerResults, setTriggerResults] = useState<Record<string, TriggerResult>>({});
  const [triggering, setTriggering] = useState<Record<string, boolean>>({});

  // Tab 3: Data
  const [dataStats, setDataStats] = useState<DataStats | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [purgingErrors, setPurgingErrors] = useState(false);

  // =========================================================================
  // Fetchers
  // =========================================================================

  const fetchIntegrations = useCallback(async () => {
    setIntegrationsLoading(true);
    try {
      const res = await fetch("/api/staff/admin/integrations");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setIntegrations(data);
    } catch {
      toast({ title: "Error", description: "Failed to load integration status.", variant: "destructive" });
    } finally {
      setIntegrationsLoading(false);
    }
  }, [toast]);

  const fetchCron = useCallback(async () => {
    setCronLoading(true);
    try {
      const res = await fetch("/api/staff/admin/cron");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCronData(data);
    } catch {
      toast({ title: "Error", description: "Failed to load cron status.", variant: "destructive" });
    } finally {
      setCronLoading(false);
    }
  }, [toast]);

  const fetchDataStats = useCallback(async () => {
    setDataLoading(true);
    try {
      const res = await fetch("/api/staff/admin/data/stats");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setDataStats(data);
    } catch {
      toast({ title: "Error", description: "Failed to load data stats.", variant: "destructive" });
    } finally {
      setDataLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchIntegrations();
    fetchCron();
    fetchDataStats();
  }, [fetchIntegrations, fetchCron, fetchDataStats]);

  // =========================================================================
  // Actions
  // =========================================================================

  const testIntegration = async (integration: "stripe" | "jwt") => {
    setTesting((prev) => ({ ...prev, [integration]: true }));
    setTestResults((prev) => ({ ...prev, [integration]: null }));
    try {
      const res = await fetch("/api/staff/admin/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration }),
      });
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [integration]: data }));
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [integration]: { success: false, message: "Request failed." },
      }));
    } finally {
      setTesting((prev) => ({ ...prev, [integration]: false }));
    }
  };

  const triggerJob = async (jobKey: string) => {
    setTriggering((prev) => ({ ...prev, [jobKey]: true }));
    setTriggerResults((prev) => ({ ...prev, [jobKey]: null }));
    try {
      const res = await fetch("/api/staff/admin/cron/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job: jobKey }),
      });
      const data = await res.json();
      setTriggerResults((prev) => ({ ...prev, [jobKey]: data }));
      if (data.success) {
        toast({ title: "Job Triggered", description: data.message });
        // Refresh cron data after a successful trigger
        fetchCron();
      } else {
        toast({ title: "Job Failed", description: data.message, variant: "destructive" });
      }
    } catch {
      setTriggerResults((prev) => ({
        ...prev,
        [jobKey]: { success: false, message: "Request failed." },
      }));
      toast({ title: "Error", description: "Failed to trigger job.", variant: "destructive" });
    } finally {
      setTriggering((prev) => ({ ...prev, [jobKey]: false }));
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/staff/admin/data/seed", { method: "POST" });
      const data = await res.json();
      toast({
        title: data.success ? "Seed Triggered" : "Error",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    } catch {
      toast({ title: "Error", description: "Failed to trigger seed.", variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  };

  const handlePurgeErrors = async () => {
    setPurgingErrors(true);
    try {
      const res = await fetch("/api/staff/admin/data/purge-errors", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Purged", description: data.message });
        fetchDataStats();
      } else {
        toast({ title: "Error", description: data.message || "Purge failed.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to purge error logs.", variant: "destructive" });
    } finally {
      setPurgingErrors(false);
    }
  };

  // =========================================================================
  // Count annotations for cron jobs
  // =========================================================================
  const getCountAnnotation = (key: string) => {
    if (!cronData) return null;
    switch (key) {
      case "LOCK_SWEEP":
        return { label: "Expired Locks", value: cronData.counts.expiredLocks };
      case "WAITLIST_PROCESSOR":
        return { label: "Active Waitlist", value: cronData.counts.activeWaitlist };
      case "SLOT_GENERATION":
        return { label: "Pending Appts", value: cronData.counts.pendingAppointments };
      default:
        return null;
    }
  };

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="space-y-6">
      <Tabs defaultValue="integrations" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="integrations" className="gap-2">
            <Key className="size-4" />
            <span className="hidden sm:inline">Integrations</span>
          </TabsTrigger>
          <TabsTrigger value="cron" className="gap-2">
            <Clock className="size-4" />
            <span className="hidden sm:inline">WP-Cron</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-2">
            <Database className="size-4" />
            <span className="hidden sm:inline">Data</span>
          </TabsTrigger>
        </TabsList>

        {/* ============================================================= */}
        {/* TAB 1: Integration Credentials                                */}
        {/* ============================================================= */}
        <TabsContent value="integrations" className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 p-3">
            <Info className="size-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Credentials are managed via environment variables. Contact DevOps to update.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {/* Stripe */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center size-9 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <CreditCard className="size-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Stripe</CardTitle>
                    <CardDescription>Payment processing</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {integrationsLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      {integrations?.stripe.configured ? (
                        <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">Configured</Badge>
                      ) : (
                        <Badge variant="secondary">Not Configured</Badge>
                      )}
                    </div>
                    {integrations?.stripe.configured && (
                      <div className="rounded-md bg-muted/50 px-3 py-2">
                        <p className="text-xs text-muted-foreground font-mono break-all">
                          {integrations.stripe.publicKey}
                        </p>
                      </div>
                    )}
                    {testResults.stripe && (
                      <div className={`flex items-start gap-2 rounded-md p-2 text-sm ${
                        testResults.stripe.success
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                          : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                      }`}>
                        {testResults.stripe.success
                          ? <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
                          : <XCircle className="size-4 mt-0.5 shrink-0" />
                        }
                        <span>{testResults.stripe.message}</span>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={testing.stripe}
                      onClick={() => testIntegration("stripe")}
                    >
                      {testing.stripe ? (
                        <Loader2 className="size-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="size-4 mr-2" />
                      )}
                      Test Connection
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* JWT Secret */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center size-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <Key className="size-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">JWT Secret</CardTitle>
                    <CardDescription>Auth token signing</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {integrationsLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      {integrations?.jwt.configured ? (
                        <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">Configured</Badge>
                      ) : (
                        <Badge variant="secondary">Not Configured</Badge>
                      )}
                    </div>
                    {integrations?.jwt.configured && (
                      <div className="rounded-md bg-muted/50 px-3 py-2">
                        <p className="text-xs text-muted-foreground font-mono break-all">
                          {integrations.jwt.secretMasked}
                        </p>
                      </div>
                    )}
                    {testResults.jwt && (
                      <div className={`flex items-start gap-2 rounded-md p-2 text-sm ${
                        testResults.jwt.success
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                          : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                      }`}>
                        {testResults.jwt.success
                          ? <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
                          : <XCircle className="size-4 mt-0.5 shrink-0" />
                        }
                        <span>{testResults.jwt.message}</span>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={testing.jwt}
                      onClick={() => testIntegration("jwt")}
                    >
                      {testing.jwt ? (
                        <Loader2 className="size-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="size-4 mr-2" />
                      )}
                      Test Signing
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Gravity Forms */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center size-9 rounded-lg bg-gray-100 dark:bg-gray-800">
                    <Globe className="size-4 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Gravity Forms</CardTitle>
                    <CardDescription>WordPress integration</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {integrationsLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Not Configured</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Gravity Forms integration is not yet configured. This will be used for intake form bridging.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============================================================= */}
        {/* TAB 2: WP-Cron Monitoring                                     */}
        {/* ============================================================= */}
        <TabsContent value="cron" className="space-y-4">
          {cronLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {cronData?.jobs.map((job) => {
                const annotation = getCountAnnotation(job.key);
                const isTriggering = triggering[job.key];
                const result = triggerResults[job.key];

                return (
                  <Card key={job.key}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center size-9 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                            <Clock className="size-4 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{job.name}</CardTitle>
                            <CardDescription>{job.description}</CardDescription>
                          </div>
                        </div>
                        <StatusBadge status={job.status} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Metadata */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Last Run</p>
                          <p className="font-medium">
                            {job.lastRun
                              ? new Date(job.lastRun).toLocaleString()
                              : "Never"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Success Rate</p>
                          <p className="font-medium">
                            {job.successRate
                              ? `${job.successRate}%`
                              : "N/A — No automated runs yet"}
                          </p>
                        </div>
                      </div>

                      {/* Annotation (live DB count) */}
                      {annotation && (
                        <div className="rounded-md bg-muted/50 px-3 py-2 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{annotation.label}</span>
                          <span className="text-sm font-semibold">{annotation.value}</span>
                        </div>
                      )}

                      {/* Trigger result */}
                      {result && (
                        <div className={`flex items-start gap-2 rounded-md p-2 text-sm ${
                          result.success
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                            : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                        }`}>
                          {result.success
                            ? <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
                            : <XCircle className="size-4 mt-0.5 shrink-0" />
                          }
                          <span>{result.message}</span>
                        </div>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={isTriggering}
                        onClick={() => triggerJob(job.key)}
                      >
                        {isTriggering ? (
                          <Loader2 className="size-4 mr-2 animate-spin" />
                        ) : (
                          <Play className="size-4 mr-2" />
                        )}
                        Trigger
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ============================================================= */}
        {/* TAB 3: Data Management                                        */}
        {/* ============================================================= */}
        <TabsContent value="data" className="space-y-4">
          {/* Database Stats */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center size-9 rounded-lg bg-sky-100 dark:bg-sky-900/30">
                    <BarChart3 className="size-4 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Database Statistics</CardTitle>
                    <CardDescription>Table row counts across all models</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {dataStats?.dbFileSize && (
                    <Badge variant="outline" className="gap-1.5">
                      <HardDrive className="size-3" />
                      {dataStats.dbFileSize}
                    </Badge>
                  )}
                  {dataStats && (
                    <Badge variant="outline" className="gap-1.5">
                      <Database className="size-3" />
                      {dataStats.totalRows.toLocaleString()} total rows
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={fetchDataStats}
                    disabled={dataLoading}
                  >
                    <RefreshCw className={`size-4 ${dataLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {dataLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : dataStats ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-96 overflow-y-auto">
                  {Object.entries(dataStats.tables)
                    .sort(([, a], [, b]) => b - a)
                    .map(([key, count]) => (
                      <div
                        key={key}
                        className="rounded-lg border bg-card p-3 space-y-1"
                      >
                        <p className="text-xs text-muted-foreground truncate">
                          {TABLE_LABELS[key] || key}
                        </p>
                        <p className="text-lg font-bold">{count.toLocaleString()}</p>
                      </div>
                    ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Action Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Re-seed Demo Data */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center size-9 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <RotateCcw className="size-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Re-seed Demo Data</CardTitle>
                    <CardDescription>Reset to demo defaults</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Triggers the demo data seed script. This will add sample data but does not clear existing records.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={seeding}
                    >
                      {seeding ? (
                        <Loader2 className="size-4 mr-2 animate-spin" />
                      ) : (
                        <RotateCcw className="size-4 mr-2" />
                      )}
                      Re-seed Demo Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertCircle className="size-5 text-amber-500" />
                        Confirm Data Reset
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will trigger the demo data seed script. If the seed script performs a full reset,
                        existing data may be lost. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSeed} disabled={seeding}>
                        {seeding ? (
                          <Loader2 className="size-4 mr-2 animate-spin" />
                        ) : null}
                        Trigger Seed
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>

            {/* Purge Soft-Deleted Data */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center size-9 rounded-lg bg-gray-100 dark:bg-gray-800">
                    <Trash2 className="size-4 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Purge Soft-Deleted Data</CardTitle>
                    <CardDescription>Clean up archived records</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Permanently remove soft-deleted records (archived appointments, inactive providers, etc.) to reclaim database space.
                </p>
                <Button size="sm" variant="outline" className="w-full" disabled>
                  <Trash2 className="size-4 mr-2" />
                  Purge Soft-Deleted
                  <Badge variant="secondary" className="ml-2 text-xs">Coming Soon</Badge>
                </Button>
              </CardContent>
            </Card>

            {/* SystemErrorLog Cleanup */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center size-9 rounded-lg bg-red-100 dark:bg-red-900/30">
                    <Shield className="size-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Error Log Cleanup</CardTitle>
                    <CardDescription>SystemErrorLog maintenance</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {dataLoading ? (
                  <Skeleton className="h-8 w-full" />
                ) : (
                  <div className="rounded-md bg-muted/50 px-3 py-2 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Resolved Error Logs</span>
                    <span className="text-sm font-semibold">{dataStats?.resolvedErrorLogs ?? 0}</span>
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={purgingErrors || (dataStats?.resolvedErrorLogs ?? 0) === 0}
                  onClick={handlePurgeErrors}
                >
                  {purgingErrors ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="size-4 mr-2" />
                  )}
                  Purge Resolved
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}