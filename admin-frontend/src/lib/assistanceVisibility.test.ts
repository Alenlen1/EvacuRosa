import { describe, expect, it } from "vitest";
import { isVisibleAssistanceRequest } from "./assistanceVisibility";

describe("CDRRMO shared location visibility", () => {
  it("excludes cancellations while retaining active and completed requests", () => {
    const requests = [
      "PENDING",
      "ACKNOWLEDGED",
      "DISPATCHED",
      "COMPLETED",
      "CANCELLED",
    ].map((status) => ({ status }));
    expect(
      requests.filter(isVisibleAssistanceRequest).map(({ status }) => status),
    ).toEqual(["PENDING", "ACKNOWLEDGED", "DISPATCHED", "COMPLETED"]);
    expect(requests).toHaveLength(5);
  });

  it("removes a previously visible request when its status becomes cancelled", () => {
    const request = { id: "request-1", status: "PENDING" };
    expect([request].filter(isVisibleAssistanceRequest)).toHaveLength(1);
    expect(
      [{ ...request, status: "CANCELLED" }].filter(isVisibleAssistanceRequest),
    ).toEqual([]);
  });
});
