/** Operator-only. No credentials are embedded in this file or sent to the browser.
 * npm run accounts:barangays --workspace backend -- --template
 * Fill .runtime/barangay-accounts.json, then run with no flags (read-only preview).
 * Add --apply to provision, then test logins before using --retire-shared.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SANTA_ROSA_BARANGAYS } from "../src/geography/barangays";
import {
  planBarangayAccounts,
  validateAccountList,
  type AccountUser,
} from "./lib/barangayAccounts";

const root = resolve(__dirname, "../..");
const args = process.argv.slice(2);
const directory = resolve(root, ".runtime");
const fileFlag = args.indexOf("--file");
const input =
  fileFlag >= 0 && args[fileFlag + 1]
    ? resolve(args[fileFlag + 1])
    : resolve(directory, "barangay-accounts.json");

async function main() {
  mkdirSync(directory, { recursive: true });
  if (args.includes("--template")) {
    writeFileSync(
      input,
      JSON.stringify(
        SANTA_ROSA_BARANGAYS.map((barangay) => ({ barangay, email: "" })),
        null,
        2,
      ) + "\n",
      { flag: "wx", mode: 0o600 },
    );
    console.log(
      `Private email template created: ${input}. Fill the email fields; do not commit this file.`,
    );
    return;
  }
  if (!existsSync(input))
    throw Error("Create the private email list with --template first.");
  const entries = validateAccountList(JSON.parse(readFileSync(input, "utf8")));
  config({ path: resolve(root, "backend/.env"), quiet: true });
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw Error(
      "Set backend SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the operator environment.",
    );
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [barangays, profiles, mappings] = await Promise.all([
    client
      .from("barangays")
      .select("id,name")
      .in("name", [...SANTA_ROSA_BARANGAYS]),
    client.from("profiles").select("id,role,barangay_id"),
    client.from("barangay_access_accounts").select("barangay_id,user_id"),
  ]);
  if (barangays.error || profiles.error || mappings.error)
    throw Error(
      "Could not read account assignments. Check the project and migration 0017; no accounts changed.",
    );
  const users: AccountUser[] = [];
  for (let page = 1; ; page++) {
    const result = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (result.error)
      throw Error("Could not inspect Auth identities; no accounts changed.");
    users.push(...result.data.users);
    if (result.data.users.length < 1000) break;
  }
  const plan = planBarangayAccounts(
    entries,
    barangays.data,
    profiles.data,
    users,
    mappings.data,
  );
  // Do not print email addresses, passwords, tokens or server keys.
  console.table(
    plan.map((item) => ({ barangay: item.barangay, action: item.action })),
  );
  if (args.includes("--retire-shared")) {
    if (plan.some((item) => item.action !== "keep"))
      throw Error(
        "Provision and test all 18 accounts before retiring the shared entry account.",
      );
    const shared = users.find(
      (user) => user.email?.toLowerCase() === "brgyadmin@gmail.com",
    );
    if (!shared) {
      console.log("The shared entry account is already absent.");
      return;
    }
    const profile = profiles.data.find((row) => row.id === shared.id);
    if (
      profile &&
      (profile.role !== "BARANGAY_ADMIN" || profile.barangay_id !== null)
    )
      throw Error(
        "The shared email is assigned to an operational account; retirement refused.",
      );
    const banned = await client.auth.admin.updateUserById(shared.id, {
      ban_duration: "876000h",
    });
    if (banned.error)
      throw Error("Could not disable the shared entry account.");
    const removed = await client
      .from("profiles")
      .delete()
      .eq("id", shared.id)
      .eq("role", "BARANGAY_ADMIN")
      .is("barangay_id", null);
    if (removed.error)
      throw Error(
        "Shared sign-in disabled, but its profile could not be retired. Retry this command.",
      );
    console.log(
      "Shared entry login disabled and its unassigned profile removed. Auth identity retained for audit references.",
    );
    return;
  }
  if (!args.includes("--apply")) {
    console.log(
      "Preview only: no accounts changed. Add --apply after checking the email list.",
    );
    return;
  }
  const changes = plan.filter((item) => item.action !== "keep");
  if (!changes.length) {
    console.log(
      "All 18 accounts are already provisioned; passwords were not reset.",
    );
    return;
  }
  // Save passwords BEFORE changing Auth so a failed/partial run cannot lose them.
  const output = resolve(
    directory,
    `barangay-account-credentials-${Date.now()}.json`,
  );
  const credentials = changes.map((item) => ({
    ...item,
    password: `Brgy!${randomBytes(18).toString("base64url")}`,
    state: "pending",
  }));
  const save = () =>
    writeFileSync(output, JSON.stringify(credentials, null, 2) + "\n", {
      mode: 0o600,
    });
  writeFileSync(output, "[]\n", { flag: "wx", mode: 0o600 });
  save();
  console.log(
    `Private credentials/checkpoint file: ${output}. Never commit or publish it.`,
  );
  for (const entry of credentials) {
    const previous = users.find((user) => user.id === entry.userId);
    const result = entry.userId
      ? await client.auth.admin.updateUserById(entry.userId, {
          email: entry.email,
          password: entry.password,
          email_confirm: true,
          app_metadata: {
            ...previous?.app_metadata,
            barangay_password_login: true,
            barangay_id: entry.barangayId,
          },
        })
      : await client.auth.admin.createUser({
          email: entry.email,
          password: entry.password,
          email_confirm: true,
          app_metadata: {
            barangay_password_login: true,
            barangay_id: entry.barangayId,
          },
        });
    if (result.error || !result.data.user)
      throw Error(
        `Could not provision ${entry.barangay}. Stop and review the private checkpoint; completed accounts remain saved.`,
      );
    entry.userId = result.data.user.id;
    entry.state = "auth-saved";
    save();
    const profileResult = await client.from("profiles").upsert({
      id: entry.userId,
      role: "BARANGAY_ADMIN",
      barangay_id: entry.barangayId,
      full_name: `${entry.barangay} authorized staff`,
    });
    if (profileResult.error)
      throw Error(
        `Auth saved for ${entry.barangay}, but profile assignment failed. Review the private checkpoint before retrying.`,
      );
    entry.state = "ready";
    save();
  }
  console.log(
    "Accounts provisioned. Test each login and cross-barangay restrictions, distribute credentials individually, then run --retire-shared. No invitation emails were requested.",
  );
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Account setup failed.",
  );
  process.exitCode = 1;
});
