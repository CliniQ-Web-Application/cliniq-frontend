import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function required(name, { trim = true } = {}) {
  const raw = process.env[name];
  const value = trim ? raw?.trim() : raw;
  if (!value || !value.trim()) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function resultOrThrow(result, action) {
  if (result.error) {
    const detail = result.error.code ? ` (${result.error.code})` : "";
    throw new Error(`${action} failed${detail}. Check the service-role key and Supabase schema.`);
  }
  return result.data;
}

async function bootstrapStaff() {
  const url = required("SUPABASE_URL");
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  if (/your-service-role-key|placeholder|replace/i.test(serviceRoleKey)) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is still a placeholder. Copy the real Supabase service-role key into .env.local; never expose it with NEXT_PUBLIC_.");
  }

  const email = required("CLINIQ_STAFF_EMAIL").toLowerCase();
  const password = required("CLINIQ_STAFF_PASSWORD", { trim: false });
  const firstName = required("CLINIQ_STAFF_FIRST_NAME");
  const lastName = required("CLINIQ_STAFF_LAST_NAME");
  const departmentId = required("CLINIQ_STAFF_DEPARTMENT_ID");
  if (password.length < 8) throw new Error("CLINIQ_STAFF_PASSWORD must be at least 8 characters.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("CLINIQ_STAFF_EMAIL must be a valid email.");

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const department = resultOrThrow(
    await supabase.from("department").select("department_id").eq("department_id", departmentId).maybeSingle(),
    "Department lookup",
  );
  if (!department) throw new Error("The configured staff department does not exist. Set CLINIQ_STAFF_DEPARTMENT_ID to an existing department UUID.");

  let authUser;
  for (let page = 1; ; page += 1) {
    const data = resultOrThrow(await supabase.auth.admin.listUsers({ page, perPage: 1000 }), "Auth user lookup");
    authUser = data.users.find((user) => user.email?.toLowerCase() === email);
    if (authUser || data.users.length < 1000) break;
  }

  const pattern = email.replace(/[\\%_]/g, "\\$&");
  const existing = resultOrThrow(
    await supabase.from("staff").select("auth_user_id,email,staff_role").ilike("email", pattern).maybeSingle(),
    "Staff lookup",
  );
  if (authUser || existing) {
    if (authUser && existing?.auth_user_id === authUser.id && existing.staff_role === "DOCTOR") {
      console.log("Default doctor already exists; no changes made.");
      return;
    }
    throw new Error("The configured staff email already belongs to an account/profile that is not the expected default doctor. Refusing to modify it.");
  }

  const created = resultOrThrow(
    await supabase.auth.admin.createUser({ email, password, email_confirm: true }),
    "Auth user creation",
  );
  const authUserId = created?.user?.id;
  if (!authUserId) throw new Error("Auth creation returned no user ID.");

  try {
    resultOrThrow(await supabase.from("staff").insert({
      staff_id: randomUUID(),
      auth_user_id: authUserId,
      first_name: firstName,
      last_name: lastName,
      email,
      staff_role: "DOCTOR",
      department_id: departmentId,
      is_active: true,
      availability_status: "AVAILABLE",
    }), "Staff profile insertion");
  } catch (error) {
    try {
      resultOrThrow(await supabase.auth.admin.deleteUser(authUserId), "Auth rollback");
    } catch {
      throw new Error(`Staff creation failed and Auth cleanup failed for ${authUserId}; remove that orphaned Auth user manually.`);
    }
    throw error;
  }
  console.log("Default doctor created. Sign in with CLINIQ_STAFF_EMAIL, then add schedule slots from the staff portal.");
}

try {
  await bootstrapStaff();
} catch (error) {
  console.error(`Staff setup failed: ${error instanceof Error ? error.message : "Unexpected setup error."}`);
  process.exitCode = 1;
}
