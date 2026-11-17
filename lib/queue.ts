import type { BookingConfirmation } from "./booking";

export type QueueSnapshot = {
  appointmentId: string;
  queuePosition: number | null;
  queueStatus: string;
  estimatedWaitMinutes: number | null;
  error: string;
};

export function hasActiveQueue(status: string): boolean {
  return ["WAITING", "INCONSULTATION"].includes(status.trim().toUpperCase());
}

export function readQueue(value: unknown, booking: BookingConfirmation): QueueSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The clinic returned an unexpected queue response.");
  const data = value as Record<string, unknown>;
  const rawPosition = data.queuePosition ?? data.position;
  const rawStatus = data.queueStatus ?? data.appointmentStatus ?? data.status ?? booking.appointmentStatus;
  const status = typeof rawStatus === "string" ? rawStatus.trim().toUpperCase() : booking.appointmentStatus.toUpperCase();
  const wait = data.estimatedWaitMinutes;
  return {
    appointmentId: booking.appointmentId,
    queuePosition: status === "WAITING" && typeof rawPosition === "number" && Number.isInteger(rawPosition) && rawPosition > 0 ? rawPosition : null,
    queueStatus: status,
    estimatedWaitMinutes: typeof wait === "number" && Number.isFinite(wait) && wait >= 0 ? wait : null,
    error: "",
  };
}
