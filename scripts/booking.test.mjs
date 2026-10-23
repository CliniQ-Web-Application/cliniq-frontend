import assert from "node:assert/strict";
import { test } from "node:test";
import {
  availableBookingSlots, localDateValue, bookingBody, patientProfileBody,
  parseBookingConfirmation, BookingRequestError, createBookingApi,
} from "../lib/booking.ts";

const slot = {
  slotId: "slot-1",
  slotDate: "2026-10-24",
  startTime: "09:00:00",
  endTime: "09:30:00",
  slotStatus: "OPEN",
  staff: {
    staffId: "doctor-1",
    firstName: "Test",
    lastName: "Doctor",
    staffRole: "DOCTOR",
    active: true,
    department: { departmentId: "department-1", name: "General" },
  },
};
const today = "2026-10-23";
const confirmation = {
  appointmentId: "appointment-1", appointmentStatus: "BOOKED", slotId: "slot-1",
  slotDate: slot.slotDate, startTime: slot.startTime, endTime: slot.endTime,
  departmentName: "General", doctorName: "Test Doctor", bookedAt: "2026-10-23T12:00:00Z",
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const makeApi = (fetcher, overrides = {}) => createBookingApi({
  baseUrl: "https://clinic.example/", getToken: async () => "test-token",
  refreshToken: async () => "refreshed-token", fetcher, ...overrides,
});

test("lists open schedules for active doctors with departments", () => {
  assert.deepEqual(availableBookingSlots([slot]), [slot]);
});

test("excludes booked, blocked, and invalid-duration slots", () => {
  const unavailable = [
    { ...slot, slotStatus: "BOOKED" }, { ...slot, slotStatus: "BLOCKED" },
    { ...slot, endTime: "09:00:00" }, { ...slot, endTime: "08:30:00" },
  ];
  assert.deepEqual(availableBookingSlots(unavailable), []);
});

test("excludes inactive, non-doctor, missing staff, and missing department schedules", () => {
  const unavailable = [
    { ...slot, staff: { ...slot.staff, active: false } },
    { ...slot, staff: { ...slot.staff, staffRole: "ADMIN" } },
    { ...slot, staff: { ...slot.staff, staffRole: "NURSE" } },
    { ...slot, staff: { ...slot.staff, department: null } }, { ...slot, staff: null },
  ];
  assert.deepEqual(availableBookingSlots(unavailable), []);
});

test("sorts by clinic date and time without mutating API data", () => {
  const earlier = { ...slot, slotId: "slot-2", slotDate: today };
  const later = { ...slot, slotId: "slot-3", startTime: "10:00:00", endTime: "10:30:00" };
  const input = [later, slot, earlier];
  assert.deepEqual(availableBookingSlots(input).map((item) => item.slotId), ["slot-2", "slot-1", "slot-3"]);
  assert.deepEqual(input, [later, slot, earlier]);
});

test("does not discard server-authoritative dates based on the browser calendar", () => {
  const clinicYesterday = { ...slot, slotDate: "2026-10-22" };
  assert.deepEqual(availableBookingSlots([clinicYesterday]), [clinicYesterday]);
});

test("handles empty schedules", () => {
  assert.deepEqual(availableBookingSlots([]), []);
});

test("formats a local calendar date with zero padding instead of UTC conversion", () => {
  assert.equal(localDateValue(new Date(2026, 0, 2, 0, 15)), "2026-01-02");
});

test("booking payload contains exactly slotId and requires a selection", () => {
  assert.deepEqual(bookingBody("slot-1"), { slotId: "slot-1" });
  assert.throws(() => bookingBody("  "), /select an available/);
});

test("profile payload trims required fields and omits email and ownership", () => {
  const input = { patientName: " First ", patientSurname: " Last ", nationalID: " 123 ", phone: " 456 ", patientID: "ignored", authUserId: "ignored", patientEmail: "ignored" };
  assert.deepEqual(patientProfileBody(input), { patientName: "First", patientSurname: "Last", nationalID: "123", phone: "456" });
  for (const field of ["patientName", "patientSurname", "nationalID", "phone"]) {
    assert.throws(() => patientProfileBody({ ...input, [field]: " " }), /Please enter/);
  }
});

test("confirmation preserves backend ID, date, time, and status; rejects missing fields", () => {
  assert.deepEqual(parseBookingConfirmation(confirmation), confirmation);
  assert.equal(parseBookingConfirmation({ ...confirmation, appointmentStatus: "CANCELLED" }).appointmentStatus, "CANCELLED");
  for (const field of Object.keys(confirmation)) {
    assert.throws(() => parseBookingConfirmation({ ...confirmation, [field]: undefined }), /unexpected booking response/);
  }
  assert.throws(() => parseBookingConfirmation(null), /unexpected booking response/);
});

test("keeps bookings readable after the doctor's department is unassigned", () => {
  const changed = { ...confirmation, departmentName: null };
  assert.deepEqual(parseBookingConfirmation(changed), changed);
  assert.equal([confirmation, changed].map(parseBookingConfirmation).length, 2);
  assert.throws(() => parseBookingConfirmation({ ...confirmation, departmentName: 123 }), /unexpected booking response/);
});

test("uses only authenticated booking/profile endpoints with uncached requests", async () => {
  const calls = [];
  const api = makeApi(async (url, init) => { calls.push({ url, init }); return json([]); });
  await api("/patients/me");
  await api("/bookings/availability");
  await api("/bookings");
  await api("/bookings", { method: "POST", body: JSON.stringify(bookingBody("slot-1")) });
  assert.deepEqual(calls.map((call) => call.url), ["https://clinic.example/api/patients/me", "https://clinic.example/api/bookings/availability", "https://clinic.example/api/bookings", "https://clinic.example/api/bookings"]);
  for (const { init } of calls) {
    assert.equal(init.headers.Authorization, "Bearer test-token");
    assert.equal(init.cache, "no-store");
  }
  assert.deepEqual(JSON.parse(calls[3].init.body), { slotId: "slot-1" });
  assert.equal(calls[3].init.headers["Content-Type"], "application/json");
});

test("does not fetch without a token or configured API", async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return json([]); };
  await assert.rejects(makeApi(fetcher, { getToken: async () => null })("/bookings"), (error) => error.status === 401);
  await assert.rejects(makeApi(fetcher, { baseUrl: undefined })("/bookings"), /not configured/);
  assert.equal(calls, 0);
});

test("refreshes a 401 token once and preserves the exact POST payload", async () => {
  const calls = [];
  let refreshes = 0;
  const api = makeApi(async (_url, init) => {
    calls.push(init);
    return calls.length === 1 ? json({ message: "Expired" }, 401) : json(confirmation, 201);
  }, { refreshToken: async () => { refreshes++; return "new-token"; } });
  const result = await api("/bookings", { method: "POST", body: JSON.stringify(bookingBody("slot-1")) });
  assert.deepEqual(result, confirmation);
  assert.equal(refreshes, 1);
  assert.equal(calls[1].headers.Authorization, "Bearer new-token");
  assert.equal(calls[0].body, calls[1].body);
});

test("stops after one refresh or if refresh returns no token", async () => {
  for (const refreshed of [null, "still-expired"]) {
    let calls = 0;
    const api = makeApi(async () => { calls++; return json({}, 401); }, { refreshToken: async () => refreshed });
    await assert.rejects(api("/bookings"), (error) => error.status === 401 && /sign in again/.test(error.message));
    assert.equal(calls, refreshed ? 2 : 1);
  }
});

test("surfaces backend message and status for missing profile, slot conflicts, and missing slots", async () => {
  for (const status of [404, 409]) {
    const api = makeApi(async () => json({ message: "Clinic explanation" }, status));
    await assert.rejects(api("/bookings"), (error) => error instanceof BookingRequestError && error.status === status && error.message === "Clinic explanation");
  }
});

test("falls back to friendly errors for non-JSON failures", async () => {
  const api = makeApi(async () => new Response("upstream failure", { status: 503 }));
  await assert.rejects(api("/bookings"), (error) => error.status === 503 && /clinic could not complete/.test(error.message));
});

test("never automatically retries booking network, server, or invalid-JSON failures", async () => {
  for (const fail of [
    async () => { throw new TypeError("Network lost after request"); },
    async () => json({ message: "Unavailable" }, 503),
    async () => new Response("invalid", { status: 201 }),
  ]) {
    let calls = 0;
    const api = makeApi(async () => { calls++; return fail(); });
    await assert.rejects(api("/bookings", { method: "POST", body: JSON.stringify(bookingBody("slot-1")) }));
    assert.equal(calls, 1);
  }
});

test("passes cancellation signal to fetch", async () => {
  const controller = new AbortController();
  const api = makeApi(async (_url, init) => { assert.equal(init.signal, controller.signal); return json([]); });
  await api("/bookings", { signal: controller.signal });
});
