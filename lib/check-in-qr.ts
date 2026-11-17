/**
 * Shared check-in QR contract.
 *
 * QR codes on both the patient page and the backend `/api/appointments/{id}/qr`
 * endpoint encode a plain URL: `<base>/check-in?id=<appointmentId>`.
 * The staff camera scanner parses that URL to recover the appointment id.
 */

export const CHECK_IN_PATH = "/check-in";

/** Build the canonical check-in URL for an appointment. */
export function checkInUrl(appointmentId: string, baseUrl?: string): string {
  const origin = (baseUrl ?? (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/+$/, "");
  return `${origin}${CHECK_IN_PATH}?id=${encodeURIComponent(appointmentId)}`;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Extract the appointment id from a scanned check-in URL.
 * Accepts absolute URLs (any origin) and root-relative `/check-in?id=…`.
 * Legacy JSON payloads from older QR codes are still accepted for compatibility.
 */
export function appointmentIdFromCheckInQr(rawValue: string): string | null {
  const value = rawValue.trim();
  if (!value) return null;

  // Primary format: URL with an `id` query parameter.
  try {
    const url = new URL(value, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    const path = url.pathname.replace(/\/+$/, "");
    if (path === CHECK_IN_PATH) {
      const id = url.searchParams.get("id")?.trim();
      if (id && UUID_PATTERN.test(id)) return id;
    }
  } catch {
    // Not a URL — fall through to the legacy JSON format.
  }

  // Legacy format: {"type":"CLINIQ_CHECK_IN","appointmentId":"<uuid>"}
  try {
    const payload: unknown = JSON.parse(value);
    if (payload && typeof payload === "object") {
      const object = payload as Record<string, unknown>;
      const id = object.appointmentId;
      if (object.type === "CLINIQ_CHECK_IN" && typeof id === "string" && UUID_PATTERN.test(id.trim())) {
        return id.trim();
      }
    }
  } catch {
    // Not JSON either.
  }

  return null;
}
