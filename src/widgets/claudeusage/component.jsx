import { Bar, Chip, FUSION_COLORS, MonoLabel } from "../../components/widgets/fusion/primitives";

import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";

const POLL = { revalidateOnFocus: false, revalidateOnReconnect: false, refreshInterval: 30 * 1000 };

function fmtTokens(n) {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

const fmtCost = (n) => `$${(n ?? 0).toFixed(n >= 100 ? 0 : 2)}`;

function limitColor(pct) {
  if (pct >= 90) return FUSION_COLORS.bad;
  if (pct >= 70) return FUSION_COLORS.warn;
  return FUSION_COLORS.ok;
}

function Stat({ label, value, sub }) {
  return (
    <div className="flex flex-col min-w-0">
      <span className="text-lg font-semibold leading-tight tabular-nums">{value}</span>
      <MonoLabel>{label}</MonoLabel>
      {sub ? <span className="text-[10px] opacity-60">{sub}</span> : null}
    </div>
  );
}

function LimitBar({ limit }) {
  const color = limitColor(limit.pct);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <MonoLabel>{limit.label}</MonoLabel>
        <span className="text-[11px] tabular-nums" style={{ color }}>
          {limit.pct}%
        </span>
      </div>
      <Bar pct={limit.pct} color={color} />
      {limit.resets ? <span className="text-[10px] opacity-60">resets {limit.resets}</span> : null}
    </div>
  );
}

function DailyChart({ daily }) {
  if (!daily?.length) return null;
  const max = Math.max(...daily.map((d) => d.cost), 0.0001);
  return (
    <div className="flex items-end gap-0.5 h-10">
      {daily.map((d) => (
        <div
          key={d.day}
          className="flex-1 rounded-sm min-h-px"
          style={{ height: `${Math.max(4, (d.cost / max) * 100)}%`, backgroundColor: FUSION_COLORS.infra }}
          title={`${d.day} — ${fmtCost(d.cost)} · ${fmtTokens(d.tokens)} tokens`}
        />
      ))}
    </div>
  );
}

function Breakdown({ title, rows, nameKey }) {
  if (!rows?.length) return null;
  const max = Math.max(...rows.map((r) => r.cost), 0.0001);
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <MonoLabel>{title}</MonoLabel>
      {rows.map((r) => (
        <div key={r[nameKey]} className="flex flex-col gap-0.5">
          <div className="flex justify-between gap-2 text-[11px]">
            <span className="truncate">{r[nameKey]}</span>
            <span className="tabular-nums opacity-80">{fmtCost(r.cost)}</span>
          </div>
          <Bar pct={(r.cost / max) * 100} />
        </div>
      ))}
    </div>
  );
}

export default function Component({ service }) {
  const { widget } = service;
  const { data, error } = useWidgetAPI(widget, "overview", POLL);

  if (error) return <Container service={service} error={error} />;
  if (!data) {
    return (
      <Container service={service}>
        <div className="text-xs opacity-60 p-2">Loading…</div>
      </Container>
    );
  }

  const { totals, cacheHitRate, limits = [], limitsError } = data;

  return (
    <Container service={service}>
      <div className="flex flex-col gap-3 w-full p-2">
        {limits.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {limits.map((l) => (
              <LimitBar key={l.label} limit={l} />
            ))}
          </div>
        ) : limitsError ? (
          <Chip color={FUSION_COLORS.warn}>plan limits unavailable</Chip>
        ) : null}

        <div className="grid grid-cols-3 gap-3">
          <Stat
            label="Today"
            value={fmtCost(totals.today.cost)}
            sub={`${totals.today.requests} req · ${fmtTokens(totals.today.output)} out`}
          />
          <Stat
            label="7 days"
            value={fmtCost(totals.d7.cost)}
            sub={`${totals.d7.requests} req · ${fmtTokens(totals.d7.output)} out`}
          />
          <Stat
            label="30 days"
            value={fmtCost(totals.d30.cost)}
            sub={`${Math.round(cacheHitRate.d30 * 100)}% cache hit`}
          />
        </div>

        <DailyChart daily={data.daily} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Breakdown title="Models · 7d" rows={data.models} nameKey="model" />
          <Breakdown title="Projects · 7d" rows={data.projects} nameKey="project" />
        </div>
        <span className="text-[9px] opacity-50">API-equivalent cost at list prices, not billed amount</span>
      </div>
    </Container>
  );
}
