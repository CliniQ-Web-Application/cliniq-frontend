"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import AppointmentCard from "@/components/appointments/AppointmentCard";
import PageHeader from "@/components/ui/PageHeader";
import { bookingApi } from "@/lib/api-client";
import { BookingRequestError, bookingBody, parseBookingConfirmation, patientProfileBody, slotCapacityLabel, type BookingConfirmation, type PatientProfileInput } from "@/lib/booking";
import { queryKeys } from "@/lib/query-keys";
import { useAvailability, useBookings, usePatientProfile } from "@/lib/queries";
import SessionExpiredAction from "@/components/auth/SessionExpiredAction";

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
    return <PatientBooking key={user.id} />;
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
  return (
    <AppointmentCard
      title={booking.departmentName ?? "Department no longer assigned"}
      subtitle={`Dr. ${booking.doctorName} · ${booking.slotDate} · ${booking.appointmentTime?.slice(0, 5) ?? `${booking.startTime.slice(0, 5)} – ${booking.endTime.slice(0, 5)}`} (clinic time)`}
      status={booking.appointmentStatus}
      details={[
        { label: "Date", value: booking.slotDate },
        { label: "Time", value: booking.appointmentTime?.slice(0, 5) ?? `${booking.startTime.slice(0, 5)} – ${booking.endTime.slice(0, 5)}` },
      ]}
      footer={<p className="mt-3 break-all text-sm text-neutral-500">Appointment ID: {booking.appointmentId}</p>}
      href={`/patient/appointments/${encodeURIComponent(booking.appointmentId)}`}
    />
  );
}

function PatientBooking() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [departmentId, setDepartmentId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState("");
  const [slotId, setSlotId] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [profileInput, setProfileInput] = useState<PatientProfileInput>(() => {
    const meta = user?.user_metadata;
    const text = (key: string) => typeof meta?.[key] === "string" ? meta[key] : "";
    return { patientName: text("first_name"), patientSurname: text("last_name"), nationalID: text("national_id"), phone: text("phone") };
  });
  const [profileError, setProfileError] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [success, setSuccess] = useState<BookingConfirmation | null>(null);
  const [uncertainSlot, setUncertainSlot] = useState<string | null>(null);
  const inFlight = useRef(false);
  const profileInFlight = useRef(false);

  // All three data sets are read from the shared, periodically refreshed cache.
  const profileQuery = usePatientProfile();
  const { data: slots = [], isPending: loading, error: availabilityErrorCause, refetch: refetchAvailability } = useAvailability();
  const { data: bookings = [], isPending: bookingsLoading, error: bookingsErrorCause, refetch: refetchBookings } = useBookings();

  const profileState: "loading" | "missing" | "ready" | "error" = profileQuery.isPending
    ? "loading"
    : profileQuery.isSuccess
      ? "ready"
      : profileQuery.error instanceof BookingRequestError && profileQuery.error.status === 404
        ? "missing"
        : "error";
  const profileMessage = profileQuery.error && profileState === "error"
    ? messageOf(profileQuery.error, "check your patient profile")
    : "";
  const availabilityError = availabilityErrorCause ? messageOf(availabilityErrorCause, "load clinic availability") : "";
  const bookingsError = bookingsErrorCause ? messageOf(bookingsErrorCause, "load your appointments") : "";
  const displayedProfileError = profileError || profileMessage;

  // A background refresh can remove a slot; don't leave a stale selection.
  useEffect(() => {
    setSlotId((current) => current && slots.some((slot) => slot.slotId === current) ? current : "");
  }, [slots]);

  async function saveProfile(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (profileInFlight.current) return;
    let body: PatientProfileInput;
    try { body = patientProfileBody(profileInput); }
    catch (cause) { setProfileError(messageOf(cause, "validate your profile")); return; }
    profileInFlight.current = true;
    setSavingProfile(true);
    setProfileError("");
    try {
      const data = await bookingApi("/patients/me", { method: "POST", body: JSON.stringify(body) });
      if (!data || typeof data !== "object" || !("patientID" in data)) throw new Error("Could not verify your saved profile. Use Retry profile check before submitting again.");
      // Invalidate the shared profile cache so every page sees the saved data.
      await queryClient.invalidateQueries({ queryKey: queryKeys.patientProfile });
    } catch (cause) {
      setProfileError(messageOf(cause, "save your profile"));
    } finally {
      profileInFlight.current = false;
      setSavingProfile(false);
    }
  }

  async function book(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !selectedSlot || !appointmentTime || controlsDisabled) return;
    const selectedId = selectedSlot.slotId;
    inFlight.current = true;
    setSubmitting(true);
    setBookingError("");
    setSuccess(null);
    try {
      const data = await bookingApi("/bookings", { method: "POST", body: JSON.stringify(bookingBody(selectedId, appointmentTime)) });
      const confirmation = parseBookingConfirmation(data);
      if (confirmation.appointmentStatus !== "BOOKED" || confirmation.slotId !== selectedId) {
        throw new Error("The booking response could not be verified.");
      }
      setSuccess(confirmation);
      setSlotId("");
      setAppointmentTime("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.bookings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.availability }),
      ]);
    } catch (cause) {
      if (cause instanceof BookingRequestError && (cause.status === 409 || cause.status === 404)) {
        setBookingError(`${messageOf(cause, "complete the booking")} Please review the refreshed availability and your patient profile.`);
        setSlotId("");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.availability }),
          queryClient.invalidateQueries({ queryKey: queryKeys.patientProfile }),
          queryClient.invalidateQueries({ queryKey: queryKeys.bookings }),
        ]);
      } else if (cause instanceof BookingRequestError && cause.status >= 400 && cause.status < 500) {
        setBookingError(messageOf(cause, "complete the booking"));
      } else {
        setUncertainSlot(selectedId);
        setBookingError("We could not verify whether your booking was saved. Do not book again yet. Check your appointments below, or contact the clinic if it remains unclear.");
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  async function checkBookings() {
    if (bookingsLoading || inFlight.current || !uncertainSlot) return;
    const result = await refetchBookings();
    const list = result.data ?? [];
    const match = list.find((item) => item.slotId === uncertainSlot && item.appointmentStatus === "BOOKED");
    if (match) {
      setSuccess(match);
      setUncertainSlot(null);
      setBookingError("");
      setSlotId("");
      await refetchAvailability();
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

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader
          title="Book an appointment"
          description="Choose a department, doctor, and clinic time. View your appointments from the patient menu."
        />

        <Link href="/patient/appointments" className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white">
          <Eye size={18} aria-hidden="true" /> View appointments
        </Link>
        {profileState === "loading" && <p role="status" className="mb-4">Checking your patient profile...</p>}
        {profileState === "error" && <div role="alert" className="mb-5"><p>{displayedProfileError}<SessionExpiredAction message={displayedProfileError} returnTo="/patient/book-appointment" /></p><button className="min-h-11 text-primary underline" onClick={() => void profileQuery.refetch()}>Retry profile check</button></div>}
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
            {displayedProfileError && <p role="alert" className="text-error">{displayedProfileError}<SessionExpiredAction message={displayedProfileError} returnTo="/patient/book-appointment" /></p>}
            <button type="submit" disabled={savingProfile || submitting} className={buttonClass}>{savingProfile ? "Saving profile..." : "Save patient profile"}</button>
            <button type="button" disabled={savingProfile || submitting} onClick={() => void profileQuery.refetch()} className="ml-3 min-h-11 text-primary underline disabled:opacity-50">Retry profile check</button>
          </form>
        )}
        {loading && <p role="status" className="mb-4 text-sm">Loading clinic availability...</p>}
        {availabilityError && <div role="alert" className="mb-5 text-error"><p>{availabilityError}<SessionExpiredAction message={availabilityError} returnTo="/patient/book-appointment" /></p><button type="button" disabled={submitting || loading} onClick={() => void refetchAvailability()} className="min-h-11 text-primary underline disabled:opacity-50">{loading ? "Retrying..." : "Retry availability"}</button></div>}
        {!loading && !availabilityError && slots.length === 0 && <p role="status" className="mb-5">No appointments can be booked yet. A staff member must add a future open time for an active doctor with a department.</p>}
        {bookingsError && <p role="alert" className="mb-5 text-error">{bookingsError}</p>}
        {bookingError && <div role="alert" className="mb-5 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error"><p>{bookingError}<SessionExpiredAction message={bookingError} returnTo="/patient/book-appointment" /></p>{uncertainSlot && <button type="button" onClick={() => void checkBookings()} className="inline-block min-h-11 pt-3 underline">Check my appointments before booking again</button>}</div>}
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
          <button type="button" disabled={submitting || loading || savingProfile} onClick={() => void refetchAvailability()} className="min-h-11 text-primary underline disabled:opacity-50">{loading ? "Refreshing availability..." : "Refresh availability"}</button>
        </form>

      </div>
    </main>
  );
}
