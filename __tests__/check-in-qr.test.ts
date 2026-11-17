import { describe, it, expect } from "vitest";
import { appointmentIdFromCheckInQr, checkInUrl } from "@/lib/check-in-qr";

const ID = "9f1c9e5a-3b2d-4c8e-9a7b-1234567890ab";

describe("check-in QR contract", () => {
  it("encodes a URL with the appointment id", () => {
    expect(checkInUrl(ID, "http://localhost:3000")).toBe(`http://localhost:3000/check-in?id=${ID}`);
  });

  it("strips trailing slashes from the base URL", () => {
    expect(checkInUrl(ID, "http://localhost:3000/")).toBe(`http://localhost:3000/check-in?id=${ID}`);
  });

  it("url-encodes the appointment id", () => {
    expect(checkInUrl("a b", "https://clinic.example")).toBe("https://clinic.example/check-in?id=a%20b");
  });

  it("parses the id from an absolute check-in URL", () => {
    expect(appointmentIdFromCheckInQr(`http://localhost:3000/check-in?id=${ID}`)).toBe(ID);
  });

  it("parses the id from a URL on a different host", () => {
    expect(appointmentIdFromCheckInQr(`https://clinic.example/check-in?id=${ID}`)).toBe(ID);
  });

  it("parses the id from a root-relative check-in URL", () => {
    expect(appointmentIdFromCheckInQr(`/check-in?id=${ID}`)).toBe(ID);
  });

  it("still accepts legacy JSON payloads", () => {
    expect(appointmentIdFromCheckInQr(JSON.stringify({ type: "CLINIQ_CHECK_IN", appointmentId: ID }))).toBe(ID);
  });

  it("rejects unrelated URLs and malformed ids", () => {
    expect(appointmentIdFromCheckInQr("https://example.com/other?id=" + ID)).toBeNull();
    expect(appointmentIdFromCheckInQr("http://localhost:3000/check-in?id=nope")).toBeNull();
    expect(appointmentIdFromCheckInQr("not a code")).toBeNull();
    expect(appointmentIdFromCheckInQr("")).toBeNull();
  });
});
