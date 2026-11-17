"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ADMIN_APPOINTMENT_STATUSES, EMPTY_APPOINTMENT_FILTERS, adminError, appointmentRequestParams,
  parseAdminAppointment, parseAdminAppointmentPage,
  type AdminAppointment, type AdminAppointmentPage, type AppointmentFilters,
} from "@/lib/admin-management";
import { appointmentStatusPresentation } from "@/lib/appointment-status";
import AdminManagementAccess, {
  AdminMessages, adminButton, adminInput, adminPanel, adminPrimaryButton, useAdminChoices, useAdminRequest,
} from "./AdminManagementAccess";

function Status({ value }: { value: string | null }) {
  const status = appointmentStatusPresentation(value ?? "");
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>;
}
function display(value: string | null | undefined): string { return value?.trim() || "Not recorded"; }
function timestamp(value: string | null): string { return value ? value.replace("T", " ") : "Not recorded"; }

function AppointmentManager() {
  const api = useAdminRequest();
  const { choices, error: choicesError, retry: retryChoices } = useAdminChoices();
  const [draft, setDraft] = useState<AppointmentFilters>({ ...EMPTY_APPOINTMENT_FILTERS });
  const [query, setQuery] = useState({ filters: { ...EMPTY_APPOINTMENT_FILTERS }, page: 0, revision: 0 });
  const [result, setResult] = useState<{ data: AdminAppointmentPage; key: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminAppointment | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailRevision, setDetailRevision] = useState(0);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const mutation = useRef<AbortController | null>(null);
  const detailHeading = useRef<HTMLHeadingElement | null>(null);
  const inspectTrigger = useRef<HTMLButtonElement | null>(null);
  const params = appointmentRequestParams(query.filters, query.page);
  const resultKey = `${params}:${query.revision}`;

  useEffect(() => () => mutation.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setListError("");
    void api(`/admin/appointments?${params}`, { signal: controller.signal }).then((value) => {
      const data = parseAdminAppointmentPage(value);
      if (controller.signal.aborted) return;
      if (data.page !== query.page || data.size !== 20) throw new Error("The clinic returned a different appointment page. Please refresh.");
      if (query.page > 0 && query.page >= data.totalPages) {
        setQuery((current) => ({ ...current, page: Math.max(0, data.totalPages - 1) }));
        return;
      }
      setResult({ data, key: resultKey });
    }).catch((cause) => { if (!controller.signal.aborted) { setResult(null); setListError(adminError(cause)); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, params, resultKey, query.page]);

  useEffect(() => {
    const controller = new AbortController();
    setDetail(null); setDetailError(""); setConfirmCancel(false);
    if (!selectedId) { setDetailLoading(false); return () => controller.abort(); }
    setDetailLoading(true);
    detailHeading.current?.focus();
    void api(`/admin/appointments/${encodeURIComponent(selectedId)}`, { signal: controller.signal }).then((value) => {
      const appointment = parseAdminAppointment(value);
      if (appointment.appointmentId !== selectedId) throw new Error("The clinic returned a different appointment. Please retry inspection.");
      if (!controller.signal.aborted) setDetail(appointment);
    }).catch((cause) => { if (!controller.signal.aborted) setDetailError(adminError(cause)); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [api, selectedId, detailRevision]);

  function closeDetail() {
    setSelectedId(null); setConfirmCancel(false); setActionError(""); inspectTrigger.current?.focus();
  }
  function change(field: keyof AppointmentFilters, value: string) {
    setDraft((current) => ({ ...current, [field]: value, ...(field === "departmentId" ? { doctorId: "" } : {}) }));
  }
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      appointmentRequestParams(draft);
      setFilterError(""); setSuccess(""); closeDetail();
      setQuery((current) => ({ filters: { ...draft }, page: 0, revision: current.revision + 1 }));
    } catch (cause) { setFilterError(adminError(cause)); }
  }
  function refresh() {
    setQuery((current) => ({ ...current, revision: current.revision + 1 }));
    if (selectedId) setDetailRevision((value) => value + 1);
    retryChoices();
  }
  async function cancel() {
    if (!detail || detail.appointmentId !== selectedId || detail.appointmentStatus !== "BOOKED" || mutation.current || detailLoading) return;
    const controller = new AbortController(); mutation.current = controller;
    setBusy(true); setActionError(""); setSuccess("");
    try {
      const updated = parseAdminAppointment(await api(`/admin/appointments/${encodeURIComponent(detail.appointmentId)}/cancel`, { method: "PATCH", signal: controller.signal }));
      if (updated.appointmentId !== detail.appointmentId || updated.appointmentStatus !== "CANCELLED") throw new Error("The cancellation response could not be verified. Refresh before trying again.");
      if (!controller.signal.aborted) {
        setDetail(updated); setConfirmCancel(false); setSuccess("Appointment cancelled. The clinic has released its booked capacity safely.");
        setQuery((current) => ({ ...current, revision: current.revision + 1 }));
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setActionError(adminError(cause)); setConfirmCancel(false);
        // Re-read status after a conflict or a lost response rather than allowing a blind retry.
        setDetail(null); setDetailRevision((value) => value + 1);
      }
    } finally { if (!controller.signal.aborted) { mutation.current = null; setBusy(false); } }
  }

  const currentResult = result?.key === resultKey ? result.data : null;
  const fetching = loading || (!currentResult && !listError);
  const currentDetail = detail?.appointmentId === selectedId ? detail : null;
  const doctors = choices?.doctors.filter((member) => member.staffRole === "DOCTOR" && (!draft.departmentId || member.department?.departmentId === draft.departmentId)) ?? [];

  return <>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">AP-08 · Hospital-wide oversight</p><h1 className="mt-2 text-3xl font-bold">Appointments</h1><p className="mt-2 text-sm text-neutral-600">Search all appointments, inspect patient contact and activity, or cancel a booked appointment.</p></div><button className={adminButton} disabled={busy || fetching} onClick={refresh}>Refresh</button></div>
    <AdminMessages error={filterError || choicesError} success={success} />
    {choicesError && <button className={`${adminButton} mt-3`} onClick={retryChoices}>Retry filter choices</button>}
    <form onSubmit={apply} className={adminPanel} aria-label="Appointment filters">
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-semibold">From date<input type="date" className={adminInput} value={draft.from} onChange={(event) => change("from", event.target.value)} /></label>
        <label className="text-sm font-semibold">To date (inclusive)<input type="date" className={adminInput} value={draft.to} onChange={(event) => change("to", event.target.value)} /></label>
        <label className="text-sm font-semibold">Status<select className={adminInput} value={draft.status} onChange={(event) => change("status", event.target.value)}><option value="">All statuses</option>{ADMIN_APPOINTMENT_STATUSES.map((status) => <option key={status} value={status}>{appointmentStatusPresentation(status).label}</option>)}</select></label>
        <label className="text-sm font-semibold">Department<select className={adminInput} value={draft.departmentId} onChange={(event) => change("departmentId", event.target.value)}><option value="">All departments</option>{choices?.departments.map((department) => <option key={department.departmentId} value={department.departmentId}>{department.name}</option>)}</select></label>
        <label className="text-sm font-semibold">Doctor<select className={adminInput} value={draft.doctorId} onChange={(event) => change("doctorId", event.target.value)}><option value="">All doctors</option>{doctors.map((doctor) => <option key={doctor.staffId} value={doctor.staffId}>{doctor.firstName} {doctor.lastName}{!doctor.active ? " (inactive)" : ""}</option>)}</select></label>
        <label className="text-sm font-semibold">Search patient / contact / appointment<input type="search" className={adminInput} maxLength={200} value={draft.search} onChange={(event) => change("search", event.target.value)} placeholder="Name, email, phone or appointment ID" /></label>
        <div className="flex flex-wrap gap-3 sm:col-span-2 lg:col-span-3"><button className={adminPrimaryButton} type="submit">Apply filters</button><button className={adminButton} type="button" onClick={() => { setDraft({ ...EMPTY_APPOINTMENT_FILTERS }); setQuery((current) => ({ filters: { ...EMPTY_APPOINTMENT_FILTERS }, page: 0, revision: current.revision + 1 })); setFilterError(""); setSuccess(""); closeDetail(); }}>Reset filters</button></div>
      </fieldset>
      <p className="mt-3 text-xs text-neutral-500">Filters are sent to the server when applied. Dates use the slot date, or creation date for appointments without a slot. Results retain the clinic’s newest-first order.</p>
    </form>
    <section className={adminPanel} aria-label="Appointment results" aria-busy={fetching}>
      <AdminMessages error={listError} />
      {listError && <button className={`${adminButton} mt-3`} onClick={refresh}>Retry appointments</button>}
      {fetching ? <p role="status">Loading appointments...</p> : currentResult && <>
        <p role="status" className="text-sm text-neutral-600">{currentResult.totalElements} appointment(s) · Page {currentResult.totalPages ? currentResult.page + 1 : 0} of {currentResult.totalPages}</p>
        {currentResult.items.length === 0 ? <p className="mt-5 text-sm">No appointments match the applied filters.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b border-primary/15">{["Patient", "Doctor / department", "Slot date / time", "Status", "Priority", "Booked / created", "Action"].map((label) => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead><tbody>{currentResult.items.map((appointment) => <tr key={appointment.appointmentId} className="border-b border-primary/10">
          <td className="p-3 font-semibold">{display(appointment.patientName)}</td><td className="p-3">{display(appointment.doctorName)}<p className="text-xs text-neutral-500">{display(appointment.departmentName)}</p></td><td className="p-3">{display(appointment.slotDate)}<p className="text-xs text-neutral-500">{appointment.startTime ? `${appointment.startTime}–${display(appointment.endTime)}` : display(appointment.appointmentTime)}</p></td><td className="p-3"><Status value={appointment.appointmentStatus} /></td><td className="p-3">{display(appointment.priority)}</td><td className="p-3">{timestamp(appointment.bookedAt ?? appointment.createdAt)}</td><td className="p-3"><button className={adminButton} disabled={busy} aria-label={`Inspect appointment for ${appointment.patientName || "unknown patient"}`} onClick={(event) => { inspectTrigger.current = event.currentTarget; setSelectedId(appointment.appointmentId); setDetailRevision((value) => value + 1); setConfirmCancel(false); setActionError(""); setSuccess(""); }}>Inspect</button></td>
        </tr>)}</tbody></table></div>}
        <nav aria-label="Appointment pagination" className="mt-5 flex flex-wrap items-center gap-3"><button className={adminButton} disabled={busy || currentResult.page === 0} onClick={() => { closeDetail(); setQuery((current) => ({ ...current, page: current.page - 1 })); }}>Previous</button><button className={adminButton} disabled={busy || currentResult.page + 1 >= currentResult.totalPages} onClick={() => { closeDetail(); setQuery((current) => ({ ...current, page: current.page + 1 })); }}>Next</button><span className="text-xs text-neutral-500">20 per page</span></nav>
      </>}
    </section>
    {selectedId && <section className={adminPanel} aria-labelledby="appointment-detail-title" aria-busy={detailLoading}>
      <div className="flex items-center justify-between gap-4"><h2 id="appointment-detail-title" tabIndex={-1} ref={detailHeading} className="text-xl font-bold">Appointment inspection</h2><button className={adminButton} disabled={busy} onClick={closeDetail}>Close inspection</button></div>
      <AdminMessages error={detailError || actionError} />
      {detailLoading ? <p role="status" className="mt-4">Loading appointment details...</p> : currentDetail ? <>
        <div className="mt-4"><Status value={currentDetail.appointmentStatus} /></div>
        <div className="mt-5 grid gap-6 md:grid-cols-3">
          <div><h3 className="font-bold">Patient contact</h3><dl className="mt-3 space-y-3 text-sm">{[["Name", currentDetail.patientName], ["Email", currentDetail.patientEmail], ["Phone", currentDetail.patientPhone], ["Patient ID", currentDetail.patientId]].map(([label, value]) => <div key={label}><dt className="text-neutral-500">{label}</dt><dd className="break-words">{display(value)}</dd></div>)}</dl></div>
          <div><h3 className="font-bold">Appointment and slot</h3><dl className="mt-3 space-y-3 text-sm">{[["Appointment ID", currentDetail.appointmentId], ["Priority", currentDetail.priority], ["Doctor", currentDetail.doctorName], ["Department", currentDetail.departmentName], ["Slot ID", currentDetail.slotId], ["Slot date", currentDetail.slotDate], ["Slot start", currentDetail.startTime], ["Slot end", currentDetail.endTime], ["Appointment time", currentDetail.appointmentTime]].map(([label, value]) => <div key={label}><dt className="text-neutral-500">{label}</dt><dd className="break-words">{display(value)}</dd></div>)}</dl></div>
          <div><h3 className="font-bold">Activity (clinic time)</h3><dl className="mt-3 space-y-3 text-sm">{[["Booked", currentDetail.bookedAt], ["Created", currentDetail.createdAt], ["Checked in", currentDetail.checkInTime], ["Called", currentDetail.calledTime], ["Completed", currentDetail.completedTime]].map(([label, value]) => <div key={label}><dt className="text-neutral-500">{label}</dt><dd>{timestamp(value)}</dd></div>)}</dl></div>
        </div>
        {currentDetail.appointmentStatus === "BOOKED" ? confirmCancel ? <div role="alertdialog" aria-modal="false" aria-labelledby="cancel-appointment-title" aria-describedby="cancel-appointment-description" className="mt-6 rounded-lg border border-error/25 p-4"><h3 id="cancel-appointment-title" className="font-bold">Cancel this appointment?</h3><p id="cancel-appointment-description" className="mt-2 text-sm">Cancel the booking for {display(currentDetail.patientName)} on {display(currentDetail.slotDate)} at {display(currentDetail.startTime ?? currentDetail.appointmentTime)}? This cannot be undone. The server will safely release the booked capacity.</p><div className="mt-4 flex flex-wrap gap-3"><button autoFocus className={adminButton} disabled={busy} onClick={() => setConfirmCancel(false)}>Keep appointment</button><button className={`${adminButton} text-error`} disabled={busy} onClick={() => void cancel()}>{busy ? "Cancelling..." : "Confirm cancellation"}</button></div></div> : <button className={`${adminButton} mt-6 text-error`} disabled={busy} onClick={() => { setConfirmCancel(true); setActionError(""); }}>Cancel booked appointment</button> : <p className="mt-6 text-sm text-neutral-500">Only BOOKED appointments can be cancelled here. No-show and rescheduling actions are not available.</p>}
      </> : null}
      {detailError && <button className={`${adminButton} mt-4`} disabled={busy} onClick={() => setDetailRevision((value) => value + 1)}>Retry inspection</button>}
    </section>}
  </>;
}

export default function AdminAppointments() {
  return <AdminManagementAccess><AppointmentManager /></AdminManagementAccess>;
}
