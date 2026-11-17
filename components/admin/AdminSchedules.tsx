"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  adminError, eligibleScheduleDoctors, parseSchedules, scheduleRequestBody,
  type AdminSchedule, type ScheduleForm,
} from "@/lib/admin-management";
import AdminManagementAccess, {
  AdminMessages, adminButton, adminInput, adminPanel, adminPrimaryButton, useAdminChoices, useAdminRequest,
} from "./AdminManagementAccess";

const emptyForm = (): ScheduleForm => ({ staffId: "", slotDate: "", startTime: "", endTime: "", capacity: "1", slotStatus: "OPEN" });

function ScheduleManager() {
  const api = useAdminRequest();
  const { choices, error: choicesError, retry: retryChoices } = useAdminChoices();
  const [slots, setSlots] = useState<AdminSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [revision, setRevision] = useState(0);
  const [departmentId, setDepartmentId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState<ScheduleForm>(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<AdminSchedule | null>(null);
  const [busy, setBusy] = useState(false);
  const mutation = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => () => mutation.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { setLoading(true); setError(""); });
    void api("/admin/schedules", { signal: controller.signal }).then((value) => {
      const next = parseSchedules(value);
      if (!controller.signal.aborted) setSlots(next);
    }).catch((cause) => { if (!controller.signal.aborted) { setSlots([]); setError(adminError(cause)); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, revision]);
  useEffect(() => { if (showForm) heading.current?.focus(); }, [showForm, editing]);

  function openForm(slot?: AdminSchedule) {
    setError(""); setSuccess(""); setDeleting(null);
    setEditing(slot?.slotId ?? null);
    setForm(slot ? {
      staffId: slot.staff?.staffId ?? "", slotDate: slot.slotDate, startTime: slot.startTime, endTime: slot.endTime,
      capacity: String(slot.capacity), slotStatus: slot.slotStatus,
    } : { ...emptyForm(), staffId: doctorId });
    setShowForm(true);
  }
  function change(field: keyof ScheduleForm, value: string) { setForm((current) => ({ ...current, [field]: value })); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.current || !choices) return;
    setError(""); setSuccess("");
    let body;
    try { body = scheduleRequestBody(form, choices.doctors); }
    catch (cause) { setError(adminError(cause)); return; }
    const controller = new AbortController(); mutation.current = controller; setBusy(true);
    try {
      await api(editing ? `/admin/schedules/${encodeURIComponent(editing)}` : "/admin/schedules", {
        method: editing ? "PUT" : "POST", body: JSON.stringify(body), signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setSuccess(editing ? "Schedule updated." : "Schedule created.");
        setShowForm(false); setEditing(null); setForm(emptyForm()); setRevision((value) => value + 1);
      }
    } catch (cause) { if (!controller.signal.aborted) setError(adminError(cause)); }
    finally { if (!controller.signal.aborted) { mutation.current = null; setBusy(false); } }
  }
  async function remove() {
    if (!deleting || mutation.current) return;
    const controller = new AbortController(); mutation.current = controller; setBusy(true); setError(""); setSuccess("");
    try {
      await api(`/admin/schedules/${encodeURIComponent(deleting.slotId)}`, { method: "DELETE", signal: controller.signal });
      if (!controller.signal.aborted) {
        setDeleting(null); setSuccess("Schedule deleted."); setRevision((value) => value + 1);
      }
    } catch (cause) { if (!controller.signal.aborted) setError(adminError(cause)); }
    finally { if (!controller.signal.aborted) { mutation.current = null; setBusy(false); } }
  }

  const doctors = choices?.doctors.filter((member) => member.staffRole === "DOCTOR") ?? [];
  const eligible = eligibleScheduleDoctors(choices?.doctors ?? []);
  const visible = slots.filter((slot) => (!departmentId || slot.staff?.department?.departmentId === departmentId) &&
    (!doctorId || slot.staff?.staffId === doctorId) && (!date || slot.slotDate === date) && (!status || slot.slotStatus === status))
    .sort((a, b) => `${a.slotDate}T${a.startTime}`.localeCompare(`${b.slotDate}T${b.startTime}`));

  return <>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-widest text-primary">AP-03 · Availability</p><h1 className="mt-2 text-3xl font-bold">Doctor schedules</h1><p className="mt-2 text-sm text-neutral-600">Manage dated schedule windows and capacity. Slots with booking history cannot be changed or deleted.</p></div>
      <button className={adminPrimaryButton} disabled={!choices || busy || !!choicesError} onClick={() => openForm()}>Create schedule</button>
    </div>
    <AdminMessages error={error || choicesError} success={success} />
    <div className="mt-4 flex gap-3"><button className={adminButton} disabled={loading || busy} onClick={() => { setRevision((value) => value + 1); retryChoices(); }}>Refresh schedules and doctors</button>{choicesError && <button className={adminButton} onClick={retryChoices}>Retry choices</button>}</div>
    {showForm && <section className={adminPanel} aria-labelledby="schedule-form-title">
      <h2 id="schedule-form-title" tabIndex={-1} ref={heading} className="text-xl font-bold">{editing ? "Edit schedule" : "Create schedule"}</h2>
      <p className="mt-2 text-sm text-neutral-600">Use clinic-local date and time. Only active doctors with a department can be scheduled. The server validates its clock and protects booking history.</p>
      <form onSubmit={save} className="mt-5">
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-semibold">Doctor<select required className={adminInput} value={form.staffId} onChange={(event) => change("staffId", event.target.value)}><option value="">Select doctor</option>{form.staffId && !eligible.some((doctor) => doctor.staffId === form.staffId) && <option value={form.staffId} disabled>Doctor no longer eligible — select another</option>}{eligible.map((doctor) => <option key={doctor.staffId} value={doctor.staffId}>{doctor.firstName} {doctor.lastName} · {doctor.department?.name}</option>)}</select></label>
          <label className="text-sm font-semibold">Date<input required type="date" className={adminInput} value={form.slotDate} onChange={(event) => change("slotDate", event.target.value)} /></label>
          <label className="text-sm font-semibold">Start time<input required type="time" step="1" className={adminInput} value={form.startTime} onChange={(event) => change("startTime", event.target.value)} /></label>
          <label className="text-sm font-semibold">End time<input required type="time" step="1" className={adminInput} value={form.endTime} onChange={(event) => change("endTime", event.target.value)} /></label>
          <label className="text-sm font-semibold">Capacity<input required type="number" min="1" max="10000" step="1" className={adminInput} value={form.capacity} onChange={(event) => change("capacity", event.target.value)} /></label>
          <label className="text-sm font-semibold">Status<select className={adminInput} value={form.slotStatus} onChange={(event) => change("slotStatus", event.target.value)}><option value="OPEN">Open</option><option value="BLOCKED">Blocked</option></select></label>
          <div className="flex flex-wrap gap-3 sm:col-span-2 lg:col-span-3"><button className={adminPrimaryButton} type="submit" disabled={!choices || !!choicesError}>{busy ? "Saving..." : "Save schedule"}</button><button className={adminButton} type="button" onClick={() => { setShowForm(false); setEditing(null); }}>Discard form</button></div>
        </fieldset>
      </form>
    </section>}
    {deleting && <section role="alertdialog" aria-modal="false" aria-labelledby="delete-schedule-title" aria-describedby="delete-schedule-description" className={adminPanel}>
      <h2 id="delete-schedule-title" className="text-lg font-bold">Delete schedule?</h2><p id="delete-schedule-description" className="mt-2 text-sm">{deleting.staff?.firstName} {deleting.staff?.lastName} · {deleting.slotDate} · {deleting.startTime}–{deleting.endTime}. This cannot be undone. Booking history will prevent deletion.</p>
      <div className="mt-4 flex gap-3"><button autoFocus className={adminButton} disabled={busy} onClick={() => setDeleting(null)}>Keep schedule</button><button className={`${adminButton} text-error`} disabled={busy} onClick={() => void remove()}>{busy ? "Deleting..." : "Confirm delete"}</button></div>
    </section>}
    <section className={adminPanel} aria-label="Schedule list">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-semibold">Department<select className={adminInput} value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); setDoctorId(""); }}><option value="">All departments</option>{choices?.departments.map((department) => <option key={department.departmentId} value={department.departmentId}>{department.name}</option>)}</select></label>
        <label className="text-sm font-semibold">Doctor<select className={adminInput} value={doctorId} onChange={(event) => setDoctorId(event.target.value)}><option value="">All doctors</option>{doctors.filter((doctor) => !departmentId || doctor.department?.departmentId === departmentId).map((doctor) => <option key={doctor.staffId} value={doctor.staffId}>{doctor.firstName} {doctor.lastName}{!doctor.active ? " (inactive)" : ""}</option>)}</select></label>
        <label className="text-sm font-semibold">Date<input type="date" className={adminInput} value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label className="text-sm font-semibold">Status<select className={adminInput} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="OPEN">Open</option><option value="BLOCKED">Blocked</option><option value="BOOKED">Booked (read-only)</option></select></label>
      </div>
      <button className={`${adminButton} mt-4`} onClick={() => { setDepartmentId(""); setDoctorId(""); setDate(""); setStatus(""); }}>Clear filters</button>
      {loading ? <p role="status" className="mt-5">Loading schedules...</p> : <>
        <p role="status" className="mt-5 text-sm text-neutral-500">{visible.length} schedule(s)</p>
        {visible.length === 0 ? <p className="mt-4 text-sm">No schedules match these filters.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b border-primary/15">{["Doctor / department", "Date", "Time", "Capacity", "Status", "Actions"].map((label) => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead><tbody>{visible.map((slot) => <tr key={slot.slotId} className="border-b border-primary/10">
          <td className="p-3">{slot.staff ? `${slot.staff.firstName} ${slot.staff.lastName}` : "Doctor unavailable"}<p className="text-xs text-neutral-500">{slot.staff?.department?.name ?? "Unassigned"}</p></td><td className="p-3">{slot.slotDate}</td><td className="p-3">{slot.startTime}–{slot.endTime}</td><td className="p-3">{slot.capacity}</td><td className="p-3">{slot.slotStatus}</td>
          <td className="p-3">{slot.slotStatus === "BOOKED" ? <span className="text-neutral-500">Protected</span> : <div className="flex gap-2"><button className={adminButton} disabled={busy || !choices || !!choicesError} onClick={() => openForm(slot)}>Edit</button><button className={`${adminButton} text-error`} disabled={busy} onClick={() => { setDeleting(slot); setShowForm(false); setError(""); setSuccess(""); }}>Delete</button></div>}</td>
        </tr>)}</tbody></table></div>}
      </>}
    </section>
  </>;
}

export default function AdminSchedules() {
  return <AdminManagementAccess><ScheduleManager /></AdminManagementAccess>;
}
