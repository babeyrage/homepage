import { DateTime } from "luxon";

// ── Tournament row (CitoAPI) ────────────────────────────────────────────────────
// A single row/badge shape for all three tournament states — status is passed
// explicitly by the caller (either from tournament.status directly, or the
// null-status fallback derived in component.jsx from cross-referencing matches).

export function TournamentRow({ tournament, status, onClick }) {
  const begin = tournament.startsAt ? DateTime.fromISO(tournament.startsAt) : null;
  const end = tournament.endsAt ? DateTime.fromISO(tournament.endsAt) : null;

  const dateLabel =
    status === "completed"
      ? end
        ? end.toRelative()
        : ""
      : begin && end
        ? `${begin.toFormat("d MMM")} – ${end.toFormat("d MMM")}`
        : begin
          ? `From ${begin.toFormat("d MMM")}`
          : "";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between rounded-sm bg-theme-200/50 dark:bg-theme-900/20 px-1.5 py-0.5 mb-0.5 gap-1 text-left hover:bg-theme-200/80 dark:hover:bg-theme-900/40 transition-colors"
    >
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-xs text-theme-700 dark:text-theme-200 truncate">{tournament.name}</span>
        {dateLabel && (
          <span className="text-[10px] text-theme-400 dark:text-theme-500">{dateLabel}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {status === "live" && (
          <span className="flex items-center gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
            </span>
            <span className="text-[9px] font-bold text-red-500 uppercase tracking-wide">Live</span>
          </span>
        )}
        {status === "upcoming" && (
          <span className="text-[9px] font-semibold text-sky-500 uppercase tracking-wide bg-sky-500/10 px-1 py-px rounded-sm">
            Upcoming
          </span>
        )}
        <span className="text-[10px] text-theme-400 dark:text-theme-500 select-none">▸</span>
      </div>
    </button>
  );
}
