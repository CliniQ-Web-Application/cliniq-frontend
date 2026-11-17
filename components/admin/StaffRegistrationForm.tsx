"use client";

import React, { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { adminApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useDepartments } from "@/lib/queries";
import { StaffApiError } from "@/lib/staff";
import SessionExpiredAction from "@/components/auth/SessionExpiredAction";
import type { Department } from "@/types/Department";

const inputClass = "h-11 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm outline-none transition placeholder:text-neutral-500 focus:border-primary focus:ring-2 focus:ring-primary/20";


export default function StaffRegistrationForm() {
    const { user, role: userRole, loading: authLoading } = useAuth();
    const queryClient = useQueryClient();
    const submitting = useRef(false);
    const [succeeded, setSucceeded] = useState(false);
    const [staffName, setStaffName] = useState("");
    const [staffSurname, setStaffSurname] = useState("");
    const [email, setEmail] = useState("");
    const [departmentId, setDepartmentId] = useState("");
    const [role, setRole] = useState("DOCTOR");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    // Departments come from the shared cache used by the rest of the admin portal.
    const {
        data: departments = [],
        isPending: loadingDepartments,
        error: departmentsError,
    } = useDepartments<Department[]>({ enabled: !authLoading && Boolean(user) && userRole === "ADMIN" });
    const displayMessage = message || (departmentsError ? "Could not load departments. Please retry later." : "");

    async function handleSubmit( e: React.SubmitEvent<HTMLFormElement> ) {
        e.preventDefault();
        if (submitting.current) return;
        setSucceeded(false);
        setMessage("");

        if (authLoading || !user || userRole !== "ADMIN") {
            setMessage("Only signed-in administrators can create staff accounts.");
            return;
        }

        if (!staffName.trim() || !staffSurname.trim()) {
            setMessage("First name and surname must not be blank.");
            return;
        }

        if (password !== confirmPassword) {
            setMessage("Passwords do not match.");
            return;
        }

        if (password.length < 6) {
            setMessage("Password must be at least 6 characters.");
            return;
        }

        if (loadingDepartments || !departments.some((department) => department.departmentId === departmentId)) {
            setMessage("Please select a department.");
            return;
        }

        submitting.current = true;
        setLoading(true);

        try {
            await adminApi("/staff/register", {
                method: "POST",
                body: JSON.stringify({
                        firstName: staffName.trim(),
                        lastName: staffSurname.trim(),
                        email: email.trim(),
                        departmentId,
                        staffRole: role,
                        password,
                }),
            });
            await queryClient.invalidateQueries({ queryKey: queryKeys.staffList });

            setSucceeded(true);
            setMessage("Staff account created successfully. The demo staff list will not display this account.");

            setStaffName("");
            setStaffSurname("");
            setEmail("");
            setDepartmentId("");
            setRole("DOCTOR");
            setPassword("");
            setConfirmPassword("");
        } catch (error) {
            setMessage(error instanceof StaffApiError ? error.message : error instanceof Error ? error.message : "Something went wrong.");
        } finally {
            submitting.current = false;
            setLoading(false);
        }
    }

    if (authLoading) {
        return <p role="status">Verifying administrator access...</p>;
    }

    if (!user || userRole !== "ADMIN") {
        return <p role="alert" className="rounded-lg border border-error/20 bg-error-background p-4 text-error">Only signed-in administrators can create staff accounts.</p>;
    }

    return (
        <div className="mx-auto w-full max-w-md">
            <form
                onSubmit={handleSubmit}
                aria-busy={loading}
                className="w-full max-w-md space-y-5 rounded-2xl border border-primary/15 bg-surface p-6 shadow-sm sm:p-8"
            >
                <div>
                    <h1 className="text-3xl font-bold">
                        Register staff
                    </h1>
                    <p className="mt-2 text-sm text-neutral-600">
                        Create a staff member&apos;s CliniQ account.
                    </p>
                </div>

                <fieldset disabled={loading} className="space-y-5">
                <legend className="sr-only">Staff account details</legend>
                <div className="space-y-2">
                    <label htmlFor="staffName" className="block text-sm font-medium">
                        First name
                    </label>
                    <input
                        id="staffName"
                        value={staffName}
                        onChange={(e) => setStaffName(e.target.value)}
                        autoComplete="given-name"
                        required
                        className={inputClass}
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="staffSurname" className="block text-sm font-medium">
                        Surname
                    </label>
                    <input
                        id="staffSurname"
                        value={staffSurname}
                        onChange={(e) => setStaffSurname(e.target.value)}
                        autoComplete="family-name"
                        required
                        className={inputClass}
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="email" className="block text-sm font-medium">
                        Email address
                    </label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        required
                        className={inputClass}
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="department" className="block text-sm font-medium">
                        Department
                    </label>
                    <select
                        id="department"
                        value={departmentId}
                        onChange={(e) => setDepartmentId(e.target.value)}
                        disabled={loadingDepartments || departments.length === 0}
                        required
                        className={inputClass}
                    >
                        <option value="">
                            {loadingDepartments
                                ? "Loading departments..."
                                : departments.length === 0
                                    ? "No departments available"
                                    : "Select a department"}
                        </option>

                        {departments.map((department) => (
                            <option
                                key={department.departmentId}
                                value={department.departmentId}
                            >
                                {department.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label htmlFor="role" className="block text-sm font-medium">
                        Staff role
                    </label>
                    <select
                        id="role"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className={inputClass}
                    >
                        <option value="DOCTOR">Doctor</option>
                        <option value="NURSE">Nurse</option>
                        <option value="RECEPTIONIST">Receptionist</option>
                        <option value="ADMIN">Administrator</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <label htmlFor="password" className="block text-sm font-medium">
                        Initial password
                    </label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        minLength={6}
                        required
                        className={inputClass}
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="confirmPassword" className="block text-sm font-medium">
                        Confirm password
                    </label>
                    <input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        minLength={6}
                        required
                        className={inputClass}
                    />
                </div>

                </fieldset>

                <p
                    role={succeeded ? "status" : "alert"}
                    aria-live={succeeded ? "polite" : "assertive"}
                    aria-atomic="true"
                    className={displayMessage ? `wrap-break-word rounded-lg border px-3 py-2.5 text-sm font-medium ${succeeded ? "border-success/20 bg-success-background text-success" : "border-error/20 bg-error-background text-error"}` : "sr-only"}
                >
                    {displayMessage}<SessionExpiredAction message={displayMessage} returnTo="/admin/staff/register" />
                </p>

                <button
                    type="submit"
                    disabled={loading || loadingDepartments || departments.length === 0}
                    className="flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover disabled:opacity-50"
                >
                    {loading ? "Creating account..." : "Register staff"}
                </button>
            </form>
        </div>
    );
}
