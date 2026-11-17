import { supabase } from "@/lib/supabase";

export type UserRole = "ADMIN" | "STAFF" | "PATIENT";

export interface UserProfile {
  id: string;
  email?: string;
  role: UserRole;
  staffRole?: "ADMIN" | "DOCTOR" | "NURSE" | "RECEPTIONIST" | string;
  staffId?: string;
  availabilityStatus?: string;
  firstName?: string;
  lastName?: string;
  departmentId?: string;
}

/**
 * Resolves the user profile and role by inspecting database tables under RLS.
 * 1. Checks `staff` table by `auth_user_id`.
 *    - If staff_role is "ADMIN" -> Role is "ADMIN"
 *    - If staff_role is anything else (DOCTOR, NURSE, RECEPTIONIST, etc.) -> Role is "STAFF"
 * 2. If not found in `staff`, user is treated as "PATIENT".
 */
export async function fetchUserProfile(userId: string): Promise<UserProfile> {
  try {
    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("staff_id, auth_user_id, first_name, last_name, staff_role, email, department_id, is_active, availability_status")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (staffError) {
      console.warn("Could not query staff table:", staffError.message);
    }

    if (staff) {
      const isStaffAdmin = String(staff.staff_role).toUpperCase() === "ADMIN";
      return {
        id: userId,
        email: staff.email,
        role: isStaffAdmin ? "ADMIN" : "STAFF",
        staffRole: staff.staff_role,
        staffId: staff.staff_id,
        availabilityStatus: staff.availability_status,
        firstName: staff.first_name,
        lastName: staff.last_name,
        departmentId: staff.department_id,
      };
    }

    // Try reading patient details from the patient table
    try {
      const { data: patient } = await supabase
        .from("patient")
        .select("patientid, patient_name, patient_surname, phone")
        .eq("auth_user_id", userId)
        .maybeSingle();

      if (patient) {
        return {
          id: userId,
          role: "PATIENT",
          firstName: patient.patient_name,
          lastName: patient.patient_surname,
        };
      }
    } catch {
      // Fallback silently if patient query fails or column variation exists
    }

    // Fallback to user metadata stored in Supabase Auth
    try {
      const { data: authData } = await supabase.auth.getUser();
      const meta = authData?.user?.user_metadata;
      if (meta?.first_name || meta?.last_name) {
        return {
          id: userId,
          role: "PATIENT",
          firstName: meta.first_name,
          lastName: meta.last_name,
        };
      }
    } catch {
      // Fallback silently
    }

    return {
      id: userId,
      role: "PATIENT",
    };
  } catch (error) {
    console.error("Error in fetchUserProfile:", error);
    return {
      id: userId,
      role: "PATIENT",
    };
  }
}

/**
 * Returns the designated landing route for each role.
 */
export function getRoleDestination(role: UserRole | null | undefined): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "STAFF":
      return "/staff";
    case "PATIENT":
      return "/patient";
    default:
      return "/auth/signin";
  }
}

/**
 * Checks whether a user with the given role is allowed to access the specified pathname.
 */
export function isRouteAllowed(pathname: string, role: UserRole | null): boolean {
  // Match on the path part only, ignoring query strings (e.g. /check-in?id=...).
  const path = pathname.split("?")[0] || "/";
  // Public routes accessible without logging in
  if (path === "/" || path.startsWith("/auth/")) {
    return true;
  }

  // If user is not logged in, protected routes are not allowed
  if (!role) {
    return false;
  }

  // Check-in works for any signed-in role: patients check themselves in, staff/admins scan it at reception.
  if (path === "/check-in") {
    return true;
  }

  // Admin routes: strictly ADMIN only
  if (path === "/admin" || path.startsWith("/admin/")) {
    return role === "ADMIN";
  }

  // Legacy staff registration is reserved for admins and redirects to the admin portal.
  if (path === "/staff/register" || path === "/staff/register/") {
    return role === "ADMIN";
  }

  // Staff routes: strictly STAFF only
  if (path === "/staff" || path.startsWith("/staff/")) {
    return role === "STAFF";
  }

  // Patient routes: strictly PATIENT only
  if (path === "/patient" || path.startsWith("/patient/")) {
    return role === "PATIENT";
  }

  // Default deny for unknown internal paths
  return false;
}
