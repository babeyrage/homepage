// ── Shared Fusion-redesign UI primitives ──────────────────────────────────
// Reused by every "<name>fusion" widget fork (see
// /home/babeyrage/.claude/plans/rosy-rolling-crystal.md for the fork
// pattern and rationale). These forks never modify their upstream
// src/widgets/<name>/ counterpart — they're separate files registered
// under a distinct widget `type`, so upstream merges stay conflict-free.
//
// Kept intentionally small and Tailwind-first, matching the existing
// src/widgets/dota2/ui/primitives.jsx convention. Colours that vary by
// live data (status, severity, zone) are passed as props and applied via
// inline style, since Tailwind's JIT can't resolve arbitrary runtime hex
// values from className alone.

import { useContext, useState } from "react";

import { BlockHighlightContext } from "components/services/widget/highlight-context";
import { evaluateHighlight } from "utils/highlights";
import useCurrentTime from "utils/hooks/use-current-time";

export const FUSION_COLORS = {
  ok: "#34d399",
  warn: "#f5a524",
  bad: "#fb7185",
  dota: "#bf2e1a",
  media: "#f5a524",
  infra: "#5b8def",
  network: "#34d399",
  security: "#fb7185",
  // Deliberately not red/amber/green/blue — a paused transfer isn't a
  // problem or progress, so it gets a cool neutral slate rather than
  // borrowing a color already meaning "active"/"warning"/"failed".
  paused: "#94a3b8",
};

// Matches the IBM Plex Mono stack custom.css already loads for
// stat/label text across the rest of the Fusion redesign.
export const FUSION_MONO = '"IBM Plex Mono", ui-monospace, "SF Mono", "Cascadia Code", "Fira Code", monospace';

const HIGHLIGHT_LEVEL_COLORS = {
  good: FUSION_COLORS.ok,
  warn: FUSION_COLORS.warn,
  danger: FUSION_COLORS.bad,
};

// Reuses the same declarative `widget.highlight` YAML (services.yaml) that
// stock Block components read via BlockHighlightContext (see
// components/services/widget/block.jsx), so a fusion tile's LED threshold
// is configurable the same way instead of inventing a second config
// surface. `fieldKey` is checked against both its bare form and
// `<widgetType>.<fieldKey>` (utils/highlights.js normalizes both), so a
// plain name like "ping" or "outdated" works directly. Returns `fallback`
// when nothing is configured for this field — callers still compute their
// own sane built-in default and pass it as `fallback`.
export function useHighlightColor(fieldKey, value, fallback = null) {
  const highlightConfig = useContext(BlockHighlightContext);
  const result = evaluateHighlight(fieldKey, value, highlightConfig);
  return result?.level ? (HIGHLIGHT_LEVEL_COLORS[result.level] ?? fallback) : fallback;
}

// A fusion widget's top-level `Component` function runs *before* Container
// mounts — Container is returned as JSX from Component, not an ancestor of
// it, so a hook reading BlockHighlightContext directly in Component's own
// body always sees the default (null) context and never observes the
// per-service config Container builds from service.widget.highlight.
// Render this as one of Container's children instead: `children` receives a
// `getColor(fieldKey, value, fallback)` callback resolved against the real
// context at that point in the tree, which a single wrapper can service for
// any number of fields (see patchmonfusion for a multi-field example).
export function HighlightColors({ children }) {
  const highlightConfig = useContext(BlockHighlightContext);
  const getColor = (fieldKey, value, fallback = null) => {
    const result = evaluateHighlight(fieldKey, value, highlightConfig);
    return result?.level ? (HIGHLIGHT_LEVEL_COLORS[result.level] ?? fallback) : fallback;
  };
  return children(getColor);
}

const AGE_TICK_MS = 10000;

function formatAge(seconds) {
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

// Tracks how long it's been since `data` last changed (a new SWR payload
// arrived) and formats it as a compact "12s ago" / "4m ago" / "2h ago"
// label, so a card can show it's not silently displaying a stale number.
// Built on the same useCurrentTime external-store clock the rest of the app
// uses for ticking values, rather than calling Date.now() during render
// (react-hooks/purity forbids that) or setting state from inside a
// useEffect body (react-hooks/set-state-in-effect flags that as a
// cascading-render anti-pattern) — capturing `now` when `data` changes is
// React's documented "adjust state during render" pattern instead, guarded
// so it only fires once per actual data change. Capture is deferred until
// the clock has ticked at least once (`now != null`) so it isn't stuck at
// null if data arrives before mount. Returns undefined until data has
// arrived at least once.
export function useLastUpdatedLabel(data) {
  const now = useCurrentTime(AGE_TICK_MS);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [prevData, setPrevData] = useState(data);

  if (data !== prevData && now != null) {
    setPrevData(data);
    setUpdatedAt(data !== undefined ? now : null);
  }

  if (updatedAt == null || now == null) return undefined;
  return formatAge(Math.max(0, Math.round((now - updatedAt) / 1000)));
}

export function Led({ color = FUSION_COLORS.ok, glow = false, className = "" }) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${className}`}
      style={{ backgroundColor: color, boxShadow: glow ? `0 0 6px ${color}` : undefined }}
    />
  );
}

export function MonoLabel({ children, color, className = "", title }) {
  return (
    <span
      className={`text-[9px] font-semibold uppercase tracking-widest ${className}`}
      style={{ fontFamily: FUSION_MONO, color }}
      title={title}
    >
      {children}
    </span>
  );
}

export function Bar({ pct = 0, color = FUSION_COLORS.infra, className = "" }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className={`h-1 rounded-full bg-theme-300/30 dark:bg-theme-900/40 overflow-hidden ${className}`}>
      <div className="h-full rounded-full" style={{ width: `${clamped}%`, backgroundColor: color }} />
    </div>
  );
}

export function Chip({ children, color = FUSION_COLORS.infra, className = "" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-semibold ${className}`}
      style={{ fontFamily: FUSION_MONO, color, backgroundColor: `${color}1f`, border: `1px solid ${color}59` }}
    >
      {children}
    </span>
  );
}

export function StatRow({ children, divider = true, className = "" }) {
  return (
    <div
      className={`flex items-center justify-between gap-2 py-1 ${
        divider ? "border-b border-theme-300/20 dark:border-theme-700/40 last:border-b-0" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

// Small rotating caret — indicates a tertiary line is expandable. `expanded`
// flips it from pointing right (collapsed) to down (open). Exported so forks
// with their own list-row layout (e.g. cisafusion/nvdfusion's per-item
// expand) can reuse the same affordance instead of a one-off caret.
export function Chevron({ expanded = false, className = "" }) {
  return (
    <svg
      viewBox="0 0 10 10"
      className={`w-2 h-2 shrink-0 transition-transform duration-150 ${expanded ? "rotate-90" : ""} ${className}`}
      style={{ fill: "currentColor" }}
    >
      <path d="M2 1 L8 5 L2 9 Z" />
    </svg>
  );
}

// One consolidated service tile: LED + one bold primary stat (with an
// optional unit label right beside it, e.g. "232 missing"), then two
// supporting detail lines — the shape every MEDIA-zone fork renders
// (see src/widgets/radarrfusion/component.jsx for the reference use).
// `w-full` + left alignment fills the tile edge-to-edge, matching the
// Fusion mockup's dense tiles — `.service-container`'s `justify-content:
// center` (config/custom.css) would otherwise centre a narrow intrinsic-
// width tile inside the full-width block slot, leaving large empty
// gutters on both sides.
// While `primary` is undefined (and no `error`) it renders a skeleton,
// matching useWidgetAPI's loading contract.
//
// The tertiary line can double as a disclosure control: pass `expandable`
// (with `expanded`/`onToggleExpand`) to render it as a button with a
// caret, so a fork can reveal a detail list (e.g. queue rows) beneath the
// tile without needing its own separate toggle affordance. `tertiaryBadge`
// renders a node (typically a <Chip>) after the tertiary text — used for
// things that deserve visual weight beyond plain text, like a failed count.
// `cornerBadge` renders a node pinned to the tile's top-right corner instead
// — for a status that's about the tile as a whole (e.g. an update being
// available) rather than tied to the tertiary stat specifically.
export function StatTile({
  primary,
  primaryLabel,
  secondary,
  tertiary,
  tertiaryBadge,
  cornerBadge,
  ledColor = FUSION_COLORS.ok,
  updatedAgo,
  error,
  expandable = false,
  expanded = false,
  onToggleExpand,
}) {
  if (!error && primary === undefined) {
    return (
      <div className="flex flex-col gap-1.5 w-full px-2 py-1.5 animate-pulse">
        <div className="h-4 w-12 rounded-sm bg-theme-300/40 dark:bg-theme-800/40" />
        <div className="h-2.5 w-20 rounded-sm bg-theme-300/30 dark:bg-theme-800/30" />
        <div className="h-2.5 w-16 rounded-sm bg-theme-300/20 dark:bg-theme-800/20" />
      </div>
    );
  }

  const canExpand = expandable && !error;
  const tertiaryInner = (tertiary || error) && (
    <>
      <span className="truncate">{error ? String(error) : tertiary}</span>
      {!error && tertiaryBadge}
      {canExpand && <Chevron expanded={expanded} className="ml-auto" />}
    </>
  );
  const tertiaryClassName =
    "flex items-center gap-1 w-full text-[9.5px] leading-snug text-theme-400/70 dark:text-theme-500/60";

  return (
    <div className="relative flex flex-col gap-0.5 w-full px-2 py-1.5">
      {!error && cornerBadge && <div className="absolute top-1 right-1.5">{cornerBadge}</div>}
      <div className="flex items-baseline gap-1.5">
        <Led color={error ? FUSION_COLORS.bad : ledColor} className="translate-y-[-2px]" />
        <span
          className="text-[15px] font-extrabold leading-tight tabular-nums"
          style={{ fontFamily: FUSION_MONO }}
        >
          {error ? "—" : primary}
        </span>
        {!error && primaryLabel && (
          <span
            className="text-[9px] font-semibold uppercase tracking-widest text-theme-500 dark:text-theme-400/80"
            style={{ fontFamily: FUSION_MONO }}
          >
            {primaryLabel}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[10px] leading-snug text-theme-500 dark:text-theme-400 truncate"
          style={{ fontFamily: FUSION_MONO }}
        >
          {error ? "API error" : secondary}
        </span>
        {!error && updatedAgo && (
          <span
            className="text-[9px] leading-snug text-theme-400/50 dark:text-theme-500/40 shrink-0"
            style={{ fontFamily: FUSION_MONO }}
          >
            {updatedAgo}
          </span>
        )}
      </div>
      {(tertiary || error) &&
        (canExpand ? (
          <button
            type="button"
            onClick={onToggleExpand}
            className={`${tertiaryClassName} text-left cursor-pointer hover:text-theme-300 dark:hover:text-theme-300 transition-colors`}
            style={{ fontFamily: FUSION_MONO }}
          >
            {tertiaryInner}
          </button>
        ) : (
          <span className={tertiaryClassName} style={{ fontFamily: FUSION_MONO }}>
            {tertiaryInner}
          </span>
        ))}
    </div>
  );
}

// Known download-client brand colours, loosely matched to each client's own
// mark so the chips read as distinct at a glance. Matching is substring-based
// against a lowercased name (e.g. "qBittorrent 4.6" still hits "qbittorrent"),
// since widgets report whatever instance name the user configured.
const CLIENT_COLORS = {
  qbittorrent: "#3b82f6",
  deluge: "#22c55e",
  transmission: "#ef4444",
  sabnzbd: "#f5a524",
  nzbget: "#a855f7",
  rutorrent: "#06b6d4",
  flood: "#ec4899",
  jdownloader: "#eab308",
  "download station": "#0ea5e9",
};

// Unknown/unlisted clients still deserve a stable, distinct colour rather
// than all collapsing into one grey — hashed into this fallback palette so
// the same client name always lands on the same colour.
const CLIENT_FALLBACK_PALETTE = ["#3b82f6", "#22c55e", "#ef4444", "#f5a524", "#a855f7", "#06b6d4", "#ec4899", "#eab308"];

export function getClientColor(name) {
  if (!name) return FUSION_COLORS.infra;
  const key = name.toLowerCase().trim();
  if (CLIENT_COLORS[key]) return CLIENT_COLORS[key];
  const matchKey = Object.keys(CLIENT_COLORS).find((k) => key.includes(k));
  if (matchKey) return CLIENT_COLORS[matchKey];

  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return CLIENT_FALLBACK_PALETTE[hash % CLIENT_FALLBACK_PALETTE.length];
}

// One row inside a StatTile's expanded detail list — a single queued/
// downloading item: title + download-client chip, a thin progress bar,
// then a status/eta line and a right-aligned size-or-speed line.
//
// `status` and `speed` carry the activity signal for the row, so both get
// bolder, brighter treatment than the row's other supporting text: `status`
// takes `statusColor` (e.g. blue while downloading, red on failure, left to
// a neutral-but-still-legible default otherwise) and `speed` is always
// rendered in the same accent green regardless of state, so a live transfer
// rate reads instantly against the surrounding muted timeLeft/label text.
export function QueueRow({
  title,
  client,
  progress = 0,
  status,
  statusColor,
  timeLeft,
  speed,
  barColor = FUSION_COLORS.infra,
}) {
  return (
    <div className="flex flex-col gap-1 px-2 py-1.5 border-t border-theme-300/10 dark:border-theme-700/30">
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[10.5px] font-semibold leading-tight truncate"
          style={{ fontFamily: FUSION_MONO }}
        >
          {title}
        </span>
        {client && (
          <Chip color={getClientColor(client)} className="shrink-0">
            {client}
          </Chip>
        )}
      </div>
      <Bar pct={progress} color={barColor} />
      <div className="flex items-center gap-2 text-[10.5px]" style={{ fontFamily: FUSION_MONO }}>
        <span
          className={`font-bold truncate ${statusColor ? "" : "text-theme-600 dark:text-theme-300"}`}
          style={statusColor ? { color: statusColor } : undefined}
        >
          {status}
        </span>
        {timeLeft && (
          <span className="shrink-0 text-theme-400/70 dark:text-theme-500/60">{timeLeft}</span>
        )}
        {speed && (
          <span className="shrink-0 ml-auto font-bold tabular-nums" style={{ color: FUSION_COLORS.ok }}>
            {speed}
          </span>
        )}
      </div>
    </div>
  );
}

// Prev/page/next footer for a paginated QueueRow list — keeps a long queue
// from turning the expanded tile into an unbounded scroll of rows. Renders
// nothing for a single page, so callers can include it unconditionally.
export function QueuePager({ page, pageCount, onPrev, onNext }) {
  if (pageCount <= 1) return null;
  return (
    <div
      className="flex items-center justify-center gap-3 px-2 py-1.5 border-t border-theme-300/10 dark:border-theme-700/30 text-[9.5px] text-theme-400/70 dark:text-theme-500/60"
      style={{ fontFamily: FUSION_MONO }}
    >
      <button
        type="button"
        onClick={onPrev}
        disabled={page === 0}
        className="px-1.5 disabled:opacity-30 disabled:cursor-not-allowed hover:text-theme-300 dark:hover:text-theme-300 transition-colors"
      >
        ‹
      </button>
      <span className="tabular-nums">
        {page + 1} / {pageCount}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={page === pageCount - 1}
        className="px-1.5 disabled:opacity-30 disabled:cursor-not-allowed hover:text-theme-300 dark:hover:text-theme-300 transition-colors"
      >
        ›
      </button>
    </div>
  );
}
