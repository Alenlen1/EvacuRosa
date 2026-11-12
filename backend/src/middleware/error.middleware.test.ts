import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { errorHandler } from "./error.middleware";

describe("safe backend error responses", () => {
  let server: Server;
  let url: string;
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const internal = new Error(
    "Database column internal_secret_column does not exist",
  );

  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: "1kb" }));
    app.get("/failure", async () => {
      throw internal;
    });
    app.get("/untrusted-error", () => {
      throw {
        status: 400,
        expose: true,
        message: "private-database-detail",
        body: "private-body",
      };
    });
    app.get("/validation", (_req, res) =>
      res.status(400).json({ error: "Select a barangay." }),
    );
    app.post("/body", (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  beforeEach(() => log.mockClear());
  afterAll(async () => {
    log.mockRestore();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it("hides async failures and links the visible reference to technical server logs", async () => {
    const response = await fetch(url + "/failure", {
      headers: { Authorization: "Bearer private-test-token" },
    });
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.referenceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.error).toContain(body.referenceId);
    expect(body.error).toContain("Please try again");
    expect(JSON.stringify(body)).not.toMatch(
      /internal_secret_column|Error:|stack|private-test-token/,
    );
    expect(log).toHaveBeenCalledWith(
      "Backend request failed",
      expect.objectContaining({
        referenceId: body.referenceId,
        status: 500,
        error: {
          name: "Error",
          message: internal.message,
          stack: internal.stack,
        },
      }),
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain("private-test-token");
    const second = await (await fetch(url + "/failure")).json();
    expect(second.referenceId).not.toBe(body.referenceId);
  });

  it("does not expose arbitrary thrown objects even if marked exposable", async () => {
    const response = await fetch(url + "/untrusted-error");
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("private-");
    expect(JSON.stringify(log.mock.calls)).not.toContain("private-");
  });

  it.each([
    [400, '{"password":"private-body" invalid', {}],
    [413, JSON.stringify({ value: "x".repeat(1100) }), {}],
    [
      415,
      "{}",
      { "Content-Type": "application/json; charset=bogus-private-charset" },
    ],
    [415, "{}", { "Content-Encoding": "bogus-private-encoding" }],
  ])(
    "returns safe parser errors with status %s without logging request contents",
    async (status, body, headers) => {
      const response = await fetch(url + "/body", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body,
      });
      const result = await response.json();
      expect(response.status).toBe(status);
      expect(result.error).toContain(result.referenceId);
      expect(JSON.stringify(result)).not.toContain("private-");
      expect(JSON.stringify(log.mock.calls)).not.toContain("private-");
      expect(log).toHaveBeenCalledWith(
        "Backend request failed",
        expect.objectContaining({
          referenceId: result.referenceId,
          status,
          error: { type: expect.any(String) },
        }),
      );
    },
  );

  it("preserves explicit validation responses", async () => {
    const response = await fetch(url + "/validation");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Select a barangay." });
    expect(log).not.toHaveBeenCalled();
  });

  it("delegates failures after headers are sent without writing another response", () => {
    const next = vi.fn();
    const response = { headersSent: true, status: vi.fn(), setHeader: vi.fn() };
    errorHandler(
      internal,
      {} as Request,
      response as unknown as Response,
      next as NextFunction,
    );
    expect(next).toHaveBeenCalledWith(internal);
    expect(response.status).not.toHaveBeenCalled();
    expect(response.setHeader).not.toHaveBeenCalled();
  });
});
