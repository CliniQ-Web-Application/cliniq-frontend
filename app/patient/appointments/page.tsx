"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { ArrowLeft, CalendarDays, CalendarPlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { appointmentStatusPresentation } from "@/lib/appointment-status";
import SessionExpiredAction from "@/components/auth/SessionExpiredAction";
import {
    BookingRequestError, createBookingApi, parseBookingConfirmation,
    type BookingConfirmation,
} from "@/lib/booking";

const buttonClass = "min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";

const messageOf = (cause: unknown, action: string) => {
    if (cause instanceof BookingRequestError) {
        if (cause.status === 403) return "This page is for patient accounts. Sign out and sign in with a patient account.";
        if (cause.status === 401) return "Your session has expired. Sign in again and retry.";
        return cause.message;
    }
    return cause instanceof Error ? cause.message : `Could not ${action}. Please try again.`;
};

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

export default function AppointmentsPage() {
    const { user, profile, role, session, loading } = useAuth();
    if (user && profile?.id === user.id && role === "PATIENT" && session?.user.id === user.id) {
        return <AppointmentsList key={user.id} user={user} />;
    }
    return (
        <main className="min-h-screen bg-background p-8">
            {loading ? <p role="status">Checking your patient session...</p> : (
                <p>Patient sign-in is required. <Link href="/auth/signin" className="text-primary underline">Sign in</Link></p>
            )}
        </main>
    );
}

function AppointmentsList({ user }: { user: User }) {
    const [bookings, setBookings] = useState<BookingConfirmation[]>([]);
    const [bookingsLoading, setBookingsLoading] = useState(true);
    const [bookingsError, setBookingsError] = useState("");
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

    const loadBookings = useCallback(async (signal: AbortSignal) => {
        setBookingsLoading(true);
        setBookingsError("");
        try {
            const data = await api("/bookings", { signal });
            if (!Array.isArray(data)) throw new Error("The clinic returned an unexpected appointments response.");
            const list = data.map(parseBookingConfirmation);
            if (!signal.aborted) setBookings(list);
        } catch (cause) {
            if (!signal.aborted) setBookingsError(messageOf(cause, "load your appointments"));
        } finally {
            if (!signal.aborted) setBookingsLoading(false);
        }
    }, [api]);

    useEffect(() => {
        const controller = new AbortController();
        lifetime.current = controller;
        queueMicrotask(() => { if (!controller.signal.aborted) void loadBookings(controller.signal); });
        return () => controller.abort();
    }, [loadBookings]);

    const signal = () => lifetime.current!.signal;

    return (
        <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-3xl">
                <Link href="/patient" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline">
                    <ArrowLeft size={18} aria-hidden="true" /> Back to patient portal
                </Link>
                <header className="mb-8 mt-8">
                    <CalendarDays className="mb-3 text-primary" size={30} aria-hidden="true" />
                    <p className="text-sm font-semibold uppercase tracking-widest text-primary">Patient appointments</p>
                    <h1 className="mt-2 text-3xl font-bold sm:text-4xl">My appointments</h1>
                    <p className="mt-3 text-neutral-600">See your confirmed appointments and booking details.</p>
                </header>

                <Link href="/patient/book-appointment" className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white">
                    <CalendarPlus size={18} aria-hidden="true" /> Book appointment
                </Link>

                <section aria-busy={bookingsLoading} className="space-y-4">
                    <button type="button" disabled={bookingsLoading} onClick={() => void loadBookings(signal())} className={buttonClass}>
                        {bookingsLoading ? "Loading appointments..." : "Refresh my appointments"}
                    </button>
                    {bookingsError && <p role="alert" className="text-error">{bookingsError}<SessionExpiredAction message={bookingsError} returnTo="/patient/appointments" /></p>}
                    {!bookingsLoading && !bookingsError && bookings.length === 0 && <p role="status">No appointments found.</p>}
                    {bookings.map((booking) => <Confirmation key={booking.appointmentId} booking={booking} />)}
                </section>
            </div>
        </main>
    );
}