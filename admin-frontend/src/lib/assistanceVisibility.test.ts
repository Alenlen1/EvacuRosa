import { describe, expect, it } from "vitest";
import {
  isArchivedAssistanceRequest,
  isVisibleAssistanceRequest,
} from "./assistanceVisibility";

describe("CDRRMO shared location visibility", () => {
  it("separates active requests from completed and cancelled archives", () => {
    const requests = [
      "PENDING",
      "ACKNOWLEDGED",
      "DISPATCHED",
      "COMPLETED",
      "CANCELLED",
    ].map((status) => ({ status }));
    expect(
      requests.filter(isVisibleAssistanceRequest).map(({ status }) => status),
    ).toEqual(["PENDING", "ACKNOWLEDGED", "DISPATCHED"]);
    expect(
      requests.filter(isArchivedAssistanceRequest).map(({ status }) => status),
    ).toEqual(["COMPLETED", "CANCELLED"]);
    expect(requests).toHaveLength(5);
  });
  it.each(["CANCELLED", "COMPLETED"])(
    "automatically archives a request once it becomes %s",
    (status) => {
      const request = { id: "request-1", status };
      expect(isVisibleAssistanceRequest(request)).toBe(false);
      expect(isArchivedAssistanceRequest(request)).toBe(true);
    },
  );

  it("removes a previously visible request when its status becomes cancelled", () => {
    const request = { id: "request-1", status: "PENDING" };
    expect([request].filter(isVisibleAssistanceRequest)).toHaveLength(1);
    expect(
      [{ ...request, status: "CANCELLED" }].filter(isVisibleAssistanceRequest),
    ).toEqual([]);
  });
});
