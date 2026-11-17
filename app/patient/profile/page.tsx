"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { BookingRequestError, patientProfileBody, type PatientProfile, type PatientProfileInput } from "@/lib/booking";
import { bookingApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { usePatientProfile } from "@/lib/queries";
import { parsePatientProfile } from "@/lib/queries";
import PageHeader from "@/components/ui/PageHeader";
import SessionExpiredAction from "@/components/auth/SessionExpiredAction";

const inputClass = "mt-2 h-11 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-70";

function messageOf(cause: unknown, action: string) {
  if (cause instanceof BookingRequestError && cause.status === 401) return "Your session expired. Sign in again and retry.";
  if (cause instanceof BookingRequestError && cause.status === 403) return "This page is for patient accounts. Sign in with your patient account.";
  return cause instanceof Error ? cause.message : `Could not ${action}. Please try again.`;
}

export default function PatientProfilePage() {
  const { user, profile, role, session, loading } = useAuth();
  if (user && profile?.id === user.id && role === "PATIENT" && session?.user.id === user.id) {
    return <PatientProfileManager key={user.id} />;
  }
  return <main className="min-h-screen bg-background p-8">{loading ? <p role="status">Checking your patient session...</p> : <p>Patient sign-in is required. <Link href="/auth/signin" className="text-primary underline">Sign in</Link></p>}</main>;
}

function PatientProfileManager() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: profileData, isPending: loading, error, refetch } = usePatientProfile();
  const [values, setValues] = useState<PatientProfileInput>(() => {
    const metadata = user?.user_metadata;
    const read = (key: string) => typeof metadata?.[key] === "string" ? metadata[key] : "";
    return { patientName: read("first_name"), patientSurname: read("last_name"), nationalID: read("national_id"), phone: read("phone") };
  });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");

  const missing = error instanceof BookingRequestError && error.status === 404;
  const queryMessage = error && !missing ? messageOf(error, "load your patient profile") : "";
  const errorMessage = saveError || queryMessage;

  useEffect(() => {
    if (!profileData) return;
    setValues({
      patientName: profileData.patientName,
      patientSurname: profileData.patientSurname,
      nationalID: profileData.nationalID,
      phone: profileData.phone,
    });
    setEditing(false);
  }, [profileData]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    let body: PatientProfileInput;
    try { body = patientProfileBody(values); }
    catch (cause) { setSaveError(messageOf(cause, "validate your profile")); return; }
    setSaving(true);
    setSaveError("");
    setNotice("");
    try {
      const result = parsePatientProfile(await bookingApi("/patients/me", { method: "POST", body: JSON.stringify(body) })) as PatientProfile;
      setValues({ patientName: result.patientName, patientSurname: result.patientSurname, nationalID: result.nationalID, phone: result.phone });
      setEditing(false);
      setNotice("Your patient profile has been saved.");
      // Keep the shared cache in sync for every other patient page.
      await queryClient.invalidateQueries({ queryKey: queryKeys.patientProfile });
    } catch (cause) {
      setSaveError(messageOf(cause, "save your patient profile"));
    } finally {
      setSaving(false);
    }
  }

  const cancelEdit = () => {
    if (profileData) setValues({ patientName: profileData.patientName, patientSurname: profileData.patientSurname, nationalID: profileData.nationalID, phone: profileData.phone });
    setSaveError("");
    setEditing(false);
  };

  return <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader
        title="Patient profile"
        description="Review and update the contact and identification details used for your care."
      />
      {loading && <p role="status" className="mb-4">Loading your patient profile...</p>}
      {errorMessage && <div role="alert" className="mb-5 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error">{errorMessage}<SessionExpiredAction message={errorMessage} returnTo="/patient/profile" />{!editing && profileData && <button type="button" onClick={() => setSaveError("")} className="ml-2 underline">Dismiss</button>}</div>}
      {notice && <p role="status" className="mb-5 rounded-xl border border-success/30 bg-success-background p-4 text-sm text-success">{notice}</p>}
      {!loading && !errorMessage && missing && <p className="mb-5 rounded-xl border border-primary/15 bg-accent-surface p-4 text-sm">You have not completed your patient profile yet. Add your details below.</p>}
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
      {!loading && (editing || missing) && <form onSubmit={save} aria-busy={saving} className="space-y-5 rounded-2xl border border-primary/15 bg-surface p-6 shadow-sm">
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
      {!loading && errorMessage && !profileData && <button type="button" onClick={() => void refetch()} className="min-h-11 text-primary underline">Retry profile</button>}
    </div>
  </main>;
}
