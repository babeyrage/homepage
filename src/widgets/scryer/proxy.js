import getServiceWidget from "utils/config/service-helpers";
import createLogger from "utils/logger";
import { sanitizeErrorURL } from "utils/proxy/api-helpers";
import { httpProxy } from "utils/proxy/http";

const logger = createLogger("scryerProxy");

// Scryer is local, so there is no upstream quota to ration — the cache only
// exists so several open tabs/browsers share one batched GraphQL call.
export const OVERVIEW_TTL_MS = 10 * 1000;
const CALENDAR_DAYS = 14;
const QUEUE_LIMIT = 8;
const RECENT_IMPORT_LIMIT = 8;
const ACTIVITY_WINDOW_HOURS = 24;

// globalThis so Next dev HMR doesn't drop the cache on every file edit.
const state = (globalThis.__scryerState ??= { entries: new Map(), inflight: new Map() });

const OVERVIEW_QUERY = `
query Overview($start: Date!, $end: Date!, $queueLimit: Int!, $importLimit: Int!, $window: Int!) {
  scryerVersion
  applicationUpgradeStatus { currentVersion updateAvailable updateVersion }
  systemHealth {
    serviceReady totalTitles monitoredTitles titlesMovie titlesSeries titlesAnime
    indexerStats { indexerId indexerName queriesLast24H failedLast24H grabsLast24H apiCurrent apiMax }
  }
  indexers { id name isEnabled lastHealthStatus lastErrorMessage lastErrorAt disabledUntil rateLimitedUntil }
  activity: dashboardActivityStats(windowHours: $window) {
    current { grabbed upgraded imported importFailed downloadFailed }
    previous { grabbed upgraded imported importFailed downloadFailed }
  }
  recentImports: dashboardRecentImports(limit: $importLimit) {
    id titleName facet kind quality sizeBytes occurredAt posterUrl
    episode { seasonNumber episodeNumber title }
  }
  queue: downloadQueuePage(
    limit: $queueLimit, offset: 0, scryerSubmittedOnly: false,
    filters: [DOWNLOADING, QUEUED, PAUSED, POST_PROCESSING, WARNING],
    sortKey: PROGRESS, sortDirection: DESC
  ) {
    totalCount ready stale
    items {
      id titleName facet displayState progressPercent sizeBytes remainingSeconds
      clientName attentionRequired attentionReason
    }
  }
  calendar: calendarEpisodes(startDate: $start, endDate: $end) {
    id titleName titleFacet seasonNumber episodeNumber episodeTitle airDate airDateEstimated
    monitored imageUrl
  }
  wantedMissing: wantedItems(wantedKind: MISSING, limit: 1, offset: 0) { totalCount }
  wantedCutoff: cutoffUnmetTitlesPage(limit: 1, offset: 0) { totalCount }
  pendingRequests: mediaRequests(status: PENDING) { id }
  pendingImports: pendingImportCounts { movie series anime }
  activeJobs: activeJobRuns { id displayName status startedAt }
  activeScans: activeLibraryScans { sessionId facet status foundTitles }
}`;

const ISSUE_STATES = new Set(["WARNING", "FAILED", "IMPORT_BLOCKED", "IMPORT_FAILED", "REMOVE_FAILED"]);

function dateOnly(d) {
  return d.toISOString().slice(0, 10);
}

function pickCounts(c) {
  return {
    grabbed: c?.grabbed ?? 0,
    upgraded: c?.upgraded ?? 0,
    imported: c?.imported ?? 0,
    failed: (c?.importFailed ?? 0) + (c?.downloadFailed ?? 0),
  };
}

// Indexer is "unhealthy" if it is enabled but currently disabled/rate-limited
// by Scryer, or has an error more recent than its last successful query.
function indexerState(indexer, stats, now) {
  if (!indexer.isEnabled) return "disabled";
  if (indexer.disabledUntil && Date.parse(indexer.disabledUntil) > now) return "disabled";
  if (indexer.rateLimitedUntil && Date.parse(indexer.rateLimitedUntil) > now) return "limited";
  const errored = indexer.lastErrorAt && (!stats?.lastQueryAt || Date.parse(indexer.lastErrorAt) >= Date.parse(stats.lastQueryAt));
  const failing = (stats?.failedLast24H ?? 0) > 0 && (stats?.successfulLast24H ?? 0) === 0;
  return errored || failing ? "error" : "ok";
}

export function mapOverview(data, now = Date.now()) {
  const health = data.systemHealth ?? {};
  const statsById = new Map((health.indexerStats ?? []).map((s) => [s.indexerId, s]));

  const indexers = (data.indexers ?? []).map((i) => {
    const stats = statsById.get(i.id);
    return {
      id: i.id,
      name: i.name,
      state: indexerState(i, stats, now),
      queries24h: stats?.queriesLast24H ?? 0,
      failed24h: stats?.failedLast24H ?? 0,
      grabs24h: stats?.grabsLast24H ?? 0,
      apiCurrent: stats?.apiCurrent ?? null,
      apiMax: stats?.apiMax ?? null,
      lastError: i.lastErrorMessage ?? null,
      lastErrorAt: i.lastErrorAt ?? null,
    };
  });

  const queueItems = data.queue?.items ?? [];

  return {
    version: data.scryerVersion,
    update: data.applicationUpgradeStatus?.updateAvailable
      ? { version: data.applicationUpgradeStatus.updateVersion ?? null }
      : null,
    ready: health.serviceReady !== false && data.queue?.ready !== false,
    library: {
      movies: health.titlesMovie ?? 0,
      series: health.titlesSeries ?? 0,
      anime: health.titlesAnime ?? 0,
      monitored: health.monitoredTitles ?? 0,
    },
    wanted: {
      missing: data.wantedMissing?.totalCount ?? 0,
      cutoffUnmet: data.wantedCutoff?.totalCount ?? 0,
      pendingRequests: data.pendingRequests?.length ?? 0,
      pendingImports: Object.values(data.pendingImports ?? {}).reduce((sum, n) => sum + (Number(n) || 0), 0),
    },
    activity: {
      windowHours: ACTIVITY_WINDOW_HOURS,
      current: pickCounts(data.activity?.current),
      previous: pickCounts(data.activity?.previous),
    },
    queue: {
      total: data.queue?.totalCount ?? 0,
      items: queueItems.map((q) => ({
        id: q.id,
        title: q.titleName,
        facet: q.facet ?? null,
        state: q.displayState,
        progress: q.progressPercent ?? 0,
        sizeBytes: q.sizeBytes ?? null,
        etaSeconds: q.remainingSeconds ?? null,
        client: q.clientName ?? null,
        issue: q.attentionRequired || ISSUE_STATES.has(q.displayState) ? (q.attentionReason ?? q.displayState) : null,
      })),
    },
    calendar: (data.calendar ?? [])
      .filter((e) => e.airDate)
      .map((e) => ({
        id: e.id,
        title: e.titleName,
        facet: e.titleFacet,
        season: e.seasonNumber ?? null,
        episode: e.episodeNumber ?? null,
        episodeTitle: e.episodeTitle ?? null,
        airDate: e.airDate,
        estimated: !!e.airDateEstimated,
        monitored: !!e.monitored,
        imageUrl: e.imageUrl ?? null,
      }))
      .sort((a, b) => a.airDate.localeCompare(b.airDate)),
    recentImports: (data.recentImports ?? []).map((r) => ({
      id: r.id,
      title: r.titleName ?? "",
      facet: r.facet ?? null,
      kind: r.kind,
      quality: r.quality ?? null,
      sizeBytes: r.sizeBytes ?? null,
      occurredAt: r.occurredAt,
      posterUrl: r.posterUrl ?? null,
      season: r.episode?.seasonNumber ?? null,
      episode: r.episode?.episodeNumber ?? null,
      episodeTitle: r.episode?.title ?? null,
    })),
    indexers,
    activeJobs: (data.activeJobs ?? []).map((j) => ({ id: j.id, name: j.displayName, status: j.status })),
    activeScans: (data.activeScans ?? []).map((s) => ({ id: s.sessionId, facet: s.facet, found: s.foundTitles })),
  };
}

export async function scryerGraphql(widget, query, variables) {
  const url = new URL("/graphql", widget.url);
  const [status, , data] = await httpProxy(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${widget.key}` },
    body: JSON.stringify({ query, variables }),
  });

  let body = data;
  if (Buffer.isBuffer(data) || typeof data === "string") {
    try {
      body = JSON.parse(data.toString());
    } catch {
      body = null;
    }
  }
  return { status, url, body };
}

async function fetchOverview(widget, now) {
  const start = new Date(now);
  const end = new Date(now + CALENDAR_DAYS * 24 * 60 * 60 * 1000);
  const { status, url, body } = await scryerGraphql(widget, OVERVIEW_QUERY, {
    start: dateOnly(start),
    end: dateOnly(end),
    queueLimit: QUEUE_LIMIT,
    importLimit: RECENT_IMPORT_LIMIT,
    window: ACTIVITY_WINDOW_HOURS,
  });

  // Scryer reports auth failures as HTTP 401 *with* a GraphQL errors array, and
  // partial failures as 200 with both `data` and `errors`; only bail if nothing usable came back.
  if (status !== 200 || !body?.data) {
    return { ok: false, status, url, message: body?.errors?.[0]?.message ?? "HTTP Error" };
  }
  if (body.errors?.length) logger.debug("Scryer partial errors: %s", body.errors.map((e) => e.message).join("; "));
  return { ok: true, data: mapOverview(body.data, now) };
}

export default async function scryerProxyHandler(req, res) {
  const { group, service, index } = req.query;
  if (!group || !service) return res.status(400).json({ error: "Invalid proxy service type" });

  const widget = await getServiceWidget(group, service, index);
  if (widget?.type !== "scryer") return res.status(400).json({ error: "Invalid proxy service type" });

  const cacheKey = `${group}/${service}/${index ?? ""}`;
  const now = Date.now();
  const cached = state.entries.get(cacheKey);
  if (cached && now - cached.fetchedAt < OVERVIEW_TTL_MS) return res.status(200).json(cached.data);

  let pending = state.inflight.get(cacheKey);
  if (!pending) {
    pending = fetchOverview(widget, now).finally(() => state.inflight.delete(cacheKey));
    state.inflight.set(cacheKey, pending);
  }
  const result = await pending;

  if (result.ok) {
    state.entries.set(cacheKey, { data: result.data, fetchedAt: now });
    return res.status(200).json(result.data);
  }

  // Scryer unreachable or erroring: show the last good data rather than an error tile.
  if (cached) return res.status(200).json(cached.data);

  logger.error("HTTP Error %d calling %s", result.status, sanitizeErrorURL(result.url));
  return res.status(result.status >= 400 ? result.status : 500).json({
    error: { message: result.message, url: sanitizeErrorURL(result.url) },
  });
}
