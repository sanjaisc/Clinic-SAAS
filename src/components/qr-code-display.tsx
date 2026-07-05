"use client";

import { useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";
import { QrCode, Download, Copy, Check, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface QrCodeDisplayProps {
  appointmentId: string;
  patientName?: string;
  /** If provided, generates QR client-side from this URL (no API call needed) */
  manageUrl?: string;
}

interface QrData {
  qrDataUrl: string;
  appointmentId: string;
  patientName: string;
}

export function QrCodeDisplay({ appointmentId, patientName, manageUrl }: QrCodeDisplayProps) {
  const [qrData, setQrData] = useState<QrData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch or generate QR code
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    if (manageUrl) {
      // Client-side QR generation (patient mode)
      QRCode.toDataURL(manageUrl, {
        width: 280,
        margin: 2,
        color: {
          dark: "#065f46",
          light: "#ffffff",
        },
        errorCorrectionLevel: "M",
      })
        .then((dataUrl) => {
          if (!cancelled) {
            setQrData({
              qrDataUrl: dataUrl,
              appointmentId,
              patientName: patientName || "Patient",
            });
          }
        })
        .catch(() => {
          if (!cancelled) setError("Failed to generate QR code");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      // Server-side QR generation via API (staff mode)
      (async () => {
        try {
          const res = await fetch(`/api/qr/${appointmentId}`);
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Failed to generate QR code");
          }
          const data: QrData = await res.json();
          if (!cancelled) setQrData(data);
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Failed to generate QR code");
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }

    return () => { cancelled = true; };
  }, [appointmentId, patientName, manageUrl]);

  const handleDownload = useCallback(() => {
    if (!qrData) return;
    const link = document.createElement("a");
    link.download = `qr-appointment-${qrData.appointmentId}.png`;
    link.href = qrData.qrDataUrl;
    link.click();
    toast.success("QR code downloaded");
  }, [qrData]);

  const handleCopyLink = useCallback(async () => {
    const url = manageUrl || (typeof window !== "undefined" ? window.location.href : "");
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Management link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  }, [manageUrl]);

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <Card className="border-emerald-200 bg-white">
        <CardContent className="p-6 flex flex-col items-center gap-4">
          <Skeleton className="size-48 rounded-lg" />
          <Skeleton className="h-4 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- Error state ----
  if (error || !qrData) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="size-5 text-red-500" />
          </div>
          <p className="text-sm text-red-700 font-medium">
            {error || "QR code unavailable"}
          </p>
          <p className="text-xs text-red-600/70">
            A valid management token is required to generate a QR code.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ---- QR code display ----
  return (
    <Card className="border-emerald-200 bg-white">
      <CardContent className="p-6 flex flex-col items-center gap-4">
        {/* QR Code Image */}
        <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-sm">
          <img
            src={qrData.qrDataUrl}
            alt="Appointment QR Code"
            className="size-48 sm:size-56"
            width={224}
            height={224}
          />
        </div>

        {/* Patient name */}
        {qrData.patientName && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <QrCode className="size-4 text-emerald-600" />
            <span>
              {qrData.patientName}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 w-full max-w-xs">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 cursor-pointer"
            onClick={handleDownload}
          >
            {copied ? (
              <Check className="size-4 mr-1.5" />
            ) : (
              <Download className="size-4 mr-1.5" />
            )}
            Download QR
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 cursor-pointer"
            onClick={handleCopyLink}
          >
            {copied ? (
              <Check className="size-4 mr-1.5" />
            ) : (
              <Copy className="size-4 mr-1.5" />
            )}
            {copied ? "Copied!" : "Copy Link"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}