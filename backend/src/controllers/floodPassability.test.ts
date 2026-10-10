import { describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import type { RoleAwareRequest } from "../middleware/role.middleware";
import { createFloodReport, updateFloodReport } from "./admin.controller";

async function call(body: unknown, create: boolean) {
  const query = {
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: { id: "report" }, error: null }),
  };
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  const write = vi.fn(() => query);
  const from = vi.fn(() => ({ insert: write, update: write }));
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  await (create ? createFloodReport : updateFloodReport)(
    {
      body,
      params: { id: "report" },
      userSupabase: { from },
    } as unknown as RoleAwareRequest,
    res as unknown as Response,
  );
  return { write, from, res };
}

describe("flood passability writes", () => {
  for (const create of [true, false]) {
    it.each(["NONE", "LOW", "MODERATE", "HIGH", "SEVERE"])(
      `${create ? "create" : "update"} derives passability for %s`,
      async (severity) => {
        const blocked = severity === "HIGH" || severity === "SEVERE";
        const { write } = await call(
          { roadId: "road", severity, roadImpassable: !blocked },
          create,
        );
        expect(write).toHaveBeenCalledWith(
          expect.objectContaining({ severity, road_impassable: blocked }),
        );
      },
    );
    it(`rejects invalid severity on ${create ? "create" : "update"}`, async () => {
      const { from, res } = await call(
        { roadId: "road", severity: "INVALID" },
        create,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(from).not.toHaveBeenCalled();
    });
  }
  it("does not allow the legacy flag to override severity", async () => {
    const { write, res } = await call({ roadImpassable: true }, false);
    expect(write).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
  it("leaves passability unchanged when updating unrelated fields", async () => {
    const { write } = await call(
      { notes: "Updated note", roadImpassable: true },
      false,
    );
    expect(write).toHaveBeenCalledWith({ notes: "Updated note" });
  });
});
