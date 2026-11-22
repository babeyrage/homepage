import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

export const OVERVIEW_TTL_MS = 15 * 1000;
export const LIMITS_TTL_MS = 2 * 60 * 1000;
const MAX_DAYS = 30;

// USD per million tokens (API list prices). Matched by substring against the model id, first hit wins.
// Override per-widget with `pricing:` in services.yaml.
export const DEFAULT_PRICING = [
  { match: "fable", input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  { match: "opus", input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  { match: "sonnet", input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  { match: "haiku", input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
];

// globalThis so Next dev HMR doesn't drop caches on every edit.
const state = (globalThis.__claudeUsageState ??= {
  files: new Map(), // file -> { mtimeMs, size, rows }
  overview: null,
  limits: null,
  inflight: null,
  limitsInflight: null,
});

export function priceFor(model, pricing) {
  const id = String(model ?? "").toLowerCase();
  return pricing.find((p) => id.includes(p.match)) ?? null;
}

export function costOf(usage, price) {
  if (!price) return 0;
  const m = 1e6;
  return (
    ((usage.input ?? 0) * price.input +
      (usage.output ?? 0) * price.output +
      (usage.cacheRead ?? 0) * price.cacheRead +
      (usage.cacheWrite ?? 0) * price.cacheWrite) /
    m
  );
}

async function walk(dir, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, out);
    else if (e.name.endsWith(".jsonl")) out.push(full);
  }
  return out;
}

async function parseFile(file, projectsDir, cutoffMs) {
  const rows = [];
  const project = path.relative(projectsDir, file).split(path.sep)[0];
  const rl = readline.createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.includes('"usage"')) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const msg = obj?.message;
    const u = msg?.usage;
    if (obj?.type !== "assistant" || !u) continue;
    const ts = Date.parse(obj.timestamp);
    if (!Number.isFinite(ts) || ts < cutoffMs) continue;
    rows.push({
      key: `${msg.id ?? ""}:${obj.requestId ?? ""}`,
      ts,
      model: msg.model ?? "unknown",
      project,
      input: u.input_tokens ?? 0,
      output: u.output_tokens ?? 0,
      cacheRead: u.cache_read_input_tokens ?? 0,
      cacheWrite: u.cache_creation_input_tokens ?? 0,
    });
  }
  return rows;
}

function prettyProject(dir) {
  // "-home-user-projects-foo" -> "foo"
  const parts = dir.split("-").filter(Boolean);
  return parts[parts.length - 1] ?? dir;
}

const DAY_MS = 86400000;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function topWithOther(map, n, nameKey) {
  const all = [...map.values()].sort((a, b) => b.cost - a.cost);
  const total = all.reduce((s, r) => s + r.cost, 0);
  const top = all.slice(0, n);
  const rest = all.slice(n);
  if (rest.length) {
    top.push({
      [nameKey]: `other (${rest.length})`,
      requests: rest.reduce((s, r) => s + r.requests, 0),
      cost: rest.reduce((s, r) => s + r.cost, 0),
      other: true,
    });
  }
  return top.map((r) => ({ ...r, share: total > 0 ? r.cost / total : 0 }));
}

// tzOffsetMin = minutes EAST of UTC (e.g. Perth = 480). Local time = ts + offset.
export function summarize(rows, pricing, now = Date.now(), tzOffsetMin = 0) {
  const seen = new Set();
  const off = tzOffsetMin * 60000;
  const startOfToday = Math.floor((now + off) / DAY_MS) * DAY_MS - off;
  const local = new Date(now + off);
  const monthStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - off;
  const daysInMonth = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
  const windows = {
    today: startOfToday,
    d7: now - 7 * DAY_MS,
    d30: now - 30 * DAY_MS,
    month: monthStart,
  };

  const zero = () => ({ requests: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, saved: 0 });
  const totals = { today: zero(), yesterday: zero(), d7: zero(), d30: zero(), month: zero() };
  const models = new Map();
  const projects = new Map();
  const daily = new Map();
  const hourly = Array.from({ length: 24 }, () => 0);

  for (const r of rows) {
    if (seen.has(r.key) && r.key !== ":") continue;
    seen.add(r.key);
    const price = priceFor(r.model, pricing);
    const cost = costOf(r, price);
    const saved = price ? (r.cacheRead * Math.max(0, price.input - price.cacheRead)) / 1e6 : 0;
    const add = (t) => {
      t.requests += 1;
      t.input += r.input;
      t.output += r.output;
      t.cacheRead += r.cacheRead;
      t.cacheWrite += r.cacheWrite;
      t.cost += cost;
      t.saved += saved;
    };
    for (const [name, since] of Object.entries(windows)) if (r.ts >= since) add(totals[name]);
    if (r.ts >= startOfToday - DAY_MS && r.ts < startOfToday) add(totals.yesterday);

    if (r.ts >= windows.d7) {
      const mk = models.get(r.model) ?? { model: r.model, requests: 0, tokens: 0, cost: 0 };
      mk.requests += 1;
      mk.tokens += r.input + r.output + r.cacheRead + r.cacheWrite;
      mk.cost += cost;
      models.set(r.model, mk);

      const pk = projects.get(r.project) ?? { project: prettyProject(r.project), requests: 0, cost: 0 };
      pk.requests += 1;
      pk.cost += cost;
      projects.set(r.project, pk);

      hourly[new Date(r.ts + off).getUTCHours()] += cost;
    }
    const day = new Date(r.ts + off).toISOString().slice(0, 10);
    const dk = daily.get(day) ?? { day, cost: 0, tokens: 0, requests: 0 };
    dk.cost += cost;
    dk.tokens += r.input + r.output;
    dk.requests += 1;
    daily.set(day, dk);
  }

  // Continuous 14-day series (missing days are zero) so the chart has no gaps.
  const series = [];
  for (let i = 13; i >= 0; i -= 1) {
    const key = new Date(startOfToday - i * DAY_MS + off).toISOString().slice(0, 10);
    series.push(daily.get(key) ?? { day: key, cost: 0, tokens: 0, requests: 0 });
  }

  const denom = (t) => t.input + t.cacheRead + t.cacheWrite;
  const hitRate = (t) => (denom(t) > 0 ? t.cacheRead / denom(t) : 0);
  const elapsedDays = Math.max((now - monthStart) / DAY_MS, 1 / 24);
  const peak = Math.max(...hourly);

  return {
    totals,
    cacheHitRate: { today: hitRate(totals.today), d7: hitRate(totals.d7), d30: hitRate(totals.d30) },
    models: topWithOther(models, 3, "model"),
    projects: topWithOther(projects, 3, "project"),
    daily: series,
    hourly,
    peakHour: peak > 0 ? hourly.indexOf(peak) : null,
    month: {
      cost: totals.month.cost,
      projected: (totals.month.cost / elapsedDays) * daysInMonth,
      daysInMonth,
      elapsedDays,
    },
  };
}

// Parses reset strings like "Nov 22, 10:30am (UTC)", "Nov 26, 9am (UTC)" or "10:30am (UTC)" to epoch ms.
// "(UTC)"/"(GMT)" is honoured; any other zone label is treated as the server's local time.
export function parseResetTime(str, now = Date.now()) {
  if (!str) return null;
  const utc = /\((?:UTC|GMT)\)/i.test(str);
  const t = str.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!t) return null;
  let hour = Number(t[1]) % 12;
  if (t[3].toLowerCase() === "pm") hour += 12;
  const minute = Number(t[2] ?? 0);
  const make = (y, m, d) => (utc ? Date.UTC(y, m, d, hour, minute) : new Date(y, m, d, hour, minute).getTime());

  const d = str.match(/([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})/);
  const month = d ? MONTHS.indexOf(d[1].toLowerCase()) : -1;
  const ref = new Date(now);
  if (month >= 0) {
    const year = utc ? ref.getUTCFullYear() : ref.getFullYear();
    let ts = make(year, month, Number(d[2]));
    if (ts < now - DAY_MS) ts = make(year + 1, month, Number(d[2]));
    return ts;
  }
  const y = utc ? ref.getUTCFullYear() : ref.getFullYear();
  const m = utc ? ref.getUTCMonth() : ref.getMonth();
  const day = utc ? ref.getUTCDate() : ref.getDate();
  let ts = make(y, m, day);
  if (ts < now) ts += DAY_MS;
  return ts;
}

const LIMIT_WINDOWS = [
  [/session/i, 5 * 3600000],
  [/week/i, 7 * DAY_MS],
];

// Parses lines like "Current session: 2% used · resets Nov 22, 10:30am (UTC)"
// and "Current week (Opus): 9% used · resets ...".
export function parseUsageText(text, now = Date.now()) {
  const limits = [];
  for (const line of String(text ?? "").split("\n")) {
    const m = line.match(/^\s*Current ([^:]+):\s*(\d+(?:\.\d+)?)%\s*used(?:\s*·\s*resets\s*(.+?))?\s*$/i);
    if (!m) continue;
    const label = m[1].trim();
    const windowMs = LIMIT_WINDOWS.find(([re]) => re.test(label))?.[1] ?? null;
    limits.push({
      label,
      pct: Number(m[2]),
      resets: m[3]?.trim() ?? null,
      resetsAt: parseResetTime(m[3], now),
      windowMs,
    });
  }
  return limits;
}

function runClaudeUsage(bin) {
  return new Promise((resolve, reject) => {
    execFile(bin, ["-p", "/usage"], { timeout: 60000, cwd: os.tmpdir(), maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

async function getLimits(widget, now) {
  if (widget.limits === false) return { limits: [], limitsError: null };
  if (state.limits && now - state.limits.fetchedAt < LIMITS_TTL_MS) return state.limits.data;
  if (!state.limitsInflight) {
    state.limitsInflight = runClaudeUsage(widget.claudeBin || "claude")
      .then((out) => ({ limits: parseUsageText(out), limitsError: null }))
      .catch((e) => {
        console.error("claude -p /usage failed:", e.message);
        return { limits: state.limits?.data?.limits ?? [], limitsError: "claude CLI unavailable" };
      })
      .then((data) => {
        state.limits = { data, fetchedAt: Date.now() };
        return data;
      })
      .finally(() => {
        state.limitsInflight = null;
      });
  }
  return state.limitsInflight;
}

async function buildOverview(widget, now) {
  const projectsDir = widget.projectsDir || path.join(os.homedir(), ".claude", "projects");
  const cutoff = now - MAX_DAYS * 86400000;
  const pricing = Array.isArray(widget.pricing) && widget.pricing.length ? widget.pricing : DEFAULT_PRICING;

  const files = await walk(projectsDir);
  const live = new Set(files);
  for (const f of state.files.keys()) if (!live.has(f)) state.files.delete(f);

  const rows = [];
  for (const file of files) {
    let st;
    try {
      st = await stat(file);
    } catch {
      continue;
    }
    if (st.mtimeMs < cutoff) {
      state.files.delete(file);
      continue;
    }
    let entry = state.files.get(file);
    if (!entry || entry.mtimeMs !== st.mtimeMs || entry.size !== st.size) {
      entry = { mtimeMs: st.mtimeMs, size: st.size, rows: await parseFile(file, projectsDir, cutoff) };
      state.files.set(file, entry);
    }
    rows.push(...entry.rows);
  }

  const tzOffsetMin = -new Date(now).getTimezoneOffset();
  return { ...summarize(rows, pricing, now, tzOffsetMin), generatedAt: now };
}

// Single entry point used by both the local proxy mode and the remote agent.
// `opts`: { projectsDir, pricing, limits (false disables), claudeBin }
export async function getUsage(opts = {}) {
  const now = Date.now();
  if (!state.overview || now - state.overview.fetchedAt >= OVERVIEW_TTL_MS) {
    if (!state.inflight) {
      state.inflight = buildOverview(opts, now)
        .then((data) => {
          state.overview = { data, fetchedAt: Date.now() };
        })
        .finally(() => {
          state.inflight = null;
        });
    }
    await state.inflight;
  }
  const limits = await getLimits(opts, now);
  return { ...state.overview.data, ...limits };
}
