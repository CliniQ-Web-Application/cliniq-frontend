import AdminShell from "@/components/admin/AdminShell";
import StaffRegistrationForm from "@/components/admin/StaffRegistrationForm";

export default function AdminStaffRegistrationPage() {
    return (
        <AdminShell activePage="staff">
            <StaffRegistrationForm />
        </AdminShell>
    );
}
