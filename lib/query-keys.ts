/**
 * Central registry of TanStack Query keys and cache timings.
 *
 * Every page uses these keys through the shared hooks in `lib/queries.ts`, so
 * the same data is fetched once and reused from the in-memory query cache
 * instead of being re-fetched independently by each page.
 */

export const queryKeys = {
  bookings: ["bookings"] as const,
  booking: (id: string) => ["bookings", "detail", id] as const,
  availability: ["bookings", "availability"] as const,
  patientProfile: ["patients", "me"] as const,
  patients: ["patients", "list"] as const,
  notifications: ["notifications", "me"] as const,
  queueTracking: ["bookings", "queue-tracking"] as const,
  queuePositions: ["bookings", "queue-positions"] as const,
  staffDashboard: ["staff", "dashboard"] as const,
  staffAppointment: (id: string) => ["staff", "appointment", id] as const,
  adminQueues: ["admin", "queues"] as const,
  departments: ["departments"] as const,
  staffList: ["staff", "list"] as const,
  auditLogs: ["audit", "logs"] as const,
  analytics: (params: string) => ["analytics", params] as const,
  checkInQr: (id: string) => ["check-in-qr", id] as const,
} as const;

/** Data is considered fresh for this long before a background refetch is due. */
export const STALE_TIME_MS = 30_000;

