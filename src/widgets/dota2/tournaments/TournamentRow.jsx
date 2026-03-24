import { DateTime } from "luxon";

// ── DatDota tournament row ─────────────────────────────────────────────────────

export function TournamentRow({ tournament, onClick }) {
  const begin = tournament.first ? DateTime.fromISO(tournament.first) : null;
  const end = tournament.last ? DateTime.fromISO(tournament.last) : null;

  const dateLabel = tournament.isCurrent
    ? begin && end
      ? `${begin.toFormat("d MMM")} – ${end.toFormat("d MMM")}`
      : ""
    : end
      ? end.toRelative()
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
        {tournament.tierId === 1 && (
          <span className="text-[9px] font-semibold text-amber-500 uppercase tracking-wide">Prem</span>
        )}
        <span className="text-[10px] text-theme-400 dark:text-theme-500 select-none">▸</span>
      </div>
    </button>
  );
}
