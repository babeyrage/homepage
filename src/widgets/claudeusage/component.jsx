import { Chip, FUSION_COLORS, Led, MonoLabel } from "../../components/widgets/fusion/primitives";

import Container from "components/services/widget/container";
import useCurrentTime from "utils/hooks/use-current-time";
import useWidgetAPI from "utils/proxy/use-widget-api";

const POLL = { revalidateOnFocus: false, revalidateOnReconnect: false, refreshInterval: 30 * 1000 };
const STALE_AFTER_MS = 90 * 1000;

const TOKEN_COLORS = {
  input: "#5b8def",
  output: "#f5a524",
  cacheRead: "#34d399",
  cacheWrite: "#94a3b8",
};

function fmtTokens(n) {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

function fmtCost(n) {
  const v = Number.isFinite(n) ? n : 0;
  if (v >= 1000) return `$${Math.round(v).toLocaleString("en-US")}`;
  if (v >= 100) return `$${v.toFixed(0)}`;
  return `$${v.toFixed(2)}`;
}

const fmtPct = (n) => `${Math.round((n ?? 0) * 100)}%`;

function fmtDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "now";
  const mins = Math.round(ms / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtAge(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

const fmtHour = (h) => `${String(h).padStart(2, "0")}:00`;
const fmtDay = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function limitColor(pct) {
  if (pct >= 90) return FUSION_COLORS.bad;
  if (pct >= 70) return FUSION_COLORS.warn;
  return FUSION_COLORS.ok;
}

function Section({ title, right, children, className = "" }) {
  return (
    <div className={`flex flex-col gap-1.5 min-w-0 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <MonoLabel>{title}</MonoLabel>
        {right}
      </div>
      {children}
    </div>
  );
}

// Positive delta means spending went up, which is "bad" here, so it is coloured amber/red-ish.
function Delta({ now, before }) {
  if (!before || before <= 0) return null;
  const pct = (now - before) / before;
  if (Math.abs(pct) < 0.01) return <span className="text-[11px] opacity-60">same as yesterday</span>;
  const up = pct > 0;
  return (
    <span className="text-[11px] tabular-nums" style={{ color: up ? FUSION_COLORS.warn : FUSION_COLORS.ok }}>
      {up ? "▲" : "▼"} {Math.round(Math.abs(pct) * 100)}% vs yesterday
    </span>
  );
}

function LimitRow({ limit, now }) {
  const color = limitColor(limit.pct);
  const remaining = limit.resetsAt && now ? limit.resetsAt - now : null;
  const pace =
    limit.resetsAt && limit.windowMs && now
      ? Math.min(100, Math.max(0, (1 - (limit.resetsAt - now) / limit.windowMs) * 100))
      : null;
  const ahead = pace != null && limit.pct > pace + 5;

  let hint = null;
  if (pace != null) {
    hint = ahead ? `${Math.round(limit.pct - pace)} pts ahead of even pace` : "on or under even pace";
  }

  return (
    <div className="flex flex-col gap-1" title={limit.resets ? `${limit.label} — resets ${limit.resets}` : limit.label}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] capitalize truncate">{limit.label}</span>
        <span className="text-sm font-semibold tabular-nums" style={{ color }}>
          {Math.round(limit.pct)}%
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-theme-300/30 dark:bg-theme-900/40 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, limit.pct)}%`, backgroundColor: color }}
        />
        {pace != null ? (
          <div
            className="absolute top-0 h-full w-0.5 bg-theme-800 dark:bg-theme-100 opacity-70"
            style={{ left: `calc(${pace}% - 1px)` }}
            title={`Even pace: ${Math.round(pace)}% of the window has elapsed`}
          />
        ) : null}
      </div>
      <div className="flex justify-between gap-2 text-[10px] opacity-70">
        <span>{remaining != null ? `resets in ${fmtDuration(remaining)}` : (limit.resets ?? "")}</span>
        {hint ? <span style={ahead ? { color: FUSION_COLORS.warn } : undefined}>{hint}</span> : null}
      </div>
    </div>
  );
}

function DailyChart({ daily }) {
  if (!daily?.length) return null;
  const max = Math.max(...daily.map((d) => d.cost), 0.0001);
  const peak = daily.reduce((a, b) => (b.cost > a.cost ? b : a), daily[0]);
  const last = daily.length - 1;
  return (
    <Section
      title="Daily cost · 14d"
      right={
        peak.cost > 0 ? (
          <span className="text-[10px] opacity-70">
            peak {fmtCost(peak.cost)} · {fmtDay(peak.day)}
          </span>
        ) : null
      }
    >
      <div className="flex items-end gap-1 h-16">
        {daily.map((d, i) => (
          <div
            key={d.day}
            className="flex-1 rounded-sm min-h-px opacity-80 hover:opacity-100"
            style={{
              height: `${Math.max(3, (d.cost / max) * 100)}%`,
              backgroundColor: i === last ? FUSION_COLORS.ok : FUSION_COLORS.infra,
            }}
            title={`${d.day} — ${fmtCost(d.cost)} · ${d.requests} req · ${fmtTokens(d.tokens)} in+out`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] opacity-60">
        <span>{fmtDay(daily[0].day)}</span>
        <span>today</span>
      </div>
    </Section>
  );
}

function HourlyStrip({ hourly, peakHour }) {
  if (!hourly || peakHour == null) return null;
  const max = Math.max(...hourly, 0.0001);
  return (
    <Section
      title="Activity by hour · 7d"
      right={<span className="text-[10px] opacity-70">busiest {fmtHour(peakHour)}</span>}
    >
      <div className="flex items-end gap-px h-8">
        {hourly.map((v, h) => (
          <div
            key={h}
            className="flex-1 rounded-sm min-h-px"
            style={{
              height: `${Math.max(4, (v / max) * 100)}%`,
              backgroundColor: h === peakHour ? FUSION_COLORS.warn : FUSION_COLORS.infra,
              opacity: v > 0 ? 0.85 : 0.25,
            }}
            title={`${fmtHour(h)} — ${fmtCost(v)}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] opacity-60">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </Section>
  );
}

function TokenMix({ totals, cacheHitRate }) {
  const t = totals.d7;
  const parts = [
    ["input", "Input", t.input],
    ["output", "Output", t.output],
    ["cacheRead", "Cache read", t.cacheRead],
    ["cacheWrite", "Cache write", t.cacheWrite],
  ];
  const sum = parts.reduce((s, p) => s + p[2], 0);
  if (sum <= 0) return null;
  return (
    <Section
      title="Token mix · 7d"
      right={<span className="text-[10px] opacity-70">{fmtPct(cacheHitRate.d7)} cache hit</span>}
    >
      <div className="flex h-2 rounded-full overflow-hidden bg-theme-300/30 dark:bg-theme-900/40">
        {parts.map(([key, label, v]) => (
          <div
            key={key}
            style={{ width: `${(v / sum) * 100}%`, backgroundColor: TOKEN_COLORS[key] }}
            title={`${label}: ${fmtTokens(v)} (${fmtPct(v / sum)})`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        {parts.map(([key, label, v]) => (
          <div key={key} className="flex items-center justify-between gap-2 text-[10px]">
            <span className="flex items-center gap-1 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: TOKEN_COLORS[key] }} />
              <span className="truncate opacity-80">{label}</span>
            </span>
            <span className="tabular-nums">{fmtTokens(v)}</span>
          </div>
        ))}
      </div>
      {t.saved > 0 ? (
        <span className="text-[10px]" style={{ color: FUSION_COLORS.ok }}>
          caching saved ≈ {fmtCost(t.saved)} this week
        </span>
      ) : null}
    </Section>
  );
}

function ShareList({ title, rows, nameKey }) {
  if (!rows?.length) return null;
  return (
    <Section title={title}>
      {rows.map((r) => (
        <div
          key={r[nameKey]}
          className="flex flex-col gap-0.5"
          title={`${r[nameKey]} — ${fmtCost(r.cost)} · ${r.requests} req`}
        >
          <div className="flex justify-between gap-2 text-[11px]">
            <span className={`truncate ${r.other ? "opacity-60" : ""}`}>{r[nameKey]}</span>
            <span className="tabular-nums shrink-0">
              <span className="opacity-60">{fmtPct(r.share)}</span> · {fmtCost(r.cost)}
            </span>
          </div>
          <div className="h-1 rounded-full bg-theme-300/30 dark:bg-theme-900/40 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${r.share * 100}%`,
                backgroundColor: r.other ? FUSION_COLORS.paused : FUSION_COLORS.infra,
              }}
            />
          </div>
        </div>
      ))}
    </Section>
  );
}

export default function Component({ service }) {
  const { widget } = service;
  const { data, error } = useWidgetAPI(widget, "overview", POLL);
  const now = useCurrentTime(30 * 1000);

  if (error) return <Container service={service} error={error} />;
  if (!data) {
    return (
      <Container service={service}>
        <div className="text-xs opacity-60 p-2">Loading…</div>
      </Container>
    );
  }

  const { totals, cacheHitRate, limits = [], limitsError, month } = data;
  const age = now && data.generatedAt ? now - data.generatedAt : null;
  const stale = age != null && age > STALE_AFTER_MS;
  const today = totals.today;
  const avg = today.requests > 0 ? today.cost / today.requests : 0;
  const limitsNow = now ?? null;

  return (
    <Container service={service}>
      <div className="flex flex-col gap-3 w-full p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <Led color={stale ? FUSION_COLORS.warn : FUSION_COLORS.ok} glow={!stale} />
            <MonoLabel title="Cost is API-equivalent at list prices, not the amount billed to a subscription">
              Claude usage
            </MonoLabel>
          </span>
          <span className="text-[10px] opacity-60">
            {stale ? `agent offline · last data ${fmtAge(age)}` : age != null ? `updated ${fmtAge(age)}` : ""}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-5 gap-y-4">
          {/* Left: headline + plan limits */}
          <div className="flex flex-col gap-3 min-w-0">
            <Section title="Today">
              <span
                className="text-3xl font-semibold leading-none tabular-nums"
                title="API-equivalent cost at list prices, not billed amount"
              >
                {fmtCost(today.cost)}
              </span>
              <Delta now={today.cost} before={totals.yesterday.cost} />
              <span className="text-[11px] opacity-70 tabular-nums">
                {today.requests} requests · {fmtTokens(today.output)} output
                {today.requests > 0 ? ` · ${fmtCost(avg)}/req` : ""}
              </span>
            </Section>

            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col">
                <span className="text-sm font-semibold tabular-nums">{fmtCost(totals.d7.cost)}</span>
                <MonoLabel>7 days</MonoLabel>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold tabular-nums">{fmtCost(totals.d30.cost)}</span>
                <MonoLabel>30 days</MonoLabel>
              </div>
              <div
                className="flex flex-col"
                title={`Month to date ${fmtCost(month.cost)}, projected from ${month.elapsedDays.toFixed(1)} of ${month.daysInMonth} days`}
              >
                <span className="text-sm font-semibold tabular-nums">≈ {fmtCost(month.projected)}</span>
                <MonoLabel>month end</MonoLabel>
              </div>
            </div>

            <Section title="Plan limits">
              {limits.length > 0 ? (
                limits.map((l) => <LimitRow key={l.label} limit={l} now={limitsNow} />)
              ) : (
                <Chip color={FUSION_COLORS.warn}>{limitsError ? "limits unavailable" : "no limit data"}</Chip>
              )}
            </Section>
          </div>

          {/* Middle: trends */}
          <div className="flex flex-col gap-4 min-w-0">
            <DailyChart daily={data.daily} />
            <HourlyStrip hourly={data.hourly} peakHour={data.peakHour} />
          </div>

          {/* Right: composition */}
          <div className="flex flex-col gap-4 min-w-0">
            <TokenMix totals={totals} cacheHitRate={cacheHitRate} />
            <ShareList title="Models · 7d" rows={data.models} nameKey="model" />
            <ShareList title="Projects · 7d" rows={data.projects} nameKey="project" />
          </div>
        </div>
      </div>
    </Container>
  );
}
