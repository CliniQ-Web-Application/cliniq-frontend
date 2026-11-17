"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { BookingRequestError } from "@/lib/booking";
import { useQueueTracking } from "@/lib/queries";
import SessionExpiredAction from "@/components/auth/SessionExpiredAction";
import AppointmentCard from "@/components/appointments/AppointmentCard";
import PageHeader from "@/components/ui/PageHeader";

function friendlyError(cause: unknown) {
  if (cause instanceof BookingRequestError && cause.status === 401) return "Your session expired. Sign in again to view your queue.";
  if (cause instanceof BookingRequestError && cause.status === 403) return "Queue tracking is available to patient accounts. Sign in with your patient account.";
  return cause instanceof Error ? cause.message : "Could not load your queue. Please try again.";
}

export default function QueueTrackingPage() {
  const { user, profile, role, session, loading } = useAuth();
  if (user && profile?.id === user.id && role === "PATIENT" && session?.user.id === user.id) {
    return <QueueTracking key={user.id} />;
  }
  return <main className="min-h-screen bg-background p-8">{loading ? <p role="status">Checking your patient session...</p> : <p>Patient sign-in is required. <Link href="/auth/signin" className="text-primary underline">Sign in</Link></p>}</main>;
}

function QueueTracking() {
  // Bookings are read from the shared cache; queue events refresh their positions.
  const { bookings, queues } = useQueueTracking();
  const list = bookings.data ?? [];
  const snapshots = queues.data ?? [];
  const busy = bookings.isPending || bookings.isFetching || queues.isFetching;
  const error = bookings.error ? friendlyError(bookings.error) : "";

  const refresh = () => {
    void bookings.refetch();
    void queues.refetch();
  };

  const live = snapshots.some((item) => item.queueStatus === "WAITING" || item.queueStatus === "INCONSULTATION");
  const queueById = new Map(snapshots.map((item) => [item.appointmentId, item]));

  return <main className="min-h-screen bg-background px-4 py-2 sm:px-6 lg:px-8">
    <div className="mx-auto w-full">
      <PageHeader
        title="Track your place in the queue"
        description="Queue details update automatically as the clinic changes them. Estimated progress is provided by the clinic."
      />
      <button type="button" disabled={busy} onClick={refresh} className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw size={16} aria-hidden="true" />{busy ? "Refreshing queue..." : "Refresh queue"}</button>
      {error && <div role="alert" className="mb-5 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error">{error}<SessionExpiredAction message={error} returnTo="/patient/queue-tracking" /></div>}
      {!busy && !error && list.length === 0 && <p role="status" className="rounded-xl border border-primary/15 bg-surface p-5">No appointments found on your account.</p>}
      <section aria-label="Appointment queue positions" aria-live="polite" aria-busy={busy} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {list.map((booking) => {
          const queue = queueById.get(booking.appointmentId);
          const status = queue?.queueStatus ?? booking.appointmentStatus.toUpperCase();
          const normalizedStatus = status.trim().toUpperCase().replace(/[\s-]+/g, "_");
          const done = ["COMPLETED", "CANCELLED", "NOSHOW", "NO_SHOW"].includes(normalizedStatus);
          return <AppointmentCard
            key={booking.appointmentId}
            title={booking.departmentName ?? "Appointment"}
            subtitle={`Dr. ${booking.doctorName} · ${booking.slotDate} · ${booking.startTime.slice(0, 5)} (clinic time)`}
            status={status}
            details={[
              { label: "Queue position", value: <span className="text-2xl font-bold text-primary">{queue?.queuePosition ? `#${queue.queuePosition}` : done ? "—" : status === "BOOKED" ? "Not checked in" : "Unavailable"}</span> },
              { label: "Estimated progress", value: queue?.estimatedProgress == null ? "Not available" : queue.estimatedProgress },
            ]}
            footer={queue?.error && <p role="status" className="mt-3 text-sm text-neutral-600">Queue details are temporarily unavailable. {queue.error}<SessionExpiredAction message={queue.error} returnTo="/patient/queue-tracking" /></p>}
            href={`/patient/appointments/${encodeURIComponent(booking.appointmentId)}`}
          />;
        })}
      </section>
      {live && <p className="mt-5 text-xs text-neutral-500">Live updates are on. {busy ? "Updating..." : "You are up to date."}</p>}
    </div>
  </main>;
}
