const presentations: Record<string, { label: string; className: string }> = {
  AVAILABLE: { label: "In office", className: "bg-success-background text-success" },
  ONCALL: { label: "On call", className: "bg-amber-100 text-amber-800" },
  EMERGENCY: { label: "Emergency", className: "bg-error-background text-error" },
  UNAVAILABLE: { label: "Unavailable", className: "bg-neutral-100 text-neutral-600" },
};

export function doctorAvailabilityPresentation(status: string | null | undefined) {
  return presentations[status ?? ""] ?? { label: "Status unknown", className: "bg-neutral-100 text-neutral-600" };
}

export function departmentAvailabilitySummary(doctors: Array<{ staffId: string; availabilityStatus?: string | null }>): string {
  const uniqueDoctors = new Map(doctors.map((doctor) => [doctor.staffId, doctor]));
  const counts = new Map<string, number>();
  for (const doctor of uniqueDoctors.values()) {
    const label = doctorAvailabilityPresentation(doctor.availabilityStatus).label.toLowerCase();
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts, ([label, count]) => `${count} ${label}`).join(" · ") || "No doctors with bookable windows";
}
