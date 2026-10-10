import { describe, expect, it, vi } from "vitest";

vi.mock("utils/config/config", () => ({ CONF_DIR: "/nonexistent-dota2-test" }));
vi.mock("utils/config/service-helpers", () => ({ default: vi.fn() }));
vi.mock("utils/proxy/http", () => ({ httpProxy: vi.fn() }));
vi.mock("utils/logger", () => ({ default: () => ({ debug() {}, error() {} }) }));

import { kindOf, quotaMultiplier, quotaStatus, ttlFor } from "./proxy";

const now = Date.parse("2026-10-10T12:00:00Z");
const inMin = (m) => new Date(now + m * 60000).toISOString();

describe("dota2 proxy cache policy", () => {
  it("classifies endpoints", () => {
    expect(kindOf("matches/live")).toBe("live");
    expect(kindOf("matches/upcoming")).toBe("upcoming");
    expect(kindOf("matches/123")).toBe("detail");
    expect(kindOf("tournaments")).toBe("tournaments");
  });

  it("polls live fast only when a match is live or imminent", () => {
    expect(ttlFor("live", [{ id: 1 }], [], now)).toBe(90 * 1000);
    expect(ttlFor("live", [], [{ beginAt: inMin(10) }], now)).toBe(3 * 60 * 1000);
    expect(ttlFor("live", [], [{ beginAt: inMin(300) }], now)).toBe(20 * 60 * 1000);
    expect(ttlFor("live", [], undefined, now)).toBe(20 * 60 * 1000);
  });

  it("caches finished match detail effectively forever", () => {
    expect(ttlFor("detail", { status: "finished" }, [], now)).toBeGreaterThan(24 * 3600 * 1000);
    expect(ttlFor("detail", { status: "live" }, [], now)).toBe(90 * 1000);
  });

  it("stretches TTLs as the quota drains", () => {
    expect(quotaMultiplier(0.9)).toBe(1);
    expect(quotaMultiplier(0.1)).toBe(3);
    expect(quotaMultiplier(0.01)).toBe(8);
  });

  it("prefers header quota over own counter", () => {
    const month = new Date(now).toISOString().slice(0, 7);
    const store = { usage: { month, count: 100 }, quota: { remaining: 50, limit: 500 } };
    expect(quotaStatus(store, 500, now).remaining).toBe(50);
    expect(quotaStatus({ usage: { month, count: 100 }, quota: null }, 500, now).remaining).toBe(400);
  });
});
