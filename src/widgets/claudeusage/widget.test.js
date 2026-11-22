import { describe, expect, it, vi } from "vitest";

vi.mock("utils/config/service-helpers", () => ({ default: vi.fn() }));
vi.mock("utils/logger", () => ({ default: () => ({ debug() {}, error() {} }) }));

import { expectWidgetConfigShape } from "test-utils/widget-config";

import { DEFAULT_PRICING, costOf, parseUsageText, priceFor, summarize } from "./collector.mjs";
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
    expect(parseUsageText(text)).toEqual([
      { label: "session", pct: 2, resets: "Nov 22, 10:30am (UTC)" },
      { label: "week (all models)", pct: 9, resets: "Nov 26, 9am (UTC)" },
    ]);
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
});
