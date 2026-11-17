"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bell } from "lucide-react";
import SessionExpiredAction from "@/components/auth/SessionExpiredAction";
import { broadcastRecipientCount, broadcastSchedules, scheduleBroadcastBody, type ScheduleBroadcastInput } from "@/lib/schedule-broadcast";
import type { createStaffApi, ScheduleSlot } from "@/lib/staff";

const inputClass = "mt-1.5 min-h-11 w-full rounded-lg border border-primary/25 bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50";

export default function ScheduleBroadcast({ slots, staffId, api }: {
  slots: ScheduleSlot[];
  staffId: string;
  api: ReturnType<typeof createStaffApi>;
}) {
  const [slotId, setSlotId] = useState("");
  const [values, setValues] = useState<ScheduleBroadcastInput>({ type: "DELAY", message: "", delayMinutes: "15" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inFlight = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  const candidates = broadcastSchedules(slots, staffId);
  const selectedId = candidates.some((slot) => slot.slotId === slotId) ? slotId : "";

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted || inFlight.current) return;
    setError("");
    setNotice("");
    if (!selectedId) { setError("Choose one of your clinic windows."); return; }
    let body: ReturnType<typeof scheduleBroadcastBody>;
    try { body = scheduleBroadcastBody(values); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Check the notice details."); return; }
    if (!window.confirm("Send this notice to all booked or waiting patients in the selected clinic window? It will not cancel or reschedule their appointments.")) return;
    inFlight.current = true;
    setSaving(true);
    try {
      const result = await api(`/schedules/${encodeURIComponent(selectedId)}/broadcast`, { method: "POST", body: JSON.stringify(body), signal });
      const count = broadcastRecipientCount(result);
      if (!signal.aborted) {
        setNotice(count === 0 ? "No booked or waiting patients needed a notice for this window." : `Notice sent to ${count} patient${count === 1 ? "" : "s"}. Appointments remain unchanged.`);
        setValues((current) => ({ ...current, message: "" }));
      }
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : "Could not send this notice. Check with the clinic before retrying.");
    } finally {
      inFlight.current = false;
      if (!signal.aborted) setSaving(false);
    }
  }

  return <section aria-labelledby="broadcast-heading" className="mt-6 rounded-2xl border border-primary/15 bg-surface p-5 shadow-sm">
    <h2 id="broadcast-heading" className="flex items-center gap-2 text-lg font-bold"><Bell size={18} aria-hidden="true" className="text-primary" /> Notify patients of a delay or absence</h2>
    <p className="mt-2 text-sm text-neutral-600">Send a clinic notification to each patient booked or waiting in one of your clinic windows, including full windows. All your windows are listed, newest first, so a browser timezone difference will not hide patients still waiting. Completed, cancelled, no-show, and in-consultation appointments are excluded. This does not cancel appointments, change your current availability, or send SMS/email.</p>
    {candidates.length === 0 ? <p className="mt-4 text-sm text-neutral-600">No clinic windows available. Add a window above or ask an administrator to schedule one.</p> : <form onSubmit={send} aria-busy={saving} className="mt-4 space-y-4">
      <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold sm:col-span-2">Clinic window
          <select required value={selectedId} onChange={(event) => setSlotId(event.target.value)} className={inputClass}>
            <option value="">Select your clinic window</option>
            {candidates.map((slot) => <option key={slot.slotId} value={slot.slotId}>{slot.slotDate} · {slot.startTime.slice(0, 5)}–{slot.endTime.slice(0, 5)} · {slot.slotStatus}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Notice type
          <select value={values.type} onChange={(event) => setValues((current) => ({ ...current, type: event.target.value as ScheduleBroadcastInput["type"] }))} className={inputClass}>
            <option value="DELAY">Doctor delayed</option><option value="ABSENCE">Doctor absent</option>
          </select>
        </label>
        {values.type === "DELAY" && <label className="text-sm font-semibold">Expected delay (minutes)
          <input required type="number" min={1} max={1440} step={1} value={values.delayMinutes} onChange={(event) => setValues((current) => ({ ...current, delayMinutes: event.target.value }))} className={inputClass} />
        </label>}
        <label className="text-sm font-semibold sm:col-span-2">Message to patients
          <textarea required maxLength={500} rows={3} value={values.message} onChange={(event) => setValues((current) => ({ ...current, message: event.target.value }))} placeholder="Explain the delay or absence and any instructions for patients." className={inputClass} />
        </label>
      </fieldset>
      <button type="submit" disabled={saving || !selectedId} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Sending notice..." : "Send notice to patients"}</button>
    </form>}
    {error && <p role="alert" className="mt-3 text-sm text-error">{error}<SessionExpiredAction message={error} returnTo="/staff" /></p>}
    {notice && <p role="status" className="mt-3 text-sm font-semibold text-success">{notice}</p>}
  </section>;
}
