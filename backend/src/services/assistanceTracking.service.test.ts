import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import type { Request, Response } from "express";
const mocks = vi.hoisted(() => ({ channel: vi.fn(), removeChannel: vi.fn() }));
vi.mock("../database/supabase", () => ({
  getSupabase: () => ({
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  }),
}));
import {
  subscribeAssistance,
  notifyAssistance,
  assistanceStream,
} from "./assistanceTracking.service";
beforeEach(() => {
  vi.clearAllMocks();
  const channel = { on: vi.fn(), subscribe: vi.fn() };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockImplementation((cb) => {
    cb("SUBSCRIBED");
    return channel;
  });
  mocks.channel.mockReturnValue(channel);
  mocks.removeChannel.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());
describe("private assistance notification fan-out", () => {
  it("notifies only the matching request plus the authorized staff stream", () => {
    const a = vi.fn(),
      b = vi.fn(),
      staff = vi.fn();
    const offA = subscribeAssistance("A", a),
      offB = subscribeAssistance("B", b),
      offStaff = subscribeAssistance("*", staff);
    a.mockClear();
    b.mockClear();
    staff.mockClear();
    notifyAssistance("A", 2);
    expect(a).toHaveBeenCalledWith({ type: "changed", id: "A", version: 2 });
    expect(b).not.toHaveBeenCalled();
    expect(staff).toHaveBeenCalledTimes(1);
    expect(mocks.channel).toHaveBeenCalledTimes(1);
    offA();
    offB();
    offStaff();
    expect(mocks.removeChannel).toHaveBeenCalledTimes(1);
    a.mockClear();
    notifyAssistance("A", 3);
    expect(a).not.toHaveBeenCalled();
  });
  it("bounds per-request sockets and cleans subscriptions and timers on close", () => {
    vi.useFakeTimers();
    const responses: any[] = [];
    for (let i = 0; i < 4; i++) {
      const res: any = new EventEmitter();
      res.setHeader = vi.fn();
      res.flushHeaders = vi.fn();
      res.write = vi.fn(() => true);
      res.json = vi.fn();
      res.status = vi.fn(() => res);
      res.end = vi.fn();
      responses.push(res);
      assistanceStream({} as Request, res as Response, "bounded-test");
    }
    expect(responses[3].status).toHaveBeenCalledWith(429);
    for (const res of responses.slice(0, 3)) res.emit("close");
    expect(mocks.removeChannel).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("ends long-lived streams so each reconnect reauthorizes", () => {
    vi.useFakeTimers();
    const res: any = new EventEmitter();
    res.setHeader = vi.fn();
    res.flushHeaders = vi.fn();
    res.write = vi.fn(() => true);
    res.end = vi.fn();
    assistanceStream({} as Request, res as Response, "renewal-test");
    vi.advanceTimersByTime(5 * 60_000);
    expect(res.end).toHaveBeenCalledTimes(1);
    expect(mocks.removeChannel).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
