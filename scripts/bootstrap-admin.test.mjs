import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Script } from "node:vm";

const source = await readFile(new URL("./bootstrap-admin.mjs", import.meta.url), "utf8");
const imports = [
  ['import { randomUUID } from "node:crypto";', "const { randomUUID } = dependencies;"],
  ['import { createClient } from "@supabase/supabase-js";', "const { createClient } = dependencies;"],
];
let isolatedSource = source;
for (const [original, replacement] of imports) {
  assert.ok(isolatedSource.includes(original), `Update the test harness for changed import: ${original}`);
  isolatedSource = isolatedSource.replace(original, replacement);
}
// Never import the executable module or load the real Supabase SDK. The VM has
// only fake environment values and injected dependencies, with no Node/network APIs.
const script = new Script(`(async () => {\n${isolatedSource}\n})()`, {
  filename: "bootstrap-admin.mjs",
});

const authUserId = "11111111-1111-4111-8111-111111111111";
const departmentId = "22222222-2222-4222-8222-222222222222";
const email = "operator@example.invalid";
const authUser = { id: authUserId, email };
const admin = { auth_user_id: authUserId, email, staff_role: "ADMIN" };
const environment = {
  SUPABASE_URL: "https://project.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "offline-test-key-not-a-real-secret",
  CLINIQ_ADMIN_EMAIL: email,
  CLINIQ_ADMIN_PASSWORD: "  offline-test-password  ",
  CLINIQ_ADMIN_FIRST_NAME: "Test",
  CLINIQ_ADMIN_LAST_NAME: "Operator",
  CLINIQ_ADMIN_DEPARTMENT_ID: departmentId,
};
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const mutationMethods = new Set(["auth.createUser", "staff.insert", "auth.deleteUser"]);

async function runBootstrap(options = {}) {
  const calls = [];
  const messages = [];
  const errors = [];
  const generatedIds = [];
  const process = { env: { ...environment, ...options.env } };
  const result = (data, error = null) => ({ data, error });
  const client = {
    from(table) {
      assert.ok(["department", "staff"].includes(table), `Unexpected table: ${table}`);
      const query = { table };
      return {
        select(columns) {
          query.columns = columns;
          return this;
        },
        eq(column, value) {
          query.filter = { method: "eq", column, value };
          return this;
        },
        ilike(column, value) {
          query.filter = { method: "ilike", column, value };
          return this;
        },
        async maybeSingle() {
          calls.push({ method: "lookup", ...query });
          if (table === "department") {
            assert.deepEqual(query.filter, { method: "eq", column: "department_id", value: departmentId });
            return result(options.departmentAbsent ? null : { department_id: departmentId });
          }
          if (query.filter.method === "ilike") {
            assert.equal(query.filter.column, "email");
            return result(options.staffByEmail ?? null);
          }
          assert.deepEqual(query.filter, { method: "eq", column: "auth_user_id", value: authUserId });
          return result(options.staffByAuthId ?? null);
        },
        async insert(payload) {
          assert.equal(table, "staff");
          calls.push({ method: "staff.insert", payload: structuredClone(payload) });
          if (options.insertThrows) throw new Error("Simulated insert transport failure");
          return result(null, options.insertError ? { message: "Simulated insert rejection" } : null);
        },
      };
    },
    auth: {
      admin: {
        async listUsers({ page, perPage }) {
          calls.push({ method: "auth.listUsers", page, perPage });
          assert.equal(perPage, 1000);
          assert.ok(page <= (options.pages?.length ?? 1), "Unexpected extra Auth page request");
          return result({ users: options.pages?.[page - 1] ?? options.users ?? [] });
        },
        async createUser(payload) {
          calls.push({ method: "auth.createUser", payload: structuredClone(payload) });
          return result({ user: { id: authUserId } }, options.createError ? {} : null);
        },
        async deleteUser(id) {
          calls.push({ method: "auth.deleteUser", id });
          if (options.cleanupThrows) throw new Error("Simulated cleanup transport failure");
          return result(null, options.cleanupError ? {} : null);
        },
      },
    },
  };

  await script.runInNewContext({
    URL,
    process,
    dependencies: {
      randomUUID() {
        const id = randomUUID();
        generatedIds.push(id);
        return id;
      },
      createClient(url, key, config) {
        calls.push({ method: "createClient", url, key, config: structuredClone(config) });
        return client;
      },
    },
    console: {
      log: (message) => messages.push(message),
      error: (message) => errors.push(message),
    },
    fetch() {
      calls.push({ method: "network" });
      throw new Error("Network access is forbidden in bootstrap tests");
    },
  }, {
    timeout: 1000,
    contextCodeGeneration: { strings: false, wasm: false },
  });

  assert.equal(calls.some((call) => call.method === "network"), false);
  return {
    calls,
    messages,
    errors,
    generatedIds,
    exitCode: process.exitCode,
    writes: calls.filter((call) => mutationMethods.has(call.method)),
  };
}

function assertRefused(result) {
  assert.equal(result.exitCode, 1);
  assert.deepEqual(result.writes, []);
  assert.deepEqual(result.generatedIds, []);
  assert.deepEqual(result.messages, []);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /Refusing to promote, relink, repair, or reset/);
}

test("creates confirmed Auth user and complete ADMIN profile with a generated staff UUID", async () => {
  const result = await runBootstrap({
    env: {
      CLINIQ_ADMIN_EMAIL: "  Operator@Example.Invalid  ",
      CLINIQ_ADMIN_FIRST_NAME: "  Test  ",
      CLINIQ_ADMIN_LAST_NAME: "  Operator  ",
    },
  });
  assert.equal(result.exitCode, undefined);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.writes.map((call) => call.method), ["auth.createUser", "staff.insert"]);
  assert.deepEqual(result.writes[0].payload, {
    email,
    password: environment.CLINIQ_ADMIN_PASSWORD,
    email_confirm: true,
  });
  assert.equal(result.generatedIds.length, 1);
  const staffId = result.generatedIds[0];
  assert.match(staffId, uuidV4);
  assert.deepEqual(result.writes[1].payload, {
    staff_id: staffId,
    auth_user_id: authUserId,
    first_name: "Test",
    last_name: "Operator",
    email,
    staff_role: "ADMIN",
    department_id: departmentId,
    is_active: true,
    availability_status: "AVAILABLE",
  });
  assert.deepEqual(result.calls[0], {
    method: "createClient",
    url: environment.SUPABASE_URL,
    key: environment.SUPABASE_SERVICE_ROLE_KEY,
    config: { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  });
  assert.ok(result.calls.findIndex((call) => call.table === "department") <
    result.calls.findIndex((call) => call.method === "auth.createUser"));
  assert.match(result.messages[0], /Initial admin created/);
});

test("generates a fresh staff UUID for each new provisioning attempt", async () => {
  const first = await runBootstrap();
  const second = await runBootstrap();
  assert.match(first.writes[1].payload.staff_id, uuidV4);
  assert.match(second.writes[1].payload.staff_id, uuidV4);
  assert.notEqual(first.writes[1].payload.staff_id, second.writes[1].payload.staff_id);
});

test("repeated matching admin runs make no writes or password changes", async () => {
  const created = await runBootstrap();
  const profile = created.writes[1].payload;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await runBootstrap({
      users: [{ ...authUser, email: email.toUpperCase() }],
      staffByEmail: profile,
      staffByAuthId: profile,
    });
    assert.equal(result.exitCode, undefined);
    assert.deepEqual(result.writes, []);
    assert.deepEqual(result.generatedIds, []);
    assert.deepEqual(result.errors, []);
    assert.match(result.messages[0], /no changes made/);
  }
});

for (const [name, options] of [
  ["existing non-admin", {
    users: [authUser],
    staffByEmail: { ...admin, staff_role: "DOCTOR" },
    staffByAuthId: { ...admin, staff_role: "DOCTOR" },
  }],
  ["orphaned Auth account", { users: [authUser] }],
  ["staff profile without an Auth account", { staffByEmail: admin }],
  ["email linked to another Auth ID", {
    users: [authUser],
    staffByEmail: { ...admin, auth_user_id: departmentId },
    staffByAuthId: admin,
  }],
  ["Auth ID linked to another email", {
    users: [authUser],
    staffByEmail: admin,
    staffByAuthId: { ...admin, email: "other@example.invalid" },
  }],
]) {
  test(`refuses ${name} without mutation`, async () => {
    assertRefused(await runBootstrap(options));
  });
}

for (const failure of ["insertError", "insertThrows"]) {
  test(`rolls back only the newly created Auth user on ${failure}`, async () => {
    const result = await runBootstrap({ [failure]: true });
    assert.equal(result.exitCode, 1);
    assert.deepEqual(result.writes.map((call) => call.method), [
      "auth.createUser", "staff.insert", "auth.deleteUser",
    ]);
    assert.equal(result.writes[2].id, authUserId);
    assert.deepEqual(result.messages, []);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /newly created Auth user was deleted/);
  });
}

for (const failure of ["cleanupError", "cleanupThrows"]) {
  test(`reports manual cleanup and the created Auth ID on ${failure}`, async () => {
    const result = await runBootstrap({ insertError: true, [failure]: true });
    assert.equal(result.exitCode, 1);
    assert.deepEqual(result.writes.map((call) => call.method), [
      "auth.createUser", "staff.insert", "auth.deleteUser",
    ]);
    assert.equal(result.writes[2].id, authUserId);
    assert.deepEqual(result.messages, []);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /cleanup FAILED/);
    assert.ok(result.errors[0].includes(authUserId));
    assert.match(result.errors[0], /manually before retrying/);
  });
}

test("does not insert staff or delete any user when Auth creation fails", async () => {
  const result = await runBootstrap({ createError: true });
  assert.equal(result.exitCode, 1);
  assert.deepEqual(result.writes.map((call) => call.method), ["auth.createUser"]);
  assert.deepEqual(result.generatedIds, []);
  assert.match(result.errors[0], /Auth user creation failed/);
});

for (const name of Object.keys(environment)) {
  test(`rejects missing ${name} before creating a client or making writes`, async () => {
    const result = await runBootstrap({ env: { [name]: undefined } });
    assert.equal(result.exitCode, 1);
    assert.deepEqual(result.calls, []);
    assert.deepEqual(result.generatedIds, []);
    assert.deepEqual(result.messages, []);
    assert.equal(result.errors.length, 1);
    assert.ok(result.errors[0].includes(`Missing required environment variable: ${name}`));
  });
}

test("rejects a missing department before Auth lookup or any writes", async () => {
  const result = await runBootstrap({ departmentAbsent: true });
  assert.equal(result.exitCode, 1);
  assert.deepEqual(result.calls.map((call) => call.method), ["createClient", "lookup"]);
  assert.deepEqual(result.writes, []);
  assert.deepEqual(result.generatedIds, []);
  assert.match(result.errors[0], /Department does not exist/);
});

const fullAuthPage = Array.from({ length: 1000 }, (_, index) => ({
  id: `unrelated-${index}`,
  email: `unrelated-${index}@example.invalid`,
}));

test("finds a matching admin beyond the first Auth page without writes", async () => {
  const result = await runBootstrap({
    pages: [fullAuthPage, [authUser]],
    staffByEmail: admin,
    staffByAuthId: admin,
  });
  assert.equal(result.exitCode, undefined);
  assert.deepEqual(result.calls.filter((call) => call.method === "auth.listUsers").map((call) => call.page), [1, 2]);
  assert.deepEqual(result.writes, []);
  assert.deepEqual(result.generatedIds, []);
  assert.deepEqual(result.errors, []);
  assert.match(result.messages[0], /no changes made/);
});

test("checks the final empty Auth page before creating a new admin", async () => {
  const result = await runBootstrap({ pages: [fullAuthPage, []] });
  assert.equal(result.exitCode, undefined);
  assert.deepEqual(result.calls.filter((call) => call.method === "auth.listUsers").map((call) => call.page), [1, 2]);
  assert.deepEqual(result.writes.map((call) => call.method), ["auth.createUser", "staff.insert"]);
  assert.match(result.writes[1].payload.staff_id, uuidV4);
});
