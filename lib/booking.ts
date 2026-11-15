import type { Department } from "../types/Department";

export interface BookingSlot {
  slotId: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  slotStatus: "OPEN" | "BOOKED" | "BLOCKED";
  capacity?: number;
  bookedCount?: number;
  staff: {
    staffId: string;
    firstName: string;
    lastName: string;
    staffRole: string;
    active: boolean;
    department: Department | null;
  } | null;
}

export interface PatientProfileInput {
  patientName: string;
  patientSurname: string;
  nationalID: string;
  phone: string;
}

export interface PatientProfile extends PatientProfileInput {
  patientID: string;
  authUserId: string;
  patientEmail: string;
}

export interface BookingConfirmation {
  appointmentId: string;
  appointmentStatus: string;
  slotId: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  departmentName: string | null;
  doctorName: string;
  bookedAt: string;
}

// The server filters future times in the clinic timezone, not the browser timezone.
export function availableBookingSlots(slots: BookingSlot[]): BookingSlot[] {
  return slots.filter((slot) =>
    slot.slotStatus === "OPEN" &&
    slot.startTime < slot.endTime &&
    slot.staff?.active === true &&
    slot.staff.staffRole === "DOCTOR" &&
    Boolean(slot.staff.department?.departmentId)
  ).sort((a, b) => `${a.slotDate}T${a.startTime}`.localeCompare(`${b.slotDate}T${b.startTime}`));
}

export function slotCapacityLabel(slot: Pick<BookingSlot, "capacity" | "bookedCount">): string | null {
  if (typeof slot.capacity !== "number") return null;
  return `${slot.bookedCount ?? 0} of ${slot.capacity} booked`;
}

export function localDateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function patientProfileBody(input: PatientProfileInput): PatientProfileInput {
  const body = {
    patientName: input.patientName.trim(),
    patientSurname: input.patientSurname.trim(),
    nationalID: input.nationalID.trim(),
    phone: input.phone.trim(),
  };
  if (Object.values(body).some((value) => !value)) {
    throw new Error("Please enter your first name, surname, National ID, and phone number.");
  }
  return body;
}

export function bookingBody(slotId: string): { slotId: string } {
  if (!slotId.trim()) throw new Error("Please select an available clinic time.");
  return { slotId };
}

export function parseBookingConfirmation(value: unknown): BookingConfirmation {
  const fields = ["appointmentId", "appointmentStatus", "slotId", "slotDate", "startTime", "endTime", "doctorName", "bookedAt"];
  if (!value || typeof value !== "object" || fields.some((key) =>
    typeof (value as Record<string, unknown>)[key] !== "string" || !(value as Record<string, unknown>)[key]
  )) throw new Error("The clinic returned an unexpected booking response. Check your appointments before booking again.");
  const department = (value as Record<string, unknown>).departmentName;
  if (department !== null && (typeof department !== "string" || !department)) {
    throw new Error("The clinic returned an unexpected booking response. Check your appointments before booking again.");
  }
  return value as BookingConfirmation;
}

export class BookingRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BookingRequestError";
    this.status = status;
  }
}

export function createBookingApi(options: {
  baseUrl: string | undefined;
  getToken: () => Promise<string | null>;
  refreshToken: () => Promise<string | null>;
  fetcher?: typeof fetch;
}) {
  const fetcher = options.fetcher ?? fetch;
  return async function request(path: string, init: RequestInit = {}): Promise<unknown> {
    const baseUrl = options.baseUrl?.replace(/\/+$/, "");
    if (!baseUrl) throw new Error("Online booking is not configured. Please contact the clinic.");
    let token = await options.getToken();
    if (!token) throw new BookingRequestError("Your session has expired. Please sign in again.", 401);
    const send = (accessToken: string) => fetcher(`${baseUrl}/api${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });
    let response = await send(token);
    // Only an explicit authentication rejection is retried, never a failed POST transport.
    if (response.status === 401) {
      token = await options.refreshToken();
      if (token) response = await send(token);
    }
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const fallback = response.status === 401
        ? "Your session has expired. Please sign in again."
        : response.status === 403
          ? "You do not have permission to use patient booking. Please sign in with your patient account."
          : "The clinic could not complete this request. Please try again or contact the clinic.";
      throw new BookingRequestError(typeof data?.message === "string" && data.message.trim() ? data.message : fallback, response.status);
    }
    if (response.status === 204) return null;
    return response.json();
  };
}
