"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2, QrCode, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

/**
 * Fetches the check-in QR image for an appointment with the caller's bearer token
 * and shows it in a modal. The QR encodes a link to /check-in?id=<appointmentId>.
 */
export default function CheckInQr({ appointmentId }: { appointmentId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setLoading(true);
    setError("");
    setSrc(null);
    (async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        const token = sessionError ? null : data.session?.access_token ?? null;
        if (!token) throw new Error("Your session has expired. Please sign in again.");
        const base = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
        const response = await fetch(`${base}/api/appointments/${appointmentId}/qr`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(typeof data?.message === "string" && data.message.trim()
            ? data.message
            : "The QR code could not be loaded.");
        }
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "The QR code could not be loaded.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, appointmentId, user?.id]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-primary/25 px-3 text-xs font-semibold text-primary transition hover:bg-accent-surface"
      >
        <QrCode size={14} aria-hidden="true" />
        Check-in QR
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-dialog-title"
        >
          <div className="w-full max-w-xs rounded-2xl border border-primary/20 bg-surface p-6 text-center shadow-xl">
            <div className="flex items-center justify-between">
              <h2 id="qr-dialog-title" className="text-lg font-bold">Check-in QR</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-background"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mt-4 flex min-h-[220px] items-center justify-center">
              {loading && <Loader2 className="animate-spin text-primary" size={36} aria-label="Loading QR" />}
              {error && (
                <div role="alert" className="text-sm text-error">
                  <p>{error}</p>
                  <button type="button" onClick={() => setOpen(false)} className="mt-2 min-h-9 text-primary underline">Close</button>
                </div>
              )}
              {src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="Check-in QR code. Scanning it opens the clinic check-in page." width={240} height={240} className="rounded-xl border border-primary/15" />
              )}
            </div>
            <p className="mt-4 text-xs text-neutral-600">
              Show this at reception when you arrive. It opens the clinic check-in page for you.
            </p>
            {src && (
              <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-success">
                <CheckCircle2 size={13} aria-hidden="true" /> Ready to scan
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
