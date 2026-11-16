"use client";

import { FormEvent, useMemo, useState } from "react";
import { LogOut, Menu, Search, UserPlus, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { createStaffApi, StaffApiError } from "@/lib/staff";
import SessionExpiredAction from "@/components/auth/SessionExpiredAction";

import NotificationBell from "@/components/Notification/NotificationBell";

type WalkInPatient = {
  patientID: string;
  patientName: string;
  patientSurname: string;
  patientEmail: string;
  phone: string | null;
};

const fieldClass =
  "h-10 w-full rounded-lg border border-primary/30 bg-background px-3 text-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function Header({ onChanged }: { onChanged?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [walkInFormOpen, setWalkInFormOpen] = useState(false);
  const [availabilityOverride, setAvailabilityOverride] = useState<boolean | null>(null);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [walkInQuery, setWalkInQuery] = useState("");
  const [walkInPatientId, setWalkInPatientId] = useState("");
  const [patients, setPatients] = useState<WalkInPatient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientsError, setPatientsError] = useState("");
  const [walkInSaving, setWalkInSaving] = useState(false);
  const [walkInError, setWalkInError] = useState("");
  const [walkInDone, setWalkInDone] = useState("");

  const { profile, user, signOut } = useAuth();
  const staffName = profile?.firstName && profile?.lastName
    ? `${profile.firstName} ${profile.lastName}`
    : profile?.email || user?.email || "Staff Member";
  const staffRoleLabel = profile?.staffRole || "STAFF";
  const userId = user?.id ?? null;

  const api = useMemo(() => createStaffApi({
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

  // Derive from the profile; the override only holds an optimistic update.
  const available = availabilityOverride ?? (String(profile?.availabilityStatus ?? "").toUpperCase() === "AVAILABLE");

  async function handleAvailability(next: boolean) {
    if (availabilitySaving) return;
    const previous = availabilityOverride;
    setAvailabilityOverride(next);
    setAvailabilitySaving(true);
    setAvailabilityError("");
    try {
      await api("/staff/me/availability", {
        method: "PATCH",
        body: JSON.stringify({ status: next ? "AVAILABLE" : "UNAVAILABLE" }),
      });
      onChanged?.();
    } catch (cause) {
      setAvailabilityOverride(previous);
      setAvailabilityError(cause instanceof StaffApiError ? cause.message : "Could not update your availability.");
    } finally {
      setAvailabilitySaving(false);
    }
  }

  async function openWalkInForm() {
    setWalkInFormOpen(true);
    setMenuOpen(false);
    setWalkInDone("");
    setWalkInError("");
    setPatientsLoading(true);
    setPatientsError("");
    try {
      const data = await api("/patients");
      setPatients(Array.isArray(data) ? data as WalkInPatient[] : []);
    } catch (cause) {
      setPatientsError(cause instanceof StaffApiError ? cause.message : "Could not load registered patients.");
    } finally {
      setPatientsLoading(false);
    }
  }

  function closeWalkInForm() {
    setWalkInFormOpen(false);
    setWalkInQuery("");
    setWalkInPatientId("");
    setWalkInError("");
    setPatientsError("");
  }

  async function handleWalkInSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (walkInSaving) return;
    if (!walkInPatientId) {
      setWalkInError("Select the registered patient to check in.");
      return;
    }
    if (!profile?.departmentId) {
      setWalkInError("Your staff account has no department assigned. Ask an administrator to assign one.");
      return;
    }
    setWalkInSaving(true);
    setWalkInError("");
    setWalkInDone("");
    try {
      const created = await api("/appointments/walk-in", {
        method: "POST",
        body: JSON.stringify({ patientId: walkInPatientId, departmentId: profile.departmentId }),
      }) as { appointmentId?: string } | null;
      setWalkInDone(created?.appointmentId ? `Walk-in registered and queued (ID ${created.appointmentId}).` : "Walk-in registered and queued.");
      setWalkInPatientId("");
      onChanged?.();
    } catch (cause) {
      setWalkInError(cause instanceof StaffApiError ? cause.message : "Could not register the walk-in. Please try again.");
    } finally {
      setWalkInSaving(false);
    }
  }

  const query = walkInQuery.trim().toLowerCase();
  const filteredPatients = patients.filter((patient) =>
    !query ||
    `${patient.patientName} ${patient.patientSurname}`.toLowerCase().includes(query) ||
    patient.patientEmail.toLowerCase().includes(query) ||
    String(patient.phone ?? "").includes(query)
  );

  const availabilitySwitch = (
    <div className="flex items-center gap-2 text-sm">
      <span className={available ? "text-neutral-400" : "font-medium text-foreground"}>
        Not available
      </span>
      <Switch
        checked={available}
        onCheckedChange={handleAvailability}
        disabled={availabilitySaving}
      />
      <span className={available ? "font-medium text-foreground" : "text-neutral-400"}>
        Available
      </span>
    </div>
  );

  return (
    <>
      <header className="fixed left-0 top-0 z-50 w-full border-b border-primary/20 bg-surface shadow-sm">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* Brand & Staff Info */}
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-primary">
              CliniQ{" "}
              <span className="text-sm font-normal text-neutral-500">
                | Staff Portal
              </span>
            </span>
            <span className="hidden rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary lg:inline">
              {staffName} · {staffRoleLabel}
            </span>
          </div>

          {/* Desktop controls */}
          <div className="hidden items-center gap-4 md:flex">
            <div className="flex flex-col items-end">
              {availabilitySwitch}
              {availabilityError && <p role="alert" className="mt-1 text-xs text-error">{availabilityError}<SessionExpiredAction message={availabilityError} returnTo="/staff" /></p>}
            </div>

            <button
              type="button"
              onClick={openWalkInForm}
              className="flex min-h-10 items-center gap-1.5 rounded-lg border-2 border-primary px-4 text-sm font-semibold text-primary transition hover:bg-accent-surface"
            >
              <UserPlus size={15} aria-hidden="true" />
              Walk-in
            </button>

            <NotificationBell />

            <button
              type="button"
              onClick={() => signOut()}
              className="flex min-h-10 items-center gap-1.5 rounded-lg border border-primary/25 px-3 text-sm font-semibold text-neutral-700 transition hover:bg-accent-surface hover:text-primary"
              title="Sign out"
            >
              <LogOut size={16} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMenuOpen((c) => !c)}
            className="rounded-lg p-2 md:hidden"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="border-t border-primary/20 bg-surface px-4 py-4 md:hidden">
            <div className="mb-3 text-xs font-semibold text-primary">
              {staffName} · {staffRoleLabel}
            </div>

            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-medium">Availability</span>
              {availabilitySwitch}
            </div>
            {availabilityError && <p role="alert" className="mb-3 text-xs text-error">{availabilityError}<SessionExpiredAction message={availabilityError} returnTo="/staff" /></p>}

            <button
              type="button"
              onClick={openWalkInForm}
              className="mb-3 flex w-full min-h-10 items-center justify-center gap-1.5 rounded-lg border-2 border-primary text-sm font-semibold text-primary transition hover:bg-accent-surface"
            >
              <UserPlus size={15} aria-hidden="true" />
              Walk-in
            </button>

            <div className="mb-3 flex justify-center">
              <NotificationBell />
            </div>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                signOut();
              }}
              className="flex w-full min-h-10 items-center justify-center gap-2 rounded-lg border border-red-200 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              <LogOut size={16} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </header>

      {/* ─── Walk-in modal ─── */}
      {walkInFormOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="walkin-title"
        >
          <form
            onSubmit={handleWalkInSubmit}
            className="w-full max-w-md space-y-4 rounded-2xl border border-primary/20 bg-surface p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 id="walkin-title" className="text-lg font-bold">
                Walk-in patient
              </h2>
              <button
                type="button"
                onClick={closeWalkInForm}
                className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-background"
                aria-label="Close form"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-neutral-600">
              Select a registered patient to add them to your department&apos;s waiting queue immediately.
            </p>

            <label htmlFor="patient-search" className="block text-sm font-semibold">
              Find patient
              <div className="relative mt-1.5">
                <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-neutral-400" />
                <input
                  id="patient-search"
                  type="text"
                  value={walkInQuery}
                  onChange={(event) => setWalkInQuery(event.target.value)}
                  placeholder="Name, email or phone"
                  autoComplete="off"
                  className={`${fieldClass} pl-9`}
                />
              </div>
            </label>

            <label htmlFor="walk-in-patient" className="block text-sm font-semibold">
              Registered patient
              <select
                id="walk-in-patient"
                required
                value={walkInPatientId}
                onChange={(event) => setWalkInPatientId(event.target.value)}
                className={`${fieldClass} mt-1.5`}
                disabled={patientsLoading || Boolean(patientsError)}
              >
                <option value="">{patientsLoading ? "Loading patients..." : "Select a patient"}</option>
                {filteredPatients.map((patient) => (
                  <option key={patient.patientID} value={patient.patientID}>
                    {patient.patientSurname}, {patient.patientName} — {patient.patientEmail}
                  </option>
                ))}
              </select>
            </label>
            {filteredPatients.length === 0 && !patientsLoading && !patientsError && (
              <p className="text-xs text-neutral-500">No registered patient matches “{walkInQuery.trim()}”.</p>
            )}
            {patientsError && <p role="alert" className="text-sm text-error">{patientsError}<SessionExpiredAction message={patientsError} returnTo="/staff" /></p>}
            {walkInError && <p role="alert" className="text-sm text-error">{walkInError}<SessionExpiredAction message={walkInError} returnTo="/staff" /></p>}
            {walkInDone && <p role="status" className="text-sm font-medium text-success">{walkInDone}</p>}

            <button
              type="submit"
              disabled={walkInSaving || patientsLoading || Boolean(patientsError)}
              className="min-h-11 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {walkInSaving ? "Registering walk-in..." : "Add to waiting queue"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
