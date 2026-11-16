"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import QRCode from "qrcode";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, QrCode, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { BookingRequestError, createBookingApi, parseBookingConfirmation, type BookingConfirmation } from "@/lib/booking";
import { appointmentStatusPresentation } from "@/lib/appointment-status";
import SessionExpiredAction from "@/components/auth/SessionExpiredAction";

const qrPayload = (appointmentId: string) => JSON.stringify({ type: "CLINIQ_CHECK_IN", appointmentId });

function requestError(cause: unknown) {
  if (cause instanceof BookingRequestError && cause.status === 401) return "Your session expired. Sign in again to prepare for check-in.";
  if (cause instanceof BookingRequestError && cause.status === 403) return "QR check-in is available to patient accounts. Sign in with your patient account.";
  return cause instanceof Error ? cause.message : "Could not load your appointments. Please try again.";
}

export default function PatientCheckInPage() {
  const { user, profile, role, session, loading } = useAuth();
  if (user && profile?.id === user.id && role === "PATIENT" && session?.user.id === user.id) {
    return <PatientCheckIn key={user.id} user={user} />;
  }
  return <main className="min-h-screen bg-background p-8">{loading ? <p role="status">Checking your patient session...</p> : <p>Patient sign-in is required. <Link href="/auth/signin" className="text-primary underline">Sign in</Link></p>}</main>;
}

function PatientCheckIn({ user }: { user: User }) {
  const [bookings, setBookings] = useState<BookingConfirmation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [qrLoading, setQrLoading] = useState(false);
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const api = useMemo(() => createBookingApi({
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    getToken: async () => {
      const { data, error: authError } = await supabase.auth.getSession();
      return !authError && data.session?.user.id === user.id ? data.session.access_token : null;
    },
    refreshToken: async () => {
      const { data, error: authError } = await supabase.auth.refreshSession();
      return !authError && data.session?.user.id === user.id ? data.session.access_token : null;
    },
  }), [user.id]);

  const loadBookings = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const data = await api("/bookings", { signal });
      if (!Array.isArray(data)) throw new Error("The clinic returned an unexpected appointments response.");
      const list = data.map(parseBookingConfirmation);
      if (!signal.aborted) {
        setBookings(list);
        setSelectedId((current) => current && list.some((item) => item.appointmentId === current)
          ? current
          : list.find((item) => item.appointmentStatus.toUpperCase() === "BOOKED")?.appointmentId ?? "");
      }
    } catch (cause) {
      if (!signal.aborted) setError(requestError(cause));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    queueMicrotask(() => { if (!controller.signal.aborted) void loadBookings(controller.signal); });
    return () => controller.abort();
  }, [loadBookings]);

  const selected = bookings.find((booking) => booking.appointmentId === selectedId);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setQrImage(""); });
    if (!selected || selected.appointmentStatus.toUpperCase() !== "BOOKED") return () => { cancelled = true; };
    queueMicrotask(() => { if (!cancelled) setQrLoading(true); });
    void QRCode.toDataURL(qrPayload(selected.appointmentId), { errorCorrectionLevel: "M", margin: 2, width: 280 })
      .then((image) => { if (!cancelled) setQrImage(image); })
      .catch(() => { if (!cancelled) setError("Could not prepare your check-in QR code. Please select the appointment again."); })
      .finally(() => { if (!cancelled) setQrLoading(false); });
    return () => { cancelled = true; };
  }, [selected]);

  const retry = () => {
    const controller = controllerRef.current;
    if (controller && !controller.signal.aborted) void loadBookings(controller.signal);
  };

  return <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
    <div className="mx-auto w-full max-w-2xl">
      <Link href="/patient" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowLeft size={18} aria-hidden="true" /> Back to patient portal</Link>
      <header className="mb-8 mt-8">
        <QrCode className="mb-3 text-primary" size={30} aria-hidden="true" />
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Clinic arrival</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Check in with QR</h1>
        <p className="mt-3 text-neutral-600">Choose a booked appointment and show its QR code to clinic staff. Staff will scan it to record your arrival.</p>
      </header>
      {error && <div role="alert" className="mb-5 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error">{error}<SessionExpiredAction message={error} returnTo="/patient/check-in" /><button type="button" disabled={loading} onClick={retry} className="ml-2 underline">Retry</button></div>}
      <section aria-busy={loading} className="space-y-4 rounded-2xl border border-primary/15 bg-surface p-5 shadow-sm sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Your appointments</h2>
          <button type="button" onClick={retry} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-primary/25 px-3 text-sm font-semibold text-primary disabled:opacity-50"><RefreshCw size={15} aria-hidden="true" /> Refresh</button>
        </div>
        {loading && <p role="status" className="text-sm text-neutral-600">Loading your appointments...</p>}
        {!loading && !error && bookings.length === 0 && <p role="status" className="text-sm text-neutral-600">No appointments found. <Link href="/patient/book-appointment" className="text-primary underline">Book an appointment</Link>.</p>}
        {bookings.length > 0 && <label className="block text-sm font-semibold">Select an appointment
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm">
            <option value="">Choose an appointment</option>
            {bookings.map((booking) => <option key={booking.appointmentId} value={booking.appointmentId}>{booking.slotDate} · {booking.startTime.slice(0, 5)} · {booking.departmentName ?? booking.doctorName} · {appointmentStatusPresentation(booking.appointmentStatus).label}</option>)}
          </select>
        </label>}
        {selected && selected.appointmentStatus.toUpperCase() === "BOOKED" && <div className="rounded-xl border border-primary/10 bg-background p-4 text-center">
          <p className="font-semibold">{selected.departmentName ?? "Clinic appointment"} · Dr. {selected.doctorName}</p>
          <p className="mt-1 text-sm text-neutral-600">{selected.slotDate} · {selected.startTime.slice(0, 5)} (clinic time)</p>
          {qrLoading && <p role="status" className="mt-4">Preparing your QR code...</p>}
          {qrImage && <div className="mx-auto mt-4 w-fit rounded-xl bg-white p-3"><Image src={qrImage} alt={`Check-in QR code for appointment ${selected.appointmentId}`} width={280} height={280} unoptimized /></div>}
          <p className="mt-3 text-sm text-neutral-700">Keep this code on your screen and show it to clinic staff. It contains your appointment reference only.</p>
          <p className="mt-2 break-all font-mono text-xs text-neutral-500">Appointment ID: {selected.appointmentId}</p>
        </div>}
        {selected && selected.appointmentStatus.toUpperCase() !== "BOOKED" && <p role="status" className="rounded-lg bg-accent-surface p-4 text-sm text-primary">{appointmentStatusPresentation(selected.appointmentStatus).description}</p>}
      </section>
    </div>
  </main>;
}
