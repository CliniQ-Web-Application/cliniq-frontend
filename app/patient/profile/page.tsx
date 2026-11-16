"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { ArrowLeft, UserRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { BookingRequestError, createBookingApi, patientProfileBody, type PatientProfile, type PatientProfileInput } from "@/lib/booking";
import SessionExpiredAction from "@/components/auth/SessionExpiredAction";

const inputClass = "mt-2 h-11 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-70";
function parseProfile(value: unknown): PatientProfile {
  const fields = ["patientID", "authUserId", "patientEmail", "patientName", "patientSurname", "nationalID", "phone"];
  if (!value || typeof value !== "object" || fields.some((field) => typeof (value as Record<string, unknown>)[field] !== "string")) {
    throw new Error("The clinic returned an unexpected patient profile. Please retry.");
  }
  return value as PatientProfile;
}

function messageOf(cause: unknown, action: string) {
  if (cause instanceof BookingRequestError && cause.status === 401) return "Your session expired. Sign in again and retry.";
  if (cause instanceof BookingRequestError && cause.status === 403) return "This page is for patient accounts. Sign in with your patient account.";
  return cause instanceof Error ? cause.message : `Could not ${action}. Please try again.`;
}

export default function PatientProfilePage() {
  const { user, profile, role, session, loading } = useAuth();
  if (user && profile?.id === user.id && role === "PATIENT" && session?.user.id === user.id) {
    return <PatientProfileManager key={user.id} user={user} />;
  }
  return <main className="min-h-screen bg-background p-8">{loading ? <p role="status">Checking your patient session...</p> : <p>Patient sign-in is required. <Link href="/auth/signin" className="text-primary underline">Sign in</Link></p>}</main>;
}

function PatientProfileManager({ user }: { user: User }) {
  const [profileData, setProfileData] = useState<PatientProfile | null>(null);
  const [values, setValues] = useState<PatientProfileInput>(() => {
    const metadata = user.user_metadata;
    const read = (key: string) => typeof metadata[key] === "string" ? metadata[key] : "";
    return { patientName: read("first_name"), patientSurname: read("last_name"), nationalID: read("national_id"), phone: read("phone") };
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const requestController = useRef<AbortController | null>(null);
  const saveInFlight = useRef(false);
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

  const loadProfile = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const data = await api("/patients/me", { signal });
      const result = parseProfile(data);
      if (signal.aborted) return;
      setProfileData(result);
      setValues({ patientName: result.patientName, patientSurname: result.patientSurname, nationalID: result.nationalID, phone: result.phone });
      setMissing(false);
      setEditing(false);
    } catch (cause) {
      if (signal.aborted) return;
      if (cause instanceof BookingRequestError && cause.status === 404) {
        setProfileData(null);
        setMissing(true);
        setEditing(true);
      } else setError(messageOf(cause, "load your patient profile"));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    const controller = new AbortController();
    requestController.current = controller;
    queueMicrotask(() => { if (!controller.signal.aborted) void loadProfile(controller.signal); });
    return () => controller.abort();
  }, [loadProfile]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const signal = requestController.current?.signal;
    if (!signal || signal.aborted || saveInFlight.current) return;
    let body: PatientProfileInput;
    try { body = patientProfileBody(values); }
    catch (cause) { setError(messageOf(cause, "validate your profile")); return; }
    saveInFlight.current = true;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = parseProfile(await api("/patients/me", {
        method: missing ? "POST" : "PUT",
        body: JSON.stringify(body),
        signal,
      }));
      if (signal.aborted) return;
      setProfileData(result);
      setValues({ patientName: result.patientName, patientSurname: result.patientSurname, nationalID: result.nationalID, phone: result.phone });
      setMissing(false);
      setEditing(false);
      setNotice("Your patient profile has been saved.");
    } catch (cause) {
      if (!signal.aborted) setError(messageOf(cause, "save your patient profile"));
    } finally {
      saveInFlight.current = false;
      if (!signal.aborted) setSaving(false);
    }
  }

  const cancelEdit = () => {
    if (profileData) setValues({ patientName: profileData.patientName, patientSurname: profileData.patientSurname, nationalID: profileData.nationalID, phone: profileData.phone });
    setError("");
    setEditing(false);
  };

  return <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
    <div className="mx-auto w-full max-w-2xl">
      <Link href="/patient" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowLeft size={18} aria-hidden="true" /> Back to patient portal</Link>
      <header className="mb-8 mt-8">
        <UserRound className="mb-3 text-primary" size={30} aria-hidden="true" />
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Your details</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Patient profile</h1>
        <p className="mt-3 text-neutral-600">Review and update the contact and identification details used for your care.</p>
      </header>
      {loading && <p role="status" className="mb-4">Loading your patient profile...</p>}
      {error && <div role="alert" className="mb-5 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error">{error}<SessionExpiredAction message={error} returnTo="/patient/profile" />{!editing && profileData && <button type="button" onClick={() => setError("")} className="ml-2 underline">Dismiss</button>}</div>}
      {notice && <p role="status" className="mb-5 rounded-xl border border-success/30 bg-success-background p-4 text-sm text-success">{notice}</p>}
      {!loading && !error && missing && <p className="mb-5 rounded-xl border border-primary/15 bg-accent-surface p-4 text-sm">You have not completed your patient profile yet. Add your details below.</p>}
      {!loading && profileData && !editing && <section className="space-y-5 rounded-2xl border border-primary/15 bg-surface p-6 shadow-sm" aria-label="Patient profile details">
        <dl className="grid gap-5 sm:grid-cols-2">
          <div><dt className="text-sm text-neutral-500">First name</dt><dd className="mt-1 font-semibold">{profileData.patientName}</dd></div>
          <div><dt className="text-sm text-neutral-500">Surname</dt><dd className="mt-1 font-semibold">{profileData.patientSurname}</dd></div>
          <div><dt className="text-sm text-neutral-500">National ID (Omang)</dt><dd className="mt-1 font-semibold">{profileData.nationalID}</dd></div>
          <div><dt className="text-sm text-neutral-500">Phone number</dt><dd className="mt-1 font-semibold">{profileData.phone}</dd></div>
          <div className="sm:col-span-2"><dt className="text-sm text-neutral-500">Account email</dt><dd className="mt-1 font-semibold">{profileData.patientEmail}</dd></div>
        </dl>
        <button type="button" onClick={() => { setNotice(""); setEditing(true); }} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white">Edit profile</button>
      </section>}
      {!loading && editing && <form onSubmit={save} aria-busy={saving} className="space-y-5 rounded-2xl border border-primary/15 bg-surface p-6 shadow-sm">
        <p className="text-sm text-neutral-600">Update your name, National ID, and phone number. Account email is managed by your sign-in account.</p>
        <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
          {([ ["patientName", "First name", "given-name"], ["patientSurname", "Surname", "family-name"], ["nationalID", "National ID (Omang)", "off"], ["phone", "Phone number", "tel"] ] as const).map(([field, label, autoComplete]) => (
              <label key={field} className="text-sm font-semibold">{label}
                <input required type={field === "phone" ? "tel" : "text"} autoComplete={autoComplete} value={values[field]} className={inputClass} onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))} />
              </label>
          ))}
        </fieldset>
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saving} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving profile..." : "Save profile"}</button>
          {!missing && <button type="button" disabled={saving} onClick={cancelEdit} className="min-h-11 rounded-lg border border-primary/25 px-4 text-sm font-semibold text-primary disabled:opacity-50">Cancel</button>}
        </div>
      </form>}
      {!loading && error && !profileData && <button type="button" onClick={() => { const controller = requestController.current; if (controller && !controller.signal.aborted) void loadProfile(controller.signal); }} className="min-h-11 text-primary underline">Retry profile</button>}
    </div>
  </main>;
}