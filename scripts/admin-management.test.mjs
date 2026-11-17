import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import {
  ADMIN_APPOINTMENT_STATUSES, EMPTY_APPOINTMENT_FILTERS, appointmentRequestParams,
  eligibleScheduleDoctors, scheduleRequestBody, parseDoctor, parseDoctors, parseDepartments,
  parseSchedule, parseSchedules, parseAdminAppointment, parseAdminAppointmentPage, adminError,
} from "../lib/admin-management.ts";

const department = { departmentId: "department-1", name: "General" };
const doctor = {
  staffId: "doctor-1", firstName: "Test", lastName: "Doctor", staffRole: "DOCTOR",
  active: true, availabilityStatus: "IN_OFFICE", department,
};
const form = { staffId: doctor.staffId, slotDate: "2026-11-20", startTime: "09:00", endTime: "09:30", capacity: "10", slotStatus: "OPEN" };

const slot = { slotId: "slot-1", slotDate: form.slotDate, startTime: "09:00:00", endTime: "09:30:00", capacity: 10, slotStatus: "OPEN", staff: doctor };
const appointment = {
  appointmentId: "appointment-1", appointmentStatus: "BOOKED", priority: "NORMAL",
  bookedAt: "2026-11-19T12:00:00", createdAt: "2026-11-19T12:00:00", appointmentTime: "09:00:00",
  checkInTime: null, calledTime: null, completedTime: null, slotId: "slot-1", slotDate: form.slotDate,
  startTime: "09:00:00", endTime: "09:30:00", doctorId: doctor.staffId, doctorName: "Test Doctor",
  departmentId: department.departmentId, departmentName: department.name,
  patientId: "patient-1", patientName: "Full Patient Name", patientEmail: "patient@example.test", patientPhone: "+267 1234567",
};
const page = { items: [appointment], page: 0, size: 20, totalElements: 1, totalPages: 1 };

test("appointment query omits empty filters and uses zero-based pages of 20", () => {
  assert.equal(appointmentRequestParams(EMPTY_APPOINTMENT_FILTERS), "page=0&size=20");
  assert.equal(appointmentRequestParams(EMPTY_APPOINTMENT_FILTERS, 2), "page=2&size=20");
});
test("appointment query sends all filters and safely encodes trimmed search", () => {
  const filters = { from: "2026-11-01", to: "2026-11-30", status: "BOOKED", departmentId: department.departmentId, doctorId: doctor.staffId, search: "  Name +267 & email@example.test  " };
  const params = new URLSearchParams(appointmentRequestParams(filters, 3));
  for (const [key, value] of Object.entries(filters)) assert.equal(params.get(key), value.trim());
  assert.equal(params.get("page"), "3");
  assert.equal(params.get("size"), "20");
  assert.equal([...params].length, 8);
});
test("all supported appointment statuses can be sent to the backend", () => {
  assert.deepEqual(ADMIN_APPOINTMENT_STATUSES, ["BOOKED", "CHECKEDIN", "WAITING", "INCONSULTATION", "COMPLETED", "CANCELLED", "NOSHOW"]);
  for (const status of ADMIN_APPOINTMENT_STATUSES) assert.equal(new URLSearchParams(appointmentRequestParams({ ...EMPTY_APPOINTMENT_FILTERS, status })).get("status"), status);
});
test("appointment query rejects invalid dates, reversed ranges and unsupported statuses", () => {
  for (const patch of [{ from: "2026-02-30" }, { to: "2026-13-01" }, { from: "not-a-date" }, { from: "2026-11-20", to: "2026-11-19" }, { status: "CONFIRMED" }]) {
    assert.throws(() => appointmentRequestParams({ ...EMPTY_APPOINTMENT_FILTERS, ...patch }));
  }
  assert.doesNotThrow(() => appointmentRequestParams({ ...EMPTY_APPOINTMENT_FILTERS, from: "2028-02-29", to: "2028-02-29" }));
});
test("appointment query validates paging bounds", () => {
  for (const [number, size] of [[-1, 20], [0.5, 20], [NaN, 20], [0, 0], [0, 101], [0, 1.5]]) {
    assert.throws(() => appointmentRequestParams(EMPTY_APPOINTMENT_FILTERS, number, size));
  }
});
test("schedule doctor choices require active DOCTOR with a department", () => {
  const members = [doctor, { ...doctor, active: false }, { ...doctor, staffRole: "ADMIN" }, { ...doctor, staffRole: "NURSE" }, { ...doctor, department: null }];
  assert.deepEqual(eligibleScheduleDoctors(members), [doctor]);
});
test("schedule payload contains only contract fields and converts capacity to a number", () => {
  const payload = scheduleRequestBody({ ...form, authUserId: "must-not-send", department }, [doctor]);
  assert.deepEqual(payload, { ...form, capacity: 10 });
  assert.equal(scheduleRequestBody({ ...form, slotStatus: "BLOCKED" }, [doctor]).slotStatus, "BLOCKED");
});
test("schedule capacity accepts both boundaries", () => {
  for (const capacity of ["1", "10000"]) assert.equal(scheduleRequestBody({ ...form, capacity }, [doctor]).capacity, Number(capacity));
});
test("schedule capacity rejects fractions, exponent notation, blanks and out-of-range values", () => {
  for (const capacity of ["", " ", "0", "-1", "1.1", "1e2", "NaN", "10001", "Infinity"]) {
    assert.throws(() => scheduleRequestBody({ ...form, capacity }, [doctor]), /whole number/);
  }
});
test("schedule payload disallows BOOKED and unknown manual statuses", () => {
  for (const slotStatus of ["BOOKED", "", "CANCELLED"]) assert.throws(() => scheduleRequestBody({ ...form, slotStatus }, [doctor]), /open or blocked/);
});
test("schedule payload validates doctor eligibility rather than trusting selected ID", () => {
  for (const members of [[], [{ ...doctor, active: false }], [{ ...doctor, department: null }], [{ ...doctor, staffRole: "NURSE" }]]) {
    assert.throws(() => scheduleRequestBody(form, members), /active doctor/);
  }
});
test("schedule payload rejects invalid dates and clock values", () => {
  for (const patch of [{ slotDate: "2026-02-30" }, { slotDate: "bad" }, { startTime: "24:00" }, { endTime: "09:60" }, { startTime: "9:00" }, { endTime: "09:30:60" }]) {
    assert.throws(() => scheduleRequestBody({ ...form, ...patch }, [doctor]), /valid date/);
  }
});
test("schedule payload rejects equal, reversed and overnight windows", () => {
  for (const [startTime, endTime] of [["09:00", "09:00:00"], ["09:00:00.0", "09:00"], ["10:00", "09:30"], ["23:00", "01:00"]]) {
    assert.throws(() => scheduleRequestBody({ ...form, startTime, endTime }, [doctor]), /after start/);
  }
});
test("schedule payload leaves past-date eligibility to the server regardless of browser clock", (context) => {
  context.mock.timers.enable({ apis: ["Date"], now: new Date("2099-01-01T00:00:00Z") });
  for (const slotDate of ["2000-01-01", "2026-11-20", "2099-01-01"]) {
    const clinicForm = { ...form, slotDate };
    assert.deepEqual(scheduleRequestBody(clinicForm, [doctor]), { ...clinicForm, capacity: 10 });
  }
});
test("schedule payload preserves clinic datetime across browser timezones, including a local DST gap", () => {
  const moduleUrl = new URL("../lib/admin-management.ts", import.meta.url).href;
  const source = `
    import assert from "node:assert/strict";
    import { scheduleRequestBody } from ${JSON.stringify(moduleUrl)};
    const doctor = ${JSON.stringify(doctor)};
    for (const slotDate of ["2000-01-01", "2026-03-08", "2099-11-20"]) {
      const form = { ...${JSON.stringify(form)}, slotDate, startTime: "02:10", endTime: "02:40" };
      assert.deepEqual(scheduleRequestBody(form, [doctor]), { ...form, capacity: 10 });
    }
  `;
  for (const TZ of ["UTC", "Africa/Gaborone", "America/New_York", "Pacific/Kiritimati"]) {
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
      env: { ...process.env, TZ }, encoding: "utf8", timeout: 10000,
    });
    assert.equal(result.status, 0, `${TZ}: ${result.error?.message ?? result.stderr}`);
  }
});
test("schedule payload accepts backend-style seconds", () => {
  assert.doesNotThrow(() => scheduleRequestBody({ ...form, startTime: "09:00:01", endTime: "09:00:02" }, [doctor]));
});
test("choice parsers whitelist staff and department properties, excluding auth IDs", () => {
  assert.deepEqual(parseDoctor({ ...doctor, authUserId: "secret" }), doctor);
  assert.deepEqual(parseDepartments([{ ...department, internal: "secret" }]), [department]);
  assert.deepEqual(parseDoctors([doctor]), [doctor]);
  assert.throws(() => parseDoctors({ items: [doctor] }));
  assert.throws(() => parseDoctor({ ...doctor, active: "true" }));
  assert.throws(() => parseDepartments([null]));
});
test("schedule responses retain all management fields and allow historical missing staff", () => {
  assert.deepEqual(parseSchedules([slot]), [slot]);
  assert.deepEqual(parseSchedule({ ...slot, staff: null }).staff, null);
  assert.equal(parseSchedule({ ...slot, slotStatus: "BOOKED" }).slotStatus, "BOOKED");
});
test("schedule response rejects malformed lists, capacities and statuses", () => {
  for (const value of [null, {}, { items: [slot] }]) assert.throws(() => parseSchedules(value));
  for (const patch of [{ slotId: "" }, { capacity: null }, { capacity: "10" }, { capacity: 0 }, { capacity: 2.5 }, { slotStatus: "OTHER" }]) assert.throws(() => parseSchedule({ ...slot, ...patch }));
});
test("flat appointment parser preserves contact, full name and activity without auth identities", () => {
  const withActivity = { ...appointment, checkInTime: "2026-11-20T08:55:00", calledTime: "2026-11-20T09:05:00", completedTime: "2026-11-20T09:25:00" };
  assert.deepEqual(parseAdminAppointment({ ...withActivity, authUserId: "secret", patient: { authUserId: "secret" } }), withActivity);
});
test("appointment parser handles nullable historical fields without inventing nested values", () => {
  const parsed = parseAdminAppointment({ appointmentId: "historical-1", patient: { patientName: "Do not use nested data" } });
  for (const [key, value] of Object.entries(parsed)) if (key !== "appointmentId") assert.equal(value, null);
  assert.throws(() => parseAdminAppointment({ ...appointment, patientPhone: 123 }));
  assert.throws(() => parseAdminAppointment({ ...appointment, appointmentId: null }));
});
test("appointment page parser preserves backend newest-first order", () => {
  const items = [{ ...appointment, appointmentId: "newer", createdAt: "2026-11-19T13:00:00" }, appointment];
  assert.deepEqual(parseAdminAppointmentPage({ ...page, items, totalElements: 2 }).items, items);
  assert.deepEqual(parseAdminAppointmentPage({ ...page, items: [], totalElements: 0, totalPages: 0 }).items, []);
});
test("appointment page parser rejects malformed and inconsistent pagination", () => {
  for (const patch of [{ items: null }, { page: -1 }, { size: 0 }, { size: 101 }, { totalElements: -1 }, { totalPages: 1.5 }, { totalPages: 2 }, { totalElements: 0, totalPages: 0 }]) {
    assert.throws(() => parseAdminAppointmentPage({ ...page, ...patch }));
  }
  assert.throws(() => parseAdminAppointmentPage([appointment]));
});
test("conflict feedback retains backend reason and gives recovery guidance", () => {
  const conflict = Object.assign(new Error("This slot has booking history."), { status: 409 });
  assert.match(adminError(conflict), /Conflict: This slot has booking history/);
  assert.match(adminError(conflict), /Refresh/);
  assert.equal(adminError(new Error("Network unavailable")), "Network unavailable");
});
