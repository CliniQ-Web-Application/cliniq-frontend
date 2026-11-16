"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock3, Stethoscope } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { BookingRequestError, createBookingApi } from "@/lib/booking";
import { appointmentStatusPresentation } from "@/lib/appointment-status";
import SessionExpiredAction from "@/components/auth/SessionExpiredAction";

type AppointmentDetails = {
  id: string;
  status: string;
  slotDate: string;
  appointmentTime: string;
  startTime: string;
  endTime: string;
  doctor: string;
  department: string;
  bookedAt: string;
  checkedInAt: string;
  calledAt: string;
  completedAt: string;
  priority: string;
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function appointmentDetails(value: unknown, appointmentId: string): AppointmentDetails {
  const root = object(value);
  const data = object(root.appointment ?? root);
  const slot = object(data.slot);
  const staff = object(data.staff ?? data.doctor);
  const department = object(data.department ?? staff.department);
  const fullName = [asText(staff.firstName), asText(staff.lastName)].filter(Boolean).join(" ");
  return {
    id: asText(data.appointmentId) || appointmentId,
    status: asText(data.appointmentStatus ?? data.status) || "UNKNOWN",
    slotDate: asText(data.slotDate ?? slot.slotDate),
    appointmentTime: asText(data.appointmentTime),
    startTime: asText(data.startTime ?? slot.startTime),
    endTime: asText(data.endTime ?? slot.endTime),
    doctor: asText(data.doctorName) || (fullName ? `Dr. ${fullName}` : "Doctor details unavailable"),
    department: asText(data.departmentName ?? department.name) || "Department details unavailable",
    bookedAt: asText(data.bookedAt ?? data.createdAt),
    checkedInAt: asText(data.checkInTime ?? data.checkedInAt),
    calledAt: asText(data.calledTime ?? data.calledAt),
    completedAt: asText(data.completedTime ?? data.completedAt),
    priority: asText(data.priority),
  };
}

function dateTime(value: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function requestError(cause: unknown) {
  if (cause instanceof BookingRequestError && cause.status === 401) return "Your session expired. Sign in again to view this appointment.";
  if (cause instanceof BookingRequestError && cause.status === 403) return "This appointment is not available to your account.";
  if (cause instanceof BookingRequestError && cause.status === 404) return "This appointment could not be found on your account.";
  return cause instanceof Error ? cause.message : "Could not load appointment details. Please try again.";
}

export default function AppointmentDetail({ appointmentId }: { appointmentId: string }) {
  const { user, profile, role, session, loading } = useAuth();
  if (user && profile?.id === user.id && role === "PATIENT" && session?.user.id === user.id) {
    return <AppointmentDetailContent key={`${user.id}-${appointmentId}`} user={user} appointmentId={appointmentId} />;
  }
  return <main className="min-h-screen bg-background p-8">{loading ? <p role="status">Checking your patient session...</p> : <p>Patient sign-in is required. <Link href="/auth/signin" className="text-primary underline">Sign in</Link></p>}</main>;
}

function AppointmentDetailContent({ user, appointmentId }: { user: User; appointmentId: string }) {
  const [details, setDetails] = useState<AppointmentDetails | null>(null);
  const [busy, setBusy] = useState(true);
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

  const load = useCallback(async (signal: AbortSignal) => {
    setBusy(true);
    setError("");
    try {
      const data = await api(`/bookings/${encodeURIComponent(appointmentId)}`, { signal });
      const result = appointmentDetails(data, appointmentId);
      if (!signal.aborted) setDetails(result);
    } catch (cause) {
      if (!signal.aborted) setError(requestError(cause));
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  }, [api, appointmentId]);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); });
    return () => controller.abort();
  }, [load]);

  const retry = () => {
    const controller = controllerRef.current;
    if (controller && !controller.signal.aborted) void load(controller.signal);
  };
  const status = details ? appointmentStatusPresentation(details.status) : null;

  return <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
    <div className="mx-auto w-full max-w-3xl">
      <Link href="/patient/appointments" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowLeft size={18} aria-hidden="true" /> Back to my appointments</Link>
      <header className="mb-8 mt-8">
        <CalendarDays className="mb-3 text-primary" size={30} aria-hidden="true" />
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Appointment details</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Your appointment</h1>
      </header>
      {busy && <p role="status" className="mb-4">Loading appointment details...</p>}
      {error && <div role="alert" className="mb-5 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error">{error}<SessionExpiredAction message={error} returnTo={`/patient/appointments/${encodeURIComponent(appointmentId)}`} /><button type="button" disabled={busy} onClick={retry} className="ml-2 underline">Retry</button></div>}
      {details && <article aria-busy={busy} className="rounded-2xl border border-primary/15 bg-surface p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-primary/10 pb-5">
          <div><p className="text-sm text-neutral-500">Appointment ID</p><p className="mt-1 break-all font-semibold">{details.id}</p></div>
          {status && <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${status.className}`}>{status.label}</span>}
        </div>
        {status && <p className="border-b border-primary/10 py-4 text-sm text-neutral-700">{status.description}</p>}
        <section aria-label="Appointment schedule" className="grid gap-5 border-b border-primary/10 py-5 sm:grid-cols-2">
          <div className="flex gap-3"><CalendarDays className="mt-0.5 shrink-0 text-primary" size={19} aria-hidden="true" /><div><p className="text-sm text-neutral-500">Date</p><p className="mt-1 font-semibold">{details.slotDate || "Not available"}</p></div></div>
          <div className="flex gap-3"><Clock3 className="mt-0.5 shrink-0 text-primary" size={19} aria-hidden="true" /><div><p className="text-sm text-neutral-500">Appointment time</p><p className="mt-1 font-semibold">{details.appointmentTime ? details.appointmentTime.slice(0, 5) : details.startTime ? `${details.startTime.slice(0, 5)} – ${details.endTime.slice(0, 5)}` : "—"} <span className="text-xs font-normal text-neutral-500">(clinic time)</span></p></div></div>
          <div className="flex gap-3"><Stethoscope className="mt-0.5 shrink-0 text-primary" size={19} aria-hidden="true" /><div><p className="text-sm text-neutral-500">Doctor</p><p className="mt-1 font-semibold">{details.doctor}</p></div></div>
          <div><p className="text-sm text-neutral-500">Department</p><p className="mt-1 font-semibold">{details.department}</p></div>
        </section>
        <section aria-label="Appointment activity" className="pt-5">
          <h2 className="font-bold">Appointment activity</h2>
          <dl className="mt-3 grid gap-4 sm:grid-cols-2">
            <div><dt className="text-sm text-neutral-500">Booked</dt><dd className="mt-1 text-sm font-medium">{dateTime(details.bookedAt)}</dd></div>
            {details.checkedInAt && <div><dt className="text-sm text-neutral-500">Checked in</dt><dd className="mt-1 text-sm font-medium">{dateTime(details.checkedInAt)}</dd></div>}
            {details.calledAt && <div><dt className="text-sm text-neutral-500">Called for consultation</dt><dd className="mt-1 text-sm font-medium">{dateTime(details.calledAt)}</dd></div>}
            {details.completedAt && <div><dt className="text-sm text-neutral-500">Completed</dt><dd className="mt-1 text-sm font-medium">{dateTime(details.completedAt)}</dd></div>}
            {details.priority && <div><dt className="text-sm text-neutral-500">Priority</dt><dd className="mt-1 text-sm font-medium">{details.priority.replaceAll("_", " ")}</dd></div>}
          </dl>
        </section>
        {details.status.trim().toUpperCase().replace(/[\s-]+/g, "_") === "WAITING" && <p className="mt-5 rounded-lg bg-accent-surface p-4 text-sm text-primary">View your <Link href="/patient/queue-tracking" className="font-semibold underline">queue position</Link>.</p>}
      </article>}
    </div>
  </main>;
}
