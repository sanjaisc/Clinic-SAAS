"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Mail,
  Save,
  RotateCcw,
  FileText,
  Settings2,
  ClipboardList,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  BoldItalicUnderlineToggles,
  ListsToggle,
  toolbarPlugin,
  type MDXEditorMethods,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import type { DoctASessionUser } from "@/lib/auth";
import { useActiveClinicId } from "@/components/active-clinic-context";
import { EMAIL_TEMPLATE_TYPE, INTAKE_CADENCE } from "@/lib/enums";

// ---- Types ----
interface EmailTemplate {
  id: string;
  type: string;
  subject: string;
  bodyHtml: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Service {
  id: string;
  name: string;
  slug: string;
}

interface CommsData {
  emailFromName: string;
  customEmailHeader: string;
  commonInstructions: string;
  intakeReminderDays: string;
  intakeFormIds: Record<string, string>;
  emailTemplates: EmailTemplate[];
  availableServices: Service[];
}

const TEMPLATE_LABELS: Record<string, string> = {
  BOOKING_CONFIRMATION: "Booking Confirmation",
  CANCELLATION: "Cancellation",
  RESCHEDULE: "Reschedule",
  REMINDER: "Appointment Reminder",
  INTAKE: "Intake Form",
  REVIEW_REQUEST: "Review Request",
  PAYMENT_REQUEST: "Payment Request",
};

const CADENCE_OPTIONS = [
  { value: INTAKE_CADENCE.DO_NOT_SEND, label: "Do Not Send" },
  { value: INTAKE_CADENCE.THREE_AND_ONE_DAY, label: "3 days & 1 day before" },
  { value: INTAKE_CADENCE.ONE_DAY, label: "1 day before" },
  { value: INTAKE_CADENCE.THREE_DAY, label: "3 days before" },
  { value: INTAKE_CADENCE.SEVEN_AND_ONE_DAY, label: "7 days & 1 day before" },
];

// ---- MDXEditor wrapper (Safe Mode — no HTML source) ----
function SafeMarkdownEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  const editorRef = useRef<MDXEditorMethods>(null);

  return (
    <div className="rounded-md border border-input overflow-hidden [&_.mdxeditor]:!bg-background [&_.mdxeditor]:!min-h-[160px] [&_.mdxeditor]:!max-h-[300px] [&_.mdxeditor_editor-content]:!prose-sm [&_.mdxeditor]:!text-sm">
      <MDXEditor
        ref={editorRef}
        markdown={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        contentEditableClassName="prose prose-sm max-w-none focus:outline-none min-h-[160px] p-3"
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          markdownShortcutPlugin(),
          linkPlugin(),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <BoldItalicUnderlineToggles />
                <ListsToggle />
              </>
            ),
          }),
        ]}
      />
    </div>
  );
}

// ---- Main Component ----
export default function CommunicationsPage() {
  const { data: session } = useSession();
  const user = session?.user as DoctASessionUser | undefined;
  const clinicId = useActiveClinicId(user?.clinicId);

  // Data state
  const [data, setData] = useState<CommsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Editor states
  const [emailFromName, setEmailFromName] = useState("");
  const [customEmailHeader, setCustomEmailHeader] = useState("");
  const [commonInstructions, setCommonInstructions] = useState("");
  const [intakeReminderDays, setIntakeReminderDays] = useState(INTAKE_CADENCE.THREE_AND_ONE_DAY);
  const [intakeFormIds, setIntakeFormIds] = useState<Record<string, string>>({});

  // Saving states
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [savingSender, setSavingSender] = useState(false);
  const [savingIntake, setSavingIntake] = useState(false);

  // Template state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateActive, setTemplateActive] = useState(true);

  const fetchComms = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/staff/communications?clinicId=${clinicId}`);
      if (!res.ok) throw new Error("Failed to load");
      const result: CommsData = await res.json();
      setData(result);
      setEmailFromName(result.emailFromName);
      setCustomEmailHeader(result.customEmailHeader);
      setCommonInstructions(result.commonInstructions);
      setIntakeReminderDays(result.intakeReminderDays);
      setIntakeFormIds(result.intakeFormIds || {});

      // Select first template
      if (result.emailTemplates.length > 0) {
        const first = result.emailTemplates[0];
        setSelectedTemplateId(first.id);
        setTemplateSubject(first.subject);
        setTemplateBody(first.bodyHtml);
        setTemplateActive(first.isActive);
      }
    } catch {
      toast.error("Failed to load communication settings");
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    if (clinicId) fetchComms();
  }, [clinicId, fetchComms]);

  // Save common instructions
  const saveCommonInstructions = async () => {
    try {
      setSavingInstructions(true);
      const res = await fetch(`/api/staff/communications?clinicId=${clinicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commonInstructions }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Common instructions saved");
    } catch {
      toast.error("Failed to save common instructions");
    } finally {
      setSavingInstructions(false);
    }
  };

  // Save sender settings
  const saveSenderSettings = async () => {
    try {
      setSavingSender(true);
      const res = await fetch(`/api/staff/communications?clinicId=${clinicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailFromName, customEmailHeader }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Email sender settings saved");
    } catch {
      toast.error("Failed to save email settings");
    } finally {
      setSavingSender(false);
    }
  };

  // Save intake config
  const saveIntakeConfig = async () => {
    try {
      setSavingIntake(true);
      const res = await fetch(`/api/staff/communications?clinicId=${clinicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intakeReminderDays, intakeFormIds }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Intake configuration saved");
    } catch {
      toast.error("Failed to save intake configuration");
    } finally {
      setSavingIntake(false);
    }
  };

  // Template selection
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = data?.emailTemplates.find((t) => t.id === templateId);
    if (template) {
      setTemplateSubject(template.subject);
      setTemplateBody(template.bodyHtml);
      setTemplateActive(template.isActive);
    }
  };

  // Save template
  const saveTemplate = async () => {
    if (!selectedTemplateId) return;
    try {
      setTemplateSaving(true);
      const res = await fetch(
        `/api/staff/email-templates/${selectedTemplateId}?clinicId=${clinicId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject: templateSubject, bodyHtml: templateBody, isActive: templateActive }),
        }
      );
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Template saved");
      fetchComms();
    } catch {
      toast.error("Failed to save template");
    } finally {
      setTemplateSaving(false);
    }
  };

  // Reset template
  const resetTemplate = async () => {
    if (!selectedTemplateId) return;
    try {
      const res = await fetch(
        `/api/staff/email-templates/reset/${selectedTemplateId}?clinicId=${clinicId}`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed to reset");
      toast.success("Template reset to default");
      fetchComms();
    } catch {
      toast.error("Failed to reset template");
    }
  };

  // Toggle template active
  const toggleTemplateActive = async (templateId: string, isActive: boolean) => {
    try {
      const res = await fetch(
        `/api/staff/email-templates/${templateId}?clinicId=${clinicId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive }),
        }
      );
      if (!res.ok) throw new Error("Failed to update");
      toast.success(`Template ${isActive ? "activated" : "deactivated"}`);
      fetchComms();
    } catch {
      toast.error("Failed to update template");
    }
  };

  // Update form mapping
  const updateFormMapping = (serviceId: string, formId: string) => {
    setIntakeFormIds((prev) => {
      const updated = { ...prev };
      if (formId.trim()) {
        updated[serviceId] = formId.trim();
      } else {
        delete updated[serviceId];
      }
      return updated;
    });
  };

  const selectedTemplate = data?.emailTemplates.find(
    (t) => t.id === selectedTemplateId
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Card 1: Common Instructions Block */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-lg bg-brand-muted ">
                <MessageSquare className="size-5 text-brand" />
              </div>
              <div>
                <CardTitle className="text-lg">Common Instructions Block</CardTitle>
                <CardDescription>
                  This content is automatically appended to all automated emails
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={saveCommonInstructions}
              disabled={savingInstructions}
              size="sm"
            >
              <Save className="size-4 mr-1.5" />
              {savingInstructions ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <SafeMarkdownEditor
            value={commonInstructions}
            onChange={setCommonInstructions}
            placeholder="Add common instructions that will appear at the bottom of every email... e.g., parking info, arrival instructions, what to bring."
          />
          <p className="text-xs text-muted-foreground mt-2">
            Supports markdown formatting. This block is appended to all automated emails.
          </p>
        </CardContent>
      </Card>

      {/* Card 2: Email Sender Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-lg bg-blue-50 dark:bg-blue-950/50">
                <Settings2 className="size-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Email Sender Settings</CardTitle>
                <CardDescription>
                  Configure how outgoing emails appear to recipients
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={saveSenderSettings}
              disabled={savingSender}
              size="sm"
            >
              <Save className="size-4 mr-1.5" />
              {savingSender ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-from-name">From Name</Label>
            <Input
              id="email-from-name"
              placeholder="e.g., Front Desk Team"
              value={emailFromName}
              onChange={(e) => setEmailFromName(e.target.value)}
              className="max-w-md"
            />
            <p className="text-xs text-muted-foreground">
              The display name shown as the sender in outgoing emails
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-email-header">Custom Email Header</Label>
            <Input
              id="custom-email-header"
              placeholder="e.g., Important: Your Appointment Details"
              value={customEmailHeader}
              onChange={(e) => setCustomEmailHeader(e.target.value)}
              className="max-w-md"
            />
            <p className="text-xs text-muted-foreground">
              Prepend a custom header to all automated email subjects
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Intake Form Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-lg bg-violet-50 dark:bg-violet-950/50">
                <ClipboardList className="size-5 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Intake Form Configuration</CardTitle>
                <CardDescription>
                  Configure intake reminder timing and form-to-service mapping
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={saveIntakeConfig}
              disabled={savingIntake}
              size="sm"
            >
              <Save className="size-4 mr-1.5" />
              {savingIntake ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Intake Reminder Cadence */}
          <div className="space-y-2">
            <Label>Intake Reminder Cadence</Label>
            <Select value={intakeReminderDays} onValueChange={setIntakeReminderDays}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CADENCE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose when to send intake form reminders before appointments
            </p>
          </div>

          <Separator />

          {/* Form Mapping */}
          <div className="space-y-3">
            <Label>Form ID Mapping by Service</Label>
            <p className="text-xs text-muted-foreground">
              Map Gravity Form IDs to your services. The intake email will include the correct form link.
            </p>
            {data?.availableServices && data.availableServices.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.availableServices.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center gap-3 py-2 px-3 rounded-lg border bg-background"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{service.name}</p>
                    </div>
                    <Input
                      placeholder="Form ID"
                      value={intakeFormIds[service.id] || ""}
                      onChange={(e) =>
                        updateFormMapping(service.id, e.target.value)
                      }
                      className="w-40 h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No services available. Add services in the Services &amp; Insurance tab first.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Card 4: Email Template Editor */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-rose-50 dark:bg-rose-950/50">
              <FileText className="size-5 text-rose-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Email Template Editor</CardTitle>
              <CardDescription>
                Customize automated email templates for each communication type
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Template selector */}
          {data?.emailTemplates && data.emailTemplates.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-2">
                {data.emailTemplates.map((t) => (
                  <Button
                    key={t.id}
                    variant={selectedTemplateId === t.id ? "default" : "outline"}
                    size="sm"
                    className={
                      selectedTemplateId === t.id
                        ? "bg-brand hover:bg-brand-hover text-white"
                        : ""
                    }
                    onClick={() => handleTemplateSelect(t.id)}
                  >
                    {TEMPLATE_LABELS[t.type] || t.type}
                    {!t.isActive && (
                      <Badge
                        variant="secondary"
                        className="ml-1.5 text-xs bg-muted-foreground/20"
                      >
                        Off
                      </Badge>
                    )}
                  </Button>
                ))}
              </div>

              {selectedTemplate && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium">Active</Label>
                      <Switch
                        checked={templateActive}
                        onCheckedChange={(val) => {
                          setTemplateActive(val);
                          toggleTemplateActive(selectedTemplate.id, val);
                        }}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetTemplate}
                    >
                      <RotateCcw className="size-3.5 mr-1.5" />
                      Reset to Default
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-subject">Subject Line</Label>
                    <Input
                      id="template-subject"
                      value={templateSubject}
                      onChange={(e) => setTemplateSubject(e.target.value)}
                      placeholder="Email subject line..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Email Body</Label>
                    <SafeMarkdownEditor
                      value={templateBody}
                      onChange={setTemplateBody}
                      placeholder="Compose your email template..."
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={saveTemplate}
                      disabled={templateSaving}
                      size="sm"
                    >
                      {templateSaving ? (
                        <Loader2 className="size-4 mr-1.5 animate-spin" />
                      ) : (
                        <Save className="size-4 mr-1.5" />
                      )}
                      Save Template
                    </Button>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="size-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No email templates configured</p>
              <p className="text-xs mt-1">
                Templates are created automatically when you set up the clinic.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}