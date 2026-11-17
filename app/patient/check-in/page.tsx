"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { BookingRequestError } from "@/lib/booking";
import { useBookings } from "@/lib/queries";
import { checkInQrPayload } from "@/lib/check-in-qr";
import { appointmentStatusPresentation } from "@/lib/appointment-status";
import PageHeader from "@/components/ui/PageHeader";
import SessionExpiredAction from "@/components/auth/SessionExpiredAction";

function requestError(cause: unknown) {
  if (cause instanceof BookingRequestError && cause.status === 401) return "Your session expired. Sign in again to prepare for check-in.";
  if (cause instanceof BookingRequestError && cause.status === 403) return "QR check-in is available to patient accounts. Sign in with your patient account.";
  return cause instanceof Error ? cause.message : "Could not load your appointments. Please try again.";
}

export default function PatientCheckInPage() {
  const { user, profile, role, session, loading } = useAuth();
  if (user && profile?.id === user.id && role === "PATIENT" && session?.user.id === user.id) {
    return <PatientCheckIn key={user.id} />;
  }
  return <main className="min-h-screen bg-background p-8">{loading ? <p role="status">Checking your patient session...</p> : <p>Patient sign-in is required. <Link href="/auth/signin" className="text-primary underline">Sign in</Link></p>}</main>;
}

function PatientCheckIn() {
  const [selectedId, setSelectedId] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  // Appointments come from the shared cache, refreshed periodically in the background.
  const { data: bookings = [], isPending: loading, isFetching, error, refetch } = useBookings();
  const displayError = qrError || (error ? requestError(error) : "");

  useEffect(() => {
    queueMicrotask(() => setSelectedId((current) => current && bookings.some((item) => item.appointmentId === current)
      ? current
      : bookings.find((item) => item.appointmentStatus.toUpperCase() === "BOOKED")?.appointmentId ?? ""));
  }, [bookings]);

  const selected = bookings.find((booking) => booking.appointmentId === selectedId);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) { setQrImage(""); setQrError(""); } });
    if (!selected || selected.appointmentStatus.toUpperCase() !== "BOOKED") return () => { cancelled = true; };
    queueMicrotask(() => { if (!cancelled) setQrLoading(true); });
    // The QR encodes a check-in URL; the staff scanner extracts the appointment id from it.
    void QRCode.toDataURL(checkInQrPayload(selected.appointmentId, window.location.origin), { errorCorrectionLevel: "M", margin: 2, width: 280 })
      .then((image) => { if (!cancelled) setQrImage(image); })
      .catch(() => { if (!cancelled) setQrError("Could not prepare your check-in QR code. Please select the appointment again."); })
      .finally(() => { if (!cancelled) setQrLoading(false); });
    return () => { cancelled = true; };
  }, [selected]);

  return <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader
        title="Check in with QR"
        description="Choose a booked appointment and show its QR code to clinic staff. Staff will scan it to record your arrival."
      />
      {displayError && <div role="alert" className="mb-5 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error">{displayError}<SessionExpiredAction message={displayError} returnTo="/patient/check-in" /><button type="button" disabled={loading} onClick={() => void refetch()} className="ml-2 underline disabled:opacity-50">{loading ? "Retrying..." : "Retry"}</button></div>}
      <section aria-busy={loading || isFetching} className="space-y-4 rounded-2xl border border-primary/15 bg-surface p-5 shadow-sm sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Your appointments</h2>
          <button type="button" onClick={() => void refetch()} disabled={loading || isFetching} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-primary/25 px-3 text-sm font-semibold text-primary disabled:opacity-50"><RefreshCw size={15} aria-hidden="true" className={loading || isFetching ? "animate-spin" : ""} /> {loading || isFetching ? "Refreshing..." : "Refresh"}</button>
        </div>
        {loading && <p role="status" className="text-sm text-neutral-600">Loading your appointments...</p>}
        {!loading && !displayError && bookings.length === 0 && <p role="status" className="text-sm text-neutral-600">No appointments found. <Link href="/patient/book-appointment" className="text-primary underline">Book an appointment</Link>.</p>}
        {bookings.length > 0 && <label className="block text-sm font-semibold">Select an appointment
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm">
            <option value="">Choose an appointment</option>
            {bookings.map((booking) => <option key={booking.appointmentId} value={booking.appointmentId}>{booking.slotDate} · {booking.startTime.slice(0, 5)} · {booking.departmentName ?? booking.doctorName} · {appointmentStatusPresentation(booking.appointmentStatus).label}</option>)}
          </select>
        </label>}
        {selected && selected.appointmentStatus.toUpperCase() === "BOOKED" && <div className="rounded-xl border border-primary/10 bg-background p-4 text-center">
          <p className="font-semibold">{selected.departmentName ?? "Clinic appointment"} · Dr. {selected.doctorName}</p>
          <p className="mt-1 text-sm text-neutral-600">{selected.slotDate} · {selected.startTime.slice(0, 5)} (clinic time)</p>
          {qrLoading && <p role="status" className="mt-4">Preparing your QR code...</p>}
          {qrImage && (
            <div className="mx-auto mt-4 w-fit rounded-xl bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- QR is a runtime data URL */}
              <img src={qrImage} alt={`Check-in QR code for appointment ${selected.appointmentId}`} width={280} height={280} />
            </div>
          )}
          <p className="mt-3 text-sm text-neutral-700">Keep this code on your screen and show it to clinic staff. It contains your appointment reference only.</p>
          <p className="mt-2 break-all font-mono text-xs text-neutral-500">Appointment ID: {selected.appointmentId}</p>
        </div>}
        {selected && selected.appointmentStatus.toUpperCase() !== "BOOKED" && <p role="status" className="rounded-lg bg-accent-surface p-4 text-sm text-primary">{appointmentStatusPresentation(selected.appointmentStatus).description}</p>}
      </section>
    </div>
  </main>;
}
