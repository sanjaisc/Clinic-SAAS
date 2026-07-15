"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import type { DoctASessionUser } from "@/lib/auth";
import { useActiveClinicId } from "@/components/active-clinic-context";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SettingsBreadcrumb } from "@/components/settings-breadcrumb";
import {
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  Image as ImageIcon,
  Camera,
  Trash2,
  Plus,
  X,
  Save,
  Car,
  Footprints,
  HelpCircle,
  Languages,
  Star,
  Loader2,
  Upload,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  toolbarPlugin,
  BoldItalicUnderlineToggles,
  ListsToggle,
  StrikeThroughSupSubToggles,
  CreateLink,
  InsertThematicBreak,
  UndoRedo,
  Separator as MDXSeparator,
  type MDXEditorMethods,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";

const ClinicLocationMap = dynamic(() => import("@/components/clinic-location-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-60 rounded-lg border border-border bg-muted/30 flex items-center justify-center">
      <Loader2 className="size-5 text-muted-foreground animate-spin" />
    </div>
  ),
});

// ---- Types ----

interface ClinicProfile {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  about: string | null;
  description: string | null;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  phoneNumber: string;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  galleryUrls: string[];
  faq: { q: string; a: string }[];
  parkingInstructions: string | null;
  visitInstructions: string | null;
  status: string;
  amenityIds: string[];
  amenities: { id: string; name: string; slug: string; icon: string | null }[];
  providerLanguages: {
    providerId: string;
    providerName: string;
    languages: string[];
  }[];
  allLanguages: { id: string; name: string; code: string }[];
}

interface ExperienceData {
  parkingInstructions: string;
  visitInstructions: string;
  faq: { q: string; a: string }[];
  allAmenities: { id: string; name: string; slug: string; icon: string | null }[];
  selectedAmenityIds: string[];
  allLanguages: { id: string; name: string; code: string }[];
  providerLanguageMap: {
    providerId: string;
    providerName: string;
    languageIds: string[];
  }[];
}

interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---- Helper: build query string for SYSTEM_MANAGER ----

function getClinicParam(clinicId: string | null | undefined): string {
  return clinicId ? `?clinicId=${clinicId}` : "";
}

// ---- Image Cropper Component ----

function ImageCropUploader({
  type,
  aspectRatio,
  currentUrl,
  onUploaded,
  onRemoved,
  label,
}: {
  type: "logo" | "cover" | "gallery" | "provider-photo";
  aspectRatio: number;
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  onRemoved?: () => void;
  label: string;
}) {
  const { data: session } = useSession();
  const user = session?.user as DoctASessionUser | undefined;
  const clinicId = useActiveClinicId(user?.clinicId ?? null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [crop, setCrop] = useState<CropData | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ w: 0, h: 0 });

  useEffect(() => {
    setPreview(currentUrl);
  }, [currentUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Max 5MB.");
      return;
    }

    setRawFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      setPreview(src);
      const img = new Image();
      img.onload = () => {
        imgRef.current = img;
        setImageDimensions({ w: img.naturalWidth, h: img.naturalHeight });
        // Auto-crop to center with the correct aspect ratio
        const srcAspect = img.naturalWidth / img.naturalHeight;
        let cx: number, cy: number, cw: number, ch: number;
        if (srcAspect > aspectRatio) {
          ch = img.naturalHeight;
          cw = ch * aspectRatio;
        } else {
          cw = img.naturalWidth;
          ch = cw / aspectRatio;
        }
        cx = (img.naturalWidth - cw) / 2;
        cy = (img.naturalHeight - ch) / 2;
        const newCrop = { x: cx, y: cy, width: cw, height: ch };
        setCrop(newCrop);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!rawFile || !crop) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", rawFile);
      formData.append("type", type);
      formData.append("crop", JSON.stringify(crop));

      const clinicParam = getClinicParam(clinicId);
      const res = await fetch(`/api/staff/clinic-profile/upload${clinicParam}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      onUploaded(data.url);
      setRawFile(null);
      setCrop(null);
      toast.success("Image uploaded successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!preview && !currentUrl) return;
    try {
      const urlToRemove = currentUrl || preview;
      const clinicParam = getClinicParam(clinicId);
      const res = await fetch(`/api/staff/clinic-profile/media${clinicParam}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlToRemove, type }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to remove image");
      }
      setPreview(null);
      setRawFile(null);
      setCrop(null);
      onRemoved?.();
      toast.success("Image removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove image");
    }
  };

  const isSquare = aspectRatio === 1;
  const previewW = isSquare ? 160 : 320;
  const previewH = isSquare ? 160 : 180;

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">{label}</Label>

      {/* Preview / Upload Area */}
      <div className="flex items-start gap-4">
        <div
          className="relative flex-shrink-0 rounded-lg border-2 border-dashed border-muted-foreground/25 overflow-hidden flex items-center justify-center bg-muted/30 cursor-pointer hover:border-brand/50 transition-colors"
          style={{ width: previewW, height: previewH }}
          onClick={() => fileInputRef.current?.click()}
        >
          {preview ? (
            <img
              src={preview}
              alt={label}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <Camera className="size-5" />
              <span className="text-xs">Upload</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="size-3.5 mr-1.5" />
            Choose File
          </Button>
          {rawFile && crop && (
            <Button
              size="sm"
              onClick={handleUpload}
              disabled={uploading}
              className="bg-brand hover:bg-brand-hover text-white"
            >
              {uploading ? (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              ) : (
                <Save className="size-3.5 mr-1.5" />
              )}
              Save Image
            </Button>
          )}
          {preview && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3.5 mr-1.5" />
              Remove
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            {isSquare ? "1:1 ratio" : "16:9 ratio"} &bull; Max 5MB &bull; JPEG/PNG/WebP
          </p>
        </div>
      </div>

      {/* Hidden canvas for crop preview (not rendered visually) */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

// ---- Lightweight MDXEditor for small fields (no toolbar, markdown shortcuts only) ----

function MarkdownEditor({
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
    <div className="rounded-md border border-input overflow-hidden [&_.mdxeditor]:!bg-background [&_.mdxeditor]:!min-h-[80px] [&_.mdxeditor]:!max-h-[160px] [&_.mdxeditor_editor-content]:!prose-sm [&_.mdxeditor]:!text-sm">
      <MDXEditor
        ref={editorRef}
        markdown={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        contentEditableClassName="prose prose-sm max-w-none focus:outline-none min-h-[80px] p-3"
        plugins={[
          listsPlugin(),
          quotePlugin(),
          markdownShortcutPlugin(),
        ]}
      />
    </div>
  );
}

// ---- Rich Text Editor for About Content (toolbar, no raw code view) ----

function RichTextEditor({
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
    <div className="rounded-md border border-input overflow-hidden [&_.mdxeditor]:!bg-background [&_.mdxeditor]:!min-h-[180px] [&_.mdxeditor]:!max-h-[400px] [&_.mdxeditor_editor-content]:!prose-sm [&_.mdxeditor]:!text-sm">
      <MDXEditor
        ref={editorRef}
        markdown={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        contentEditableClassName="prose prose-sm max-w-none focus:outline-none min-h-[180px] p-3"
        plugins={[
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <MDXSeparator />
                <BoldItalicUnderlineToggles />
                <StrikeThroughSupSubToggles />
                <MDXSeparator />
                <ListsToggle />
                <MDXSeparator />
                <CreateLink />
                <MDXSeparator />
                <InsertThematicBreak />
              </>
            ),
          }),
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          linkPlugin(),
          markdownShortcutPlugin(),
        ]}
      />
    </div>
  );
}

// ---- FAQ Item Component ----

function FaqItem({
  item,
  index,
  onUpdate,
  onRemove,
}: {
  item: { q: string; a: string };
  index: number;
  onUpdate: (index: number, field: "q" | "a", value: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
      <div className="flex items-start gap-2">
        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded mt-1.5 flex-shrink-0">
          Q{index + 1}
        </span>
        <div className="flex-1 space-y-2">
          <Input
            placeholder="Question"
            value={item.q}
            onChange={(e) => onUpdate(index, "q", e.target.value)}
          />
          <Input
            placeholder="Answer"
            value={item.a}
            onChange={(e) => onUpdate(index, "a", e.target.value)}
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive flex-shrink-0 mt-1"
          onClick={onRemove}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ---- Map Preview ----
// Map is rendered by the dynamically-imported ClinicLocationMap component.
// The old static placeholder has been replaced with an interactive Leaflet/OSM map.

// ========================= MAIN PAGE =========================

export default function ProfileSettingsPage() {
  const { data: session } = useSession();
  const user = session?.user as DoctASessionUser | undefined;
  const clinicId = useActiveClinicId(user?.clinicId ?? null);
  const clinicParam = getClinicParam(clinicId);

  // ---- Data States ----
  const [profile, setProfile] = useState<ClinicProfile | null>(null);
  const [experience, setExperience] = useState<ExperienceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---- Form States ----
  const [coreForm, setCoreForm] = useState({
    name: "",
    tagline: "",
    about: "",
    phoneNumber: "",
    email: "",
    website: "",
  });
  const [locationForm, setLocationForm] = useState({
    streetAddress: "",
    city: "",
    state: "",
    zipCode: "",
    latitude: "",
    longitude: "",
  });
  const [faqItems, setFaqItems] = useState<{ q: string; a: string }[]>([]);
  const [parkingMd, setParkingMd] = useState("");
  const [visitMd, setVisitMd] = useState("");
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<string[]>([]);

  // ---- Saving States ----
  const [savingCore, setSavingCore] = useState(false);
  const [savingAbout, setSavingAbout] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [savingExperience, setSavingExperience] = useState(false);
  const [savingAmenities, setSavingAmenities] = useState(false);

  // ---- Fetch Data ----
  const fetchData = useCallback(async () => {
    try {
      const [profileRes, expRes] = await Promise.all([
        fetch(`/api/staff/clinic-profile${clinicParam}`),
        fetch(`/api/staff/clinic-profile/experience${clinicParam}`),
      ]);

      if (!profileRes.ok || !expRes.ok) throw new Error("Failed to fetch");

      const profileData: ClinicProfile = await profileRes.json();
      const expData: ExperienceData = await expRes.json();

      setProfile(profileData);
      setExperience(expData);

      setCoreForm({
        name: profileData.name || "",
        tagline: profileData.tagline || "",
        about: profileData.about || "",
        phoneNumber: profileData.phoneNumber || "",
        email: profileData.email || "",
        website: profileData.website || "",
      });

      setLocationForm({
        streetAddress: profileData.streetAddress || "",
        city: profileData.city || "",
        state: profileData.state || "",
        zipCode: profileData.zipCode || "",
        latitude: String(profileData.latitude || ""),
        longitude: String(profileData.longitude || ""),
      });

      setFaqItems(expData.faq || []);
      setParkingMd(expData.parkingInstructions || "");
      setVisitMd(expData.visitInstructions || "");
      setSelectedAmenityIds(expData.selectedAmenityIds || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load clinic profile";
      setLoadError(msg);
      toast.error(msg);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [clinicParam]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- Handlers ----

  const handleSaveCore = async () => {
    setSavingCore(true);
    try {
      const res = await fetch(`/api/staff/clinic-profile${clinicParam}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coreForm),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Core details updated");
      await fetchData();
    } catch {
      toast.error("Failed to save core details");
    } finally {
      setSavingCore(false);
    }
  };

  const handleSaveAbout = async () => {
    setSavingAbout(true);
    try {
      const res = await fetch(`/api/staff/clinic-profile${clinicParam}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ about: coreForm.about }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("About content updated");
    } catch {
      toast.error("Failed to save about content");
    } finally {
      setSavingAbout(false);
    }
  };

  const handleSaveLocation = async () => {
    setSavingLocation(true);
    try {
      const body = {
        ...locationForm,
        latitude: parseFloat(locationForm.latitude) || 0,
        longitude: parseFloat(locationForm.longitude) || 0,
      };
      const res = await fetch(`/api/staff/clinic-profile${clinicParam}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Location updated");
      await fetchData();
    } catch {
      toast.error("Failed to save location");
    } finally {
      setSavingLocation(false);
    }
  };

  const handleSaveExperience = async () => {
    setSavingExperience(true);
    try {
      const res = await fetch(`/api/staff/clinic-profile/experience${clinicParam}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parkingInstructions: parkingMd,
          visitInstructions: visitMd,
          faq: faqItems.filter((f) => f.q.trim() || f.a.trim()),
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Patient experience updated");
    } catch {
      toast.error("Failed to save patient experience");
    } finally {
      setSavingExperience(false);
    }
  };

  const handleSaveAmenities = async () => {
    setSavingAmenities(true);
    try {
      const res = await fetch(`/api/staff/clinic-profile/amenities${clinicParam}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amenityIds: selectedAmenityIds }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Amenities updated");
    } catch {
      toast.error("Failed to save amenities");
    } finally {
      setSavingAmenities(false);
    }
  };

  const handleFaqUpdate = (index: number, field: "q" | "a", value: string) => {
    setFaqItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleFaqAdd = () => {
    setFaqItems((prev) => [...prev, { q: "", a: "" }]);
  };

  const handleFaqRemove = (index: number) => {
    setFaqItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAmenityToggle = (amenityId: string) => {
    setSelectedAmenityIds((prev) =>
      prev.includes(amenityId)
        ? prev.filter((id) => id !== amenityId)
        : [...prev, amenityId]
    );
  };

  const handleGalleryUpload = () => {
    fetchData(); // Refresh to get new gallery URLs
  };

  const handleGalleryRemove = (url: string) => {
    if (!user) return;
    const clinicParamStr = getClinicParam(clinicId);
    fetch(`/api/staff/clinic-profile/media${clinicParamStr}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, type: "gallery" }),
    })
      .then((res) => {
        if (res.ok) {
          toast.success("Gallery image removed");
          fetchData();
        } else {
          toast.error("Failed to remove image");
        }
      })
      .catch(() => toast.error("Failed to remove image"));
  };

  const handleMediaUpdate = () => {
    fetchData();
  };

  // ---- Loading State ----
  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72 mt-2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // ---- Error State ----
  if (loadError) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertCircle className="size-8 text-destructive" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-lg">Failed to load profile</h3>
            <p className="text-muted-foreground text-sm mt-1 max-w-md">{loadError}</p>
          </div>
          <Button variant="outline" onClick={fetchData} className="gap-2">
            <RefreshCw className="size-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <SettingsBreadcrumb items={[{ label: "Settings" }, { label: "Clinic Profile" }]} />
      {/* ---- Card 1: Core Details ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="size-5 text-brand" />
            Core Details
          </CardTitle>
          <CardDescription>
            Basic information about your clinic that appears in search results and your public profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="clinic-name">Clinic Name</Label>
              <Input
                id="clinic-name"
                value={coreForm.name}
                onChange={(e) => setCoreForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="My Family Clinic"
                className="mt-1.5"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="clinic-tagline">Tagline / Short Summary</Label>
              <Input
                id="clinic-tagline"
                value={coreForm.tagline}
                onChange={(e) => setCoreForm((f) => ({ ...f, tagline: e.target.value }))}
                placeholder="Compassionate care for the whole family"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="clinic-phone">
                <Phone className="size-3.5 inline mr-1.5 -mt-0.5" />
                Phone
              </Label>
              <Input
                id="clinic-phone"
                value={coreForm.phoneNumber}
                onChange={(e) => setCoreForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                placeholder="(555) 123-4567"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="clinic-email">
                <Mail className="size-3.5 inline mr-1.5 -mt-0.5" />
                Email
              </Label>
              <Input
                id="clinic-email"
                type="email"
                value={coreForm.email}
                onChange={(e) => setCoreForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="contact@clinic.com"
                className="mt-1.5"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="clinic-website">
                <Globe className="size-3.5 inline mr-1.5 -mt-0.5" />
                Website
              </Label>
              <Input
                id="clinic-website"
                value={coreForm.website}
                onChange={(e) => setCoreForm((f) => ({ ...f, website: e.target.value }))}
                placeholder="https://www.myclinic.com"
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSaveCore}
              disabled={savingCore}
              className="bg-brand hover:bg-brand-hover text-white"
            >
              {savingCore ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Save className="size-4 mr-2" />
              )}
              Save Details
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ---- Card 2: About Content ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="size-5 text-brand" />
            About Content
          </CardTitle>
          <CardDescription>
            A detailed description of your clinic. Use rich formatting to make it informative and engaging.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RichTextEditor
            value={coreForm.about}
            onChange={(val) => setCoreForm((f) => ({ ...f, about: val }))}
            placeholder="Tell patients about your clinic's mission, values, and what makes you special..."
          />
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSaveAbout}
              disabled={savingAbout}
              className="bg-brand hover:bg-brand-hover text-white"
            >
              {savingAbout ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Save className="size-4 mr-2" />
              )}
              Save About
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ---- Card 3: Location ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="size-5 text-brand" />
            Location
          </CardTitle>
          <CardDescription>
            Your clinic&apos;s physical address and coordinates for mapping.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="street-address">Street Address</Label>
              <Input
                id="street-address"
                value={locationForm.streetAddress}
                onChange={(e) => setLocationForm((f) => ({ ...f, streetAddress: e.target.value }))}
                placeholder="123 Main Street, Suite 100"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={locationForm.city}
                onChange={(e) => setLocationForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Springfield"
                className="mt-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={locationForm.state}
                  onChange={(e) => setLocationForm((f) => ({ ...f, state: e.target.value }))}
                  placeholder="IL"
                  maxLength={2}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="zip">ZIP</Label>
                <Input
                  id="zip"
                  value={locationForm.zipCode}
                  onChange={(e) => setLocationForm((f) => ({ ...f, zipCode: e.target.value }))}
                  placeholder="62701"
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                value={locationForm.latitude}
                onChange={(e) => setLocationForm((f) => ({ ...f, latitude: e.target.value }))}
                placeholder="39.7817"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                value={locationForm.longitude}
                onChange={(e) => setLocationForm((f) => ({ ...f, longitude: e.target.value }))}
                placeholder="-89.6501"
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Interactive Map Preview */}
          {locationForm.latitude && locationForm.longitude && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <MapPin className="size-3.5 text-brand" />
                Map Preview
              </p>
              <ClinicLocationMap
                latitude={parseFloat(locationForm.latitude) || 0}
                longitude={parseFloat(locationForm.longitude) || 0}
                address={`${locationForm.streetAddress}, ${locationForm.city}, ${locationForm.state} ${locationForm.zipCode}`}
              />
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSaveLocation}
              disabled={savingLocation}
              className="bg-brand hover:bg-brand-hover text-white"
            >
              {savingLocation ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Save className="size-4 mr-2" />
              )}
              Save Location
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ---- Card 4: Media ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ImageIcon className="size-5 text-brand" />
            Media & Branding
          </CardTitle>
          <CardDescription>
            Upload your clinic logo, cover image, and gallery photos. Images are automatically cropped and optimized.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Logo */}
          <ImageCropUploader
            type="logo"
            aspectRatio={1}
            currentUrl={profile?.logoUrl || null}
            onUploaded={handleMediaUpdate}
            onRemoved={handleMediaUpdate}
            label="Clinic Logo"
          />

          <Separator />

          {/* Cover Image */}
          <ImageCropUploader
            type="cover"
            aspectRatio={16 / 9}
            currentUrl={profile?.coverImageUrl || null}
            onUploaded={handleMediaUpdate}
            onRemoved={handleMediaUpdate}
            label="Cover Image"
          />

          <Separator />

          {/* Gallery */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Gallery Images</Label>
              <ImageCropUploader
                type="gallery"
                aspectRatio={16 / 9}
                currentUrl={null}
                onUploaded={handleGalleryUpload}
                label=""
              />
            </div>

            {profile && profile.galleryUrls && profile.galleryUrls.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {profile.galleryUrls.map((url) => (
                  <div
                    key={url}
                    className="group relative aspect-video rounded-lg overflow-hidden border border-border"
                  >
                    <img
                      src={url}
                      alt="Gallery image"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <Button
                        variant="destructive"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity size-8"
                        onClick={() => handleGalleryRemove(url)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg">
                No gallery images yet. Upload your first one above.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ---- Card 5: Patient Experience ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Star className="size-5 text-brand" />
            Patient Experience
          </CardTitle>
          <CardDescription>
            Help patients know what to expect before they arrive — parking, arrival, FAQs, and amenities.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Parking Instructions */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <Car className="size-4 text-brand" />
              Parking Instructions
            </Label>
            <MarkdownEditor
              value={parkingMd}
              onChange={setParkingMd}
              placeholder="Describe parking options, validation, garage info..."
            />
          </div>

          <Separator />

          {/* Visit / Arrival Instructions */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <Footprints className="size-4 text-brand" />
              Visit / Arrival Instructions
            </Label>
            <MarkdownEditor
              value={visitMd}
              onChange={setVisitMd}
              placeholder="Check-in process, what to bring, where to go..."
            />
          </div>

          <Separator />

          {/* FAQ */}
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <HelpCircle className="size-4 text-brand" />
              Frequently Asked Questions
            </Label>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {faqItems.map((item, idx) => (
                <FaqItem
                  key={idx}
                  item={item}
                  index={idx}
                  onUpdate={handleFaqUpdate}
                  onRemove={() => handleFaqRemove(idx)}
                />
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleFaqAdd}
              className="w-full border-dashed"
            >
              <Plus className="size-4 mr-2" />
              Add FAQ
            </Button>
          </div>

          <Separator />

          {/* Amenities */}
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <Star className="size-4 text-brand" />
              Amenities
            </Label>
            {experience && experience.allAmenities.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-64 overflow-y-auto pr-1">
                {experience.allAmenities.map((amenity) => (
                  <label
                    key={amenity.id}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      selectedAmenityIds.includes(amenity.id)
                        ? "border-brand bg-brand-muted "
                        : "border-border hover:border-brand-border"
                    }`}
                  >
                    <Checkbox
                      checked={selectedAmenityIds.includes(amenity.id)}
                      onCheckedChange={() => handleAmenityToggle(amenity.id)}
                    />
                    <span className="text-sm">{amenity.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No amenities configured in the system yet.
              </p>
            )}
          </div>

          {/* Languages (read-only display) */}
          {experience && experience.allLanguages.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Languages className="size-4 text-brand" />
                  Languages Spoken by Providers
                </Label>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {experience.providerLanguageMap.map((pl) => (
                    <div
                      key={pl.providerId}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border"
                    >
                      <span className="text-sm font-medium min-w-[120px] pt-0.5">
                        {pl.providerName}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {pl.languageIds.length > 0 ? (
                          pl.languageIds.map((langId) => {
                            const lang = experience.allLanguages.find(
                              (l) => l.id === langId
                            );
                            return lang ? (
                              <Badge
                                key={langId}
                                variant="secondary"
                                className="text-xs"
                              >
                                {lang.name}
                              </Badge>
                            ) : null;
                          })
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No languages assigned
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Provider languages can be managed from the Providers settings tab.
                </p>
              </div>
            </>
          )}

          {/* Save Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={handleSaveExperience}
              disabled={savingExperience}
              className="bg-brand hover:bg-brand-hover text-white"
            >
              {savingExperience ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Save className="size-4 mr-2" />
              )}
              Save Experience
            </Button>
            <Button
              onClick={handleSaveAmenities}
              disabled={savingAmenities}
              variant="outline"
            >
              {savingAmenities ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Star className="size-4 mr-2" />
              )}
              Save Amenities
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}