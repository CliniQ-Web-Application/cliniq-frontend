export type AppointmentStatusPresentation = {
  label: string;
  description: string;
  className: string;
};

const knownStatuses: Record<string, AppointmentStatusPresentation> = {
  BOOKED: {
    label: "Booked",
    description: "Your appointment is confirmed. Please arrive at the clinic for your scheduled time.",
    className: "bg-accent-surface text-primary",
  },
  CONFIRMED: {
    label: "Confirmed",
    description: "Your appointment is confirmed. Please arrive at the clinic for your scheduled time.",
    className: "bg-accent-surface text-primary",
  },
  CHECKEDIN: {
    label: "Checked in",
    description: "The clinic has recorded your arrival. Please wait to be called.",
    className: "bg-warning-background text-warning",
  },
  WAITING: {
    label: "Waiting",
    description: "You are in the waiting queue. Please remain near the clinic and check your queue position for updates.",
    className: "bg-warning-background text-warning",
  },
  CALLED: {
    label: "Called",
    description: "The clinic has called you. Please proceed to the consultation area.",
    className: "bg-accent-surface text-primary",
  },
  CALLEDIN: {
    label: "Called for consultation",
    description: "The clinic has called you. Please proceed to the consultation area.",
    className: "bg-accent-surface text-primary",
  },
  CALLEDFORCONSULTATION: {
    label: "Called for consultation",
    description: "The clinic has called you. Please proceed to the consultation area.",
    className: "bg-accent-surface text-primary",
  },
  INCONSULTATION: {
    label: "In consultation",
    description: "Your consultation is in progress.",
    className: "bg-accent-surface text-primary",
  },
  COMPLETED: {
    label: "Completed",
    description: "This consultation is complete. Contact the clinic if you need follow-up information.",
    className: "bg-success-background text-success",
  },
  CANCELLED: {
    label: "Cancelled",
    description: "This appointment has been cancelled. Contact the clinic if you need help booking another time.",
    className: "bg-error-background text-error",
  },
  NOSHOW: {
    label: "Missed appointment",
    description: "The clinic marked this appointment as missed. Contact the clinic if you think this is incorrect or need to rebook.",
    className: "bg-error-background text-error",
  },
  NO_SHOW: {
    label: "Missed appointment",
    description: "The clinic marked this appointment as missed. Contact the clinic if you think this is incorrect or need to rebook.",
    className: "bg-error-background text-error",
  },
};

function normalizedStatus(status: string): string {
  return status.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function humanize(status: string): string {
  return status
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function appointmentStatusPresentation(status: string): AppointmentStatusPresentation {
  const key = normalizedStatus(status);
  const compactKey = key.replaceAll("_", "");
  const known = knownStatuses[key] ?? knownStatuses[compactKey];
  if (known) return known;
  const label = status.trim() ? humanize(status.trim()) : "Status unavailable";
  return {
    label,
    description: status.trim()
      ? `The clinic currently reports this appointment as ${label}. Contact the clinic if you need help understanding this status.`
      : "The clinic has not provided an appointment status yet.",
    className: "bg-neutral-100 text-neutral-700",
  };
}
