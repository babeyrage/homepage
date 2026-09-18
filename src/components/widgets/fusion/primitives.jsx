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

export const FUSION_COLORS = {
  ok: "#34d399",
  warn: "#f5a524",
  bad: "#fb7185",
  dota: "#bf2e1a",
  media: "#f5a524",
  infra: "#5b8def",
  network: "#34d399",
  security: "#fb7185",
};

// Matches the IBM Plex Mono stack custom.css already loads for
// stat/label text across the rest of the Fusion redesign.
export const FUSION_MONO = '"IBM Plex Mono", ui-monospace, "SF Mono", "Cascadia Code", "Fira Code", monospace';

export function Led({ color = FUSION_COLORS.ok, glow = false, className = "" }) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${className}`}
      style={{ backgroundColor: color, boxShadow: glow ? `0 0 6px ${color}` : undefined }}
    />
  );
}

export function MonoLabel({ children, color, className = "" }) {
  return (
    <span
      className={`text-[9px] font-semibold uppercase tracking-widest ${className}`}
      style={{ fontFamily: FUSION_MONO, color }}
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

// One consolidated service tile: LED + one bold primary stat, then two
// supporting detail lines — the shape every MEDIA-zone fork renders
// (see src/widgets/radarrfusion/component.jsx for the reference use).
// While `primary` is undefined (and no `error`) it renders a skeleton,
// matching useWidgetAPI's loading contract.
export function StatTile({ primary, secondary, tertiary, ledColor = FUSION_COLORS.ok, error }) {
  if (!error && primary === undefined) {
    return (
      <div className="flex flex-col gap-1.5 px-1 py-1 animate-pulse">
        <div className="h-4 w-12 rounded-sm bg-theme-300/40 dark:bg-theme-800/40" />
        <div className="h-2.5 w-20 rounded-sm bg-theme-300/30 dark:bg-theme-800/30" />
        <div className="h-2.5 w-16 rounded-sm bg-theme-300/20 dark:bg-theme-800/20" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 px-1 py-1">
      <div className="flex items-center gap-1.5">
        <Led color={error ? FUSION_COLORS.bad : ledColor} />
        <span
          className="text-[15px] font-extrabold leading-tight tabular-nums"
          style={{ fontFamily: FUSION_MONO }}
        >
          {error ? "—" : primary}
        </span>
      </div>
      <span
        className="text-[10px] leading-snug text-theme-500 dark:text-theme-400"
        style={{ fontFamily: FUSION_MONO }}
      >
        {error ? "API error" : secondary}
      </span>
      {(tertiary || error) && (
        <span
          className="text-[9.5px] leading-snug text-theme-400/70 dark:text-theme-500/60"
          style={{ fontFamily: FUSION_MONO }}
        >
          {error ? String(error) : tertiary}
        </span>
      )}
    </div>
  );
}
