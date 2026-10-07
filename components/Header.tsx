"use client";

import { SubmitEvent, useState } from "react";
import { Check, Menu, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Patient } from "@/data/mock_data";
import { usePatientStore } from "@/store/patientStore";

type PatientFormData = {
  name: string;
  contact_info: string;
  date_of_birth: string;
  medical_history: string;
};

export default function Header() {
  const [checkedIn, setCheckedIn] = useState(false);
  const [available, setAvailable] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [walkInFormOpen, setWalkInFormOpen] = useState(false);

  const addPatient = usePatientStore((state) => state.addPatient);

  const [formData, setFormData] = useState<PatientFormData>({
    name: "",
    contact_info: "",
    date_of_birth: "",
    medical_history: "",
  });

  function handleCheckIn() {
    setCheckedIn((current) => !current);
  }

  function handleAvailability() {
    setAvailable((current) => !current);
  }

  function openWalkInForm() {
    setWalkInFormOpen(true);
    setMenuOpen(false);
  }

  function closeWalkInForm() {
    setWalkInFormOpen(false);
    setFormData({
      name: "",
      contact_info: "",
      date_of_birth: "",
      medical_history: "",
    });
  }

  function handleInputChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const newPatient: Patient = { ...formData, status: "incomplete" };
    addPatient(newPatient);
    closeWalkInForm();
  }

  return (
    <>
      {/* ─── Top nav bar ─── */}
      <header className="fixed left-0 top-0 z-50 w-full border-b border-primary/20 bg-surface shadow-sm">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">

          {/* Brand */}
          <span className="text-xl font-bold text-primary">
            CliniQ{" "}
            <span className="text-sm font-normal text-neutral-500">
              | Staff Portal
            </span>
          </span>

          {/* Desktop controls */}
          <div className="hidden items-center gap-5 md:flex">

            {/* Availability toggle */}
            <div className="flex items-center gap-2 text-sm">
              <span className={available ? "text-neutral-400" : "font-medium text-foreground"}>
                Not available
              </span>
              <Switch checked={available} onCheckedChange={handleAvailability} />
              <span className={available ? "font-medium text-foreground" : "text-neutral-400"}>
                Available
              </span>
            </div>

            {/* Check-in button */}
            <button
              type="button"
              onClick={handleCheckIn}
              className={`flex min-h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition ${
                checkedIn
                  ? "bg-success hover:opacity-90"
                  : "bg-primary hover:bg-primary-hover"
              }`}
            >
              {checkedIn ? (
                <>
                  <span>Checked in</span>
                  <Check size={15} />
                </>
              ) : (
                <>
                  <span>Checked out</span>
                  <X size={15} />
                </>
              )}
            </button>

            {/* Walk-in form button */}
            <button
              type="button"
              onClick={openWalkInForm}
              className="flex min-h-10 items-center rounded-lg border-2 border-primary px-4 text-sm font-semibold text-primary transition hover:bg-accent-surface"
            >
              Walk-in form
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMenuOpen((c) => !c)}
            className="rounded-lg p-2 md:hidden"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="border-t border-primary/20 bg-surface px-4 py-4 md:hidden">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-medium">Availability</span>
              <div className="flex items-center gap-2 text-xs">
                <span className={available ? "text-neutral-400" : "font-semibold text-foreground"}>
                  Off
                </span>
                <Switch checked={available} onCheckedChange={handleAvailability} size="sm" />
                <span className={available ? "font-semibold text-foreground" : "text-neutral-400"}>
                  On
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCheckIn}
              className={`mb-3 flex w-full min-h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-white transition ${
                checkedIn
                  ? "bg-success hover:opacity-90"
                  : "bg-primary hover:bg-primary-hover"
              }`}
            >
              {checkedIn ? (
                <><span>Checked in</span><Check size={15} /></>
              ) : (
                <><span>Checked out</span><X size={15} /></>
              )}
            </button>

            <button
              type="button"
              onClick={openWalkInForm}
              className="flex w-full min-h-10 items-center justify-center rounded-lg border-2 border-primary text-sm font-semibold text-primary transition hover:bg-accent-surface"
            >
              Walk-in form
            </button>
          </div>
        )}
      </header>

      {/* ─── Walk-in modal ─── */}
      {walkInFormOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="walkin-title"
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md space-y-5 rounded-2xl border border-primary/20 bg-surface p-6 shadow-xl"
          >
            {/* Modal header */}
            <div className="flex items-center justify-between">
              <h2 id="walkin-title" className="text-lg font-bold">
                Walk-in Patient
              </h2>
              <button
                type="button"
                onClick={closeWalkInForm}
                className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-background"
                aria-label="Close form"
              >
                <X size={20} />
              </button>
            </div>

            {/* Patient Name */}
            <div>
              <label
                htmlFor="name"
                className="mb-1.5 block text-sm font-semibold"
              >
                Patient Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="Full name"
                className="h-10 w-full rounded-lg border border-primary/30 bg-background px-3 text-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Contact */}
              <div>
                <label
                  htmlFor="contact_info"
                  className="mb-1.5 block text-sm font-semibold"
                >
                  Contact Number
                </label>
                <input
                  id="contact_info"
                  name="contact_info"
                  type="tel"
                  value={formData.contact_info}
                  onChange={handleInputChange}
                  required
                  placeholder="+267 71 234 567"
                  className="h-10 w-full rounded-lg border border-primary/30 bg-background px-3 text-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Date of birth */}
              <div>
                <label
                  htmlFor="date_of_birth"
                  className="mb-1.5 block text-sm font-semibold"
                >
                  Date of Birth
                </label>
                <input
                  id="date_of_birth"
                  name="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={handleInputChange}
                  required
                  className="h-10 w-full rounded-lg border border-primary/30 bg-background px-3 text-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Medical history */}
            <div>
              <label
                htmlFor="medical_history"
                className="mb-1.5 block text-sm font-semibold"
              >
                Medical History
              </label>
              <textarea
                id="medical_history"
                name="medical_history"
                value={formData.medical_history}
                onChange={handleInputChange}
                rows={4}
                placeholder="Briefly describe any known conditions…"
                className="w-full resize-none rounded-lg border border-primary/30 bg-background p-3 text-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={closeWalkInForm}
                className="flex flex-1 min-h-10 items-center justify-center rounded-lg border-2 border-error text-sm font-semibold text-error transition hover:bg-error-background"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex flex-1 min-h-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover"
              >
                Add Patient
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}