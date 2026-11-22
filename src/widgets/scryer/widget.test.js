import { describe, expect, it, vi } from "vitest";

vi.mock("utils/config/service-helpers", () => ({ default: vi.fn() }));
vi.mock("utils/proxy/http", () => ({ httpProxy: vi.fn() }));
vi.mock("utils/logger", () => ({ default: () => ({ debug() {}, error() {} }) }));

import { expectWidgetConfigShape } from "test-utils/widget-config";

import widget from "./widget";
import { mapOverview } from "./proxy";

const now = Date.parse("2026-10-30T12:00:00Z");

const raw = {
  scryerVersion: "0.21.21",
  applicationUpgradeStatus: { updateAvailable: true, updateVersion: "0.22.0" },
  systemHealth: {
    serviceReady: true,
    titlesMovie: 756,
    titlesSeries: 88,
    titlesAnime: 3,
    monitoredTitles: 842,
    indexerStats: [{ indexerId: "a", queriesLast24H: 10, failedLast24H: 0, successfulLast24H: 10, grabsLast24H: 2 }],
  },
  indexers: [
    { id: "a", name: "Good", isEnabled: true },
    { id: "b", name: "Off", isEnabled: false },
    { id: "c", name: "Limited", isEnabled: true, rateLimitedUntil: "2026-10-30T13:00:00Z" },
    { id: "d", name: "Broken", isEnabled: true, lastErrorAt: "2026-10-30T11:00:00Z", lastErrorMessage: "boom" },
  ],
  activity: {
    current: { grabbed: 3, upgraded: 1, imported: 5, importFailed: 1, downloadFailed: 1 },
    previous: { grabbed: 1, upgraded: 0, imported: 2, importFailed: 0, downloadFailed: 0 },
  },
  recentImports: [{ id: "i1", titleName: "Show", kind: "NEW_IMPORT", occurredAt: "2026-10-30T10:00:00Z", episode: { seasonNumber: "1", episodeNumber: "2" } }],
  queue: {
    totalCount: 2,
    ready: true,
    items: [
      { id: "q1", titleName: "A", displayState: "DOWNLOADING", progressPercent: 40, attentionRequired: false },
      { id: "q2", titleName: "B", displayState: "WARNING", progressPercent: 0, attentionRequired: true, attentionReason: "stalled" },
    ],
  },
  calendar: [
    { id: "c2", titleName: "Later", titleFacet: "series", airDate: "2026-11-02", airDateEstimated: true, monitored: true },
    { id: "c1", titleName: "Sooner", titleFacet: "series", airDate: "2026-10-30", airDateEstimated: false, monitored: true },
    { id: "c0", titleName: "Undated", titleFacet: "series", airDate: null, monitored: true },
  ],
  wantedMissing: { totalCount: 669 },
  wantedCutoff: { totalCount: 0 },
  pendingRequests: [{ id: "r1" }, { id: "r2" }],
  pendingImports: { movie: 1, series: 2, anime: 0 },
  activeJobs: [{ id: "j1", displayName: "Title Rename", status: "RUNNING" }],
  activeScans: [],
};

describe("scryer widget config", () => {
  it("exports a valid widget config", () => {
    expectWidgetConfigShape(widget);
  });

  it("exposes only the batched overview endpoint", () => {
    expect(Object.keys(widget.mappings)).toEqual(["overview"]);
  });
});

describe("scryer mapOverview", () => {
  const out = mapOverview(raw, now);

  it("summarises library, wanted and update state", () => {
    expect(out.library).toMatchObject({ movies: 756, series: 88, anime: 3 });
    expect(out.wanted).toEqual({ missing: 669, cutoffUnmet: 0, pendingRequests: 2, pendingImports: 3 });
    expect(out.update).toEqual({ version: "0.22.0" });
  });

  it("merges download and import failures into one failed count", () => {
    expect(out.activity.current.failed).toBe(2);
    expect(out.activity.previous.failed).toBe(0);
  });

  it("classifies indexer health", () => {
    const states = Object.fromEntries(out.indexers.map((i) => [i.name, i.state]));
    expect(states).toEqual({ Good: "ok", Off: "disabled", Limited: "limited", Broken: "error" });
  });

  it("flags only queue items that need attention", () => {
    expect(out.queue.items.map((q) => q.issue)).toEqual([null, "stalled"]);
  });

  it("drops undated calendar entries and sorts by air date", () => {
    expect(out.calendar.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(out.calendar[1].estimated).toBe(true);
  });

  it("tolerates missing sections", () => {
    const empty = mapOverview({}, now);
    expect(empty.queue.items).toEqual([]);
    expect(empty.calendar).toEqual([]);
    expect(empty.library.movies).toBe(0);
    expect(empty.update).toBeNull();
  });
});
