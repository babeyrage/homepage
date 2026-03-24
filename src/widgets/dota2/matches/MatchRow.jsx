import { DateTime } from "luxon";

import { LogoBox } from "../ui/primitives";
import { shortRelative } from "../ui/utils";

// ── PandaScore live / upcoming match row ──────────────────────────────────────

export function MatchRow({ match, live, showAbsolute }) {
  const beginAt = match.beginAt ? DateTime.fromISO(match.beginAt) : null;

  return (
    <div className="flex flex-col rounded-sm bg-theme-200/50 dark:bg-theme-900/20 px-1.5 py-1 mb-0.5 gap-0.5">
      {/* Team row */}
      <div className="flex items-center gap-1">
        {/* Team 1 */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <LogoBox src={match.team1Logo} size="sm" />
          <span className="text-[10px] font-medium text-theme-700 dark:text-theme-200 truncate">{match.team1}</span>
        </div>

        <span className="shrink-0 text-[9px] text-theme-400 dark:text-theme-500 px-0.5">vs</span>

        {/* Team 2 */}
        <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
          <span className="text-[10px] font-medium text-theme-700 dark:text-theme-200 truncate text-right">
            {match.team2}
          </span>
          <LogoBox src={match.team2Logo} size="sm" />
        </div>

        {/* Status */}
        <div className="shrink-0 pl-1">
          {live ? (
            <span className="text-[9px] font-bold text-red-500">● LIVE</span>
          ) : (
            <span className="text-[10px] text-theme-400 dark:text-theme-500 tabular-nums">
              {beginAt
                ? showAbsolute
                  ? beginAt.toFormat("HH:mm")
                  : shortRelative(beginAt)
                : ""}
            </span>
          )}
        </div>
      </div>

      {/* League name + stream link */}
      <div className="flex items-center justify-between gap-1 min-w-0">
        {match.leagueName && (
          <span className="text-[9px] text-theme-500 dark:text-theme-400 truncate">{match.leagueName}</span>
        )}
        {match.streamUrl && (
          <a
            href={match.streamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[9px] font-semibold text-purple-500 hover:text-purple-400 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            ▶ Watch
          </a>
        )}
      </div>
    </div>
  );
}

// ── Expanded match row for use inside modals ──────────────────────────────────

export function ModalMatchRow({ match, showAbsolute }) {
  const beginAt = match.beginAt ? DateTime.fromISO(match.beginAt) : null;

  return (
    <div className="flex items-center gap-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-2.5 mb-1.5">
      {/* Team 1 */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <LogoBox src={match.team1Logo} size="md" />
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate">{match.team1}</span>
      </div>

      {/* Centre: time */}
      <div className="shrink-0 flex flex-col items-center gap-0.5 min-w-13">
        <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 tabular-nums">
          {beginAt
            ? showAbsolute
              ? beginAt.toFormat("HH:mm")
              : beginAt.toRelative()
            : ""}
        </span>
        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">vs</span>
        {match.streamUrl && (
          <a
            href={match.streamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] font-semibold text-purple-500 hover:text-purple-400 transition-colors mt-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            ▶ Watch
          </a>
        )}
      </div>

      {/* Team 2 */}
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate text-right">{match.team2}</span>
        <LogoBox src={match.team2Logo} size="md" />
      </div>
    </div>
  );
}
