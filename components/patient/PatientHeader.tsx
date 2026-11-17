"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarPlus, Clock3, LogOut, Menu, QrCode, UserRound, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

const navigation = [
  { label: "Home", href: "/patient", icon: UserRound },
  { label: "Book appointment", href: "/patient/book-appointment", icon: CalendarPlus },
  { label: "Check in", href: "/patient/check-in", icon: QrCode },
  { label: "Queue", href: "/patient/queue-tracking", icon: Clock3 },
  { label: "Notifications", href: "/patient/notifications", icon: Bell },
  { label: "Profile", href: "/patient/profile", icon: UserRound },
];

export default function PatientHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { profile, user, signOut } = useAuth();
  const patientName = profile?.firstName
    ? `${profile.firstName} ${profile.lastName ?? ""}`.trim()
    : profile?.email ?? user?.email ?? "Patient";

  return (
    <header className="sticky top-0 z-30 border-b border-primary/15 bg-surface/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/patient" className="shrink-0 text-lg font-bold text-primary no-underline">
          CliniQ <span className="hidden font-normal text-neutral-500 sm:inline">| Patient portal</span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Patient navigation">
          {navigation.map(({ label, href, icon: Icon }) => {
            const active = href === "/patient" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold no-underline transition ${
                  active ? "bg-accent-surface text-primary" : "text-neutral-600 hover:bg-background hover:text-primary"
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary sm:inline">
            {patientName}
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="hidden min-h-10 items-center gap-2 rounded-lg border border-primary/25 px-3 text-sm font-semibold text-primary transition hover:bg-accent-surface sm:flex"
          >
            <LogOut size={16} aria-hidden="true" />
            Logout
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-lg p-2 lg:hidden"
            aria-label="Toggle patient navigation"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav className="border-t border-primary/15 bg-surface px-4 py-3 lg:hidden" aria-label="Patient mobile navigation">
          <div className="grid gap-1 sm:grid-cols-2">
            {navigation.map(({ label, href, icon: Icon }) => {
              const active = href === "/patient" ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold no-underline ${
                    active ? "bg-accent-surface text-primary" : "text-neutral-700"
                  }`}
                >
                  <Icon size={17} aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                void signOut();
              }}
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-red-600 hover:bg-red-50 sm:hidden"
            >
              <LogOut size={17} aria-hidden="true" />
              Logout
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
