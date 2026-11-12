import { describe, expect, it } from "vitest";
import type { AssistanceRequest } from "../../../frontend/src/services/api";
import {
  emptyAssistanceNotifications,
  markAssistanceReviewed,
  reconcileAssistanceNotifications,
} from "./assistanceNotifications";

function request(
  id: string,
  seconds = 0,
  status: AssistanceRequest["status"] = "PENDING",
): AssistanceRequest {
  return {
    id,
    created_at: new Date(Date.UTC(2026, 10, 12, 12, 0, seconds)).toISOString(),
    version: 1,
    status,
    status_updated_at: null,
    latitude: 14.3,
    longitude: 121.1,
    accuracy_meters: 20,
    location_recorded_at: "2026-11-12T12:00:00Z",
    display_name: null,
    contact_number: null,
    travel_mode: "walking",
    route_kind: "emergency",
    destination_latitude: null,
    destination_longitude: null,
  };
}

describe("CDRRMO new-request notifications", () => {
  it("baselines existing requests without alerting for backlog", () => {
    const result = reconcileAssistanceNotifications(
      emptyAssistanceNotifications(),
      [request("old")],
    );
    expect(result.arrivals).toEqual([]);
    expect(result.state.unread).toEqual([]);
  });
  it("detects arrivals after an initially empty page", () => {
    const initial = reconcileAssistanceNotifications(
      emptyAssistanceNotifications(),
      [],
    ).state;
    const result = reconcileAssistanceNotifications(initial, [request("new")]);
    expect(result.arrivals.map((row) => row.id)).toEqual(["new"]);
    expect(result.state.unread.map((row) => row.id)).toEqual(["new"]);
  });
  it("keeps all arrivals from a batch and catches requests after reconnecting", () => {
    const initial = reconcileAssistanceNotifications(
      emptyAssistanceNotifications(),
      [request("old")],
    ).state;
    const rows = [request("second", 30), request("first", 20), request("old")];
    const result = reconcileAssistanceNotifications(initial, rows);
    expect(result.arrivals.map((row) => row.id)).toEqual(["second", "first"]);
    expect(
      reconcileAssistanceNotifications(result.state, rows).arrivals,
    ).toEqual([]);
  });
  it("does not alert for status edits or backfilled older rows", () => {
    const initial = reconcileAssistanceNotifications(
      emptyAssistanceNotifications(),
      [request("existing", 30)],
    ).state;
    const result = reconcileAssistanceNotifications(initial, [
      request("existing", 30, "DISPATCHED"),
      request("older", 10),
    ]);
    expect(result.arrivals).toEqual([]);
    expect(result.state.unread).toEqual([]);
  });
  it("handles requests with the same creation timestamp once", () => {
    const initial = reconcileAssistanceNotifications(
      emptyAssistanceNotifications(),
      [request("one")],
    ).state;
    const next = reconcileAssistanceNotifications(initial, [
      request("two"),
      request("one"),
    ]);
    expect(next.arrivals.map((row) => row.id)).toEqual(["two"]);
    const afterRemoval = reconcileAssistanceNotifications(next.state, [
      request("two"),
    ]).state;
    expect(
      reconcileAssistanceNotifications(afterRemoval, [
        request("two"),
        request("one"),
      ]).arrivals,
    ).toEqual([]);
  });
  it("reviewing a card does not change its status or make it alert again", () => {
    const initial = reconcileAssistanceNotifications(
      emptyAssistanceNotifications(),
      [],
    ).state;
    const rows = [request("one"), request("two")];
    const next = reconcileAssistanceNotifications(initial, rows).state;
    const reviewed = markAssistanceReviewed(next, "one");
    expect(reviewed.unread.map((row) => row.id)).toEqual(["two"]);
    expect(rows[0].status).toBe("PENDING");
    expect(
      reconcileAssistanceNotifications(reviewed, rows).state.unread.map(
        (row) => row.id,
      ),
    ).toEqual(["two"]);
  });
  it("removes closed requests and keeps the latest status for other unread cards", () => {
    const initial = reconcileAssistanceNotifications(
      emptyAssistanceNotifications(),
      [],
    ).state;
    const next = reconcileAssistanceNotifications(initial, [
      request("one"),
      request("two"),
      request("three"),
    ]).state;
    const result = reconcileAssistanceNotifications(next, [
      request("one", 0, "CANCELLED"),
      request("two", 0, "COMPLETED"),
      request("three", 0, "ACKNOWLEDGED"),
    ]);
    expect(result.state.unread.map((row) => [row.id, row.status])).toEqual([
      ["three", "ACKNOWLEDGED"],
    ]);
    expect(result.arrivals).toEqual([]);
  });
  it("ignores invalid creation dates and closed records", () => {
    const initial = reconcileAssistanceNotifications(
      emptyAssistanceNotifications(),
      [],
    ).state;
    expect(
      reconcileAssistanceNotifications(initial, [
        { ...request("bad"), created_at: "invalid" },
        request("closed", 0, "CANCELLED"),
      ]).arrivals,
    ).toEqual([]);
  });
  it("bounds unread records to the latest active page", () => {
    const initial = reconcileAssistanceNotifications(
      emptyAssistanceNotifications(),
      [],
    ).state;
    const next = reconcileAssistanceNotifications(initial, [
      request("one"),
      request("two"),
    ]).state;
    expect(
      reconcileAssistanceNotifications(next, [request("two")]).state.unread.map(
        (row) => row.id,
      ),
    ).toEqual(["two"]);
  });
});
