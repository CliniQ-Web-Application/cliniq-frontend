"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, LogIn, Stethoscope } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  createBookingApi, parseBookingConfirmation, BookingRequestError,
  type BookingConfirmation,
} from "@/lib/booking";
import type { StaffAppointment } from "@/lib/staff";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const errorMessage = (cause: unknown, fallback: string) =>
  cause instanceof BookingRequestError ? cause.message : fallback;

const STATUS_TEXT: Record<string, string> = {
  BOOKED: "This appointment is booked but not checked in yet.",
  CHECKEDIN: "Checked in. Please take a seat.",
  WAITING: "You are in the waiting queue. Please take a seat.",
  INCONSULTATION: "You are in consultation.",
  COMPLETED: "This appointment is complete.",
  CANCELLED: "This appointment was cancelled.",
  NOSHOW: "This appointment was marked as a no-show.",
};

export default function CheckInPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-background"><p role="status">Loading...</p></main>}>
      <CheckInContent />
    </Suspense>
  );
}

function CheckInContent() {
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get("id") ?? "";
  const { user, profile, role, loading } = useAuth();

  if (!UUID.test(appointmentId)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-8">
        <p role="alert">This check-in link is invalid. Ask reception for assistance.</p>
      </main>
    );
  }
  if (!user || !role || !profile || profile.id !== user.id) {
    const redirect = encodeURIComponent(`/check-in?id=${appointmentId}`);
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="w-full max-w-md rounded-2xl border border-primary/20 bg-surface p-8 text-center shadow-sm">
          <LogIn className="mx-auto mb-4 text-primary" size={32} aria-hidden="true" />
          <h1 className="text-xl font-bold">Sign in to check in</h1>
          <p className="mt-2 text-sm text-neutral-600">
            {loading
              ? "Checking your session..."
              : "Sign in with the account this appointment belongs to (patients or clinic staff) to complete check-in."}
          </p>
          {!loading && (
            <Link href={`/auth/signin?redirect=${redirect}`} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:opacity-90">
              <LogIn size={16} aria-hidden="true" /> Sign in
            </Link>
          )}
        </div>
      </main>
    );
  }
  return <CheckIn key={user.id} user={user} role={role} appointmentId={appointmentId} />;
}

function CheckIn({ user, role, appointmentId }: { user: User; role: string; appointmentId: string }) {
  const isPatient = role === "PATIENT";
  const [appointment, setAppointment] = useState<BookingConfirmation | StaffAppointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkingIn, setCheckingIn] = useState(false);
  const [done, setDone] = useState("");
  const lifetime = useRef<AbortController | null>(null);
  const userId = user.id;

  const api = useMemo(() => createBookingApi({
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    getToken: async () => {
      const { data, error } = await supabase.auth.getSession();
      return !error && data.session?.user.id === userId ? data.session.access_token : null;
    },
    refreshToken: async () => {
      const { data, error } = await supabase.auth.refreshSession();
      return !error && data.session?.user.id === userId ? data.session.access_token : null;
    },
  }), [userId]);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      if (isPatient) {
        const data = await api(`/bookings/${appointmentId}`, { signal });
        if (signal.aborted) return;
        setAppointment(parseBookingConfirmation(data));
      } else {
        const data = await api(`/appointments/${appointmentId}`, { signal }) as StaffAppointment | null;
        if (signal.aborted) return;
        setAppointment(data);
      }
    } catch (cause) {
      if (!signal.aborted) setError(errorMessage(cause, "Could not load the appointment. Please retry."));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [api, appointmentId, isPatient]);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  async function checkIn() {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted || checkingIn || !appointment) return;
    if (appointment.appointmentStatus !== "BOOKED") return;
    setCheckingIn(true);
    setError("");
    setDone("");
    try {
      await api(`/appointments/${appointmentId}/check-in`, { method: "POST", signal });
      await load(signal);
      setDone("You're checked in. Please take a seat — the clinic will call you.");
    } catch (cause) {
      if (!signal.aborted) setError(errorMessage(cause, "Check-in failed. Please try again or ask reception."));
    } finally {
      if (!signal.aborted) setCheckingIn(false);
    }
  }

  const status = appointment?.appointmentStatus ?? "";
  const title = isPatient
    ? (appointment ? `Appointment${bookedTime(appointment) ? ` at ${bookedTime(appointment)}` : ""}` : "Check in")
    : appointment
      ? `${(appointment as StaffAppointment).patient?.patientName ?? ""} ${(appointment as StaffAppointment).patient?.patientSurname ?? ""}`.trim() || "Appointment"
      : "Check in";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-primary/20 bg-surface p-8 text-center shadow-sm">
        <Stethoscope className="mx-auto mb-4 text-primary" size={32} aria-hidden="true" />
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-xs text-neutral-500 break-all">Appointment ID: {appointmentId}</p>
        {loading && <p role="status" className="mt-4">Loading appointment...</p>}
        {error && <div role="alert" className="mt-4 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error"><p>{error}</p></div>}
        {appointment && (
          <>
            <p className="mt-4 rounded-xl bg-background p-4 text-sm">
              {summary(appointment)}
              <br /><br />
              <span className="font-semibold">{STATUS_TEXT[status] ?? status}</span>
            </p>
            {status === "BOOKED" && (
              <button
                type="button"
                onClick={() => void checkIn()}
                disabled={checkingIn}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 size={18} aria-hidden="true" />
                {checkingIn ? "Checking in..." : "Check in now"}
              </button>
            )}
            {done && <p role="status" className="mt-3 text-sm font-medium text-success">{done}</p>}
          </>
        )}
        <p className="mt-5 text-xs text-neutral-500">
          {role === "PATIENT"
            ? "Signed in as the patient for this appointment."
            : "Staff scan — checking the patient in on their behalf."}{" "}
          <Link href={role === "PATIENT" ? "/patient" : role === "STAFF" ? "/staff" : "/admin"} className="text-primary underline">
            Back to portal
          </Link>
        </p>
      </div>
    </main>
  );
}

function bookedTime(appointment: BookingConfirmation | StaffAppointment): string {
  if ("slot" in appointment) {
    return (appointment as StaffAppointment).slot?.startTime?.slice(0, 5) ?? "";
  }
  return String((appointment as BookingConfirmation).startTime ?? "").slice(0, 5);
}

function summary(appointment: BookingConfirmation | StaffAppointment): string {
  if ("slot" in appointment) {
    const s = (appointment as StaffAppointment).slot;
    const d = s?.slotDate ?? "—";
    const time = s ? `${String(s.startTime).slice(0, 5)} – ${String(s.endTime).slice(0, 5)}` : "Walk-in";
    return `${d} · ${time} (clinic time)`;
  }
  const b = appointment as BookingConfirmation;
  return `${b.slotDate} · ${String(b.startTime).slice(0, 5)} – ${String(b.endTime).slice(0, 5)} (clinic time) · ${b.departmentName ?? "Department"} · ${b.doctorName}`;
}
