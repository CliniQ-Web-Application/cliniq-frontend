export function checkInQrPayload(appointmentId: string, appBaseUrl: string): string {
  const url = new URL("/check-in", appBaseUrl);
  url.searchParams.set("id", appointmentId);
  return url.toString();
}

export function appointmentIdFromQr(rawValue: string): string | null {
  try {
    const value: unknown = JSON.parse(rawValue);
    if (!value || typeof value !== "object") return null;
    const payload = value as Record<string, unknown>;
    return payload.type === "CLINIQ_CHECK_IN" && typeof payload.appointmentId === "string"
      ? payload.appointmentId.trim() || null
      : null;
  } catch {
    // Previously issued patient QR codes contain JSON; new codes contain a URL.
  }

  try {
    const url = new URL(rawValue, "https://cliniq.invalid");
    if (!["http:", "https:"].includes(url.protocol) || url.pathname !== "/check-in") return null;
    return url.searchParams.get("id")?.trim() || null;
  } catch {
    return null;
  }
}
