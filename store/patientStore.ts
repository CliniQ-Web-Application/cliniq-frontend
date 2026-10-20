import { create } from "zustand";
import { patients as initialPatients } from "@/data/mock_data";
import { Patient } from "@/types/Patient";

interface PatientStore {
    patients: Patient[];
    addPatient: (patient: Patient) => void;
}

export const usePatientStore = create<PatientStore>((set) => ({
    patients: initialPatients,
    addPatient: (patient) =>
        set((state) => ({ patients: [...state.patients, patient] })),
}));