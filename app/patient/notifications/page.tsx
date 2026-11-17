"use client";

import { useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { BookingRequestError } from "@/lib/booking";
import { useNotifications } from "@/lib/queries";
import PageHeader from "@/components/ui/PageHeader";
import SessionExpiredAction from "@/components/auth/SessionExpiredAction";

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function errorMessage(cause: unknown) {
  if (cause instanceof BookingRequestError && cause.status === 401) return "Your session expired. Sign in again to view notifications.";
  if (cause instanceof BookingRequestError && cause.status === 403) return "Notifications are available to patient accounts. Sign in with your patient account.";
  return cause instanceof Error ? cause.message : "Could not load your notifications. Please try again.";
}

export default function PatientNotificationsPage() {
  const { user, profile, role, session, loading } = useAuth();
  if (user && profile?.id === user.id && role === "PATIENT" && session?.user.id === user.id) {
    return <PatientNotifications key={user.id} />;
  }
  return <main className="min-h-screen bg-background p-8">{loading ? <p role="status">Checking your patient session...</p> : <p>Patient sign-in is required. <Link href="/auth/signin" className="text-primary underline">Sign in</Link></p>}</main>;
}

function PatientNotifications() {
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  // Same cache as the notification bell, refreshed every 25 seconds.
  const { data: notifications = [], isPending: busy, isFetching, error, refetch } = useNotifications();
  const message = error ? errorMessage(error) : "";
  const [busy, setBusy] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const api = useMemo(() => createBookingApi({
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    getToken: async () => {
      const { data, error: authError } = await supabase.auth.getSession();
      return !authError && data.session?.user.id === user.id ? data.session.access_token : null;
    },
    refreshToken: async () => {
      const { data, error: authError } = await supabase.auth.refreshSession();
      return !authError && data.session?.user.id === user.id ? data.session.access_token : null;
    },
  }), [user.id]);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (inFlight.current || signal?.aborted) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const data = await api("/notifications/me", { signal });
      const result = normalizeNotifications(data);
      if (!signal?.aborted) setNotifications(result);
    } catch (cause) {
      if (!signal?.aborted) setError(errorMessage(cause));
    } finally {
      inFlight.current = false;
      if (!signal?.aborted) setBusy(false);
    }
  }, [api]);

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); });
    return () => controller.abort();
  }, [load]);

  async function markAsRead(id: string) {
    const signal = request.current?.signal;
    if (!signal || signal.aborted || inFlight.current) return;
    inFlight.current = true;
    setMarkingId(id);
    setError("");
    try {
      await api(`/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH", signal });
      if (!signal.aborted) setNotifications((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
    } catch (cause) {
      if (!signal.aborted) setError(errorMessage(cause));
    } finally {
      inFlight.current = false;
      if (!signal.aborted) setMarkingId(null);
    }
  }

  const filtered = notifications.filter((item) => filter === "all" || (filter === "unread" ? item.read === false : item.read === true));
  const unreadCount = notifications.filter((item) => item.read === false).length;

  return <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Notifications"
        description="Appointment confirmations, cancellations, queue updates, and messages from your clinic."
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div aria-label="Filter notifications" className="flex gap-2">
          {([ ["all", "All"], ["unread", `Unread${unreadCount ? ` (${unreadCount})` : ""}`], ["read", "Read"] ] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${filter === value ? "bg-primary text-white" : "border border-primary/20 bg-surface text-neutral-700 hover:bg-accent-surface"}`}>{label}</button>
          ))}
        </div>
        <button type="button" disabled={busy || isFetching} onClick={() => void refetch()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-primary/25 px-3 text-sm font-semibold text-primary disabled:opacity-50"><RefreshCw size={15} aria-hidden="true" />{busy || isFetching ? "Refreshing..." : "Refresh"}</button>
      </div>
      {message && <div role="alert" className="mb-5 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error">{message}<SessionExpiredAction message={message} returnTo="/patient/notifications/me" /><button type="button" disabled={busy} onClick={() => void refetch()} className="ml-2 underline disabled:opacity-50">{busy ? "Retrying..." : "Retry"}</button></div>}
      {!busy && !message && notifications.length === 0 && <p role="status" className="rounded-xl border border-primary/15 bg-surface p-5">You don’t have any notifications yet.</p>}
      {!busy && !message && notifications.length > 0 && filtered.length === 0 && <p role="status" className="rounded-xl border border-primary/15 bg-surface p-5">There are no {filter} notifications.</p>}
      <section aria-label="Notifications" aria-live="polite" aria-busy={busy || isFetching} className="space-y-3">
        {filtered.map((item) => <article key={item.id} className={`rounded-xl border bg-surface p-5 shadow-sm ${item.read === false ? "border-primary/35" : "border-primary/15"}`}>
          <div className="flex items-start gap-3">
            {item.read === false && <span aria-label="Unread" className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold">{item.title}</h2>
                <span className="text-xs text-neutral-500">{formatDate(item.createdAt)}</span>
              </div>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-primary">{item.category.replaceAll("_", " ")}</p>
              {item.message && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{item.message}</p>}
              {item.read !== null && <p className="mt-3 text-xs text-neutral-500">{item.read ? "Read" : "Unread"}</p>}
              {item.read === false && <button type="button" disabled={busy || markingId !== null} onClick={() => { void markAsRead(item.id); }} className="mt-3 min-h-10 rounded-lg border border-primary/25 px-3 text-sm font-semibold text-primary disabled:opacity-50">{markingId === item.id ? "Marking as read..." : "Mark as read"}</button>}
            </div>
          </div>
        </article>)}
      </section>
    </div>
  </main>;
}
