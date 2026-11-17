"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import SessionExpiredAction from "@/components/auth/SessionExpiredAction";
import { BookingRequestError, createBookingApi } from "@/lib/booking";
import { supabase } from "@/lib/supabase";

function requestMessage(cause: unknown) {
  if (cause instanceof BookingRequestError && cause.status === 401) return "Your session has expired. Sign in again to reload your patient profile.";
  if (cause instanceof BookingRequestError && cause.status === 403) return "This page is for patient accounts. Sign in with your patient account.";
  if (cause instanceof BookingRequestError && cause.status === 404) return "Your patient profile has not been created yet. Complete it from the patient portal.";
  return cause instanceof Error ? cause.message : "Could not load your patient profile. Please try again.";
}

export default function PatientsPage() {
  const { user, profile, role, session, loading: authLoading } = useAuth();
  if (user && profile?.id === user.id && role === "PATIENT" && session?.user.id === user.id) return <PatientRecord user={user} />;
  return <main className="min-h-screen bg-background p-8">{authLoading ? <p role="status">Checking your patient session...</p> : <p>Patient sign-in is required. <Link href="/auth/signin" className="text-primary underline">Sign in</Link></p>}</main>;
}

function PatientRecord({ user }: { user: User }) {
  const [patient, setPatient] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    setError("");
    try {
      const data = await api("/patients/me", { signal });
      if (!signal.aborted) setPatient(data);
    } catch (cause) {
      if (!signal.aborted) setError(requestMessage(cause));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [api]);
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

  return <main className="min-h-screen bg-background p-8">
    <div className="mx-auto max-w-3xl">
      <Link href="/patient" className="text-sm font-semibold text-primary underline">Back to patient portal</Link>
      <h1 className="mt-6 text-3xl font-bold">My patient record</h1>
      {loading && <p role="status" className="mt-4">Loading your profile...</p>}
      {error && <div role="alert" className="mt-4 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error">{error}<SessionExpiredAction message={error} returnTo="/patientTest" />{!/session (?:has )?expired/i.test(error) && <button type="button" disabled={loading} onClick={retry} className="ml-2 underline">Retry</button>}{error.includes("has not been created") && <Link href="/patient/profile" className="ml-2 underline">Open profile</Link>}</div>}
      {patient !== null && <pre className="mt-4 overflow-auto rounded-xl bg-surface p-4 text-sm">{JSON.stringify(patient, null, 2)}</pre>}
    </div>
  </main>;
}
