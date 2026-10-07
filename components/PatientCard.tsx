"use client";

import { useState } from "react";
import {
  Calendar,
  CircleCheck,
  Hourglass,
  Phone,
  XCircle,
} from "lucide-react";

type Patient = {
  name: string;
  date_of_birth: string;
  contact_info: string;
  medical_history: string;
  status: string;
};

type PatientState = "waiting" | "incomplete" | "complete";

interface PatientCardProps {
  patient: Patient;
}

const stateConfig = {
  waiting: {
    cardBorder: "border-primary/30",
    cardBg: "bg-accent-surface/40",
    badgeBg: "bg-primary",
    badgeText: "text-white",
    badgeIcon: <Hourglass size={11} className="text-white" />,
    label: "Waiting",
    callBtn: "bg-primary text-white border-primary",
    markBtn: "border-primary/30 text-primary hover:bg-accent-surface",
  },
  incomplete: {
    cardBorder: "border-error/30",
    cardBg: "bg-error-background/40",
    badgeBg: "bg-error",
    badgeText: "text-white",
    badgeIcon: <XCircle size={11} className="text-white" />,
    label: "Incomplete",
    callBtn: "border-primary/30 text-primary hover:bg-accent-surface",
    markBtn: "border-success/40 text-success hover:bg-success-background",
  },
  complete: {
    cardBorder: "border-success/30",
    cardBg: "bg-success-background/40",
    badgeBg: "bg-success",
    badgeText: "text-white",
    badgeIcon: <CircleCheck size={11} className="text-white" />,
    label: "Complete",
    callBtn: "cursor-not-allowed border-neutral-200 text-neutral-400",
    markBtn: "border-error/30 text-error hover:bg-error-background",
  },
};

export default function PatientCard({ patient }: PatientCardProps) {
  const [patientState, setPatientState] = useState<PatientState>("incomplete");

  function handleCalledNext() {
    setPatientState("waiting");
  }

  function handleComplete() {
    setPatientState(patientState === "complete" ? "incomplete" : "complete");
  }

  const cfg = stateConfig[patientState];

  return (
    <div
      className={`flex h-full flex-col justify-between rounded-xl border ${cfg.cardBorder} ${cfg.cardBg} bg-surface p-5 shadow-sm transition`}
    >
      {/* Card header */}
      <div className="mb-4 flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground leading-tight">
          {patient.name}
        </h2>
        <span
          className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.badgeBg} ${cfg.badgeText}`}
        >
          {cfg.badgeIcon}
          {cfg.label}
        </span>
      </div>

      {/* Patient details */}
      <dl className="mb-5 grid gap-2">
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Calendar size={14} className="shrink-0 text-primary" />
          <dd>{patient.date_of_birth}</dd>
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Phone size={14} className="shrink-0 text-primary" />
          <dd>{patient.contact_info}</dd>
        </div>
        <div className="mt-1">
          <dt className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Medical History
          </dt>
          <dd className="line-clamp-2 text-sm text-neutral-700">
            {patient.medical_history}
          </dd>
        </div>
      </dl>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCalledNext}
          disabled={patientState === "complete"}
          className={`flex flex-1 min-h-9 items-center justify-center rounded-lg border text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${cfg.callBtn}`}
        >
          {patientState === "waiting" ? "Called" : "Call next"}
        </button>

        <button
          type="button"
          onClick={handleComplete}
          className={`flex flex-1 min-h-9 items-center justify-center rounded-lg border text-sm font-semibold transition ${cfg.markBtn}`}
        >
          Mark{" "}
          {patientState === "complete" ? "incomplete" : "complete"}
        </button>
      </div>
    </div>
  );
}