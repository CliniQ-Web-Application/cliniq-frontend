import Link from "next/link";
import { ArrowLeft, CalendarPlus, ClipboardList, HeartPulse, QrCode, Clock } from "lucide-react";

const actions = [
  {
    icon: CalendarPlus,
    title: "Book appointment",
    description: "Find a time that works for you.",
    href: "/patient/book-appointment",
  },
  {
    icon: ClipboardList,
    title: "View appointments",
    description: "See your upcoming care at a glance.",
    href: "#",
  },
  {
    icon: QrCode,
    title: "Check in with QR",
    description: "Scan to confirm your arrival instantly.",
    href: "#",
  },
  {
    icon: Clock,
    title: "Track queue position",
    description: "See where you are in the waiting list.",
    href: "#",
  },
];

export default function PatientPortal() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">

        {/* Back link */}
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary no-underline transition hover:text-primary-hover"
        >
          <ArrowLeft aria-hidden="true" size={18} />
          Back to portals
        </Link>

        {/* Page header */}
        <header className="mt-12 max-w-2xl">
          <div className="mb-4 flex items-center gap-3 text-primary">
            <HeartPulse aria-hidden="true" size={28} />
            <span className="text-xl font-bold">CliniQ</span>
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
            Patient portal
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-tight">
            Your care, in one calm place.
          </h1>
          <p className="mt-4 text-lg text-neutral-600">
            This is your starting point for appointments and care information.
          </p>
        </header>

        {/* Action cards */}
        <section
          aria-label="Patient actions"
          className="mt-10 grid gap-4 sm:grid-cols-2"
        >
          {actions.map(({ icon: Icon, title, description, href }) => (
            <Link
              key={title}
              href={href}
              className="group flex min-h-28 items-center gap-5 rounded-xl border border-primary/20 bg-surface p-6 no-underline transition hover:border-primary"
            >
              <span className="flex shrink-0 items-center justify-center rounded-lg bg-accent-surface p-3">
                <Icon aria-hidden="true" className="text-primary" size={24} />
              </span>
              <span>
                <strong className="block text-lg font-semibold text-foreground group-hover:text-primary">
                  {title}
                </strong>
                <span className="mt-0.5 block text-sm text-neutral-600">
                  {description}
                </span>
              </span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
