import { describe, it, expect } from "vitest";
import { appointmentIdFromQr, checkInQrPayload } from "@/lib/check-in-qr";

const ID = "9f1c9e5a-3b2d-4c8e-9a7b-1234567890ab";

describe("check-in QR contract", () => {
  it("encodes a URL with the appointment id", () => {
    expect(checkInQrPayload(ID, "http://localhost:3000")).toBe(`http://localhost:3000/check-in?id=${ID}`);
  });

  it("normalizes a trailing slash on the base URL", () => {
    expect(checkInQrPayload(ID, "http://localhost:3000/")).toBe(`http://localhost:3000/check-in?id=${ID}`);
  });

  it("url-encodes the appointment id", () => {
    expect(checkInQrPayload("a b", "https://clinic.example")).toBe("https://clinic.example/check-in?id=a+b");
  });

  it("parses the id from an absolute check-in URL", () => {
    expect(appointmentIdFromQr(`http://localhost:3000/check-in?id=${ID}`)).toBe(ID);
  });

  it("parses the id from a URL on a different host", () => {
    expect(appointmentIdFromQr(`https://clinic.example/check-in?id=${ID}`)).toBe(ID);
  });

  it("still accepts legacy JSON payloads", () => {
    expect(appointmentIdFromQr(JSON.stringify({ type: "CLINIQ_CHECK_IN", appointmentId: ID }))).toBe(ID);
  });

  it("rejects unrelated URLs and malformed values", () => {
    expect(appointmentIdFromQr("https://example.com/other?id=" + ID)).toBeNull();
    expect(appointmentIdFromQr("not a code")).toBeNull();
  });
});
