import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import { CONF_DIR } from "utils/config/config";
import getServiceWidget from "utils/config/service-helpers";
import createLogger from "utils/logger";
import { sanitizeErrorURL } from "utils/proxy/api-helpers";
import { httpProxy } from "utils/proxy/http";

const logger = createLogger("dota2Proxy");

export const CITO_API_BASE = "https://api.citoapi.com/api/v1/dota2";

// CitoAPI's free tier is 500 calls/month, so every upstream call is rationed here.
// All browsers/tabs share one server-side cache; the client can poll this route
// as often as it likes without spending quota.
const DEFAULT_MONTHLY_LIMIT = 500;
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

const TTL = {
  tournaments: 8 * HOUR,
  recent: 90 * MIN,
  upcoming: 45 * MIN,
  liveActive: 90 * 1000, // a match is in progress
  liveImminent: 3 * MIN, // a match is about to start / should have started
  liveIdle: 20 * MIN, // nothing scheduled nearby — only a safety-net check
  detailLive: 90 * 1000,
  detailUpcoming: 30 * MIN,
  detailFinished: 30 * 24 * HOUR, // a finished game never changes
};

const IMMINENT_AHEAD_MS = 30 * MIN;
const IMMINENT_BEHIND_MS = 4 * HOUR;
const RATE_LIMIT_BACKOFF_MS = HOUR;
const PERSIST_DEBOUNCE_MS = 2000;
const CACHE_FILE = path.join(CONF_DIR, ".dota2-cito-cache.json");

export function kindOf(endpoint) {
  const base = String(endpoint).split("?")[0];
  if (base === "matches/live") return "live";
  if (base === "matches/upcoming") return "upcoming";
  if (base === "matches/recent") return "recent";
  if (base === "tournaments") return "tournaments";
  return "detail";
}

function monthKey(now) {
  return new Date(now).toISOString().slice(0, 7);
}

// ── Store (in-memory, persisted to disk so restarts don't reset the cache) ───

function loadStore() {
  const empty = { entries: {}, usage: { month: monthKey(Date.now()), count: 0 }, quota: null, blockedUntil: 0 };
  try {
    return { ...empty, ...JSON.parse(readFileSync(CACHE_FILE, "utf8")) };
  } catch {
    return empty;
  }
}

// globalThis so Next dev HMR doesn't wipe the cache on every file edit.
const state = (globalThis.__dota2CitoState ??= { store: loadStore(), inflight: new Map(), persistTimer: null });

function persist() {
  if (state.persistTimer) return;
  state.persistTimer = setTimeout(() => {
    state.persistTimer = null;
    try {
      mkdirSync(CONF_DIR, { recursive: true });
      writeFileSync(CACHE_FILE, JSON.stringify(state.store));
    } catch (e) {
      logger.debug("Could not persist dota2 cache: %s", e?.message);
    }
  }, PERSIST_DEBOUNCE_MS);
  state.persistTimer.unref?.();
}

// ── Quota ────────────────────────────────────────────────────────────────────

function recordCall(headers, limit, now) {
  const { store } = state;
  const month = monthKey(now);
  if (store.usage.month !== month) store.usage = { month, count: 0 };
  store.usage.count += 1;

  // Prefer the server's own numbers if it sends rate-limit headers.
  let remaining;
  let headerLimit;
  for (const [k, v] of Object.entries(headers ?? {})) {
    const key = k.toLowerCase();
    const n = Number(Array.isArray(v) ? v[0] : v);
    if (!Number.isFinite(n)) continue;
    if (key.includes("ratelimit") || key.includes("quota")) {
      if (key.includes("remaining")) remaining = n;
      else if (key.includes("limit")) headerLimit = n;
    }
  }
  store.quota = remaining === undefined ? null : { remaining, limit: headerLimit ?? limit };
}

export function quotaStatus(store, limit, now) {
  const month = monthKey(now);
  const used = store.usage.month === month ? store.usage.count : 0;
  const total = store.quota?.limit ?? limit;
  const remaining = store.quota ? store.quota.remaining : total - used;
  return { remaining, total, fraction: total > 0 ? remaining / total : 0 };
}

// Stretch every TTL as the monthly budget drains so it degrades gracefully
// rather than running dry mid-month.
export function quotaMultiplier(fraction) {
  if (fraction < 0.05) return 8;
  if (fraction < 0.2) return 3;
  return 1;
}

// ── TTL policy ───────────────────────────────────────────────────────────────

function hasImminentMatch(upcoming, now) {
  if (!Array.isArray(upcoming)) return false;
  return upcoming.some((m) => {
    const t = Date.parse(m?.beginAt);
    return Number.isFinite(t) && t <= now + IMMINENT_AHEAD_MS && t >= now - IMMINENT_BEHIND_MS;
  });
}

export function ttlFor(kind, data, upcoming, now) {
  switch (kind) {
    case "tournaments":
      return TTL.tournaments;
    case "recent":
      return TTL.recent;
    case "upcoming":
      return TTL.upcoming;
    case "live":
      if (Array.isArray(data) && data.length > 0) return TTL.liveActive;
      return hasImminentMatch(upcoming, now) ? TTL.liveImminent : TTL.liveIdle;
    case "detail":
      if (data?.status === "live") return TTL.detailLive;
      if (data?.status === "upcoming") return TTL.detailUpcoming;
      return TTL.detailFinished;
    default:
      return TTL.recent;
  }
}

function cachedUpcoming(store) {
  return store.entries["matches/upcoming"]?.data;
}

// ── Handler ──────────────────────────────────────────────────────────────────

function sendCached(res, entry, how) {
  res.setHeader("X-Dota2-Cache", how);
  return res.status(200).json(entry.data);
}

async function fetchUpstream(endpoint, widget, map, kind, now) {
  const { store } = state;
  const limit = Number(widget.monthlyLimit) || DEFAULT_MONTHLY_LIMIT;
  const url = new URL(`${CITO_API_BASE}/${endpoint}`);

  const [status, , data, headers] = await httpProxy(url, {
    method: "GET",
    headers: { "Content-Type": "application/json", "X-API-Key": `${widget.key}` },
  });

  recordCall(headers, limit, now);

  if (status === 429) store.blockedUntil = now + RATE_LIMIT_BACKOFF_MS;
  if (status !== 200) return { ok: false, status, url, data };

  const mapped = map ? map(data) : data;
  const previous = store.entries[endpoint]?.data;
  store.entries[endpoint] = { kind, data: mapped, fetchedAt: now };

  // A live match just ended: make the "recent" list refetch on next request
  // so the finished result appears promptly instead of up to 90 min later.
  if (kind === "live" && Array.isArray(previous) && previous.length > 0 && mapped.length === 0) {
    for (const entry of Object.values(store.entries)) {
      if (entry.kind === "recent") entry.fetchedAt = 0;
    }
  }

  persist();
  return { ok: true, data: mapped };
}

export default async function dota2ProxyHandler(req, res, map) {
  const { group, service, endpoint, index } = req.query;
  if (!group || !service) return res.status(400).json({ error: "Invalid proxy service type" });

  const widget = await getServiceWidget(group, service, index);
  if (widget?.type !== "dota2") return res.status(400).json({ error: "Invalid proxy service type" });

  const { store, inflight } = state;
  const now = Date.now();
  const kind = kindOf(endpoint);
  const entry = store.entries[endpoint];
  const limit = Number(widget.monthlyLimit) || DEFAULT_MONTHLY_LIMIT;

  const { remaining, fraction } = quotaStatus(store, limit, now);
  const ttl = entry ? ttlFor(kind, entry.data, cachedUpcoming(store), now) * quotaMultiplier(fraction) : 0;

  if (entry && now - entry.fetchedAt < ttl) return sendCached(res, entry, "hit");

  // Budget exhausted or upstream rate-limited: never call out if we have anything to show.
  const upstreamBlocked = store.blockedUntil > now || remaining <= 5;
  if (entry && upstreamBlocked) return sendCached(res, entry, "stale-quota");

  // Collapse concurrent identical requests into a single upstream call.
  let pending = inflight.get(endpoint);
  if (!pending) {
    pending = fetchUpstream(endpoint, widget, map, kind, now).finally(() => inflight.delete(endpoint));
    inflight.set(endpoint, pending);
  }
  const result = await pending;

  if (result.ok) {
    res.setHeader("X-Dota2-Cache", "miss");
    return res.status(200).json(result.data);
  }

  const latest = store.entries[endpoint];
  if (latest) return sendCached(res, latest, "stale-error");

  logger.error("HTTP Error %d calling %s", result.status, sanitizeErrorURL(result.url));
  return res.status(result.status >= 400 ? result.status : 500).json({
    error: { message: result.data?.error?.message ?? "HTTP Error", url: sanitizeErrorURL(result.url) },
  });
}
