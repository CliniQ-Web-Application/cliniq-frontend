"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { BookingRequestError } from "@/lib/booking";
import { useBooking } from "@/lib/queries";
import AppointmentCard from "@/components/appointments/AppointmentCard";
import PageHeader from "@/components/ui/PageHeader";
import SessionExpiredAction from "@/components/auth/SessionExpiredAction";

type AppointmentDetails = {
  id: string;
  status: string;
  slotDate: string;
  appointmentTime: string;
  startTime: string;
  endTime: string;
  doctor: string;
  department: string;
  bookedAt: string;
  checkedInAt: string;
  calledAt: string;
  completedAt: string;
  priority: string;
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function appointmentDetails(value: unknown, appointmentId: string): AppointmentDetails {
  const root = object(value);
  const data = object(root.appointment ?? root);
  const slot = object(data.slot);
  const staff = object(data.staff ?? data.doctor);
  const department = object(data.department ?? staff.department);
  const fullName = [asText(staff.firstName), asText(staff.lastName)].filter(Boolean).join(" ");
  return {
    id: asText(data.appointmentId) || appointmentId,
    status: asText(data.appointmentStatus ?? data.status) || "UNKNOWN",
    slotDate: asText(data.slotDate ?? slot.slotDate),
    appointmentTime: asText(data.appointmentTime),
    startTime: asText(data.startTime ?? slot.startTime),
    endTime: asText(data.endTime ?? slot.endTime),
    doctor: asText(data.doctorName) || (fullName ? `Dr. ${fullName}` : "Doctor details unavailable"),
    department: asText(data.departmentName ?? department.name) || "Department details unavailable",
    bookedAt: asText(data.bookedAt ?? data.createdAt),
    checkedInAt: asText(data.checkInTime ?? data.checkedInAt),
    calledAt: asText(data.calledTime ?? data.calledAt),
    completedAt: asText(data.completedTime ?? data.completedAt),
    priority: asText(data.priority),
  };
}

function dateTime(value: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function requestError(cause: unknown) {
  if (cause instanceof BookingRequestError && cause.status === 401) return "Your session expired. Sign in again to view this appointment.";
  if (cause instanceof BookingRequestError && cause.status === 403) return "This appointment is not available to your account.";
  if (cause instanceof BookingRequestError && cause.status === 404) return "This appointment could not be found on your account.";
  return cause instanceof Error ? cause.message : "Could not load appointment details. Please try again.";
}

export default function AppointmentDetail({ appointmentId }: { appointmentId: string }) {
  const { user, profile, role, session, loading } = useAuth();
  if (user && profile?.id === user.id && role === "PATIENT" && session?.user.id === user.id) {
    return <AppointmentDetailContent key={`${user.id}-${appointmentId}`} appointmentId={appointmentId} />;
  }
  return <main className="min-h-screen bg-background p-8">{loading ? <p role="status">Checking your patient session...</p> : <p>Patient sign-in is required. <Link href="/auth/signin" className="text-primary underline">Sign in</Link></p>}</main>;
}

function AppointmentDetailContent({ appointmentId }: { appointmentId: string }) {
  // Appointment details come from the shared cache and refresh periodically.
  const { data, isPending, isFetching, error, refetch } = useBooking(appointmentId);
  const busy = isPending || isFetching;
  const details = data ? appointmentDetails(data, appointmentId) : null;
  const requestErrorMessage = error ? requestError(error) : "";
  const appointmentTime = details
    ? details.appointmentTime
      ? `${details.appointmentTime.slice(0, 5)} (clinic time)`
      : details.startTime
        ? `${details.startTime.slice(0, 5)} – ${details.endTime.slice(0, 5)} (clinic time)`
        : "—"
    : "—";

  return <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Your appointment"
        description="Review the schedule, status, and activity for this appointment."
      />
      {busy && <p role="status" className="mb-4">Loading appointment details...</p>}
      {requestErrorMessage && <div role="alert" className="mb-5 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error">{requestErrorMessage}<SessionExpiredAction message={requestErrorMessage} returnTo={`/patient/appointments/${encodeURIComponent(appointmentId)}`} /><button type="button" disabled={busy} onClick={() => void refetch()} className="ml-2 underline disabled:opacity-50">{busy ? "Retrying..." : "Retry"}</button></div>}
      {details && <div aria-busy={busy}>
        <AppointmentCard
          title={details.doctor}
          subtitle={details.department}
          status={details.status}
          details={[
            { label: "Date", value: details.slotDate || "Not available" },
            { label: "Appointment time", value: appointmentTime },
          ]}
          footer={<section aria-label="Appointment activity" className="mt-5 border-t border-primary/10 pt-5">
            <h2 className="font-bold">Appointment activity</h2>
            <dl className="mt-3 grid gap-4 sm:grid-cols-2">
              <div><dt className="text-sm text-neutral-500">Booked</dt><dd className="mt-1 text-sm font-medium">{dateTime(details.bookedAt)}</dd></div>
              {details.checkedInAt && <div><dt className="text-sm text-neutral-500">Checked in</dt><dd className="mt-1 text-sm font-medium">{dateTime(details.checkedInAt)}</dd></div>}
              {details.calledAt && <div><dt className="text-sm text-neutral-500">Called for consultation</dt><dd className="mt-1 text-sm font-medium">{dateTime(details.calledAt)}</dd></div>}
              {details.completedAt && <div><dt className="text-sm text-neutral-500">Completed</dt><dd className="mt-1 text-sm font-medium">{dateTime(details.completedAt)}</dd></div>}
              {details.priority && <div><dt className="text-sm text-neutral-500">Priority</dt><dd className="mt-1 text-sm font-medium">{details.priority.replaceAll("_", " ")}</dd></div>}
            </dl>
            <p className="mt-3 break-all text-sm text-neutral-500">Appointment ID: {details.id}</p>
            {details.status.trim().toUpperCase().replace(/[\s-]+/g, "_") === "WAITING" && <p className="mt-4 rounded-lg bg-accent-surface p-4 text-sm text-primary">View your <Link href="/patient/queue-tracking" className="font-semibold underline">queue position</Link>.</p>}
          </section>}
        />
      </div>}
    </div>
  </main>;
}
