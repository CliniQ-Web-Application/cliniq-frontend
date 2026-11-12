import type { Department } from "../types/Department";

export type AppointmentStatus =
  | "BOOKED" | "CHECKEDIN" | "WAITING" | "INCONSULTATION" | "COMPLETED" | "CANCELLED" | "NOSHOW";

export type Priority = "NORMAL" | "URGENT";

export interface StaffRef {
  staffId: string;
  firstName: string;
  lastName: string;
  staffRole: string;
  availabilityStatus: string;
  active: boolean;
  department: Department | null;
}

export interface PatientRef {
  patientID: string;
  patientName: string;
  patientSurname: string;
  patientEmail: string;
  phone: string | null;
}

export interface SlotRef {
  slotId: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  slotStatus: string;
}

export interface StaffAppointment {
  appointmentId: string;
  appointmentStatus: AppointmentStatus;
  priority: Priority;
  checkInTime: string | null;
  calledTime: string | null;
  completedTime: string | null;
  bookedAt: string | null;
  createdAt: string;
  patient: PatientRef | null;
  staff: StaffRef | null;
  slot: SlotRef | null;
}

export interface QueueEntry {
  queueId: string;
  position: number;
  timeStamp: string | null;
  availabilityStatus: string;
  department: Department;
  appointment: StaffAppointment;
}

export interface ScheduleSlot {
  slotId: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  slotStatus: string;
  capacity?: number | null;
  staff: StaffRef | null;
}

export function bookingMoment(appointment: StaffAppointment): string {
  return appointment.bookedAt ?? appointment.checkInTime ?? appointment.createdAt ?? "";
}

export function todayLocalValue(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function isTodayAppointment(appointment: StaffAppointment, today: string): boolean {
  if (appointment.slot?.slotDate) return appointment.slot.slotDate === today;
  return typeof appointment.createdAt === "string" && appointment.createdAt.slice(0, 10) === today;
}

export function appointmentTimeValue(appointment: StaffAppointment): string {
  return `${appointment.slot?.slotDate ?? "9999-12-31"}T${appointment.slot?.startTime ?? "99:99"}`;
}

export function waitingQueue(entries: QueueEntry[], departmentId: string | undefined): QueueEntry[] {
  return entries
    .filter((entry) => entry.appointment?.appointmentStatus === "WAITING")
    .filter((entry) => !departmentId || entry.department?.departmentId === departmentId)
    .sort((a, b) => {
      const urgent = (a.appointment.priority === "URGENT" ? 1 : 0) - (b.appointment.priority === "URGENT" ? 1 : 0);
      return urgent !== 0 ? -urgent : bookingMoment(a.appointment).localeCompare(bookingMoment(b.appointment));
    });
}

export function inConsultationQueue(entries: QueueEntry[], departmentId: string | undefined): QueueEntry[] {
  return entries
    .filter((entry) => entry.appointment?.appointmentStatus === "INCONSULTATION")
    .filter((entry) => !departmentId || entry.department?.departmentId === departmentId)
    .sort((a, b) => bookingMoment(a.appointment).localeCompare(bookingMoment(b.appointment)));
}

export function myOpenSlots(slots: ScheduleSlot[], staffId: string | undefined, today: string): ScheduleSlot[] {
  return slots
    .filter((slot) => slot.slotStatus === "OPEN" && slot.slotDate >= today)
    .filter((slot) => !staffId || slot.staff?.staffId === staffId)
    .sort((a, b) => `${a.slotDate}T${a.startTime}`.localeCompare(`${b.slotDate}T${b.startTime}`));
}

export class StaffApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "StaffApiError";
    this.status = status;
  }
}

const ERROR_FALLBACKS: Record<number, string> = {
  401: "Your session has expired. Please sign in again.",
  403: "You do not have permission to use the staff portal. Please sign in with your staff account.",
};

export function createStaffApi(options: {
  baseUrl: string | undefined;
  getToken: () => Promise<string | null>;
  refreshToken: () => Promise<string | null>;
  fetcher?: typeof fetch;
}) {
  const fetcher = options.fetcher ?? fetch;
  return async function request(path: string, init: RequestInit = {}): Promise<unknown> {
    const baseUrl = options.baseUrl?.replace(/\/+$/, "");
    if (!baseUrl) throw new Error("The clinic portal is not configured. Please contact the clinic.");
    let token = await options.getToken();
    if (!token) throw new StaffApiError("Your session has expired. Please sign in again.", 401);
    const send = (accessToken: string) => fetcher(`${baseUrl}/api${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });
    let response = await send(token);
    if (response.status === 401) {
      token = await options.refreshToken();
      if (token) response = await send(token);
    }
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const fallback = ERROR_FALLBACKS[response.status] ?? "The clinic could not complete this request. Please try again or contact the clinic.";
      throw new StaffApiError(typeof data?.message === "string" && data.message.trim() ? data.message : fallback, response.status);
    }
    if (response.status === 204) return null;
    return response.json();
  };
}
