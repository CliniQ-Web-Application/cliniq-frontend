export const ADMIN_APPOINTMENT_STATUSES = ["BOOKED", "CHECKEDIN", "WAITING", "INCONSULTATION", "COMPLETED", "CANCELLED", "NOSHOW"] as const;

export type AdminDepartment = { departmentId: string; name: string };
export type AdminDoctor = {
  staffId: string;
  firstName: string;
  lastName: string;
  staffRole: string;
  active: boolean;
  availabilityStatus: string | null;
  department: AdminDepartment | null;
};
export type AdminSchedule = {
  slotId: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  slotStatus: "OPEN" | "BLOCKED" | "BOOKED";
  capacity: number;
  staff: AdminDoctor | null;
};
export type ScheduleForm = {
  staffId: string; slotDate: string; startTime: string; endTime: string;
  capacity: string; slotStatus: string;
};
export type AppointmentFilters = {
  from: string; to: string; status: string; departmentId: string; doctorId: string; search: string;
};
export const EMPTY_APPOINTMENT_FILTERS: AppointmentFilters = {
  from: "", to: "", status: "", departmentId: "", doctorId: "", search: "",
};
const appointmentFields = [
  "appointmentStatus", "priority", "bookedAt", "createdAt", "appointmentTime", "checkInTime", "calledTime",
  "completedTime", "slotId", "slotDate", "startTime", "endTime", "doctorId", "doctorName", "departmentId",
  "departmentName", "patientId", "patientName", "patientEmail", "patientPhone",
] as const;
export type AdminAppointment = { appointmentId: string } & Record<typeof appointmentFields[number], string | null>;
export type AdminAppointmentPage = {
  items: AdminAppointment[]; page: number; size: number; totalElements: number; totalPages: number;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The clinic returned an invalid response. Please refresh and try again.");
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("The clinic returned an incomplete response. Please refresh and try again.");
  return value;
}
function nullableText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error("The clinic returned an invalid text value.");
  return value;
}
function whole(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) throw new Error("The clinic returned an invalid count.");
  return value;
}
function list<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error("The clinic returned an invalid list. Please refresh and try again.");
  return value.map(parse);
}
export function parseDepartment(value: unknown): AdminDepartment {
  const item = record(value);
  return { departmentId: text(item.departmentId), name: text(item.name) };
}
export function parseDoctor(value: unknown): AdminDoctor {
  const item = record(value);
  if (typeof item.active !== "boolean") throw new Error("The clinic returned an invalid staff status.");
  return {
    staffId: text(item.staffId), firstName: nullableText(item.firstName) ?? "", lastName: nullableText(item.lastName) ?? "",
    staffRole: text(item.staffRole), active: item.active, availabilityStatus: nullableText(item.availabilityStatus),
    department: item.department == null ? null : parseDepartment(item.department),
  };
}
export const parseDepartments = (value: unknown) => list(value, parseDepartment);
export const parseDoctors = (value: unknown) => list(value, parseDoctor);
export function parseSchedule(value: unknown): AdminSchedule {
  const item = record(value);
  const status = text(item.slotStatus);
  if (status !== "OPEN" && status !== "BLOCKED" && status !== "BOOKED") throw new Error("The clinic returned an unknown schedule status.");
  return {
    slotId: text(item.slotId), slotDate: text(item.slotDate), startTime: text(item.startTime), endTime: text(item.endTime),
    slotStatus: status, capacity: whole(item.capacity, 1, 10000), staff: item.staff == null ? null : parseDoctor(item.staff),
  };
}
export const parseSchedules = (value: unknown) => list(value, parseSchedule);
export function parseAdminAppointment(value: unknown): AdminAppointment {
  const item = record(value);
  const result = { appointmentId: text(item.appointmentId) } as AdminAppointment;
  for (const field of appointmentFields) result[field] = nullableText(item[field]);
  return result;
}
export function parseAdminAppointmentPage(value: unknown): AdminAppointmentPage {
  const item = record(value);
  const result = {
    items: list(item.items, parseAdminAppointment), page: whole(item.page, 0), size: whole(item.size, 1, 100),
    totalElements: whole(item.totalElements, 0), totalPages: whole(item.totalPages, 0),
  };
  if (result.items.length > result.size || result.items.length > result.totalElements ||
      result.totalPages !== Math.ceil(result.totalElements / result.size)) throw new Error("The clinic returned inconsistent appointment pagination.");
  return result;
}
export function eligibleScheduleDoctors(doctors: AdminDoctor[]): AdminDoctor[] {
  return doctors.filter((doctor) => doctor.active && doctor.staffRole === "DOCTOR" && doctor.department !== null);
}
function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function validTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?$/.test(value);
}
export function scheduleRequestBody(form: ScheduleForm, doctors: AdminDoctor[]) {
  if (!eligibleScheduleDoctors(doctors).some((doctor) => doctor.staffId === form.staffId)) throw new Error("Select an active doctor with a department.");
  if (!validDate(form.slotDate) || !validTime(form.startTime) || !validTime(form.endTime)) throw new Error("Enter a valid date, start time and end time.");
  const seconds = (time: string) => { const [hour, minute, second = "0"] = time.split(":"); return Number(hour) * 3600 + Number(minute) * 60 + Number(second); };
  if (seconds(form.endTime) <= seconds(form.startTime)) throw new Error("End time must be after start time on the same day.");

  if (!/^\d+$/.test(form.capacity) || Number(form.capacity) < 1 || Number(form.capacity) > 10000) throw new Error("Capacity must be a whole number between 1 and 10000.");
  if (form.slotStatus !== "OPEN" && form.slotStatus !== "BLOCKED") throw new Error("Only open or blocked slots can be managed manually.");
  return { staffId: form.staffId, slotDate: form.slotDate, startTime: form.startTime, endTime: form.endTime, capacity: Number(form.capacity), slotStatus: form.slotStatus };
}
export function appointmentRequestParams(filters: AppointmentFilters, page = 0, size = 20): string {
  if ((filters.from && !validDate(filters.from)) || (filters.to && !validDate(filters.to))) throw new Error("Enter valid filter dates.");
  if (filters.from && filters.to && filters.from > filters.to) throw new Error("From date must be on or before the to date.");
  if (filters.status && !ADMIN_APPOINTMENT_STATUSES.some((status) => status === filters.status)) throw new Error("Select a valid appointment status.");
  whole(page, 0); whole(size, 1, 100);
  const params = new URLSearchParams();
  for (const key of ["from", "to", "status", "departmentId", "doctorId", "search"] as const) {
    const value = filters[key].trim();
    if (value) params.set(key, value);
  }
  params.set("page", String(page)); params.set("size", String(size));
  return params.toString();
}
export function adminError(cause: unknown): string {
  const status = cause && typeof cause === "object" && "status" in cause ? cause.status : null;
  const message = cause instanceof Error ? cause.message : "The clinic could not complete the request. Please try again.";
  return status === 409 ? `Conflict: ${message} Refresh to see the latest state. Slots with booking history are protected; only booked appointments can be cancelled.` : message;
}
