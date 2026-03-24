import { DateTime } from "luxon";

// ── PandaScore upcoming tournament row ────────────────────────────────────────

export function UpcomingTournamentRow({ tournament, onClick }) {
  const beginAt = tournament.beginAt ? DateTime.fromISO(tournament.beginAt) : null;
  const title = [tournament.leagueName, tournament.season ? `Season ${tournament.season}` : ""]
    .filter(Boolean)
    .join(" - ");

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex flex-col rounded-sm bg-theme-200/50 dark:bg-theme-900/20 px-1.5 py-0.5 mb-0.5 text-left hover:bg-theme-200/80 dark:hover:bg-theme-900/40 transition-colors"
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs text-theme-700 dark:text-theme-200 truncate">{title}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-[10px] text-theme-400 dark:text-theme-500 select-none">▸</span>
        </div>
      </div>
      {tournament.name && (
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] text-theme-500 dark:text-theme-400 truncate">{tournament.name}</span>
          {beginAt && (
            <span className="shrink-0 text-[10px] text-theme-400 dark:text-theme-500">
              {beginAt.toFormat("d MMM")}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
