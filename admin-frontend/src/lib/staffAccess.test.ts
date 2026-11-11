import { describe, expect, it } from "vitest";
import { staffAccessError } from "./staffAccess";

describe("direct staff account access", () => {
  it("allows CDRRMO without a barangay and assigned barangay accounts", () => {
    expect(
      staffAccessError({ role: "SUPER_ADMIN", barangay_id: null }),
    ).toBeNull();
    expect(
      staffAccessError({ role: "BARANGAY_ADMIN", barangay_id: "barangay-a" }),
    ).toBeNull();
  });
  it("rejects the old unassigned shared entry account", () => {
    expect(
      staffAccessError({ role: "BARANGAY_ADMIN", barangay_id: null }),
    ).toMatch(/assignment/);
  });
  it.each([null, {}, { role: "PUBLIC" }])(
    "rejects missing or unauthorized profiles",
    (profile) => {
      expect(staffAccessError(profile)).toMatch(/does not have admin access/);
    },
  );
});
