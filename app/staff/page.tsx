"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import {
  CalendarClock, ClipboardList, ListFilter, Plus, QrCode, RefreshCw, Trash2, UserRound, Zap,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import CheckInQrScanner from "@/components/staff/CheckInQrScanner";
import SessionExpiredAction from "@/components/auth/SessionExpiredAction";
import {
  appointmentTimeValue, createStaffApi, inConsultationQueue, isTodayAppointment, myOpenSlots,
  StaffApiError, todayLocalValue, waitingQueue,
  type QueueEntry, type ScheduleSlot, type StaffAppointment,
} from "@/lib/staff";

const inputClass = "mt-1.5 h-11 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50";
const buttonClass = "min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const ghostButtonClass = "min-h-10 rounded-lg border border-primary/25 px-4 text-sm font-semibold text-primary transition hover:bg-accent-surface disabled:cursor-not-allowed disabled:opacity-50";

const errorMessage = (cause: unknown, fallback: string) =>
  cause instanceof StaffApiError ? cause.message : fallback;

const STATUS_META: Record<string, { label: string; className: string }> = {
  BOOKED: { label: "Booked", className: "bg-primary/10 text-primary" },
  CHECKEDIN: { label: "Checked in", className: "bg-primary/10 text-primary" },
  WAITING: { label: "Waiting", className: "bg-amber-100 text-amber-800" },
  INCONSULTATION: { label: "In consultation", className: "bg-violet-100 text-violet-800" },
  COMPLETED: { label: "Completed", className: "bg-success-background text-success" },
  CANCELLED: { label: "Cancelled", className: "bg-neutral-100 text-neutral-500" },
  NOSHOW: { label: "No-show", className: "bg-neutral-100 text-neutral-500" },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, className: "bg-neutral-100 text-neutral-600" };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}>{meta.label}</span>;
}

function patientName(appointment: StaffAppointment): string {
  const patient = appointment.patient;
  if (!patient) return "Unknown patient";
  return `${patient.patientName} ${patient.patientSurname}`.trim();
}

export default function StaffPortal() {
  const { user, profile, role, loading } = useAuth();
  if (user && role === "STAFF" && profile?.id === user.id) {
    return <StaffPortalInner key={user.id} user={user} />;
  }
  return (
    <main className="min-h-screen bg-background p-8">
      {loading ? <p role="status">Checking your staff session...</p> : (
        <p>Staff sign-in is required. <Link href="/auth/signin" className="text-primary underline">Sign in</Link></p>
      )}
    </main>
  );
}

function StaffPortalInner({ user }: { user: User }) {
  const { profile, refreshProfile } = useAuth();
  const userId = user.id;
  const departmentId = profile?.departmentId;
  const myStaffId = profile?.staffId;
  const isDoctor = String(profile?.staffRole ?? "").toUpperCase() === "DOCTOR";
  const today = todayLocalValue();

  const [appointments, setAppointments] = useState<StaffAppointment[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [slotForm, setSlotForm] = useState({ slotDate: today, startTime: "09:00", endTime: "15:00", capacity: "10" });
  const [slotSaving, setSlotSaving] = useState(false);
  const [slotError, setSlotError] = useState("");
  const [slotDone, setSlotDone] = useState("");
  const lifetime = useRef<AbortController | null>(null);

  const api = useMemo(() => createStaffApi({
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    getToken: async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      return !sessionError && data.session?.user.id === userId ? data.session.access_token : null;
    },
    refreshToken: async () => {
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      return !refreshError && data.session?.user.id === userId ? data.session.access_token : null;
    },
  }), [userId]);

  const loadAll = useCallback(async (signal: AbortSignal, quiet = false) => {
    if (!quiet) setLoading(true);
    setRefreshing(true);
    setError("");
    try {
      const [appointmentData, queueData, slotData] = await Promise.all([
        api("/appointments", { signal }),
        api("/queues", { signal }),
        api("/schedules", { signal }),
      ]);
      if (signal.aborted) return;
      setAppointments(Array.isArray(appointmentData) ? appointmentData as StaffAppointment[] : []);
      setQueue(Array.isArray(queueData) ? queueData as QueueEntry[] : []);
      setSlots(Array.isArray(slotData) ? slotData as ScheduleSlot[] : []);
    } catch (cause) {
      if (!signal.aborted) setError(errorMessage(cause, "Could not load the clinic data. Please retry."));
    } finally {
      if (!signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [api]);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadAll(controller.signal);
    });
    return () => controller.abort();
  }, [loadAll]);

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    lifetime.current?.abort();
    lifetime.current = controller;
    await loadAll(controller.signal, true);
  }, [loadAll]);

  async function runAction(key: string, action: () => Promise<unknown>, failureMessage: string) {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted || busyKey) return;
    setBusyKey(key);
    setActionError("");
    try {
      await action();
      await refresh();
    } catch (cause) {
      if (!lifetime.current?.signal.aborted) setActionError(errorMessage(cause, failureMessage));
    } finally {
      if (!lifetime.current?.signal.aborted) setBusyKey(null);
    }
  }

  const checkIn = (appointmentId: string) =>
    runAction(`checkin-${appointmentId}`, () => api(`/appointments/${encodeURIComponent(appointmentId)}/check-in`, { method: "POST" }), "Could not check the patient in. Please try again.");
  const complete = (appointmentId: string) =>
    runAction(`complete-${appointmentId}`, () => api(`/appointments/${appointmentId}/complete`, { method: "POST" }), "Could not complete the consultation. Please try again.");
  const callNext = () =>
    runAction("call-next", () => api("/queues/call-next", { method: "POST" }), "Could not call the next patient. Please try again.");
  const markUrgent = (entry: QueueEntry) =>
    runAction(`urgent-${entry.queueId}`, () => api(`/queues/${entry.queueId}/prioritise`, { method: "POST", body: JSON.stringify({ reason: "Marked urgent by staff" }) }), "Could not flag the queue entry as urgent.");

  async function createSlot(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted || slotSaving) return;
    const { slotDate, startTime, endTime, capacity } = slotForm;
    const capacityNumber = Number(capacity);
    if (!slotDate || !startTime || !endTime) {
      setSlotError("Choose a date, a start time, and an end time.");
      return;
    }
    if (endTime <= startTime) {
      setSlotError("The end time must be after the start time.");
      return;
    }
    if (!Number.isInteger(capacityNumber) || capacityNumber < 1) {
      setSlotError("Capacity must be a whole number of at least 1.");
      return;
    }
    setSlotSaving(true);
    setSlotError("");
    setSlotDone("");
    try {
      await api("/schedules", { method: "POST", body: JSON.stringify({ slotDate, startTime, endTime, capacity: capacityNumber }) });
      setSlotDone(`Clinic window added for ${slotDate}, ${startTime} – ${endTime} (${capacityNumber} patients). It is now available for patients to book.`);
      await refresh();
    } catch (cause) {
      if (!signal.aborted) setSlotError(errorMessage(cause, "Could not add the availability slot. Please try again."));
    } finally {
      if (!signal.aborted) setSlotSaving(false);
    }
  }

  const removeSlot = (slot: ScheduleSlot) =>
    runAction(`delete-slot-${slot.slotId}`, () => api(`/schedules/${slot.slotId}`, { method: "DELETE" }), "Could not remove the slot. Please try again.");

  const todayAppointments = appointments
    .filter((item) => isTodayAppointment(item, today))
    .filter((item) => !departmentId || item.staff?.department?.departmentId === departmentId)
    .sort((a, b) => appointmentTimeValue(a).localeCompare(appointmentTimeValue(b)));
  const waitingEntries = waitingQueue(queue, departmentId);
  const consultingEntries = inConsultationQueue(queue, departmentId);
  const openSlots = myOpenSlots(slots, myStaffId, today);

  return (
    <div className="min-h-screen bg-background">
      <Header onChanged={() => void refresh()} />

      <main className="mx-auto w-full max-w-7xl px-4 pt-24 pb-12 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">Staff portal</p>
            <h1 className="mt-1 text-3xl font-bold leading-tight">Clinic queue & availability</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Live data from the clinic API, scoped to your department where applicable. Booked patients appear in today's list; checking one in adds them to the waiting queue.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setScannerOpen(true)} disabled={Boolean(busyKey)} className={buttonClass}>
              <span className="inline-flex items-center gap-2"><QrCode size={16} aria-hidden="true" /> Scan patient QR</span>
            </button>
            <button type="button" onClick={() => void refresh()} disabled={refreshing} className={ghostButtonClass}>
              <span className="inline-flex items-center gap-2">
              <RefreshCw size={15} aria-hidden="true" className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing..." : "Refresh"}
              </span>
            </button>
          </div>
        </header>

        {loading && <p role="status" className="mb-4">Loading clinic data...</p>}
        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error">
            <p>{error}<SessionExpiredAction message={error} returnTo="/staff" /></p>
          </div>
        )}
        {actionError && <div role="alert" className="mb-5 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error">{actionError}<SessionExpiredAction message={actionError} returnTo="/staff" /></div>}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ─── Today's appointments ─── */}
          <section aria-labelledby="today-heading" className="rounded-2xl border border-primary/15 bg-surface p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="today-heading" className="flex items-center gap-2 text-lg font-bold">
                <ClipboardList size={18} aria-hidden="true" className="text-primary" /> Today's appointments
              </h2>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{todayAppointments.length}</span>
            </div>
            {!loading && todayAppointments.length === 0 && (
              <p className="text-sm text-neutral-600">No appointments booked for today. Patients who book will appear here.</p>
            )}
            <ul className="grid gap-2">
              {todayAppointments.map((appointment) => {
                const busyPrefix = busyKey?.endsWith(appointment.appointmentId);
                return (
                  <li key={appointment.appointmentId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/10 bg-background p-3">
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight">
                        {patientName(appointment)}
                        {appointment.priority === "URGENT" && <span className="ml-2 rounded-full bg-error px-2 py-0.5 text-[10px] font-bold uppercase text-white align-middle">Urgent</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-600">
                        {appointment.slot
                          ? `${appointment.slot.startTime.slice(0, 5)} – ${appointment.slot.endTime.slice(0, 5)} · Dr. ${appointment.staff?.firstName ?? ""} ${appointment.staff?.lastName ?? ""}`.trim()
                          : "Walk-in"}
                        {appointment.checkInTime ? ` · Checked in ${appointment.checkInTime.slice(11, 16)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={appointment.appointmentStatus} />
                      {appointment.appointmentStatus === "BOOKED" && (
                        <button type="button" disabled={Boolean(busyKey)} onClick={() => void checkIn(appointment.appointmentId)} className="min-h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
                          {busyPrefix ? "Checking in..." : "Check in"}
                        </button>
                      )}
                      {appointment.appointmentStatus === "INCONSULTATION" && (
                        <button type="button" disabled={Boolean(busyKey)} onClick={() => void complete(appointment.appointmentId)} className="min-h-9 rounded-lg border border-success/40 px-3 text-xs font-semibold text-success hover:bg-success-background disabled:opacity-50">
                          {busyPrefix ? "Saving..." : "Complete"}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* ─── Waiting queue ─── */}
          <section aria-labelledby="queue-heading" className="rounded-2xl border border-primary/15 bg-surface p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 id="queue-heading" className="flex items-center gap-2 text-lg font-bold">
                <ListFilter size={18} aria-hidden="true" className="text-primary" /> Waiting queue
              </h2>
              <button type="button" disabled={Boolean(busyKey) || waitingEntries.length === 0} onClick={() => void callNext()} className={buttonClass}>
                {busyKey === "call-next" ? "Calling..." : "Call next patient"}
              </button>
            </div>
            {!loading && waitingEntries.length === 0 && consultingEntries.length === 0 && (
              <p className="text-sm text-neutral-600">Nobody is waiting. Patients appear here after they are checked in.</p>
            )}
            <ol className="grid gap-2">
              {waitingEntries.map((entry) => (
                <li key={entry.queueId} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200/60 bg-amber-50/60 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight">{patientName(entry.appointment)}</p>
                    <p className="mt-0.5 text-xs text-neutral-600">
                      Booked {entry.appointment.bookedAt?.slice(11, 16) ?? "—"}
                      {entry.appointment.checkInTime ? ` · Checked in ${entry.appointment.checkInTime.slice(11, 16)}` : ""}
                      {" · "}{entry.department?.name ?? "Department"}
                    </p>
                  </div>
                  {entry.appointment.priority === "URGENT"
                    ? <span className="rounded-full bg-error px-2 py-0.5 text-[10px] font-bold uppercase text-white">Urgent</span>
                    : (
                      <button type="button" disabled={Boolean(busyKey)} onClick={() => void markUrgent(entry)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-error/30 px-3 text-xs font-semibold text-error hover:bg-error-background disabled:opacity-50">
                        <Zap size={13} aria-hidden="true" /> Mark urgent
                      </button>
                    )}
                </li>
              ))}
            </ol>
            {consultingEntries.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">In consultation</h3>
                <ul className="grid gap-2">
                  {consultingEntries.map((entry) => (
                    <li key={entry.queueId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-200/70 bg-violet-50/60 p-3">
                      <p className="font-semibold leading-tight">{patientName(entry.appointment)}
                        <span className="ml-2 text-xs font-normal text-neutral-500">called {entry.appointment.calledTime?.slice(11, 16) ?? ""}</span>
                      </p>
                      <button type="button" disabled={Boolean(busyKey)} onClick={() => void complete(entry.appointment.appointmentId)} className="min-h-9 rounded-lg border border-success/40 px-3 text-xs font-semibold text-success hover:bg-success-background disabled:opacity-50">
                        {busyKey === `complete-${entry.appointment.appointmentId}` ? "Saving..." : "Complete"}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        {/* ─── Availability management (doctors) ─── */}
        {isDoctor && (
          <section aria-labelledby="availability-heading" className="mt-6 rounded-2xl border border-primary/15 bg-surface p-5 shadow-sm">
            <h2 id="availability-heading" className="flex items-center gap-2 text-lg font-bold">
              <CalendarClock size={18} aria-hidden="true" className="text-primary" /> My availability
            </h2>
            <p className="mt-1 text-sm text-neutral-600">Open a clinic window (e.g. 09:00–15:00) with a capacity. Patients who book that window are served in the order they booked, with urgent patients ahead. Only OPEN windows for active doctors appear on the patient booking page.</p>

            <form onSubmit={createSlot} className="mt-4 flex flex-wrap items-end gap-3">
              <label className="text-sm font-semibold">Date
                <input required type="date" min={today} value={slotForm.slotDate} onChange={(event) => setSlotForm((current) => ({ ...current, slotDate: event.target.value }))} className={inputClass} />
              </label>
              <label className="text-sm font-semibold">Start time
                <input required type="time" value={slotForm.startTime} onChange={(event) => setSlotForm((current) => ({ ...current, startTime: event.target.value }))} className={inputClass} />
              </label>
              <label className="text-sm font-semibold">End time
                <input required type="time" value={slotForm.endTime} onChange={(event) => setSlotForm((current) => ({ ...current, endTime: event.target.value }))} className={inputClass} />
              </label>
              <label className="text-sm font-semibold">Patients
                <input required type="number" min={1} step={1} inputMode="numeric" value={slotForm.capacity} onChange={(event) => setSlotForm((current) => ({ ...current, capacity: event.target.value }))} className={`${inputClass} w-24`} />
              </label>
              <button type="submit" disabled={slotSaving} className={`${buttonClass} inline-flex items-center gap-1.5`}>
                <Plus size={15} aria-hidden="true" />
                {slotSaving ? "Adding..." : "Add slot"}
              </button>
            </form>
            {slotError && <p role="alert" className="mt-2 text-sm text-error">{slotError}</p>}
            {slotDone && <p role="status" className="mt-2 text-sm font-medium text-success">{slotDone}</p>}

            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Your upcoming open slots</h3>
              {openSlots.length === 0 ? (
                <p className="mt-1 text-sm text-neutral-600">No open slots. Add your availability above so patients can book.</p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {openSlots.map((slot) => (
                    <li key={slot.slotId} className="flex items-center gap-2 rounded-lg border border-primary/15 bg-background py-1.5 pl-3 pr-1.5 text-sm">
                      <UserRound size={13} aria-hidden="true" className="text-primary" />
                      <span>{slot.slotDate} · {slot.startTime.slice(0, 5)} – {slot.endTime.slice(0, 5)} · up to {slot.capacity ?? 1} patient{(slot.capacity ?? 1) === 1 ? "" : "s"}</span>
                      <button type="button" disabled={Boolean(busyKey)} onClick={() => void removeSlot(slot)} aria-label={`Remove slot on ${slot.slotDate} at ${slot.startTime.slice(0, 5)}`} className="rounded-md p-1.5 text-neutral-400 transition hover:bg-error-background hover:text-error disabled:opacity-50">
                        {busyKey === `delete-slot-${slot.slotId}` ? <RefreshCw size={14} className="animate-spin" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        <p className="mt-6 flex items-center gap-2 text-xs text-neutral-500">
          <UserRound size={12} aria-hidden="true" /> Appointments and queues are live from the clinic API. Signed in as {profile?.email ?? user.email}. <button type="button" className="underline hover:text-primary" onClick={() => void refreshProfile()}>Reload profile</button>
        </p>
      </main>
      {scannerOpen && <CheckInQrScanner onClose={() => setScannerOpen(false)} onDetected={(appointmentId) => {
        setScannerOpen(false);
        void checkIn(appointmentId);
      }} />}
    </div>
  );
}
