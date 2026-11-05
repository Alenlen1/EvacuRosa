import { describe, expect, it, vi } from "vitest";
const database = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("../database/supabase", () => ({
  getSupabase: () => ({ from: () => ({ select: database.select }) }),
}));
import { deriveStatus, getAllCenters } from "./evacuation.service";

it("loads center records without the retired supply columns", async () => {
  database.select.mockResolvedValueOnce({
    data: [
      {
        id: "center",
        barangay_id: "barangay",
        barangays: { name: "Tagapo" },
        name: "Test center",
        address: "Santa Rosa",
        latitude: 14.31,
        longitude: 121.1,
        capacity: 100,
        current_occupancy: 75,
        status: "AVAILABLE",
        updated_at: "2026-11-05T00:00:00Z",
      },
    ],
    error: null,
  });
  const centers = await getAllCenters();
  expect(database.select.mock.calls.at(-1)![0]).not.toMatch(
    /water_status|food_status|medical_status|supplies_updated_at/,
  );
  expect(centers).toHaveLength(1);
  expect(centers[0]).toMatchObject({
    id: "center",
    barangayName: "Tagapo",
    status: "NEARLY_FULL",
    currentOccupancy: 75,
  });
  for (const key of [
    "waterStatus",
    "foodStatus",
    "medicalStatus",
    "suppliesUpdatedAt",
  ])
    expect(centers[0]).not.toHaveProperty(key);
});

describe("deriveStatus", () => {
  it("is AVAILABLE under 70% occupancy", () => {
    expect(deriveStatus(50, 100)).toBe("AVAILABLE");
  });

  it("is NEARLY_FULL between 70% and 90%", () => {
    expect(deriveStatus(80, 100)).toBe("NEARLY_FULL");
  });

  it("is FULL at 90% or above", () => {
    expect(deriveStatus(95, 100)).toBe("FULL");
  });

  it("is CLOSED when manually marked CLOSED", () => {
    expect(deriveStatus(0, 100, "CLOSED")).toBe("CLOSED");
  });
});
