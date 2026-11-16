"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { ArrowLeft, Clock3, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { BookingRequestError, createBookingApi, parseBookingConfirmation, type BookingConfirmation } from "@/lib/booking";
import { appointmentStatusPresentation } from "@/lib/appointment-status";
import { hasActiveQueue, readQueue, type QueueSnapshot } from "@/lib/queue";
import SessionExpiredAction from "@/components/auth/SessionExpiredAction";


function friendlyError(cause: unknown) {
  if (cause instanceof BookingRequestError && cause.status === 401) return "Your session expired. Sign in again to view your queue.";
  if (cause instanceof BookingRequestError && cause.status === 403) return "Queue tracking is available to patient accounts. Sign in with your patient account.";
  return cause instanceof Error ? cause.message : "Could not load your queue. Please try again.";
}

export default function QueueTrackingPage() {
  const { user, profile, role, session, loading } = useAuth();
  if (user && profile?.id === user.id && role === "PATIENT" && session?.user.id === user.id) {
    return <QueueTracking key={user.id} user={user} />;
  }
  return <main className="min-h-screen bg-background p-8">{loading ? <p role="status">Checking your patient session...</p> : <p>Patient sign-in is required. <Link href="/auth/signin" className="text-primary underline">Sign in</Link></p>}</main>;
}

function QueueTracking({ user }: { user: User }) {
  const [bookings, setBookings] = useState<BookingConfirmation[]>([]);
  const [queues, setQueues] = useState<QueueSnapshot[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
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

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (inFlight.current || signal?.aborted) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api("/bookings", { signal });
      if (!Array.isArray(result)) throw new Error("The clinic returned an unexpected appointments response.");
      const list = result.map(parseBookingConfirmation);
      if (signal?.aborted) return;
      setBookings(list);
      const snapshots = await Promise.all(list.map(async (booking) => {
        if (!hasActiveQueue(booking.appointmentStatus)) return readQueue({}, booking);
        try {
          const data = await api(`/appointments/${encodeURIComponent(booking.appointmentId)}/queue-position`, { signal });
          return readQueue(data, booking);
        } catch (cause) {
          return { appointmentId: booking.appointmentId, queuePosition: null, queueStatus: booking.appointmentStatus.toUpperCase(), estimatedWaitMinutes: null, error: friendlyError(cause) };
        }
      }));
      if (!signal?.aborted) setQueues(snapshots);
    } catch (cause) {
      if (!signal?.aborted) setError(friendlyError(cause));
    } finally {
      inFlight.current = false;
      if (!signal?.aborted) setBusy(false);
    }
  }, [api]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) void refresh(controller.signal); });
    const interval = window.setInterval(() => void refresh(controller.signal), 30_000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [refresh]);

  const live = queues.some((item) => hasActiveQueue(item.queueStatus));
  const queueById = new Map(queues.map((item) => [item.appointmentId, item]));

  return <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
    <div className="mx-auto w-full max-w-3xl">
      <Link href="/patient" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowLeft size={18} aria-hidden="true" /> Back to patient portal</Link>
      <header className="mb-8 mt-8">
        <Clock3 className="mb-3 text-primary" size={30} aria-hidden="true" />
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Patient queue</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Track your place in the queue</h1>
        <p className="mt-3 text-neutral-600">Queue details refresh every 30 seconds while you wait. Wait estimates are approximate and may change when urgent patients arrive.</p>
      </header>
      <button type="button" disabled={busy} onClick={() => void refresh()} className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw size={16} aria-hidden="true" />{busy ? "Refreshing queue..." : "Refresh queue"}</button>
      {error && <div role="alert" className="mb-5 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error">{error}<SessionExpiredAction message={error} returnTo="/patient/queue-tracking" /></div>}
      {!busy && !error && bookings.length === 0 && <p role="status" className="rounded-xl border border-primary/15 bg-surface p-5">No appointments found on your account.</p>}
      <section aria-label="Appointment queue positions" aria-live="polite" aria-busy={busy} className="space-y-4">
        {bookings.map((booking) => {
          const queue = queueById.get(booking.appointmentId);
          const status = queue?.queueStatus ?? booking.appointmentStatus.toUpperCase();
          const presentation = appointmentStatusPresentation(status);
          const normalizedStatus = status.trim().toUpperCase().replace(/[\s-]+/g, "_");
          const done = ["COMPLETED", "CANCELLED", "NOSHOW", "NO_SHOW"].includes(normalizedStatus);
          return <article key={booking.appointmentId} className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-lg font-bold">{booking.departmentName ?? "Appointment"}</h2><p className="text-sm text-neutral-600">Dr. {booking.doctorName} · {booking.slotDate} · {booking.startTime.slice(0, 5)} (clinic time)</p></div>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${presentation.className}`}>{presentation.label}</span>
            </div>
            <div className="mt-5 grid gap-4 border-t border-primary/10 pt-4 sm:grid-cols-2">
              <div><p className="text-sm text-neutral-500">Queue position</p><p className="mt-1 text-2xl font-bold text-primary">{queue?.queuePosition ? `#${queue.queuePosition}` : done || status === "INCONSULTATION" ? "—" : status === "BOOKED" ? "Not checked in" : "Unavailable"}</p></div>
              <div><p className="text-sm text-neutral-500">Estimated wait</p><p className="mt-1 text-lg font-semibold">{done || status === "INCONSULTATION" ? "—" : queue?.estimatedWaitMinutes == null ? "Not available" : `${queue.estimatedWaitMinutes} min`}</p></div>
            </div>
            <p className="mt-4 text-sm text-neutral-700">{presentation.description}</p>
            {queue?.error && <p role="status" className="mt-3 text-sm text-neutral-600">Queue details are temporarily unavailable. {queue.error}<SessionExpiredAction message={queue.error} returnTo="/patient/queue-tracking" /></p>}
            <Link href={`/patient/appointments/${encodeURIComponent(booking.appointmentId)}`} className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-primary underline">View appointment details</Link>
          </article>;
        })}
      </section>
      {live && <p className="mt-5 text-xs text-neutral-500">Automatic refresh is on. Last checked: {busy ? "updating" : "just now"}.</p>}
    </div>
  </main>;
}
