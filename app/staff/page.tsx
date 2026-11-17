"use client";

import React, { useCallback, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  CalendarClock, ClipboardList, ListFilter, Plus, QrCode, RefreshCw, Trash2, UserRound, Zap,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { staffApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useStaffDashboard } from "@/lib/queries";
import Header from "@/components/Header";
import CheckInQrScanner from "@/components/staff/CheckInQrScanner";
import AppointmentCard from "@/components/appointments/AppointmentCard";
import PageHeader from "@/components/ui/PageHeader";
import SessionExpiredAction from "@/components/auth/SessionExpiredAction";
import {
  appointmentTimeValue, inConsultationQueue, isTodayAppointment, myOpenSlots,
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
  const queryClient = useQueryClient();
  const departmentId = profile?.departmentId;
  const myStaffId = profile?.staffId;
  const isDoctor = String(profile?.staffRole ?? "").toUpperCase() === "DOCTOR";
  const today = todayLocalValue();

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [slotForm, setSlotForm] = useState({ slotDate: today, startTime: "09:00", endTime: "15:00", capacity: "10" });
  const [slotSaving, setSlotSaving] = useState(false);
  const [slotError, setSlotError] = useState("");
  const [slotDone, setSlotDone] = useState("");
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState("ALL");
  const [profileRefreshing, setProfileRefreshing] = useState(false);

  // One shared, auto-refreshing cache for appointments, queues and schedules.
  const { data, isPending: loading, isFetching: refreshing, error: queryError } = useStaffDashboard();
  const appointments = data?.appointments ?? [];
  const queue = data?.queue ?? [];
  const slots = data?.slots ?? [];
  const error = queryError ? errorMessage(queryError, "Could not load the clinic data. Please retry.") : "";

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.staffDashboard });
  }, [queryClient]);

  async function runAction(key: string, action: () => Promise<unknown>, failureMessage: string) {
    if (busyKey) return;
    setBusyKey(key);
    setActionError("");
    try {
      await action();
      await refresh();
    } catch (cause) {
      setActionError(errorMessage(cause, failureMessage));
    } finally {
      setBusyKey(null);
    }
  }

  const checkIn = (appointmentId: string) =>
    runAction(`checkin-${appointmentId}`, () => staffApi(`/appointments/${encodeURIComponent(appointmentId)}/check-in`, { method: "POST" }), "Could not check the patient in. Please try again.");
  const complete = (appointmentId: string) =>
    runAction(`complete-${appointmentId}`, () => staffApi(`/appointments/${appointmentId}/complete`, { method: "POST" }), "Could not complete the consultation. Please try again.");
  const callNext = () =>
    runAction("call-next", () => staffApi("/queues/call-next", { method: "POST" }), "Could not call the next patient. Please try again.");
  const broadcastDelay = () => {
    const msg = window.prompt("Enter delay message for waiting patients:", "We are currently running 15 minutes behind schedule.");
    if (!msg) return;
    return runAction(
        "delay-broadcast",
        () => staffApi("/queues/broadcast-delay", { method: "POST", body: JSON.stringify({ message: msg }) }),
        "Could not send the delay broadcast."
    );
  };
  const markUrgent = (entry: QueueEntry) =>
    runAction(`urgent-${entry.queueId}`, () => staffApi(`/queues/${entry.queueId}/prioritise`, { method: "POST", body: JSON.stringify({ reason: "Marked urgent by staff" }) }), "Could not flag the queue entry as urgent.");
  const markNoShow = (appointmentId: string) => {
    if (!window.confirm("Are you sure you want to mark this patient as a No-Show?")) return;
    return runAction(
        `noshow-${appointmentId}`,
        () => staffApi(`/appointments/${appointmentId}/no-show`, { method: "POST" }),
        "Could not mark the patient as a no-show."
    );
  };

  async function createSlot(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (slotSaving) return;
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
      await staffApi("/schedules", { method: "POST", body: JSON.stringify({ slotDate, startTime, endTime, capacity: capacityNumber }) });
      setSlotDone(`Clinic window added for ${slotDate}, ${startTime} – ${endTime} (${capacityNumber} patients). It is now available for patients to book.`);
      await refresh();
    } catch (cause) {
      setSlotError(errorMessage(cause, "Could not add the availability slot. Please try again."));
    } finally {
      setSlotSaving(false);
    }
  }

  const removeSlot = (slot: ScheduleSlot) =>
    runAction(`delete-slot-${slot.slotId}`, () => staffApi(`/schedules/${slot.slotId}`, { method: "DELETE" }), "Could not remove the slot. Please try again.");

  async function reloadProfile() {
    if (profileRefreshing) return;
    setProfileRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      setProfileRefreshing(false);
    }
  }

  const todayAppointments = appointments
    .filter((item) => isTodayAppointment(item, today))
    .filter((item) => !departmentId || item.staff?.department?.departmentId === departmentId)
    .sort((a, b) => appointmentTimeValue(a).localeCompare(appointmentTimeValue(b)));
  const visibleAppointments = todayAppointments.filter((appointment) => {
    const query = appointmentSearch.trim().toLocaleLowerCase();
    const patient = appointment.patient;
    const matchesSearch = !query || [
      patientName(appointment), patient?.patientEmail, patient?.phone,
    ].some((value) => value?.toLocaleLowerCase().includes(query));
    return matchesSearch && (appointmentStatusFilter === "ALL" || appointment.appointmentStatus === appointmentStatusFilter);
  });
  const waitingEntries = waitingQueue(queue, departmentId);
  const consultingEntries = inConsultationQueue(queue, departmentId);
  const openSlots = myOpenSlots(slots, myStaffId, today);
  const staffRoleLabel = String(profile?.staffRole ?? "staff")
    .toLocaleLowerCase()
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
  const checkedInCount = todayAppointments.filter((appointment) =>
    ["CHECKEDIN", "WAITING", "INCONSULTATION"].includes(appointment.appointmentStatus),
  ).length;

  return (
    <div className="min-h-screen bg-background">
      <Header onChanged={() => void refresh()} />

      <main className="mx-auto w-full max-w-7xl px-4 pt-24 pb-12 sm:px-6 lg:px-8">
        <PageHeader
          title="Clinic queue & availability"
          description={`Manage today's appointments, the waiting queue, and your availability as ${staffRoleLabel.toLowerCase()}.`}
          action={
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
          }
        />

        {loading && <p role="status" className="mb-4">Loading clinic data...</p>}
        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error">
            <p>{error}<SessionExpiredAction message={error} returnTo="/staff" /></p>
          </div>
        )}
        {actionError && <div role="alert" className="mb-5 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error">{actionError}<SessionExpiredAction message={actionError} returnTo="/staff" /></div>}

        <section aria-label={`${staffRoleLabel} dashboard summary`} className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-primary/15 bg-surface p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Your role</p>
            <p className="mt-1 text-lg font-bold">{staffRoleLabel}</p>
          </div>
          <div className="rounded-xl border border-primary/15 bg-surface p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Today&apos;s appointments</p>
            <p className="mt-1 text-2xl font-bold">{loading ? "—" : todayAppointments.length}</p>
          </div>
          <div className="rounded-xl border border-primary/15 bg-surface p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Checked in today</p>
            <p className="mt-1 text-2xl font-bold">{loading ? "—" : checkedInCount}</p>
          </div>
          <div className="rounded-xl border border-primary/15 bg-surface p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Waiting now</p>
            <p className="mt-1 text-2xl font-bold">{loading ? "—" : waitingEntries.length}</p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">

          <section aria-labelledby="today-heading" className="rounded-2xl border border-primary/15 bg-surface p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="today-heading" className="flex items-center gap-2 text-lg font-bold">
                <ClipboardList size={18} aria-hidden="true" className="text-primary" /> Today&apos;s appointments
              </h2>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{visibleAppointments.length} / {todayAppointments.length}</span>
            </div>
            <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_12rem]">
              <label className="text-xs font-semibold text-neutral-600">
                Search patients
                <input
                  type="search"
                  value={appointmentSearch}
                  onChange={(event) => setAppointmentSearch(event.target.value)}
                  placeholder="Name, email, or phone"
                  className={inputClass}
                />
              </label>
              <label className="text-xs font-semibold text-neutral-600">
                Filter by status
                <select value={appointmentStatusFilter} onChange={(event) => setAppointmentStatusFilter(event.target.value)} className={inputClass}>
                  <option value="ALL">All statuses</option>
                  {Object.entries(STATUS_META).map(([status, meta]) => <option key={status} value={status}>{meta.label}</option>)}
                </select>
              </label>
            </div>
            {!loading && todayAppointments.length === 0 && (
              <p className="text-sm text-neutral-600">No appointments booked for today. Patients who book will appear here.</p>
            )}
            {!loading && todayAppointments.length > 0 && visibleAppointments.length === 0 && (
              <p className="text-sm text-neutral-600">No appointments match your search and status filter.</p>
            )}
            <div className="grid gap-3">
              {visibleAppointments.map((appointment) => {
                const busyPrefix = busyKey?.endsWith(appointment.appointmentId);
                const schedule = appointment.slot
                  ? `${appointment.slot.startTime.slice(0, 5)} – ${appointment.slot.endTime.slice(0, 5)} · Dr. ${appointment.staff?.firstName ?? ""} ${appointment.staff?.lastName ?? ""}`.trim()
                  : "Walk-in";
                return (
                  <AppointmentCard
                    key={appointment.appointmentId}
                    title={patientName(appointment)}
                    subtitle={schedule}
                    status={appointment.appointmentStatus}
                    details={appointment.checkInTime ? [{ label: "Checked in", value: appointment.checkInTime.slice(11, 16) }] : []}
                    footer={
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {appointment.priority === "URGENT" && <span className="rounded-full bg-error px-2 py-0.5 text-[10px] font-bold uppercase text-white">Urgent</span>}
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
                    }
                  />
                );
              })}
            </div>
          </section>

          <section aria-labelledby="queue-heading" className="rounded-2xl border border-primary/15 bg-surface p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 id="queue-heading" className="flex items-center gap-2 text-lg font-bold">
                <ListFilter size={18} aria-hidden="true" className="text-primary" /> Waiting queue
              </h2>
              <button type="button" disabled={Boolean(busyKey) || waitingEntries.length === 0} onClick={() => void broadcastDelay()} className={ghostButtonClass}>
                {busyKey === "delay-broadcast" ? "Sending..." : "Announce Delay"}
              </button>
              <button type="button" disabled={Boolean(busyKey) || waitingEntries.length === 0} onClick={() => void callNext()} className={buttonClass}>
                {busyKey === "call-next" ? "Calling..." : "Call next patient"}
              </button>
            </div>
            {!loading && waitingEntries.length === 0 && consultingEntries.length === 0 && (
              <p className="text-sm text-neutral-600">Nobody is waiting. Patients appear here after they are checked in.</p>
            )}
            <div className="grid gap-3">
              {waitingEntries.map((entry) => (
                <AppointmentCard
                  key={entry.queueId}
                  title={patientName(entry.appointment)}
                  subtitle={entry.department?.name ?? "Department"}
                  status={entry.appointment.appointmentStatus}
                  details={[
                    { label: "Queue position", value: entry.position },
                    { label: "Checked in", value: entry.appointment.checkInTime?.slice(11, 16) ?? "—" },
                  ]}
                  footer={
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {entry.appointment.priority === "URGENT"
                        ? <span className="rounded-full bg-error px-2 py-0.5 text-[10px] font-bold uppercase text-white">Urgent</span>
                        : (
                          <button type="button" disabled={Boolean(busyKey)} onClick={() => void markUrgent(entry)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-error/30 px-3 text-xs font-semibold text-error hover:bg-error-background disabled:opacity-50">
                            <Zap size={13} aria-hidden="true" /> {busyKey === `urgent-${entry.queueId}` ? "Marking..." : "Mark urgent"}
                          </button>
                        )}
                      <button type="button" disabled={Boolean(busyKey)} onClick={() => void markNoShow(entry.appointment.appointmentId)} className="min-h-9 rounded-lg border border-neutral-300 px-3 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 disabled:opacity-50">
                        {busyKey === `noshow-${entry.appointment.appointmentId}` ? "Saving..." : "No-Show"}
                      </button>
                    </div>
                  }
                />
              ))}
            </div>
            {consultingEntries.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">In consultation</h3>
                <div className="grid gap-3">
                  {consultingEntries.map((entry) => (
                    <AppointmentCard
                      key={entry.queueId}
                      title={patientName(entry.appointment)}
                      subtitle={`${entry.department?.name ?? "Department"} · Called ${entry.appointment.calledTime?.slice(11, 16) ?? "—"}`}
                      status={entry.appointment.appointmentStatus}
                      footer={<button type="button" disabled={Boolean(busyKey)} onClick={() => void complete(entry.appointment.appointmentId)} className="mt-4 min-h-9 rounded-lg border border-success/40 px-3 text-xs font-semibold text-success hover:bg-success-background disabled:opacity-50">
                        {busyKey === `complete-${entry.appointment.appointmentId}` ? "Saving..." : "Complete"}
                      </button>}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

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
          <UserRound size={12} aria-hidden="true" /> Appointments and queues are live from the clinic API. Signed in as {profile?.email ?? user.email}. <button type="button" disabled={profileRefreshing} className="underline hover:text-primary disabled:opacity-50" onClick={() => void reloadProfile()}>{profileRefreshing ? "Reloading..." : "Reload profile"}</button>
        </p>
      </main>
      {scannerOpen && <CheckInQrScanner onClose={() => setScannerOpen(false)} onDetected={(appointmentId) => {
        setScannerOpen(false);
        void checkIn(appointmentId);
      }} />}
    </div>
  );
}
