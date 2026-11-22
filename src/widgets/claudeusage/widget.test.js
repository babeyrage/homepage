import { describe, expect, it, vi } from "vitest";

vi.mock("utils/config/service-helpers", () => ({ default: vi.fn() }));
vi.mock("utils/logger", () => ({ default: () => ({ debug() {}, error() {} }) }));

import { expectWidgetConfigShape } from "test-utils/widget-config";

import { DEFAULT_PRICING, costOf, parseResetTime, parseUsageText, priceFor, summarize } from "./collector.mjs";
import widget from "./widget";

describe("claudeusage widget", () => {
  it("has a valid config shape", () => {
    expectWidgetConfigShape(widget);
    expect(widget.mappings.overview.endpoint).toBe("overview");
  });

  it("parses /usage limit lines", () => {
    const text = [
      "Current session: 2% used · resets Nov 22, 10:30am (UTC)",
      "Current week (all models): 9% used · resets Nov 26, 9am (UTC)",
      "Last 24h · 36 requests",
    ].join("\n");
    const now = Date.parse("2026-11-22T08:00:00Z");
    expect(parseUsageText(text, now)).toEqual([
      {
        label: "session",
        pct: 2,
        resets: "Nov 22, 10:30am (UTC)",
        resetsAt: Date.parse("2026-11-22T10:30:00Z"),
        windowMs: 5 * 3600000,
      },
      {
        label: "week (all models)",
        pct: 9,
        resets: "Nov 26, 9am (UTC)",
        resetsAt: Date.parse("2026-11-26T09:00:00Z"),
        windowMs: 7 * 86400000,
      },
    ]);
  });

  it("parses reset times with and without a date", () => {
    const now = Date.parse("2026-11-22T12:00:00Z");
    expect(parseResetTime("Dec 1, 12am (UTC)", now)).toBe(Date.parse("2026-12-01T00:00:00Z"));
    expect(parseResetTime("1:15pm (UTC)", now)).toBe(Date.parse("2026-11-22T13:15:00Z"));
    expect(parseResetTime("9am (UTC)", now)).toBe(Date.parse("2026-11-23T09:00:00Z"));
    expect(parseResetTime("Jan 3, 9am (UTC)", Date.parse("2026-12-30T00:00:00Z"))).toBe(
      Date.parse("2027-01-03T09:00:00Z"),
    );
    expect(parseResetTime("nonsense", now)).toBeNull();
  });

  it("prices by model family", () => {
    const price = priceFor("claude-sonnet-5-5", DEFAULT_PRICING);
    expect(costOf({ input: 1e6, output: 1e6 }, price)).toBeCloseTo(18);
    expect(priceFor("mystery", DEFAULT_PRICING)).toBeNull();
  });

  it("dedupes by message+request id and windows totals", () => {
    const now = Date.parse("2026-11-22T12:00:00Z");
    const row = {
      key: "m1:r1",
      ts: now - 1000,
      model: "claude-haiku-5-5",
      project: "-a-b",
      input: 1000,
      output: 1000,
      cacheRead: 0,
      cacheWrite: 0,
    };
    const old = { ...row, key: "m2:r2", ts: now - 10 * 86400000 };
    const s = summarize([row, { ...row }, old], DEFAULT_PRICING, now, 0);
    expect(s.totals.today.requests).toBe(1);
    expect(s.totals.d7.requests).toBe(1);
    expect(s.totals.d30.requests).toBe(2);
    expect(s.models[0].model).toBe("claude-haiku-5-5");
  });

  it("fills 14 days, yesterday, hourly, shares and month projection", () => {
    const now = Date.parse("2026-11-22T12:00:00Z");
    const mk = (key, ts, model, project, cost) => ({
      key,
      ts,
      model,
      project,
      input: cost * 1e6,
      output: 0,
      cacheRead: 1e6,
      cacheWrite: 0,
    });
    const rows = [
      mk("a:1", now - 3600000, "claude-haiku-5-5", "-x-alpha", 5),
      mk("b:1", now - 86400000, "claude-haiku-5-5", "-x-beta", 1),
      mk("c:1", now - 2 * 3600000, "claude-haiku-5-5", "-x-gamma", 1),
      mk("d:1", now - 3 * 3600000, "claude-haiku-5-5", "-x-delta", 1),
      mk("e:1", now - 4 * 3600000, "claude-haiku-5-5", "-x-eps", 1),
    ];
    const s = summarize(rows, DEFAULT_PRICING, now, 0);
    expect(s.daily).toHaveLength(14);
    expect(s.daily.at(-1).day).toBe("2026-11-22");
    expect(s.daily.at(-2).requests).toBe(1);
    expect(s.totals.yesterday.requests).toBe(1);
    expect(s.totals.today.requests).toBe(4);
    expect(s.totals.today.saved).toBeGreaterThan(0);
    expect(s.projects).toHaveLength(4);
    expect(s.projects.at(-1).other).toBe(true);
    expect(s.projects.reduce((n, p) => n + p.share, 0)).toBeCloseTo(1);
    expect(s.peakHour).toBe(11);
    expect(s.month.daysInMonth).toBe(30);
    expect(s.month.projected).toBeGreaterThan(s.month.cost);
  });

  it("uses the local timezone for day boundaries", () => {
    const now = Date.parse("2026-11-22T20:00:00Z"); // 04:00 on the 23rd in Perth (+8)
    const row = {
      key: "a:1",
      ts: Date.parse("2026-11-22T17:00:00Z"),
      model: "claude-haiku-5-5",
      project: "-p",
      input: 1,
      output: 1,
      cacheRead: 0,
      cacheWrite: 0,
    };
    const perth = summarize([row], DEFAULT_PRICING, now, 480);
    expect(perth.totals.today.requests).toBe(1); // 01:00 on the 23rd local
    expect(perth.daily.at(-1).day).toBe("2026-11-23");
    expect(summarize([row], DEFAULT_PRICING, now, 0).daily.at(-1).day).toBe("2026-11-22");
  });
});
