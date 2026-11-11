import express from "express";
import type { AddressInfo } from "node:net";
import { expect, it } from "vitest";
import { adminRouter } from "./admin.routes";

it("does not accept legacy barangay access-code exchanges", async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin/barangay-login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barangayId: "00000000-0000-4000-8000-000000000001",
          code: "123456",
        }),
      },
    );
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("access_token");
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
