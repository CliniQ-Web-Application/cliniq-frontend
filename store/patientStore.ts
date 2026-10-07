import { create } from "zustand";
import { patients as initialPatients, Patient } from "@/data/mock_data";

interface PatientStore {
    patients: Patient[];
    addPatient: (patient: Patient) => void;
}

export const usePatientStore = create<PatientStore>((set) => ({
    patients: initialPatients,
    addPatient: (patient) =>
        set((state) => ({ patients: [...state.patients, patient] })),
}));