/** Run from the repository root with: npx tsx backend/scripts/provision-barangay-access.ts
 * Requires backend/.env or environment variables; never run in the browser.
 * Initial provisioning only. Existing barangay access accounts are not changed.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SANTA_ROSA_BARANGAYS } from "../src/geography/barangays";
config({ path: resolve("backend/.env"), quiet: true });
async function main() {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw Error(
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the operator environment.",
    );
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: barangays, error } = await client
    .from("barangays")
    .select("id,name")
    .in("name", [...SANTA_ROSA_BARANGAYS])
    .order("name");
  if (error || barangays?.length !== 18)
    throw Error("Run migration 0017 first; all 18 barangays are required.");
  const { data: existing, error: mapError } = await client
    .from("barangay_access_accounts")
    .select("barangay_id");
  if (mapError) throw Error("Run migration 0017 before provisioning accounts.");
  const done = new Set(existing.map((item) => item.barangay_id));
  const directory = resolve(".runtime");
  mkdirSync(directory, { recursive: true });
  const output = resolve(directory, `barangay-access-${Date.now()}.json`);
  const results: { barangay: string; code: string; userId: string }[] = [];
  const usedCodes = new Set<string>();
  writeFileSync(output, "[]\n", { flag: "wx", mode: 0o600 });
  for (const barangay of barangays) {
    if (done.has(barangay.id)) continue;
    let code: string;
    do {
      code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    } while (usedCodes.has(code));
    usedCodes.add(code);
    const { data: created, error: authError } =
      await client.auth.admin.createUser({
        email: `barangay-${barangay.id}@access.evacurosa.invalid`,
        password: code,
        email_confirm: true,
      });
    if (authError || !created.user)
      throw Error(
        `Could not provision ${barangay.name}. Check existing Auth identities; no existing account was overwritten.`,
      );
    const id = created.user.id;
    try {
      const { error: profileError } = await client.from("profiles").insert({
        id,
        role: "BARANGAY_ADMIN",
        barangay_id: barangay.id,
        full_name: `${barangay.name} authorized staff`,
      });
      if (profileError) throw profileError;
      const { error: accessError } = await client
        .from("barangay_access_accounts")
        .insert({ barangay_id: barangay.id, user_id: id });
      if (accessError) throw accessError;
    } catch {
      await client.auth.admin.deleteUser(id);
      throw Error(
        `Could not provision ${barangay.name}. Check database setup. Previously completed credentials are saved in ${output}.`,
      );
    }
    results.push({ barangay: barangay.name, code, userId: id });
    writeFileSync(output, JSON.stringify(results, null, 2) + "\n", {
      mode: 0o600,
    });
  }
  console.log(
    `Provisioned ${results.length} accounts. Private credentials saved to ${output}. Distribute individually and delete this file after secure handoff. Do not commit or publish it.`,
  );
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Provisioning failed.",
  );
  process.exitCode = 1;
});
