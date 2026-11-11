import { describe, expect, it } from "vitest";
import { SANTA_ROSA_BARANGAYS } from "../../src/geography/barangays";
import { planBarangayAccounts, validateAccountList } from "./barangayAccounts";

const entries = SANTA_ROSA_BARANGAYS.map((barangay, i) => ({
  barangay,
  email: `barangay${i}@example.test`,
}));
const barangays = SANTA_ROSA_BARANGAYS.map((name, i) => ({
  name,
  id: `barangay-${i}`,
}));
const profiles = barangays.map((row, i) => ({
  id: `user-${i}`,
  role: "BARANGAY_ADMIN",
  barangay_id: row.id,
}));
const mappings = profiles.map((row) => ({
  barangay_id: row.barangay_id,
  user_id: row.id,
}));
const users = profiles.map((row, i) => ({
  id: row.id,
  email: `legacy-${i}@access.invalid`,
}));

describe("barangay account provisioning plan", () => {
  it("reuses the 18 scoped Auth identities instead of duplicating users", () => {
    const plan = planBarangayAccounts(
      entries,
      barangays,
      profiles,
      users,
      mappings,
    );
    expect(plan).toHaveLength(18);
    expect(
      plan.every(
        (row, i) => row.action === "migrate" && row.userId === profiles[i].id,
      ),
    ).toBe(true);
  });
  it("does not reset passwords for an already completed migration", () => {
    const ready = users.map((row, i) => ({
      ...row,
      email: entries[i].email,
      app_metadata: { barangay_password_login: true },
    }));
    expect(
      planBarangayAccounts(entries, barangays, profiles, ready, mappings).every(
        (row) => row.action === "keep",
      ),
    ).toBe(true);
  });
  it("creates missing accounts and recovers a partially created Auth identity", () => {
    expect(planBarangayAccounts(entries, barangays, [], [], [])[0].action).toBe(
      "create",
    );
    const orphan = {
      id: "pending",
      email: entries[0].email,
      app_metadata: {
        barangay_password_login: true,
        barangay_id: barangays[0].id,
      },
    };
    expect(
      planBarangayAccounts(entries, barangays, [], [orphan], [])[0],
    ).toMatchObject({ userId: "pending", action: "migrate" });
  });
  it("refuses to claim another account's email", () => {
    expect(() =>
      planBarangayAccounts(
        entries,
        barangays,
        profiles,
        [...users, { id: "cdrrmo", email: entries[0].email }],
        mappings,
      ),
    ).toThrow(/another account/);
  });
  it("refuses mismatched, duplicate and superadmin profile assignments", () => {
    expect(() =>
      planBarangayAccounts(
        entries,
        barangays,
        profiles.slice(1),
        users,
        mappings,
      ),
    ).toThrow(/mismatch/);
    expect(() =>
      planBarangayAccounts(
        entries,
        barangays,
        [...profiles, { ...profiles[0], id: "other" }],
        users,
        mappings,
      ),
    ).toThrow(/Multiple/);
    const orphan = {
      id: "cdrrmo",
      email: entries[0].email,
      app_metadata: {
        barangay_password_login: true,
        barangay_id: barangays[0].id,
      },
    };
    expect(() =>
      planBarangayAccounts(
        entries,
        barangays,
        [{ id: "cdrrmo", role: "SUPER_ADMIN", barangay_id: null }],
        [orphan],
        [],
      ),
    ).toThrow(/Refusing/);
  });
  it("validates the entire email list before any Auth mutation", () => {
    expect(() => validateAccountList(entries.slice(1))).toThrow(/18/);
    expect(() =>
      validateAccountList(entries.map((row) => ({ ...row, email: "" }))),
    ).toThrow(/usable email/);
    expect(() =>
      validateAccountList(
        entries.map((row) => ({ ...row, email: "same@example.test" })),
      ),
    ).toThrow(/different email/);
    expect(() =>
      validateAccountList(
        entries.map((row, i) => (i === 0 ? entries[1] : row)),
      ),
    ).toThrow(/exactly once/);
  });
});
