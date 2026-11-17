import type { ReactNode } from "react";
import Link from "next/link";
import { appointmentStatusPresentation } from "@/lib/appointment-status";

export type AppointmentCardDetail = {
  label: string;
  value: ReactNode;
};

export default function AppointmentCard({
  title,
  subtitle,
  status,
  details = [],
  description,
  footer,
  href,
  hrefLabel = "View appointment details",
  className = "",
}: {
  title: string;
  subtitle: string;
  status: string;
  details?: AppointmentCardDetail[];
  description?: string;
  footer?: ReactNode;
  href?: string;
  hrefLabel?: string;
  className?: string;
}) {
  const presentation = appointmentStatusPresentation(status);

  return (
    <article className={`rounded-xl border border-primary/15 bg-surface p-5 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-sm text-neutral-600">{subtitle}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${presentation.className}`}>{presentation.label}</span>
      </div>
      {details.length > 0 && (
        <div className={`mt-5 grid gap-4 border-t border-primary/10 pt-4 ${details.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {details.map((detail) => (
            <div key={detail.label}>
              <p className="text-sm text-neutral-500">{detail.label}</p>
              <p className="mt-1 text-lg font-semibold">{detail.value}</p>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-sm text-neutral-700">{description ?? presentation.description}</p>
      {footer}
      {href && <Link href={href} className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-primary underline">{hrefLabel}</Link>}
    </article>
  );
}
