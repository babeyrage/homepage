// ── Shared UI primitives ──────────────────────────────────────────────────────

export function SectionLabel({ children }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wide text-theme-500 dark:text-theme-400 mb-0.5 mt-1.5 first:mt-0 border-l-2 border-theme-400 dark:border-theme-500 pl-1.5">
      {children}
    </div>
  );
}

export function PulseRow() {
  return <div className="h-7 w-full rounded-sm bg-theme-200/50 dark:bg-theme-900/20 mb-0.5 animate-pulse" />;
}

export function MatchPulseRow() {
  return (
    <div className="flex flex-col rounded-sm bg-theme-200/50 dark:bg-theme-900/20 px-1.5 py-1 mb-0.5 gap-0.5 animate-pulse">
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-1 flex-1">
          <div className="h-5 w-5 rounded-sm bg-theme-300/50 dark:bg-theme-800/30 shrink-0" />
          <div className="h-2.5 w-16 rounded-sm bg-theme-300/50 dark:bg-theme-800/30" />
        </div>
        <div className="h-2 w-4 rounded-sm bg-theme-300/50 dark:bg-theme-800/30 shrink-0" />
        <div className="flex items-center gap-1 flex-1 justify-end">
          <div className="h-2.5 w-16 rounded-sm bg-theme-300/50 dark:bg-theme-800/30" />
          <div className="h-5 w-5 rounded-sm bg-theme-300/50 dark:bg-theme-800/30 shrink-0" />
        </div>
        <div className="h-2.5 w-8 rounded-sm bg-theme-300/50 dark:bg-theme-800/30 shrink-0 ml-1" />
      </div>
      <div className="h-2 w-24 rounded-sm bg-theme-300/50 dark:bg-theme-800/30" />
    </div>
  );
}

export function TournamentPulseRow() {
  return (
    <div className="flex items-center justify-between rounded-sm bg-theme-200/50 dark:bg-theme-900/20 px-1.5 py-0.5 mb-0.5 animate-pulse gap-1">
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="h-2.5 w-3/4 rounded-sm bg-theme-300/50 dark:bg-theme-800/30" />
        <div className="h-2 w-1/3 rounded-sm bg-theme-300/50 dark:bg-theme-800/30" />
      </div>
      <div className="h-3 w-8 rounded-sm bg-theme-300/50 dark:bg-theme-800/30 shrink-0" />
    </div>
  );
}

// Static size map — all strings are literals so Tailwind JIT picks them up
export const LOGO_SIZES = {
  xs: { box: "h-4 w-4", img: "h-3 w-3" },   // per-game rows inside a series
  sm: { box: "h-5 w-5", img: "h-4 w-4" },   // PandaScore match rows
  md: { box: "h-6 w-6", img: "h-5 w-5" },   // series header
  lg: { box: "h-7 w-7", img: "h-6 w-6" },   // teams grid
};

// Fixed-size container that normalises every logo to the same visual footprint.
// overflow-hidden clips wide/tall logos; the neutral background fills transparent areas.
export function LogoBox({ src, alt = "", size = "md" }) {
  const { box, img } = LOGO_SIZES[size];
  return (
    <div
      className={`${box} shrink-0 rounded-sm bg-white/40 dark:bg-black/25 flex items-center justify-center overflow-hidden`}
    >
      {src ? (
        <img src={src} alt={alt} className={`${img} object-contain`} />
      ) : (
        <div className={`${img} opacity-0`} />
      )}
    </div>
  );
}

export function ItemSlot({ item, size = "md", rounded = false }) {
  const cls = size === "sm" ? "w-5 h-5" : "w-6 h-6";
  const roundCls = rounded ? "rounded-full" : "rounded-sm";
  if (!item?.img) return <div className={`${cls} ${roundCls} bg-zinc-700/60 shrink-0`} />;
  return (
    <img
      src={item.img}
      alt={item.name ?? ""}
      title={item.name ?? ""}
      className={`${cls} ${roundCls} object-cover bg-zinc-700/60 shrink-0`}
    />
  );
}

export function LevelRing({ level }) {
  const r = 9;
  const strokeWidth = 2.5;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(level, 30) / 30);

  // Colour shifts with level progression
  const ringColor =
    level >= 25 ? "#f59e0b" :
    level >= 15 ? "#fb923c" :
    level >= 5  ? "#60a5fa" :
                  "#6b7280";

  return (
    <div className="relative w-7 h-7 shrink-0">
      <svg viewBox="0 0 24 24" className="w-full h-full -rotate-90">
        {/* Track */}
        <circle cx="12" cy="12" r={r} fill="none" stroke="#3f3f46" strokeWidth={strokeWidth} />
        {/* Progress */}
        <circle
          cx="12" cy="12" r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-zinc-200 tabular-nums leading-none">
        {level}
      </span>
    </div>
  );
}
