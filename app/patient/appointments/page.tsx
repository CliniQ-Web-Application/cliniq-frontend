"use client";

import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { BookingRequestError } from "@/lib/booking";
import { useBookings } from "@/lib/queries";
import AppointmentCard from "@/components/appointments/AppointmentCard";
import PageHeader from "@/components/ui/PageHeader";
import SessionExpiredAction from "@/components/auth/SessionExpiredAction";

const buttonClass = "min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";

const messageOf = (cause: unknown, action: string) => {
    if (cause instanceof BookingRequestError) {
        if (cause.status === 403) return "This page is for patient accounts. Sign out and sign in with a patient account.";
        if (cause.status === 401) return "Your session has expired. Sign in again and retry.";
        return cause.message;
    }
    return cause instanceof Error ? cause.message : `Could not ${action}. Please try again.`;
};

export default function AppointmentsPage() {
    const { user, profile, role, session, loading } = useAuth();
    if (user && profile?.id === user.id && role === "PATIENT" && session?.user.id === user.id) {
        return <AppointmentsList key={user.id} />;
    }
    return (
        <main className="min-h-screen bg-background p-8">
            {loading ? <p role="status">Checking your patient session...</p> : (
                <p>Patient sign-in is required. <Link href="/auth/signin" className="text-primary underline">Sign in</Link></p>
            )}
        </main>
    );
}

function AppointmentsList() {
    const { data: bookings = [], isPending: bookingsLoading, isFetching, error, refetch } = useBookings();
    const bookingsError = error ? messageOf(error, "load your appointments") : "";

    return (
        <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-3xl">
                <PageHeader
                    title="My appointments"
                    description="See your confirmed appointments and booking details."
                />

                <Link href="/patient/book-appointment" className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white">
                    <CalendarPlus size={18} aria-hidden="true" /> Book appointment
                </Link>

                <section aria-busy={bookingsLoading || isFetching} className="grid gap-4 md:grid-cols-2">
                    <button type="button" disabled={bookingsLoading || isFetching} onClick={() => void refetch()} className={`${buttonClass} md:col-span-2`}>
                        {bookingsLoading ? "Loading appointments..." : isFetching ? "Refreshing..." : "Refresh my appointments"}
                    </button>
                    {bookingsError && <p role="alert" className="text-error md:col-span-2">{bookingsError}<SessionExpiredAction message={bookingsError} returnTo="/patient/appointments" /></p>}
                    {!bookingsLoading && !bookingsError && bookings.length === 0 && <p role="status" className="md:col-span-2">No appointments found.</p>}
                    {bookings.map((booking) => <AppointmentCard
                        key={booking.appointmentId}
                        title={booking.departmentName ?? "Appointment"}
                        subtitle={`Dr. ${booking.doctorName} · ${booking.slotDate} · ${booking.appointmentTime?.slice(0, 5) ?? `${booking.startTime.slice(0, 5)} – ${booking.endTime.slice(0, 5)}`} (clinic time)`}
                        status={booking.appointmentStatus}
                        details={[
                            { label: "Date", value: booking.slotDate },
                            { label: "Time", value: booking.appointmentTime?.slice(0, 5) ?? `${booking.startTime.slice(0, 5)} – ${booking.endTime.slice(0, 5)}` },
                        ]}
                        footer={<p className="mt-3 break-all text-sm text-neutral-500">Appointment ID: {booking.appointmentId}</p>}
                        href={`/patient/appointments/${encodeURIComponent(booking.appointmentId)}`}
                    />)}
                </section>
            </div>
        </main>
    );
}
