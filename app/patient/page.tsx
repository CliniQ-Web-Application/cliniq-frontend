"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { bookingApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useBookings } from "@/lib/queries";
import AppointmentCard from "@/components/appointments/AppointmentCard";
import PageHeader from "@/components/ui/PageHeader";



export default function PatientPortal() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  // Appointments come from the shared, periodically refreshed cache.
  const { data: bookings = [], isPending: loading, error: loadError } = useBookings();
  const patientDisplayName = profile?.firstName
    ? `${profile.firstName} ${profile.lastName || ""}`.trim()
    : user?.email || "Patient";

  async function updateBooking(id: string, action: "check-in" | "cancel") {
    if (busyAction) return;
    setBusyAction(`${id}-${action}`);
    setMessage("");
    try {
      await bookingApi(`/appointments/${id}/${action}`, {
        method: action === "cancel" ? "PATCH" : "POST",
      });
      setMessage(action === "cancel" ? "Appointment cancelled." : "Checked in. You are now in the clinic queue.");
      // Refresh the shared cache so every page with appointments stays in sync.
      await queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "The appointment could not be updated.");
    } finally {
      setBusyAction(null);
    }
  }

  const statusMessage = message || (loadError instanceof Error ? loadError.message : "");

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <PageHeader
          title={`Welcome, ${patientDisplayName}`}
          description="Manage appointments, check in, and follow your queue status."
        />

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/patient/book-appointment" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white">
            <CalendarPlus size={17} /> Book appointment
          </Link>
          <Link href="/patient/book-appointment#my-bookings" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-primary/25 px-4 text-sm font-semibold text-primary">
            View booking availability
          </Link>
        </div>

        {statusMessage && <p role="status" className="mt-5 rounded-lg border border-primary/20 bg-accent-surface p-3 text-sm">{statusMessage}</p>}

        <section className="mt-8" aria-labelledby="appointments-heading">
          <h2 id="appointments-heading" className="text-2xl font-bold">Your appointments</h2>
          {loading ? <p className="mt-4 text-sm text-neutral-600">Loading appointments...</p> : bookings.length === 0 ? (
            <p className="mt-4 rounded-xl border border-primary/15 bg-surface p-6 text-sm text-neutral-600">You do not have any appointments yet.</p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {bookings.map((booking) => (
                <AppointmentCard
                  key={booking.appointmentId}
                  title={booking.departmentName || "Clinic"}
                  subtitle={`Dr. ${booking.doctorName} · ${booking.slotDate} · ${booking.appointmentTime?.slice(0, 5) ?? `${booking.startTime.slice(0, 5)} – ${booking.endTime.slice(0, 5)}`} (clinic time)`}
                  status={booking.appointmentStatus}
                  details={[
                    { label: "Date", value: booking.slotDate },
                    { label: "Time", value: booking.appointmentTime?.slice(0, 5) ?? `${booking.startTime.slice(0, 5)} – ${booking.endTime.slice(0, 5)}` },
                  ]}
                  footer={
                    <div className="mt-5 flex flex-wrap gap-2">
                      {booking.appointmentStatus === "BOOKED" && (
                        <>
                          <button
                            type="button"
                            disabled={Boolean(busyAction)}
                            onClick={() => void updateBooking(booking.appointmentId, "check-in")}
                            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busyAction === `${booking.appointmentId}-check-in` ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            {busyAction === `${booking.appointmentId}-check-in` ? "Checking in..." : "Check in"}
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(busyAction)}
                            onClick={() => void updateBooking(booking.appointmentId, "cancel")}
                            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busyAction === `${booking.appointmentId}-cancel` ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                            {busyAction === `${booking.appointmentId}-cancel` ? "Cancelling..." : "Cancel"}
                          </button>
                        </>
                      )}
                      {booking.appointmentStatus === "WAITING" && <span className="text-sm font-semibold text-success">You are in the queue.</span>}
                    </div>
                  }
                  href={`/patient/appointments/${encodeURIComponent(booking.appointmentId)}`}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
