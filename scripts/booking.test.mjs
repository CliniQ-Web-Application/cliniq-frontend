import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { Script } from "node:vm";
import { appointmentIdFromQr, checkInQrPayload } from "../lib/check-in-qr.ts";
import { hasActiveQueue, readQueue } from "../lib/queue.ts";
import { departmentAvailabilitySummary, doctorAvailabilityPresentation } from "../lib/availability.ts";
import { broadcastRecipientCount, broadcastSchedules, scheduleBroadcastBody } from "../lib/schedule-broadcast.ts";
import {
  availableBookingSlots, localDateValue, bookingBody, patientProfileBody,
  parseBookingConfirmation, BookingRequestError, createBookingApi, slotCapacityLabel,
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
const notificationSource = await readFile(new URL("../lib/notifications.ts", import.meta.url), "utf8");
const notificationScript = new Script(`${stripTypeScriptTypes(notificationSource.replace(/^import[^\n]+\n/, "")).replace(/export /g, "")}\n({ fetchMyNotifications, markNotificationRead })`);
function notificationClient(fetcher, session = { access_token: "test-token" }) {
  return notificationScript.runInNewContext({
    supabase: { auth: { getSession: async () => ({ data: { session } }) } },
    process: { env: { NEXT_PUBLIC_API_URL: "https://clinic.example" } },
    fetch: fetcher,
  });
}

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

test("doctor availability labels match the backend enum and tolerate unknown status", () => {
  for (const [status, label] of Object.entries({ AVAILABLE: "In office", ONCALL: "On call", EMERGENCY: "Emergency", UNAVAILABLE: "Unavailable" })) {
    assert.equal(doctorAvailabilityPresentation(status).label, label);
    assert.ok(doctorAvailabilityPresentation(status).className);
  }
  for (const status of [undefined, null, "NEW_STATUS"]) assert.equal(doctorAvailabilityPresentation(status).label, "Status unknown");
});

test("department availability counts unique doctors rather than each open window", () => {
  const doctors = [
    { staffId: "doctor-1", availabilityStatus: "AVAILABLE" },
    { staffId: "doctor-1", availabilityStatus: "AVAILABLE" },
    { staffId: "doctor-2", availabilityStatus: "ONCALL" },
    { staffId: "doctor-3", availabilityStatus: "UNAVAILABLE" },
  ];
  assert.equal(departmentAvailabilitySummary(doctors), "1 in office · 1 on call · 1 unavailable");
  assert.equal(departmentAvailabilitySummary([]), "No doctors with bookable windows");
});

test("current doctor status is informational and does not hide future booking windows", () => {
  for (const availabilityStatus of ["AVAILABLE", "ONCALL", "EMERGENCY", "UNAVAILABLE", null]) {
    const candidate = { ...slot, staff: { ...slot.staff, availabilityStatus } };
    assert.deepEqual(availableBookingSlots([candidate]), [candidate]);
  }
});

test("schedule broadcasts validate delay minutes and omit them for absence notices", () => {
  assert.deepEqual(scheduleBroadcastBody({ type: "DELAY", message: " Traffic delay ", delayMinutes: "20" }), { type: "DELAY", message: "Traffic delay", delayMinutes: 20 });
  assert.deepEqual(scheduleBroadcastBody({ type: "ABSENCE", message: " Please contact reception ", delayMinutes: "20" }), { type: "ABSENCE", message: "Please contact reception" });
  for (const delayMinutes of ["", " ", "0", "-1", "1.5", "1441", "bad"]) {
    assert.throws(() => scheduleBroadcastBody({ type: "DELAY", message: "Delay", delayMinutes }), /whole minutes/);
  }
  for (const message of ["", " ", "x".repeat(501)]) {
    assert.throws(() => scheduleBroadcastBody({ type: "ABSENCE", message, delayMinutes: "" }), /1–500/);
  }
});

test("broadcast windows include full and older clinics without relying on the browser date", () => {
  const full = { ...slot, slotId: "full", slotStatus: "BOOKED" };
  const earlier = { ...slot, slotId: "today", slotDate: today };
  const blocked = { ...slot, slotId: "blocked", slotStatus: "BLOCKED", slotDate: "2026-10-25" };
  const input = [full, { ...slot, staff: { ...slot.staff, staffId: "another-doctor" } },
    { ...slot, slotId: "older", slotDate: "2026-10-22" }, blocked, earlier];
  assert.deepEqual(broadcastSchedules(input, "doctor-1").map((item) => item.slotId), ["blocked", "full", "today", "older"]);
  assert.equal(input[0], full);
});

test("broadcast success counts accept zero and reject malformed responses", () => {
  assert.equal(broadcastRecipientCount({ recipientCount: 0 }), 0);
  assert.equal(broadcastRecipientCount({ recipientCount: 3 }), 3);
  for (const value of [null, {}, { recipientCount: -1 }, { recipientCount: 1.5 }, { recipientCount: "3" }]) {
    assert.throws(() => broadcastRecipientCount(value), /avoid duplicate notices/);
  }
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

test("describes remaining capacity when a window declares one", () => {
  assert.equal(slotCapacityLabel({ capacity: 20, bookedCount: 3 }), "3 of 20 booked");
  assert.equal(slotCapacityLabel({ capacity: 1 }), "0 of 1 booked");
  assert.equal(slotCapacityLabel({}), null);
});

test("formats a local calendar date with zero padding instead of UTC conversion", () => {
  assert.equal(localDateValue(new Date(2026, 0, 2, 0, 15)), "2026-01-02");
});

test("booking payload contains exactly slotId and requires a selection", () => {
  assert.deepEqual(bookingBody("slot-1"), { slotId: "slot-1" });
  assert.deepEqual(bookingBody("slot-1", "13:45"), { slotId: "slot-1", appointmentTime: "13:45" });
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

test("saves existing profiles via authenticated PUT with editable fields only", async () => {
  const input = { patientName: " First ", patientSurname: " Last ", nationalID: " 123 ", phone: " 456 " };
  const body = patientProfileBody(input);
  const api = makeApi(async (url, init) => {
    assert.equal(url, "https://clinic.example/api/patients/me");
    assert.equal(init.method, "PUT");
    assert.equal(init.headers.Authorization, "Bearer test-token");
    assert.deepEqual(JSON.parse(init.body), body);
    return json(body);
  });
  assert.deepEqual(await api("/patients/me", { method: "PUT", body: JSON.stringify(body) }), body);
});

test("notification list and read receipts use authenticated uncached recipient endpoints", async () => {
  const notification = { notificationId: "notification-1", isRead: false, message: "Clinic update" };
  const calls = [];
  const client = notificationClient(async (url, init) => {
    calls.push({ url, init });
    return json(init.method === "PATCH" ? { ...notification, isRead: true } : [notification]);
  });
  assert.deepEqual(await client.fetchMyNotifications(), [notification]);
  assert.deepEqual(await client.markNotificationRead(notification.notificationId), { ...notification, isRead: true });
  assert.deepEqual(calls.map(({ url }) => url), ["https://clinic.example/api/notifications/me", "https://clinic.example/api/notifications/notification-1/read"]);
  assert.deepEqual(calls.map(({ init }) => init.method), ["GET", "PATCH"]);
  for (const { init } of calls) {
    assert.equal(init.headers.Authorization, "Bearer test-token");
    assert.equal(init.cache, "no-store");
    assert.equal(init.body, undefined);
  }
});

test("notification read failures remain errors and never report a successful read", async () => {
  for (const status of [401, 403, 404, 500]) {
    const client = notificationClient(async () => json({}, status));
    await assert.rejects(client.markNotificationRead("notification-1"), /Could not mark this notification as read/);
  }
  const client = notificationClient(async () => { throw new Error("Must not fetch without session"); }, null);
  await assert.rejects(client.markNotificationRead("notification-1"), /No session/);
});

test("notification read receipts encode the notification identifier as a path segment", async () => {
  const client = notificationClient(async (url) => {
    assert.equal(url, "https://clinic.example/api/notifications/id%2Fwith%3Fdelimiters/read");
    return json({ isRead: true });
  });
  await client.markNotificationRead("id/with?delimiters");
});

test("queue snapshots use the live server position, status, and estimated minutes", () => {
  const snapshot = readQueue({ appointmentId: confirmation.appointmentId, queuePosition: 3, queueStatus: "WAITING", estimatedWaitMinutes: 30 }, confirmation);
  assert.deepEqual(snapshot, {
    appointmentId: confirmation.appointmentId, queuePosition: 3, queueStatus: "WAITING", estimatedWaitMinutes: 30, error: "",
  });
  assert.equal(readQueue({ queuePosition: 2, queueStatus: "WAITING", estimatedWaitMinutes: 15 }, confirmation).queuePosition, 2);
  assert.equal(readQueue({ queuePosition: 1, queueStatus: "WAITING", estimatedWaitMinutes: 0 }, confirmation).estimatedWaitMinutes, 0);
});

test("only waiting and in-consultation appointments request live queue details", () => {
  for (const status of ["WAITING", "INCONSULTATION", " waiting "]) assert.equal(hasActiveQueue(status), true);
  for (const status of ["BOOKED", "COMPLETED", "CANCELLED", "NOSHOW"]) {
    assert.equal(hasActiveQueue(status), false);
    const snapshot = readQueue({}, { ...confirmation, appointmentStatus: status });
    assert.equal(snapshot.queueStatus, status);
    assert.equal(snapshot.queuePosition, null);
    assert.equal(snapshot.estimatedWaitMinutes, null);
  }
});

test("queue snapshots do not show stale positions after a patient is called or leaves", () => {
  for (const status of ["INCONSULTATION", "COMPLETED", "CANCELLED", "NOSHOW"]) {
    const snapshot = readQueue({ position: 4, queueStatus: status, estimatedWaitMinutes: 0 }, confirmation);
    assert.equal(snapshot.queueStatus, status);
    assert.equal(snapshot.queuePosition, null);
    assert.equal(snapshot.estimatedWaitMinutes, 0);
  }
});

test("queue snapshots reject invalid positions, estimates, and non-object responses", () => {
  for (const queuePosition of [0, -1, 1.5, NaN, Infinity, "2", null]) {
    assert.equal(readQueue({ queuePosition, queueStatus: "WAITING" }, confirmation).queuePosition, null);
  }
  for (const estimatedWaitMinutes of [-1, NaN, Infinity, "15", null]) {
    assert.equal(readQueue({ estimatedWaitMinutes }, confirmation).estimatedWaitMinutes, null);
  }
  for (const value of [null, [], "invalid"]) assert.throws(() => readQueue(value, confirmation), /unexpected queue response/);
});

test("patient QR codes use the backend check-in URL format and round-trip through the scanner", () => {
  const id = "cc54d085-5698-40c1-917e-d37db83ba46a";
  const payload = checkInQrPayload(id, "https://clinic.example/");
  assert.equal(payload, `https://clinic.example/check-in?id=${id}`);
  assert.equal(appointmentIdFromQr(payload), id);
  assert.equal(appointmentIdFromQr(`http://localhost:3000/check-in?id=${id}`), id);
  assert.equal(appointmentIdFromQr(`/check-in?id=${id}`), id);
  assert.equal(appointmentIdFromQr(`/check-in?other=value&id=%20${id}%20`), id);
});

test("scanner remains compatible with legacy patient JSON QR codes", () => {
  assert.equal(appointmentIdFromQr(JSON.stringify({ type: "CLINIQ_CHECK_IN", appointmentId: " appointment-1 " })), "appointment-1");
});

test("scanner rejects invalid or unrelated QR payloads without throwing", () => {
  for (const raw of [
    "", "not a QR payload", "{broken", "null", "42", '"appointment-1"', "[]",
    JSON.stringify({ type: "OTHER", appointmentId: "appointment-1" }),
    JSON.stringify({ type: "CLINIQ_CHECK_IN" }),
    JSON.stringify({ type: "CLINIQ_CHECK_IN", appointmentId: 123 }),
    JSON.stringify({ type: "CLINIQ_CHECK_IN", appointmentId: " " }),
    "/check-in", "/check-in?id=", "/check-in?id=%20", "/other?id=appointment-1",
    "https://clinic.example/?id=appointment-1", "https://[invalid/check-in?id=appointment-1",
    "javascript:/check-in?id=appointment-1", "ftp://clinic.example/check-in?id=appointment-1",
  ]) assert.equal(appointmentIdFromQr(raw), null, raw);
});
