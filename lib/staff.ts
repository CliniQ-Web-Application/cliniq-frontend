import type { Department } from "@/types/Department";

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
  appointmentTime: string | null;
  bookedAt: string | null;
  createdAt: string;
  patient: PatientRef | null;
  staff: StaffRef | null;
  slot: SlotRef | null;
  queueId?: string | null;
  queuePosition?: number | null;
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

export function mapStaffAppointment(raw: unknown): StaffAppointment {
  const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const existingPatient = item.patient as PatientRef | null | undefined;
  const patient: PatientRef | null = existingPatient ?? (
      item.patientId
          ? {
            patientID: String(item.patientId),
            patientName: String(item.patientName ?? ""),
            patientSurname: String(item.patientSurname ?? ""),
            patientEmail: String(item.patientEmail ?? ""),
            phone: item.phone ? String(item.phone) : null,
          }
          : null
  );

  const existingSlot = item.slot as SlotRef | null | undefined;
  const slot: SlotRef | null = existingSlot ?? (
      item.slotDate && item.startTime && item.endTime
          ? {
            slotId: String(item.slotId ?? ""),
            slotDate: String(item.slotDate),
            startTime: String(item.startTime),
            endTime: String(item.endTime),
            slotStatus: "BOOKED",
          }
          : null
  );

  return {
    appointmentId: String(item.appointmentId ?? ""),
    appointmentStatus: String(item.appointmentStatus ?? "BOOKED") as AppointmentStatus,
    priority: String(item.priority ?? "NORMAL") === "URGENT" ? "URGENT" : "NORMAL",
    checkInTime: item.checkInTime ? String(item.checkInTime) : null,
    calledTime: item.calledTime ? String(item.calledTime) : null,
    completedTime: item.completedTime ? String(item.completedTime) : null,
    appointmentTime: item.appointmentTime ? String(item.appointmentTime) : null,
    bookedAt: item.bookedAt ? String(item.bookedAt) : null,
    createdAt: String(item.createdAt ?? item.bookedAt ?? ""),
    patient,
    staff: (item.staff as StaffRef | null | undefined) ?? null,
    slot,
    queueId: item.queueId ? String(item.queueId) : null,
    queuePosition: typeof item.queuePosition === "number" ? item.queuePosition : null,
  };
}

export function mapDepartmentQueueEntry(raw: unknown, fallbackDepartmentId?: string): QueueEntry {
  const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (item.appointment && typeof item.appointment === "object") {
    return item as unknown as QueueEntry;
  }

  const appointment = mapStaffAppointment({
    appointmentId: item.appointmentId,
    appointmentStatus: item.appointmentStatus ?? "WAITING",
    priority: item.priority ?? "NORMAL",
    patientId: item.patientId,
    patientName: item.patientName,
    patientSurname: item.patientSurname,
    createdAt: item.createdAt,
    checkInTime: item.checkInTime,
    calledTime: item.calledTime,
  });

  return {
    queueId: String(item.queueId ?? ""),
    position: typeof item.position === "number" ? item.position : 0,
    timeStamp: item.queueTimeStamp ? String(item.queueTimeStamp) : item.timeStamp ? String(item.timeStamp) : null,
    availabilityStatus: "AVAILABLE",
    department: {
      departmentId: String(item.departmentId ?? fallbackDepartmentId ?? ""),
      name: String(item.departmentName ?? "Department"),
    },
    appointment,
  };
}

// FIFO ordering by created_at first, falling back to bookedAt / checkInTime
export function bookingMoment(appointment: StaffAppointment): string {
  return appointment.createdAt || appointment.bookedAt || appointment.checkInTime || "";
}

export function todayLocalValue(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function isTodayAppointment(appointment: StaffAppointment, today: string): boolean {
  if (appointment.slot?.slotDate) return appointment.slot.slotDate === today;
  return typeof appointment.createdAt === "string" && appointment.createdAt.slice(0, 10) === today;
}

export function waitingQueue(entries: QueueEntry[], departmentId: string | undefined): QueueEntry[] {
  return entries
      .filter((entry) => entry.appointment?.appointmentStatus === "WAITING")
      .filter((entry) => !departmentId || !entry.department?.departmentId || entry.department.departmentId === departmentId)
      .sort((a, b) => {
        const urgent = (a.appointment.priority === "URGENT" ? 1 : 0) - (b.appointment.priority === "URGENT" ? 1 : 0);
        if (urgent !== 0) return -urgent;
        const fifo = bookingMoment(a.appointment).localeCompare(bookingMoment(b.appointment));
        return fifo !== 0 ? fifo : a.position - b.position;
      });
}

export function inConsultationQueue(entries: QueueEntry[], departmentId: string | undefined): QueueEntry[] {
  return entries
      .filter((entry) => entry.appointment?.appointmentStatus === "INCONSULTATION")
      .filter((entry) => !departmentId || !entry.department?.departmentId || entry.department.departmentId === departmentId)
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
  forbiddenMessage?: string;
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
      const message = response.status === 403 && options.forbiddenMessage ? options.forbiddenMessage : fallback;
      throw new StaffApiError(typeof data?.message === "string" && data.message.trim() ? data.message : message, response.status);
    }
    if (response.status === 204) return null;
    return response.json();
  };
}