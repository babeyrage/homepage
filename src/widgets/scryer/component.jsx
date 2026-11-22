import { DateTime } from "luxon";
import { useState } from "react";

import { Bar, Chip, FUSION_COLORS, Led, MonoLabel } from "../../components/widgets/fusion/primitives";

import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";

const POLL = { revalidateOnFocus: false, revalidateOnReconnect: false, refreshInterval: 15 * 1000 };

const STATE_COLOR = {
  DOWNLOADING: "#5b8def",
  POST_PROCESSING: "#5b8def",
  IMPORTING: "#5b8def",
  QUEUED: FUSION_COLORS.paused,
  PAUSED: FUSION_COLORS.paused,
  WARNING: FUSION_COLORS.warn,
  IMPORT_BLOCKED: FUSION_COLORS.warn,
  IMPORT_PENDING: FUSION_COLORS.warn,
  FAILED: FUSION_COLORS.bad,
  IMPORT_FAILED: FUSION_COLORS.bad,
};

const INDEXER_COLOR = {
  ok: FUSION_COLORS.ok,
  limited: FUSION_COLORS.warn,
  error: FUSION_COLORS.bad,
  disabled: FUSION_COLORS.paused,
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  return `${value >= 100 || i === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[i]}`;
}

function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

function humanize(state) {
  return String(state ?? "")
    .toLowerCase()
    .replace(/_/g, " ");
}

// Delta vs. the previous equal-length window. Failures are the one stat where
// "up" is bad, so its colour is inverted.
function Delta({ now, before, invert = false }) {
  const diff = now - before;
  if (diff === 0) return null;
  const good = invert ? diff < 0 : diff > 0;
  return (
    <span style={{ color: good ? FUSION_COLORS.ok : FUSION_COLORS.bad }} className="text-[10px] ml-1">
      {diff > 0 ? "+" : ""}
      {diff}
    </span>
  );
}

function Stat({ label, value, color, title }) {
  return (
    <div className="flex flex-col min-w-0" title={title}>
      <span className="text-lg font-semibold leading-tight tabular-nums" style={color ? { color } : undefined}>
        {value}
      </span>
      <MonoLabel>{label}</MonoLabel>
    </div>
  );
}

function SectionTitle({ children, right }) {
  return (
    <div className="flex items-center justify-between mb-1.5">
      <MonoLabel>{children}</MonoLabel>
      {right}
    </div>
  );
}

function Poster({ widget, path, title }) {
  if (!path || !path.startsWith("/images/")) {
    return <div className="w-7 h-10 rounded bg-theme-500/20 shrink-0" />;
  }
  const params = new URLSearchParams({
    group: widget.service_group,
    service: widget.service_name,
    index: String(widget.index ?? 0),
    path,
  });
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/widgets/scryer/image?${params}`}
      alt={title}
      loading="lazy"
      className="w-7 h-10 rounded object-cover shrink-0"
    />
  );
}

function episodeLabel(e) {
  if (e.season == null || e.episode == null) return "";
  return `S${String(e.season).padStart(2, "0")}E${String(e.episode).padStart(2, "0")}`;
}

function dayLabel(iso, today) {
  const d = DateTime.fromISO(iso);
  const diff = Math.round(d.startOf("day").diff(today.startOf("day"), "days").days);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toFormat("ccc d LLL");
}

function groupByDay(calendar, today) {
  const groups = [];
  for (const entry of calendar) {
    const label = dayLabel(entry.airDate, today);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(entry);
    else groups.push({ label, items: [entry] });
  }
  return groups;
}

function IndexerStrip({ indexers }) {
  if (!indexers.length) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {indexers.map((i) => (
        <span
          key={i.id}
          className="flex items-center gap-1 text-[10px] opacity-80"
          title={i.lastError ? `${i.name}: ${i.lastError}` : `${i.name} — ${i.queries24h} queries, ${i.grabs24h} grabs (24h)`}
        >
          <Led color={INDEXER_COLOR[i.state]} />
          {i.name}
        </span>
      ))}
    </div>
  );
}

export default function Component({ service }) {
  const { widget } = service;
  const { data, error } = useWidgetAPI(widget, "overview", POLL);
  const [calendarExpanded, setCalendarExpanded] = useState(false);

  if (error) return <Container service={service} error={error} />;
  if (!data) {
    return (
      <Container service={service}>
        <div className="animate-pulse h-40 w-full rounded bg-theme-500/10" />
      </Container>
    );
  }

  const { library, wanted, activity, queue, calendar, recentImports, indexers, activeJobs, activeScans } = data;
  const today = DateTime.now().setZone(widget.timezone ?? undefined);
  const days = groupByDay(calendar, today);
  const visibleDays = calendarExpanded ? days : days.slice(0, 3);
  const unhealthy = indexers.filter((i) => i.state === "error" || i.state === "limited");
  const attention = [
    ...queue.items.filter((q) => q.issue).map((q) => ({ key: `q${q.id}`, text: q.title, note: humanize(q.issue) })),
    ...unhealthy.map((i) => ({ key: `i${i.id}`, text: i.name, note: i.lastError ?? i.state })),
  ];
  const busy = [...activeJobs.map((j) => j.name), ...activeScans.map((s) => `Scanning ${humanize(s.facet)}`)];

  return (
    <Container service={service}>
      <div className="flex flex-col gap-3 w-full text-theme-800 dark:text-theme-200">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2">
            <Led color={data.ready ? FUSION_COLORS.ok : FUSION_COLORS.bad} glow />
            <MonoLabel>SCRYER {data.version}</MonoLabel>
            {data.update && <Chip color={FUSION_COLORS.warn}>update {data.update.version ?? ""}</Chip>}
          </div>
          <Stat label="MOVIES" value={library.movies} />
          <Stat label="SERIES" value={library.series} />
          <Stat label="ANIME" value={library.anime} />
          <Stat
            label="MISSING"
            value={wanted.missing}
            color={wanted.missing > 0 ? FUSION_COLORS.warn : undefined}
          />
          <Stat label="CUTOFF" value={wanted.cutoffUnmet} title="Below quality cutoff" />
          <Stat
            label="REQUESTS"
            value={wanted.pendingRequests}
            color={wanted.pendingRequests > 0 ? FUSION_COLORS.media : undefined}
            title="Pending media requests"
          />
          {wanted.pendingImports > 0 && (
            <Stat label="TO IMPORT" value={wanted.pendingImports} color={FUSION_COLORS.warn} />
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="flex flex-col gap-3 min-w-0">
            <div>
              <SectionTitle right={<MonoLabel>{queue.total} ACTIVE</MonoLabel>}>DOWNLOADS</SectionTitle>
              {queue.items.length === 0 && <div className="text-xs opacity-60">Nothing downloading.</div>}
              <div className="flex flex-col gap-1.5">
                {queue.items.map((q) => (
                  <div key={q.id} className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate" title={q.title}>
                        {q.title}
                      </span>
                      <span className="shrink-0 text-[10px]" style={{ color: STATE_COLOR[q.state] }}>
                        {humanize(q.state)}
                      </span>
                    </div>
                    <Bar pct={q.progress} color={STATE_COLOR[q.state] ?? FUSION_COLORS.infra} />
                    <div className="flex justify-between text-[10px] opacity-60">
                      <span>{[q.client, formatBytes(q.sizeBytes)].filter(Boolean).join(" · ")}</span>
                      <span>{q.progress}% {formatEta(q.etaSeconds)}</span>
                    </div>
                  </div>
                ))}
              </div>
              {busy.length > 0 && <div className="mt-1.5 text-[10px] opacity-60">Running: {busy.join(", ")}</div>}
            </div>

            <div>
              <SectionTitle right={<MonoLabel>{activity.windowHours}H</MonoLabel>}>ACTIVITY</SectionTitle>
              <div className="flex gap-5">
                <Stat label="GRABBED" value={<>{activity.current.grabbed}<Delta now={activity.current.grabbed} before={activity.previous.grabbed} /></>} />
                <Stat label="UPGRADED" value={<>{activity.current.upgraded}<Delta now={activity.current.upgraded} before={activity.previous.upgraded} /></>} />
                <Stat label="IMPORTED" value={<>{activity.current.imported}<Delta now={activity.current.imported} before={activity.previous.imported} /></>} />
                <Stat
                  label="FAILED"
                  value={<>{activity.current.failed}<Delta now={activity.current.failed} before={activity.previous.failed} invert /></>}
                  color={activity.current.failed > 0 ? FUSION_COLORS.bad : undefined}
                />
              </div>
            </div>

            <div>
              <SectionTitle>INDEXERS</SectionTitle>
              <IndexerStrip indexers={indexers} />
            </div>
          </div>

          <div className="flex flex-col gap-3 min-w-0">
            <div>
              <SectionTitle
                right={
                  days.length > 3 && (
                    <button
                      type="button"
                      className="text-[10px] opacity-60 hover:opacity-100"
                      onClick={() => setCalendarExpanded((v) => !v)}
                    >
                      {calendarExpanded ? "less" : `+${days.length - 3} days`}
                    </button>
                  )
                }
              >
                UPCOMING
              </SectionTitle>
              {days.length === 0 && <div className="text-xs opacity-60">Nothing scheduled in the next 14 days.</div>}
              {visibleDays.map((day) => (
                <div key={day.label} className="mb-1.5">
                  <div className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">{day.label}</div>
                  {day.items.map((e) => (
                    <div key={e.id} className="flex items-center gap-2 py-0.5">
                      <Poster widget={widget} path={e.imageUrl} title={e.title} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs truncate">{e.title}</div>
                        <div className="text-[10px] opacity-60 truncate">
                          {[episodeLabel(e), e.episodeTitle].filter(Boolean).join(" · ")}
                          {e.estimated ? " (est.)" : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div>
              <SectionTitle>RECENTLY IMPORTED</SectionTitle>
              {recentImports.length === 0 && <div className="text-xs opacity-60">No recent imports.</div>}
              {recentImports.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center gap-2 py-0.5">
                  <Poster widget={widget} path={r.posterUrl} title={r.title} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs truncate">{r.title}</div>
                    <div className="text-[10px] opacity-60 truncate">
                      {[episodeLabel(r), r.quality, formatBytes(r.sizeBytes)].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <span className="text-[10px] opacity-50 shrink-0">
                    {DateTime.fromISO(r.occurredAt).toRelative({ style: "narrow" })}
                  </span>
                </div>
              ))}
            </div>

            {attention.length > 0 && (
              <div>
                <SectionTitle right={<Chip color={FUSION_COLORS.bad}>{attention.length}</Chip>}>
                  NEEDS ATTENTION
                </SectionTitle>
                {attention.map((a) => (
                  <div key={a.key} className="flex justify-between gap-2 text-xs py-0.5">
                    <span className="truncate" title={a.text}>
                      {a.text}
                    </span>
                    <span className="shrink-0 text-[10px]" style={{ color: FUSION_COLORS.bad }}>
                      {a.note}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
}
