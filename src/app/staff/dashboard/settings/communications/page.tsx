"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { SettingsBreadcrumb } from "@/components/settings-breadcrumb";
import {
  Mail,
  Save,
  RotateCcw,
  FileText,
  Settings2,
  ClipboardList,
  MessageSquare,
  Loader2,
  Info,
  ChevronDown,
  Copy,
  Check,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

// ---- Placeholder Tags Configuration ----
interface PlaceholderTag {
  tag: string;
  label: string;
  description: string;
  scope: "all" | string[];
  target: "subject" | "body" | "both";
}

interface PlaceholderCategory {
  name: string;
  icon: string;
  tags: PlaceholderTag[];
}

const PLACEHOLDER_CATEGORIES: PlaceholderCategory[] = [
  {
    name: "Patient & Contact",
    icon: "👤",
    tags: [
      {
        tag: "{{patientName}}",
        label: "Patient Name",
        description: "Full name of the patient",
        scope: "all",
        target: "both",
      },
      {
        tag: "{{patientEmail}}",
        label: "Patient Email",
        description: "Email address of the patient",
        scope: "all",
        target: "body",
      },
      {
        tag: "{{patientPhone}}",
        label: "Patient Phone",
        description: "Phone number of the patient",
        scope: "all",
        target: "body",
      },
    ],
  },
  {
    name: "Appointment Details",
    icon: "📅",
    tags: [
      {
        tag: "{{date}}",
        label: "Appointment Date",
        description: "Formatted date of the appointment (e.g., Monday, January 15, 2025)",
        scope: [
          "BOOKING_CONFIRMATION",
          "CANCELLATION",
          "RESCHEDULE",
          "REMINDER",
        ],
        target: "both",
      },
      {
        tag: "{{time}}",
        label: "Appointment Time",
        description: "Time of the appointment (e.g., 2:30 PM)",
        scope: [
          "BOOKING_CONFIRMATION",
          "CANCELLATION",
          "RESCHEDULE",
          "REMINDER",
        ],
        target: "both",
      },
      {
        tag: "{{providerName}}",
        label: "Provider Name",
        description: "Name of the assigned provider (e.g., Dr. Jane Smith)",
        scope: [
          "BOOKING_CONFIRMATION",
          "RESCHEDULE",
          "REMINDER",
        ],
        target: "both",
      },
      {
        tag: "{{serviceName}}",
        label: "Service Name",
        description: "Name of the booked service",
        scope: ["BOOKING_CONFIRMATION"],
        target: "both",
      },
      {
        tag: "{{appointmentId}}",
        label: "Appointment ID",
        description: "Unique appointment reference number",
        scope: [
          "BOOKING_CONFIRMATION",
          "CANCELLATION",
          "RESCHEDULE",
          "REMINDER",
        ],
        target: "body",
      },
      {
        tag: "{{modality}}",
        label: "Appointment Modality",
        description: "In-Person or Video",
        scope: [
          "BOOKING_CONFIRMATION",
          "RESCHEDULE",
          "REMINDER",
        ],
        target: "body",
      },
    ],
  },
  {
    name: "Clinic Information",
    icon: "🏢",
    tags: [
      {
        tag: "{{clinicName}}",
        label: "Clinic Name",
        description: "Display name of the clinic",
        scope: "all",
        target: "both",
      },
      {
        tag: "{{clinicPhone}}",
        label: "Clinic Phone",
        description: "Primary phone number of the clinic",
        scope: "all",
        target: "body",
      },
      {
        tag: "{{clinicAddress}}",
        label: "Clinic Address",
        description: "Full street address of the clinic",
        scope: "all",
        target: "body",
      },
    ],
  },
  {
    name: "Action Links",
    icon: "🔗",
    tags: [
      {
        tag: "{{intakeLink}}",
        label: "Intake Form Link",
        description: "URL to the patient intake form",
        scope: ["INTAKE"],
        target: "body",
      },
      {
        tag: "{{reviewLink}}",
        label: "Review Link",
        description: "URL to leave a review",
        scope: ["REVIEW_REQUEST"],
        target: "body",
      },
      {
        tag: "{{paymentLink}}",
        label: "Payment Link",
        description: "URL to complete payment",
        scope: ["PAYMENT_REQUEST"],
        target: "body",
      },
      {
        tag: "{{cancellationLink}}",
        label: "Cancel Appointment",
        description: "URL for the patient to cancel the appointment",
        scope: ["BOOKING_CONFIRMATION", "REMINDER"],
        target: "body",
      },
      {
        tag: "{{rescheduleLink}}",
        label: "Reschedule Link",
        description: "URL for the patient to reschedule",
        scope: ["BOOKING_CONFIRMATION", "REMINDER"],
        target: "body",
      },
      {
        tag: "{{manageLink}}",
        label: "Manage Appointment",
        description: "URL to view or manage appointment details",
        scope: ["BOOKING_CONFIRMATION", "REMINDER"],
        target: "body",
      },
    ],
  },
  {
    name: "Payment",
    icon: "💳",
    tags: [
      {
        tag: "{{amount}}",
        label: "Payment Amount",
        description: "Amount due (e.g., $50.00)",
        scope: ["PAYMENT_REQUEST"],
        target: "both",
      },
    ],
  },
];

/** Check if a tag is relevant for a given template type */
function isTagRelevant(tag: PlaceholderTag, templateType: string): boolean {
  return tag.scope === "all" || tag.scope.includes(templateType);
}

// ---- Tag Chip Component ----
function PlaceholderTagChip({
  tag,
  templateType,
  onInsert,
}: {
  tag: PlaceholderTag;
  templateType: string | undefined;
  onInsert: (tagStr: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const relevant = templateType ? isTagRelevant(tag, templateType) : true;

  const handleInsert = () => {
    onInsert(tag.tag);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(tag.tag).then(() => {
      setCopied(true);
      toast.success(`Copied ${tag.tag} to clipboard`);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
      toast.error("Failed to copy to clipboard");
    });
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleInsert}
            className={`
              group relative inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5
              text-xs font-mono transition-all duration-150
              ${
                relevant
                  ? "border-foreground/15 bg-background hover:border-brand hover:bg-brand/5 hover:shadow-sm cursor-pointer"
                  : "border-dashed border-muted-foreground/20 bg-muted/30 text-muted-foreground cursor-default opacity-50"
              }
            `}
            disabled={!relevant}
          >
            <span className="truncate">{tag.tag}</span>
            <span className="text-muted-foreground font-sans hidden sm:inline">
              {tag.label}
            </span>
            {/* Copy button — visible on hover */}
            {relevant && (
              <span
                role="button"
                tabIndex={-1}
                onClick={handleCopy}
                className="ml-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                aria-label={`Copy ${tag.tag}`}
              >
                {copied ? (
                  <Check className="size-3 text-green-500" />
                ) : (
                  <Copy className="size-3" />
                )}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="font-medium text-xs">{tag.description}</p>
          {!relevant && templateType && (
            <p className="text-xs text-muted-foreground mt-1">
              Not available for {TEMPLATE_LABELS[templateType] || templateType} templates
            </p>
          )}
          {relevant && (
            <p className="text-xs text-muted-foreground mt-1">
              Click to insert &middot; Hover + click icon to copy
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ---- Placeholder Reference Panel ----
function PlaceholderReferencePanel({
  templateType,
  onInsertTag,
}: {
  templateType: string | undefined;
  onInsertTag: (tagStr: string) => void;
}) {
  const [open, setOpen] = useState(true);

  // Count relevant vs total tags
  const totalTags = PLACEHOLDER_CATEGORIES.reduce(
    (sum, cat) => sum + cat.tags.length,
    0
  );
  const relevantTags = templateType
    ? PLACEHOLDER_CATEGORIES.reduce(
        (sum, cat) =>
          sum + cat.tags.filter((t) => isTagRelevant(t, templateType)).length,
        0
      )
    : totalTags;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left group"
        >
          <div className="flex items-center justify-center size-7 rounded-md bg-amber-50 dark:bg-amber-950/40">
            <Info className="size-3.5 text-amber-600" />
          </div>
          <span>Available Placeholders</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
            {relevantTags}/{totalTags} applicable
          </Badge>
          <ChevronDown
            className={`size-4 ml-auto transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-3">
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Click a tag to insert it into the email body, or hover and click the copy icon
            to place it in the subject line or elsewhere.
            {templateType && (
              <span className="ml-1">
                Dimmed tags are not available for{" "}
                <span className="font-medium text-foreground">
                  {TEMPLATE_LABELS[templateType] || templateType}
                </span>{" "}
                templates.
              </span>
            )}
          </p>

          {PLACEHOLDER_CATEGORIES.map((category) => {
            const hasRelevantTags = templateType
              ? category.tags.some((t) => isTagRelevant(t, templateType))
              : true;
            // Skip categories with no relevant tags
            if (!hasRelevantTags) return null;

            return (
              <div key={category.name}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm" aria-hidden="true">
                    {category.icon}
                  </span>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {category.name}
                  </h4>
                </div>
                <div className="flex flex-wrap gap-1.5 pl-6">
                  {category.tags.map((tag) => (
                    <PlaceholderTagChip
                      key={tag.tag}
                      tag={tag}
                      templateType={templateType}
                      onInsert={onInsertTag}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

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
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  // Track original values for dirty check
  const originalSubjectRef = useRef("");
  const originalBodyRef = useRef("");
  const originalActiveRef = useRef(true);

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
        originalSubjectRef.current = first.subject;
        originalBodyRef.current = first.bodyHtml;
        originalActiveRef.current = first.isActive;
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

  // Insert placeholder tag into template body
  const handleInsertTag = useCallback((tagStr: string) => {
    setTemplateBody((prev) => {
      const separator = prev && !prev.endsWith("\n") ? "\n" : "";
      return `${prev}${separator}${tagStr}`;
    });
    toast.info(`Inserted ${tagStr}`, {
      description: "The placeholder has been added to the email body.",
      duration: 2000,
    });
  }, []);

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

  // Check if template has unsaved changes
  const isTemplateDirty = () => {
    if (!selectedTemplateId) return false;
    return (
      templateSubject !== originalSubjectRef.current ||
      templateBody !== originalBodyRef.current ||
      templateActive !== originalActiveRef.current
    );
  };

  // Template selection with dirty check
  const handleTemplateSelect = (templateId: string) => {
    if (templateId === selectedTemplateId) return;
    if (isTemplateDirty()) {
      setPendingTemplateId(templateId);
      setUnsavedDialogOpen(true);
      return;
    }
    applyTemplateSelection(templateId);
  };

  const applyTemplateSelection = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = data?.emailTemplates.find((t) => t.id === templateId);
    if (template) {
      setTemplateSubject(template.subject);
      setTemplateBody(template.bodyHtml);
      setTemplateActive(template.isActive);
      originalSubjectRef.current = template.subject;
      originalBodyRef.current = template.bodyHtml;
      originalActiveRef.current = template.isActive;
    }
  };

  const confirmDiscardAndSwitch = () => {
    setUnsavedDialogOpen(false);
    if (pendingTemplateId) {
      applyTemplateSelection(pendingTemplateId);
      setPendingTemplateId(null);
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
      // Reset dirty tracking after successful save
      originalSubjectRef.current = templateSubject;
      originalBodyRef.current = templateBody;
      originalActiveRef.current = templateActive;
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
      <SettingsBreadcrumb items={[{ label: "Settings" }, { label: "Communications" }]} />
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

                  {/* Placeholder Tags Reference */}
                  <PlaceholderReferencePanel
                    templateType={selectedTemplate.type}
                    onInsertTag={handleInsertTag}
                  />

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

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={unsavedDialogOpen} onOpenChange={setUnsavedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to the current email template. Switching templates will discard these changes. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingTemplateId(null)}>
              Stay on this template
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDiscardAndSwitch}>
              Discard and switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}