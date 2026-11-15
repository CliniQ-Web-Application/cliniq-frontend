import type { ReactNode } from "react";
import PatientHeader from "@/components/patient/PatientHeader";

export default function PatientLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <PatientHeader />
      {children}
    </div>
  );
}
