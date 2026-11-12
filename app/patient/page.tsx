"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarPlus, CheckCircle2, Clock, LogOut, XCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type Booking = {
  appointmentId: string;
  appointmentStatus: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  doctorName: string;
  departmentName: string | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function PatientPortal() {
  const { profile, user, session, signOut } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const patientDisplayName = profile?.firstName
    ? `${profile.firstName} ${profile.lastName || ""}`.trim()
    : user?.email || "Patient";

  const loadBookings = useCallback(async () => {
    if (!API_URL || !session?.access_token) return;
    const response = await fetch(`${API_URL}/api/bookings`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Could not load your appointments.");
    setBookings(await response.json());
  }, [session]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => loadBookings())
      .catch((error) => active && setMessage(error instanceof Error ? error.message : "Could not load appointments."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [loadBookings]);

  async function updateBooking(id: string, action: "check-in" | "cancel") {
    if (!API_URL || !session?.access_token) return;
    setMessage("");
    const response = await fetch(`${API_URL}/api/appointments/${id}/${action}`, {
      method: action === "cancel" ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(result.message || "The appointment could not be updated.");
      return;
    }
    setMessage(action === "cancel" ? "Appointment cancelled." : "Checked in. You are now in the clinic queue.");
    await loadBookings();
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">
            <ArrowLeft size={18} /> Back to home
          </Link>
          <button type="button" onClick={() => signOut()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-primary/25 px-3 text-sm font-semibold">
            <LogOut size={16} /> Sign out
          </button>
        </div>

        <header className="mt-12">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Patient portal</p>
          <h1 className="mt-2 text-4xl font-bold">Welcome, {patientDisplayName}</h1>
          <p className="mt-3 text-neutral-600">Manage appointments, check in, and follow your queue status.</p>
        </header>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/patient/book-appointment" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white">
            <CalendarPlus size={17} /> Book appointment
          </Link>
          <Link href="/patient/book-appointment#my-bookings" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-primary/25 px-4 text-sm font-semibold text-primary">
            View booking availability
          </Link>
        </div>

        {message && <p role="status" className="mt-5 rounded-lg border border-primary/20 bg-accent-surface p-3 text-sm">{message}</p>}

        <section className="mt-8" aria-labelledby="appointments-heading">
          <h2 id="appointments-heading" className="text-2xl font-bold">Your appointments</h2>
          {loading ? <p className="mt-4 text-sm text-neutral-600">Loading appointments...</p> : bookings.length === 0 ? (
            <p className="mt-4 rounded-xl border border-primary/15 bg-surface p-6 text-sm text-neutral-600">You do not have any appointments yet.</p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {bookings.map((booking) => (
                <article key={booking.appointmentId} className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{booking.doctorName}</h3>
                      <p className="text-sm text-neutral-600">{booking.departmentName || "Clinic"} · {booking.slotDate}</p>
                    </div>
                    <span className="rounded-full bg-accent-surface px-2.5 py-1 text-xs font-semibold text-primary">{booking.appointmentStatus}</span>
                  </div>
                  <p className="mt-4 flex items-center gap-2 text-sm"><Clock size={16} /> {booking.startTime} – {booking.endTime}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {booking.appointmentStatus === "BOOKED" && (
                      <>
                        <button type="button" onClick={() => updateBooking(booking.appointmentId, "check-in")} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-white"><CheckCircle2 size={16} /> Check in</button>
                        <button type="button" onClick={() => updateBooking(booking.appointmentId, "cancel")} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700"><XCircle size={16} /> Cancel</button>
                      </>
                    )}
                    {booking.appointmentStatus === "WAITING" && <span className="text-sm font-semibold text-success">You are in the queue.</span>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
