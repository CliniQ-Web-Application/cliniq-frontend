import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function required(name, { trim = true } = {}) {
  const raw = process.env[name];
  const value = trim ? raw?.trim() : raw;
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function checkResult(result, action) {
  if (result.error) {
    // Do not print SDK errors or request details that may contain credentials.
    const detail = result.error.code ? ` (${result.error.code})` : "";
    throw new Error(`${action} failed${detail}. Check that SUPABASE_SERVICE_ROLE_KEY is a real service-role key and that the table/schema exists.`);
  }
  return result.data;
}

async function bootstrapAdmin() {
  const url = required("SUPABASE_URL");
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const email = required("CLINIQ_ADMIN_EMAIL").toLowerCase();
  const password = required("CLINIQ_ADMIN_PASSWORD", { trim: false });
  const firstName = required("CLINIQ_ADMIN_FIRST_NAME");
  const lastName = required("CLINIQ_ADMIN_LAST_NAME");
  const departmentId = required("CLINIQ_ADMIN_DEPARTMENT_ID");

  const parsedUrl = new URL(url);
  if (!["https:", "http:"].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    throw new Error("SUPABASE_URL must be an HTTP(S) project URL without embedded credentials.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100) {
    throw new Error("CLINIQ_ADMIN_EMAIL must be a valid email of at most 100 characters.");
  }
  if (firstName.length > 100 || lastName.length > 100) {
    throw new Error("Admin first and last names must each be at most 100 characters.");
  }
  if (password.length < 8) {
    throw new Error("CLINIQ_ADMIN_PASSWORD must be at least 8 characters and satisfy the project's Auth policy.");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(departmentId)) {
    throw new Error("CLINIQ_ADMIN_DEPARTMENT_ID must be an existing department UUID.");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const department = checkResult(
    await supabase.from("department").select("department_id").eq("department_id", departmentId).maybeSingle(),
    "Department lookup",
  );
  if (!department) {
    throw new Error("Department does not exist. Create it through the normal department workflow first.");
  }

  // Auth's admin API is paginated; a first-page-only lookup is not idempotent.
  let authUser;
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const data = checkResult(
      await supabase.auth.admin.listUsers({ page, perPage }),
      "Auth user lookup",
    );
    authUser = data.users.find((user) => user.email?.toLowerCase() === email);
    if (authUser || data.users.length < perPage) break;
  }

  // Escape LIKE metacharacters so an email is always an exact, case-insensitive match.
  const emailPattern = email.replace(/[\\%_]/g, "\\$&");
  const staffByEmail = checkResult(
    await supabase.from("staff").select("auth_user_id,email,staff_role").ilike("email", emailPattern).maybeSingle(),
    "Staff email lookup",
  );
  const staffByAuthId = authUser
    ? checkResult(
        await supabase.from("staff").select("auth_user_id,email,staff_role").eq("auth_user_id", authUser.id).maybeSingle(),
        "Staff Auth ID lookup",
      )
    : null;

  if (authUser || staffByEmail || staffByAuthId) {
    if (
      authUser &&
      staffByEmail?.auth_user_id === authUser.id &&
      staffByEmail.staff_role === "ADMIN" &&
      staffByAuthId?.email?.toLowerCase() === email &&
      staffByAuthId.staff_role === "ADMIN"
    ) {
      console.log("Admin already exists with matching email and Auth ID; no changes made.");
      return;
    }
    throw new Error(
      "Email or Auth ID already exists without a matching ADMIN profile. Refusing to promote, relink, repair, or reset an existing account; review it manually.",
    );
  }

  const created = checkResult(
    await supabase.auth.admin.createUser({ email, password, email_confirm: true }),
    "Auth user creation",
  );
  if (!created?.user?.id) {
    throw new Error("Auth creation returned no user ID. Inspect Auth manually before retrying.");
  }
  const createdUserId = created.user.id;

  try {
    checkResult(
      await supabase.from("staff").insert({
        staff_id: randomUUID(),
        auth_user_id: createdUserId,
        first_name: firstName,
        last_name: lastName,
        email,
        staff_role: "ADMIN",
        department_id: departmentId,
        is_active: true,
        availability_status: "AVAILABLE",
      }),
      "Admin staff profile insertion",
    );
  } catch {
    // Only the Auth user created by this invocation may be rolled back.
    try {
      checkResult(await supabase.auth.admin.deleteUser(createdUserId), "Auth rollback");
    } catch {
      throw new Error(
        `Staff profile insertion failed and Auth cleanup FAILED for user ${createdUserId}. Inspect staff and Auth, then remove the orphaned user manually before retrying.`,
      );
    }
    throw new Error("Staff profile insertion failed; the newly created Auth user was deleted. Check the staff schema and permissions before retrying.");
  }

  console.log("Initial admin created with a confirmed Auth email and an active ADMIN staff profile.");
}

try {
  await bootstrapAdmin();
} catch (error) {
  console.error(`Admin setup failed: ${error instanceof Error ? error.message : "Unexpected error; inspect project configuration."}`);
  process.exitCode = 1;
}
