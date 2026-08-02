import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { httpProxy, getServiceWidget, cache, xml2json, logger } = vi.hoisted(() => {
  const store = new Map();
  return {
    httpProxy: vi.fn(),
    getServiceWidget: vi.fn(),
    cache: {
      get: vi.fn((k) => (store.has(k) ? store.get(k) : null)),
      put: vi.fn((k, v) => store.set(k, v)),
      del: vi.fn((k) => store.delete(k)),
      _reset: () => store.clear(),
    },
    xml2json: vi.fn((xml) => {
      if (xml === "sessions") return JSON.stringify({ MediaContainer: { _attributes: { size: "2" } } });
      if (xml === "libraries") {
        return JSON.stringify({
          MediaContainer: {
            Directory: [
              { _attributes: { type: "movie", key: "1" } },
              { _attributes: { type: "show", key: "2" } },
              { _attributes: { type: "artist", key: "3" } },
            ],
          },
        });
      }
      if (xml === "movies_count") return JSON.stringify({ MediaContainer: { _attributes: { totalSize: "10" } } });
      if (xml === "tv_count") return JSON.stringify({ MediaContainer: { _attributes: { totalSize: "20" } } });
      if (xml === "movies_recent") {
        return JSON.stringify({
          MediaContainer: {
            Video: [
              {
                _attributes: {
                  ratingKey: "201",
                  addedAt: "1700000000",
                  type: "movie",
                  title: "Movie A",
                  year: "2023",
                  thumb: "/library/metadata/201/thumb",
                },
              },
            ],
          },
        });
      }
      if (xml === "tv_recent") {
        return JSON.stringify({
          MediaContainer: {
            Video: [
              {
                _attributes: {
                  ratingKey: "301",
                  addedAt: "1700000100",
                  type: "episode",
                  title: "Pilot",
                  grandparentTitle: "Show A",
                  grandparentRatingKey: "9001",
                  grandparentThumb: "/library/metadata/9001/thumb",
                  parentIndex: "1",
                  index: "1",
                },
              },
            ],
          },
        });
      }
      return JSON.stringify({ MediaContainer: { _attributes: { size: "0" } } });
    }),
    logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
});

vi.mock("utils/logger", () => ({
  default: () => logger,
}));
vi.mock("utils/config/service-helpers", () => ({
  default: getServiceWidget,
}));
vi.mock("utils/proxy/http", () => ({
  httpProxy,
}));
vi.mock("memory-cache", () => ({
  default: cache,
}));
vi.mock("xml-js", () => ({
  xml2json,
}));
vi.mock("widgets/widgets", () => ({
  default: { plexrecent: { api: "{url}{endpoint}" } },
}));

const { default: plexProxyHandler } = await import("./proxy");

const widget = { type: "plexrecent", url: "http://plex.local:32400", key: "tok123" };
const req = { query: { group: "g", service: "svc", index: "0" } };

function buf(marker) {
  return Buffer.from(marker);
}

describe("widgets/plexrecent/proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache._reset();
    getServiceWidget.mockResolvedValue(widget);
  });

  it("fetches streams, library counts and recently-added items, caching the results", async () => {
    httpProxy
      .mockResolvedValueOnce([200, "application/xml", buf("sessions")]) // sessions
      .mockResolvedValueOnce([200, "application/xml", buf("libraries")]) // libraries
      .mockResolvedValueOnce([200, "application/xml", buf("movies_count")]) // movie lib total
      .mockResolvedValueOnce([200, "application/xml", buf("tv_count")]) // show lib total
      .mockResolvedValueOnce([200, "application/xml", buf("movies_recent")]) // movie lib recentlyAdded
      .mockResolvedValueOnce([200, "application/xml", buf("tv_recent")]); // show lib recentlyAdded

    const res = createMockRes();
    await plexProxyHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.streams).toBe(2);
    expect(res.body.totalMovies).toBe(10);
    expect(res.body.totalShows).toBe(20);

    expect(res.body.recentMovies).toHaveLength(1);
    expect(res.body.recentMovies[0]).toMatchObject({ id: "201", title: "Movie A" });

    expect(res.body.recentTV).toHaveLength(1);
    expect(res.body.recentTV[0]).toMatchObject({ id: "9001", showTitle: "Show A" });
    expect(res.body.recentTV[0].episodes).toHaveLength(1);
    expect(res.body.recentTV[0].episodes[0]).toMatchObject({ id: "301", title: "Pilot" });

    expect(cache.put).toHaveBeenCalled();

    // Token is sent as a header, never in the URL.
    for (const [, options] of httpProxy.mock.calls) {
      expect(options?.headers?.["X-Plex-Token"]).toBe("tok123");
    }
    for (const [url] of httpProxy.mock.calls) {
      expect(String(url)).not.toContain("tok123");
    }
  });

  it("reports zero streams instead of failing the whole request when /status/sessions errors", async () => {
    httpProxy
      .mockResolvedValueOnce([500, "application/json", buf("boom")]) // sessions fails
      .mockResolvedValueOnce([200, "application/xml", buf("libraries")])
      .mockResolvedValueOnce([200, "application/xml", buf("movies_count")])
      .mockResolvedValueOnce([200, "application/xml", buf("tv_count")])
      .mockResolvedValueOnce([200, "application/xml", buf("movies_recent")])
      .mockResolvedValueOnce([200, "application/xml", buf("tv_recent")]);

    const res = createMockRes();
    await plexProxyHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.streams).toBe(0);
    expect(res.body.totalMovies).toBe(10);
  });

  it("returns 502 when libraries fail and there is no cached fallback", async () => {
    httpProxy
      .mockResolvedValueOnce([200, "application/xml", buf("sessions")])
      .mockResolvedValueOnce([500, "application/json", buf("boom")]); // libraries fails, no cache yet

    const res = createMockRes();
    await plexProxyHandler(req, res);

    expect(res.statusCode).toBe(502);
  });

  it("falls back to cached library data when a later libraries refresh fails", async () => {
    httpProxy
      .mockResolvedValueOnce([200, "application/xml", buf("sessions")])
      .mockResolvedValueOnce([200, "application/xml", buf("libraries")])
      .mockResolvedValueOnce([200, "application/xml", buf("movies_count")])
      .mockResolvedValueOnce([200, "application/xml", buf("tv_count")])
      .mockResolvedValueOnce([200, "application/xml", buf("movies_recent")])
      .mockResolvedValueOnce([200, "application/xml", buf("tv_recent")]);

    const first = createMockRes();
    await plexProxyHandler(req, first);
    expect(first.statusCode).toBe(200);

    // Force the recent-items cache to be considered stale, but leave the libraries cache intact.
    cache.del(`plexRecentProxyHandler__recent_movies.svc.0`);
    cache.del(`plexRecentProxyHandler__recent_tv.svc.0`);

    httpProxy
      .mockResolvedValueOnce([200, "application/xml", buf("sessions")])
      .mockResolvedValueOnce([500, "application/json", buf("boom")]) // libraries refresh fails this time
      .mockResolvedValueOnce([200, "application/xml", buf("movies_recent")])
      .mockResolvedValueOnce([200, "application/xml", buf("tv_recent")]);

    const second = createMockRes();
    await plexProxyHandler(req, second);

    expect(second.statusCode).toBe(200);
    expect(second.body.totalMovies).toBe(10);
    expect(second.body.totalShows).toBe(20);
  });
});
