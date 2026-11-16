"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { ArrowLeft, Bell, CheckCheck, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { BookingRequestError, createBookingApi } from "@/lib/booking";
import SessionExpiredAction from "@/components/auth/SessionExpiredAction";

type PatientNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string | null;
  category: string;
  read: boolean;
};

function normalizeNotifications(value: unknown): PatientNotification[] {
  const list = Array.isArray(value)
      ? value
      : value && typeof value === "object" && Array.isArray((value as Record<string, unknown>).notifications)
          ? (value as { notifications: unknown[] }).notifications
          : null;
  if (!list) throw new Error("The clinic returned an unexpected notifications response.");
  return list
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
      .map((item, index) => {
        const rawRead = item.isRead ?? item.read;
        const read = typeof rawRead === "boolean" ? rawRead : false;
        const category = typeof item.type === "string" ? item.type : typeof item.category === "string" ? item.category : "Clinic update";
        const timestamp = item.createdAt ?? item.sentAt ?? item.timestamp;
        return {
          id: String(item.notificationId ?? item.id ?? `notification-${index}`),
          title: category === "QUEUE_CALLED" ? "You are up next!" : typeof item.title === "string" && item.title.trim() ? item.title : "Clinic notification",
          message: typeof item.message === "string" ? item.message : typeof item.body === "string" ? item.body : "",
          createdAt: typeof timestamp === "string" ? timestamp : null,
          category,
          read,
        };
      });
}

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
    return <PatientNotifications key={user.id} user={user} />;
  }
  return <main className="min-h-screen bg-background p-8">{loading ? <p role="status">Checking your patient session...</p> : <p>Patient sign-in is required. <Link href="/auth/signin" className="text-primary underline">Sign in</Link></p>}</main>;
}

function PatientNotifications({ user }: { user: User }) {
  const [notifications, setNotifications] = useState<PatientNotification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [busy, setBusy] = useState(true);
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
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && !controller.signal.aborted) {
        void load(controller.signal);
      }
    }, 15000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [load]);

  const markRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await api(`/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" });
    } catch {
      const signal = request.current?.signal;
      if (signal && !signal.aborted) void load(signal);
    }
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api("/notifications/read-all", { method: "PATCH" });
    } catch {
      const signal = request.current?.signal;
      if (signal && !signal.aborted) void load(signal);
    }
  };

  const filtered = notifications.filter((item) => filter === "all" || (filter === "unread" ? !item.read : item.read));
  const unreadCount = notifications.filter((item) => !item.read).length;

  return <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
    <div className="mx-auto w-full max-w-3xl">
      <Link href="/patient" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowLeft size={18} aria-hidden="true" /> Back to patient portal</Link>
      <header className="mb-8 mt-8">
        <Bell className="mb-3 text-primary" size={30} aria-hidden="true" />
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Patient updates</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Notifications</h1>
        <p className="mt-3 text-neutral-600">Queue call alerts, appointment confirmations, and updates from your clinic.</p>
      </header>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div aria-label="Filter notifications" className="flex gap-2">
          {([ ["all", "All"], ["unread", `Unread${unreadCount ? ` (${unreadCount})` : ""}`], ["read", "Read"] ] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${filter === value ? "bg-primary text-white" : "border border-primary/20 bg-surface text-neutral-700 hover:bg-accent-surface"}`}>{label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
              <button type="button" onClick={() => void markAllRead()} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-primary/25 px-3 text-sm font-semibold text-primary hover:bg-accent-surface">
                <CheckCheck size={15} aria-hidden="true" /> Mark all read
              </button>
          )}
          <button type="button" disabled={busy} onClick={() => { const signal = request.current?.signal; if (signal && !signal.aborted) void load(signal); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-primary/25 px-3 text-sm font-semibold text-primary disabled:opacity-50"><RefreshCw size={15} aria-hidden="true" />{busy ? "Refreshing..." : "Refresh"}</button>
        </div>
      </div>
      {error && <div role="alert" className="mb-5 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error">{error}<SessionExpiredAction message={error} returnTo="/patient/notifications" /><button type="button" disabled={busy} onClick={() => { const signal = request.current?.signal; if (signal && !signal.aborted) void load(signal); }} className="ml-2 underline">Retry</button></div>}
      {!busy && !error && notifications.length === 0 && <p role="status" className="rounded-xl border border-primary/15 bg-surface p-5">You don’t have any notifications yet.</p>}
      {!busy && !error && notifications.length > 0 && filtered.length === 0 && <p role="status" className="rounded-xl border border-primary/15 bg-surface p-5">There are no {filter} notifications.</p>}
      <section aria-label="Notifications" aria-live="polite" aria-busy={busy} className="space-y-3">
        {filtered.map((item) => <article key={item.id} className={`rounded-xl border bg-surface p-5 shadow-sm ${!item.read ? "border-primary/40 bg-blue-50/30" : "border-primary/15"}`}>
          <div className="flex items-start gap-3">
            {!item.read && <span aria-label="Unread" className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold">{item.title}</h2>
                <span className="text-xs text-neutral-500">{formatDate(item.createdAt)}</span>
              </div>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-primary">{item.category.replaceAll("_", " ")}</p>
              {item.message && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{item.message}</p>}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-neutral-500">{item.read ? "Read" : "Unread"}</span>
                {!item.read && (
                    <button type="button" onClick={() => void markRead(item.id)} className="text-xs font-semibold text-primary hover:underline">
                      Mark as read
                    </button>
                )}
              </div>
            </div>
          </div>
        </article>)}
      </section>
    </div>
  </main>;
}