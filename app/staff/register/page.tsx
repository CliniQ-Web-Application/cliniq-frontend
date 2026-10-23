"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function StaffRegistrationPage() {
    const { user, role, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user && role === "ADMIN") {
            router.replace("/admin/staff/register");
        }
    }, [loading, user, role, router]);

    return <p role="status" className="p-6 text-sm text-neutral-600">Redirecting to the admin portal...</p>;
}
