"use client";

import Header from "@/components/Header";
import PatientCard from "@/components/PatientCard";
import { usePatientStore } from "@/store/patientStore";

export default function StaffPortal() {
  const patients = usePatientStore((state) => state.patients);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Main content — pushed below the fixed header */}
      <main className="mx-auto w-full max-w-[1280px] px-4 pt-24 pb-12 sm:px-6 lg:px-8">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
            Staff portal
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight">
            Patient queue
          </h1>
          <p className="mt-2 text-neutral-600">
            {patients.length} patient{patients.length !== 1 ? "s" : ""} in the
            current queue.
          </p>
        </header>

        <section
          aria-label="Patient queue"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {patients.map((patient, index) => (
            <PatientCard key={index} patient={patient} />
          ))}
        </section>
      </main>
    </div>
  );
}