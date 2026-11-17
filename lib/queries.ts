"use client";

import { useQuery } from "@tanstack/react-query";
import { adminApi, bookingApi, getAccessToken, staffApi } from "@/lib/api-client";
import {
  availableBookingSlots, BookingRequestError, parseBookingConfirmation,
  type BookingConfirmation, type BookingSlot, type PatientProfile,
} from "@/lib/booking";
import { queryKeys } from "@/lib/query-keys";
import type { Department } from "@/types/Department";
import type { QueueEntry, ScheduleSlot, StaffAppointment } from "@/lib/staff";

/**
 * Shared TanStack Query hooks. Every page reads server data through these,
 * so identical requests are served from one in-memory cache. Freshness is
 * driven by Supabase Realtime events (see lib/realtime.ts) rather than polling.
 */

interface QueryOptions {
  enabled?: boolean;
}

/** List endpoints are paged by the backend; request a generous first page. */
const LIST_PAGE_QUERY = "?page=0&size=500";

/** Accept both the paged envelope (`content`) and legacy bare-array responses. */
export function readList<T>(value: unknown, label: string): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && Array.isArray((value as { content?: unknown }).content)) {
    return (value as { content: T[] }).content;
  }
  throw new Error(`The clinic returned an unexpected ${label} response.`);
}

// ---------------------------------------------------------------------------
// Patients / bookings
// ---------------------------------------------------------------------------

export function useBookings(options?: QueryOptions) {
  return useQuery<BookingConfirmation[]>({
    queryKey: queryKeys.bookings,
    queryFn: async ({ signal }) =>
      readList<unknown>(await bookingApi("/bookings", { signal }), "appointments").map(parseBookingConfirmation),
    enabled: options?.enabled ?? true,
  });
}

export function useBooking(id: string, options?: QueryOptions) {
  return useQuery({
    queryKey: queryKeys.booking(id),
    queryFn: ({ signal }) => bookingApi(`/bookings/${encodeURIComponent(id)}`, { signal }),
    enabled: (options?.enabled ?? true) && Boolean(id),
  });
}

export function useAvailability(options?: QueryOptions) {
  return useQuery<BookingSlot[]>({
    queryKey: queryKeys.availability,
    queryFn: async ({ signal }) =>
      availableBookingSlots(readList<BookingSlot>(await bookingApi("/bookings/availability", { signal }), "availability")),
    enabled: options?.enabled ?? true,
  });
}

export function parsePatientProfile(value: unknown): PatientProfile {
  const fields = ["patientID", "patientEmail", "patientName", "patientSurname", "nationalID", "phone"];
  if (!value || typeof value !== "object" || fields.some((field) => typeof (value as Record<string, unknown>)[field] !== "string")) {
    throw new Error("The clinic returned an unexpected patient profile. Please retry.");
  }
  return value as PatientProfile;
}

export function usePatientProfile(options?: QueryOptions) {
  return useQuery<PatientProfile>({
    queryKey: queryKeys.patientProfile,
    queryFn: async ({ signal }) => parsePatientProfile(await bookingApi("/patients/me", { signal })),
    enabled: options?.enabled ?? true,
  });
}

// ---------------------------------------------------------------------------
// Notifications (one cache shared by the bell and the full page)
// ---------------------------------------------------------------------------

export interface ClinicNotification {
  id: string;
  notificationId: string;
  title: string;
  message: string;
  createdAt: string | null;
  category: string;
  type: string;
  read: boolean | null;
  isRead: boolean;
}

export function normalizeNotifications(value: unknown): ClinicNotification[] {
  const list = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as Record<string, unknown>).notifications)
      ? (value as { notifications: unknown[] }).notifications
      : value && typeof value === "object" && Array.isArray((value as Record<string, unknown>).content)
        ? (value as { content: unknown[] }).content
        : null;
  if (!list) throw new Error("The clinic returned an unexpected notifications response.");

  return list
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item, index) => {
      const rawRead = item.isRead ?? item.read;
      const read = typeof rawRead === "boolean"
        ? rawRead
        : typeof item.readAt === "string"
          ? true
          : typeof item.status === "string" && ["READ", "UNREAD"].includes(item.status.toUpperCase())
            ? item.status.toUpperCase() === "READ"
            : null;
      const timestamp = item.createdAt ?? item.sentAt ?? item.timestamp;
      const notificationId = String(item.notificationId ?? item.id ?? `notification-${index}`);
      return {
        id: notificationId,
        notificationId,
        title: typeof item.title === "string" && item.title.trim() ? item.title : "Clinic notification",
        message: typeof item.message === "string" ? item.message : typeof item.body === "string" ? item.body : "",
        createdAt: typeof timestamp === "string" ? timestamp : null,
        category: typeof item.type === "string" ? item.type : typeof item.category === "string" ? item.category : "Clinic update",
        type: typeof item.type === "string" ? item.type : "Clinic update",
        read,
        isRead: read === true,
      };
    });
}

export function useNotifications(options?: QueryOptions) {
  return useQuery<ClinicNotification[]>({
    queryKey: queryKeys.notifications,
    queryFn: async ({ signal }) => normalizeNotifications(await bookingApi("/notifications/me", { signal })),
    enabled: options?.enabled ?? true,
  });
}

// ---------------------------------------------------------------------------
// Patient queue tracking (bookings + per-appointment queue positions)
// ---------------------------------------------------------------------------

export interface QueueSnapshot {
  appointmentId: string;
  queuePosition: number | null;
  queueStatus: string;
  estimatedProgress: string | number | null;
  error: string;
}

function queueError(cause: unknown) {
  if (cause instanceof BookingRequestError && cause.status === 401) return "Your session expired. Sign in again to view your queue.";
  if (cause instanceof BookingRequestError && cause.status === 403) return "Queue tracking is available to patient accounts. Sign in with your patient account.";
  return cause instanceof Error ? cause.message : "Could not load your queue. Please try again.";
}

function readQueue(value: unknown, booking: BookingConfirmation): QueueSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The clinic returned an unexpected queue response.");
  const data = value as Record<string, unknown>;
  const rawPosition = data.queuePosition ?? data.position;
  const rawStatus = data.queueStatus ?? data.appointmentStatus ?? data.status ?? booking.appointmentStatus;
  const progress = data.estimatedProgress ?? data.estimatedWaitMinutes ?? data.estimatedWaitTime ?? data.estimatedWait ?? null;
  return {
    appointmentId: booking.appointmentId,
    queuePosition: typeof rawPosition === "number" && Number.isFinite(rawPosition) && rawPosition > 0 ? rawPosition : null,
    queueStatus: typeof rawStatus === "string" ? rawStatus.toUpperCase() : booking.appointmentStatus.toUpperCase(),
    estimatedProgress: typeof progress === "string" || typeof progress === "number" ? progress : null,
    error: "",
  };
}

/** Bookings come from the shared bookings cache; queue events refresh positions. */
export function useQueueTracking(options?: QueryOptions) {
  const bookings = useBookings({ enabled: options?.enabled });
  const list = bookings.data ?? [];
  const key = list.map((booking) => booking.appointmentId).join("|");

  const queues = useQuery<QueueSnapshot[]>({
    queryKey: [...queryKeys.queuePositions, key],
    queryFn: async ({ signal }) => Promise.all(list.map(async (booking) => {
      try {
        const data = await bookingApi(`/appointments/${encodeURIComponent(booking.appointmentId)}/queue-position`, { signal });
        return readQueue(data, booking);
      } catch (cause) {
        return {
          appointmentId: booking.appointmentId,
          queuePosition: null,
          queueStatus: booking.appointmentStatus.toUpperCase(),
          estimatedProgress: null,
          error: queueError(cause),
        } satisfies QueueSnapshot;
      }
    })),
    enabled: (options?.enabled ?? true) && list.length > 0,
  });

  return { bookings, queues };
}

// ---------------------------------------------------------------------------
// Staff portal
// ---------------------------------------------------------------------------

export interface StaffDashboardData {
  appointments: StaffAppointment[];
  queue: QueueEntry[];
  slots: ScheduleSlot[];
}

export function useStaffDashboard(options?: QueryOptions) {
  return useQuery<StaffDashboardData>({
    queryKey: queryKeys.staffDashboard,
    queryFn: async ({ signal }) => {
      const [appointments, queue, slots] = await Promise.all([
        staffApi(`/appointments${LIST_PAGE_QUERY}`, { signal }),
        staffApi(`/queues${LIST_PAGE_QUERY}`, { signal }),
        staffApi(`/schedules${LIST_PAGE_QUERY}`, { signal }),
      ]);
      return {
        appointments: readList<StaffAppointment>(appointments, "appointments"),
        queue: readList<QueueEntry>(queue, "queues"),
        slots: readList<ScheduleSlot>(slots, "schedules"),
      };
    },
    enabled: options?.enabled ?? true,
  });
}

/** A single appointment as seen by staff (used by the QR check-in route). */
export function useStaffAppointment(id: string, options?: QueryOptions) {
  return useQuery<StaffAppointment | null>({
    queryKey: queryKeys.staffAppointment(id),
    queryFn: ({ signal }) => staffApi(`/appointments/${encodeURIComponent(id)}`, { signal }) as Promise<StaffAppointment | null>,
    enabled: (options?.enabled ?? true) && Boolean(id),
  });
}

/** Registered patients for the staff walk-in dialog. */
export function usePatients(options?: QueryOptions) {
  return useQuery({
    queryKey: queryKeys.patients,
    queryFn: async ({ signal }) => readList<unknown>(await staffApi(`/patients${LIST_PAGE_QUERY}`, { signal }), "patients"),
    enabled: options?.enabled ?? true,
  });
}

// ---------------------------------------------------------------------------
// Admin portal
// ---------------------------------------------------------------------------

export function useAdminQueues(options?: QueryOptions) {
  return useQuery({
    queryKey: queryKeys.adminQueues,
    queryFn: async ({ signal }) => {
      const [queue, departments] = await Promise.all([
        staffApi(`/queues${LIST_PAGE_QUERY}`, { signal }),
        staffApi(`/departments${LIST_PAGE_QUERY}`, { signal }),
      ]);
      return {
        queue: readList<QueueEntry>(queue, "queues"),
        departments: readList<Department>(departments, "departments"),
      };
    },
    enabled: options?.enabled ?? true,
  });
}

export function useDepartments<T = Department[]>(options?: QueryOptions) {
  return useQuery<T>({
    queryKey: queryKeys.departments,
    queryFn: async ({ signal }) => {
      return readList<unknown>(await staffApi(`/departments${LIST_PAGE_QUERY}`, { signal }), "departments") as T;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useStaffList<T>(options?: QueryOptions) {
  return useQuery<T[]>({
    queryKey: queryKeys.staffList,
    queryFn: async ({ signal }) => {
      return readList<T>(await staffApi(`/staff${LIST_PAGE_QUERY}`, { signal }), "staff");
    },
    enabled: options?.enabled ?? true,
  });
}

export function useAuditLogs<T>(options?: QueryOptions) {
  return useQuery<T[]>({
    queryKey: queryKeys.auditLogs,
    queryFn: async ({ signal }) => {
      return readList<T>(await adminApi(`/audit-logs${LIST_PAGE_QUERY}`, { signal }), "audit log");
    },
    enabled: options?.enabled ?? true,
  });
}

export function useAnalytics<T>(params: string, options?: QueryOptions) {
  return useQuery<T>({
    queryKey: queryKeys.analytics(params),
    queryFn: ({ signal }) => adminApi(`/analytics?${params}`, { signal }) as Promise<T>,
    enabled: options?.enabled ?? true,
  });
}

/** QR image blob for an appointment; cached while the dialog is open. */
export function useCheckInQr(appointmentId: string, enabled: boolean) {
  return useQuery<Blob>({
    queryKey: queryKeys.checkInQr(appointmentId),
    queryFn: async ({ signal }) => {
      const token = await getAccessToken();
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const base = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
      const response = await fetch(`${base}/api/appointments/${encodeURIComponent(appointmentId)}/qr`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(typeof data?.message === "string" && data.message.trim() ? data.message : "The QR code could not be loaded.");
      }
      return response.blob();
    },
    enabled: enabled && Boolean(appointmentId),
    staleTime: Infinity,
  });
}
