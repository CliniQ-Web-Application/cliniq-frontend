export type Patient = {
    name: string;
    date_of_birth: string;
    contact_info: string;
    medical_history: string;
    status: "waiting" | "incomplete" | "complete";
};
