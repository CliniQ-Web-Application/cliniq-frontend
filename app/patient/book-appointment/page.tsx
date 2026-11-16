"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import {ArrowLeft, CalendarPlus, Eye, PenLine} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import CheckInQr from "@/components/booking/CheckInQr";
import { supabase } from "@/lib/supabase";
import { appointmentStatusPresentation } from "@/lib/appointment-status";
import SessionExpiredAction from "@/components/auth/SessionExpiredAction";
import {
  availableBookingSlots, bookingBody, BookingRequestError, createBookingApi,
  parseBookingConfirmation, patientProfileBody, slotCapacityLabel,
  type BookingConfirmation, type BookingSlot, type PatientProfileInput,
} from "@/lib/booking";

const inputClass = "mt-2 h-11 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50";
const buttonClass = "min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";
function toMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function fromMinutes(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

const messageOf = (cause: unknown, action: string) => {
  if (cause instanceof BookingRequestError) {
    if (cause.status === 403) return "This page is for patient accounts. Sign out and sign in with a patient account.";
    if (cause.status === 401) return "Your session has expired. Sign in again and retry.";
    return cause.message;
  }
  return cause instanceof Error ? cause.message : `Could not ${action}. Please try again.`;
};

export default function BookAppointmentPage() {
  const { user, profile, role, session, loading } = useAuth();
  // Key by identity, not token: a refresh must not discard a selection or confirmation.
  if (user && profile?.id === user.id && role === "PATIENT" && session?.user.id === user.id) {
    return <PatientBooking key={user.id} user={user} />;
  }
  return (
    <main className="min-h-screen bg-background p-8">
      {loading ? <p role="status">Checking your patient session...</p> : (
        <p>Patient sign-in is required. <Link href="/auth/signin" className="text-primary underline">Sign in</Link></p>
      )}
    </main>
  );
}

function Confirmation({ booking }: { booking: BookingConfirmation }) {
  const status = appointmentStatusPresentation(booking.appointmentStatus);
  return (
    <div className="rounded-xl border border-primary/20 bg-accent-surface p-4 text-sm">
      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
      <p className="mt-2 break-all">Appointment ID: {booking.appointmentId}</p>
      <p>{booking.departmentName ?? "Department no longer assigned"} · {booking.doctorName}</p>
      <p>{booking.slotDate} · {booking.appointmentTime?.slice(0, 5) ?? `${booking.startTime.slice(0, 5)} – ${booking.endTime.slice(0, 5)}`} (clinic time)</p>
      <p className="mt-2 text-neutral-700">{status.description}</p>
      <Link href={`/patient/appointments/${encodeURIComponent(booking.appointmentId)}`} className="mt-3 inline-flex min-h-10 items-center font-semibold text-primary underline">View appointment details</Link>
    </div>
  );
}

function PatientBooking({ user }: { user: User }) {
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState("");
  const [slotId, setSlotId] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [profileState, setProfileState] = useState<"loading" | "missing" | "ready" | "error">("loading");
  const [profileError, setProfileError] = useState("");
  const [profileInput, setProfileInput] = useState<PatientProfileInput>(() => {
    const meta = user.user_metadata;
    const text = (key: string) => typeof meta[key] === "string" ? meta[key] : "";
    return { patientName: text("first_name"), patientSurname: text("last_name"), nationalID: text("national_id"), phone: text("phone") };
  });
  const [loading, setLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [success, setSuccess] = useState<BookingConfirmation | null>(null);
  const [uncertainSlot, setUncertainSlot] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingConfirmation[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState("");
  const inFlight = useRef(false);
  const profileInFlight = useRef(false);
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

  const loadProfile = useCallback(async (signal: AbortSignal) => {
    setProfileState("loading");
    setProfileError("");
    try {
      const data = await api("/patients/me", { signal });
      if (!data || typeof data !== "object" || !("patientID" in data)) throw new Error("Could not read your patient profile. Please retry.");
      if (!signal.aborted) setProfileState("ready");
    } catch (cause) {
      if (signal.aborted) return;
      if (cause instanceof BookingRequestError && cause.status === 404) setProfileState("missing");
      else { setProfileState("error"); setProfileError(messageOf(cause, "check your patient profile")); }
    }
  }, [api]);

  const loadAvailability = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setAvailabilityError("");
    try {
      const data = await api("/bookings/availability", { signal });
      if (!Array.isArray(data)) throw new Error("The clinic returned an unexpected availability response.");
      const available = availableBookingSlots(data);
      if (!signal.aborted) {
        setSlots(available);
        setSlotId((current) => available.some((slot) => slot.slotId === current) ? current : "");
      }
    } catch (cause) {
      if (!signal.aborted) setAvailabilityError(messageOf(cause, "load clinic availability"));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [api]);

  const loadBookings = useCallback(async (signal: AbortSignal): Promise<BookingConfirmation[] | null> => {
    setBookingsLoading(true);
    setBookingsError("");
    try {
      const data = await api("/bookings", { signal });
      if (!Array.isArray(data)) throw new Error("The clinic returned an unexpected appointments response.");
      const list = data.map(parseBookingConfirmation);
      if (signal.aborted) return null;
      setBookings(list);
      return list;
    } catch (cause) {
      if (!signal.aborted) setBookingsError(messageOf(cause, "load your appointments"));
      return null;
    } finally {
      if (!signal.aborted) setBookingsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      void loadProfile(controller.signal);
      void loadAvailability(controller.signal);
      void loadBookings(controller.signal);
    });
    return () => controller.abort();
  }, [loadProfile, loadAvailability, loadBookings]);

  async function saveProfile(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted || profileInFlight.current) return;
    let body: PatientProfileInput;
    try { body = patientProfileBody(profileInput); }
    catch (cause) { setProfileError(messageOf(cause, "validate your profile")); return; }
    profileInFlight.current = true;
    setSavingProfile(true);
    setProfileError("");
    try {
      const data = await api("/patients/me", { method: "POST", body: JSON.stringify(body), signal });
      if (!data || typeof data !== "object" || !("patientID" in data)) throw new Error("Could not verify your saved profile. Use Retry profile check before submitting again.");
      if (!signal.aborted) setProfileState("ready");
    } catch (cause) {
      if (!signal.aborted) setProfileError(messageOf(cause, "save your profile"));
    } finally {
      profileInFlight.current = false;
      if (!signal.aborted) setSavingProfile(false);
    }
  }

  async function book(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted || inFlight.current || !selectedSlot || !appointmentTime || controlsDisabled) return;
    const selectedId = selectedSlot.slotId;
    inFlight.current = true;
    setSubmitting(true);
    setBookingError("");
    setSuccess(null);
    try {
      const data = await api("/bookings", { method: "POST", body: JSON.stringify(bookingBody(selectedId, appointmentTime)), signal });
      const confirmation = parseBookingConfirmation(data);
      if (confirmation.appointmentStatus !== "BOOKED" || confirmation.slotId !== selectedId) {
        throw new Error("The booking response could not be verified.");
      }
      if (signal.aborted) return;
      setSuccess(confirmation);
      setSlotId("");
      setAppointmentTime("");
      setBookings((current) => [confirmation, ...current.filter((item) => item.appointmentId !== confirmation.appointmentId)]);
      await loadAvailability(signal);
    } catch (cause) {
      if (signal.aborted) return;
      if (cause instanceof BookingRequestError && (cause.status === 409 || cause.status === 404)) {
        setBookingError(`${messageOf(cause, "complete the booking")} Please review the refreshed availability and your patient profile.`);
        setSlotId("");
        await Promise.all([loadAvailability(signal), loadProfile(signal), loadBookings(signal)]);
      } else if (cause instanceof BookingRequestError && cause.status >= 400 && cause.status < 500) {
        setBookingError(messageOf(cause, "complete the booking"));
      } else {
        setUncertainSlot(selectedId);
        setBookingError("We could not verify whether your booking was saved. Do not book again yet. Check your appointments below, or contact the clinic if it remains unclear.");
      }
    } finally {
      inFlight.current = false;
      if (!signal.aborted) setSubmitting(false);
    }
  }

  async function checkBookings() {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted || bookingsLoading || inFlight.current) return;
    const list = await loadBookings(signal);
    if (signal.aborted || !list || !uncertainSlot) return;
    const match = list.find((item) => item.slotId === uncertainSlot && item.appointmentStatus === "BOOKED");
    if (match) {
      setSuccess(match);
      setUncertainSlot(null);
      setBookingError("");
      setSlotId("");
      await loadAvailability(signal);
    } else {
      setBookingError("No confirmed appointment for that time is visible yet. Booking remains paused to avoid a duplicate. Check again shortly or contact the clinic before making another booking.");
    }
  }

  const departments = Array.from(new Map(slots.map((slot) => [slot.staff!.department!.departmentId, slot.staff!.department!])).values());
  const departmentSlots = slots.filter((slot) => slot.staff?.department?.departmentId === departmentId);
  const doctors = Array.from(new Map(departmentSlots.map((slot) => [slot.staff!.staffId, slot.staff!])).values());
  const doctorSlots = departmentSlots.filter((slot) => slot.staff?.staffId === staffId);
  const dates = Array.from(new Set(doctorSlots.map((slot) => slot.slotDate)));
  const dateSlots = doctorSlots.filter((slot) => slot.slotDate === date);
  const selectedSlot = dateSlots.find((slot) => slot.slotId === slotId);
  const firstAppointmentMinute = selectedSlot ? Math.ceil(toMinutes(selectedSlot.startTime) / 5) * 5 : 0;
  const appointmentTimes = selectedSlot ? Array.from(
    { length: Math.max(0, Math.ceil((toMinutes(selectedSlot.endTime) - firstAppointmentMinute) / 5)) },
    (_, index) => fromMinutes(firstAppointmentMinute + index * 5),
  ) : [];
  const controlsDisabled = loading || Boolean(availabilityError) || profileState !== "ready" || submitting || Boolean(uncertainSlot);
  const signal = () => lifetime.current!.signal;

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/patient" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft size={18} aria-hidden="true" /> Back to patient portal
        </Link>
        <header className="mb-8 mt-8">
          <CalendarPlus className="mb-3 text-primary" size={30} aria-hidden="true" />
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Patient appointments</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Book an appointment</h1>

          <p className="mt-3 text-neutral-600">Choose a department, doctor, and clinic time. <a href="/patient/appointments" className="text-primary underline">View your appointments</a></p>
        </header>

        <Link href="/patient/appointments" className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white">
          <Eye size={18} aria-hidden="true" /> View appointments
        </Link>
        {profileState === "loading" && <p role="status" className="mb-4">Checking your patient profile...</p>}
        {profileState === "error" && <div role="alert" className="mb-5"><p>{profileError}<SessionExpiredAction message={profileError} returnTo="/patient/book-appointment" /></p><button className="min-h-11 text-primary underline" onClick={() => void loadProfile(signal())}>Retry profile check</button></div>}
        {profileState === "missing" && (
          <form onSubmit={saveProfile} aria-busy={savingProfile} className="mb-6 space-y-4 rounded-xl border border-primary/20 bg-surface p-6">
            <h2 className="text-xl font-semibold">Complete your patient profile</h2>
            <p className="text-sm text-neutral-600">Review your registration details before saving. Your signed-in account supplies your email and profile ownership.</p>
            <fieldset disabled={savingProfile || submitting} className="grid gap-4 sm:grid-cols-2">
              {([
                ["patientName", "First name", "given-name"], ["patientSurname", "Surname", "family-name"],
                ["nationalID", "National ID (Omang)", "off"], ["phone", "Phone number", "tel"],
              ] as const).map(([field, label, autoComplete]) => (
                <label key={field} className="text-sm font-semibold">{label}
                  <input required type={field === "phone" ? "tel" : "text"} autoComplete={autoComplete} value={profileInput[field]} className={inputClass}
                    onChange={(event) => setProfileInput((current) => ({ ...current, [field]: event.target.value }))} />
                </label>
              ))}
            </fieldset>
            {profileError && <p role="alert" className="text-error">{profileError}<SessionExpiredAction message={profileError} returnTo="/patient/book-appointment" /></p>}
            <button type="submit" disabled={savingProfile || submitting} className={buttonClass}>{savingProfile ? "Saving profile..." : "Save patient profile"}</button>
            <button type="button" disabled={savingProfile || submitting} onClick={() => void loadProfile(signal())} className="ml-3 min-h-11 text-primary underline">Retry profile check</button>
          </form>
        )}
        {loading && <p role="status" className="mb-4 text-sm">Loading clinic availability...</p>}
        {availabilityError && <div role="alert" className="mb-5 text-error"><p>{availabilityError}<SessionExpiredAction message={availabilityError} returnTo="/patient/book-appointment" /></p><button type="button" disabled={submitting} onClick={() => void loadAvailability(signal())} className="min-h-11 underline">Retry availability</button></div>}
        {!loading && !availabilityError && slots.length === 0 && <p role="status" className="mb-5">No appointments can be booked yet. A staff member must add a future open time for an active doctor with a department.</p>}
        {bookingError && <div role="alert" className="mb-5 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error"><p>{bookingError}<SessionExpiredAction message={bookingError} returnTo="/patient/book-appointment" /></p>{uncertainSlot && <a href="#my-bookings" className="inline-block min-h-11 pt-3 underline">Check my appointments before booking again</a>}</div>}
        {success && <section role="status" aria-label="Booking confirmation" className="mb-6"><Confirmation booking={success} /></section>}

        <form onSubmit={book} aria-busy={submitting} className="space-y-6 rounded-2xl border border-primary/15 bg-surface p-6 shadow-sm sm:p-8">
          <fieldset disabled={controlsDisabled} className="grid gap-6 sm:grid-cols-2">
            <label className="block text-sm font-semibold">Department
              <select required value={departmentId} disabled={controlsDisabled || departments.length === 0} className={inputClass} onChange={(event) => { setDepartmentId(event.target.value); setStaffId(""); setDate(""); setSlotId(""); setAppointmentTime(""); }}>
                <option value="">Select a department</option>
                {departments.map((item) => <option key={item.departmentId} value={item.departmentId}>{item.name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold">Doctor
              <select required value={staffId} disabled={controlsDisabled || !departmentId || doctors.length === 0} className={inputClass} onChange={(event) => { setStaffId(event.target.value); setDate(""); setSlotId(""); setAppointmentTime(""); }}>
                <option value="">{departmentId && doctors.length === 0 ? "No doctors with open times" : "Select a doctor"}</option>
                {doctors.map((doctor) => <option key={doctor.staffId} value={doctor.staffId}>Dr. {doctor.firstName} {doctor.lastName}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold">Appointment date
              <select required value={date} disabled={controlsDisabled || !staffId} className={inputClass} onChange={(event) => { setDate(event.target.value); setSlotId(""); setAppointmentTime(""); }}>
                <option value="">Select an available date</option>
                {dates.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold">Availability window
              <select required value={slotId} disabled={controlsDisabled || !date} className={inputClass} onChange={(event) => { setSlotId(event.target.value); setAppointmentTime(""); }}>
                <option value="">Select a time</option>
                {dateSlots.map((slot) => <option key={slot.slotId} value={slot.slotId}>{slot.startTime.slice(0, 5)} – {slot.endTime.slice(0, 5)}{slotCapacityLabel(slot) ? ` · ${slotCapacityLabel(slot)}` : ""}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold">Appointment time (5-minute increments)
              <select required value={appointmentTime} disabled={controlsDisabled || !selectedSlot} className={inputClass} onChange={(event) => setAppointmentTime(event.target.value)}>
                <option value="">Select an appointment time</option>
                {appointmentTimes.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </fieldset>
          <p className="text-xs text-neutral-600">Dates and times use the clinic timezone. Selecting a time does not reserve it; your appointment is confirmed only after the clinic saves it.</p>
          {selectedSlot && <section aria-label="Appointment selection" aria-live="polite" className="rounded-xl bg-background p-4 text-sm">
            <h2 className="font-semibold">Your selection — not booked</h2>
            <p className="mt-2">{selectedSlot.staff?.department?.name} · Dr. {selectedSlot.staff?.firstName} {selectedSlot.staff?.lastName}</p>
            <p>{selectedSlot.slotDate} · {appointmentTime || "Choose a time"}{slotCapacityLabel(selectedSlot) ? ` · ${slotCapacityLabel(selectedSlot)}` : ""}</p>
            <p className="mt-1 text-xs text-neutral-500">You will be served in the order appointments are booked.</p>
          </section>}
          <button type="submit" disabled={controlsDisabled || !selectedSlot || !appointmentTime} className={`${buttonClass} w-full`}>{submitting ? "Booking appointment..." : "Confirm booking"}</button>
          <button type="button" disabled={submitting || loading || savingProfile} onClick={() => void loadAvailability(signal())} className="min-h-11 text-primary underline disabled:opacity-50">Refresh availability</button>
        </form>

      </div>
    </main>
  );
}
