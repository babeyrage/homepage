import { DateTime } from "luxon";
import { useState } from "react";
import { createPortal } from "react-dom";

import { ErrorState, LogoBox, PulseRow } from "../ui/primitives";
import { formatDayLabel, groupMatchesByDay, useBodyScrollLock, useEscapeToClose } from "../ui/utils";
import useWidgetAPI from "utils/proxy/use-widget-api";
import { TeamModal } from "../modals/TeamModal";

// ── Scheduled match row (inside UpcomingTournamentModal) ──────────────────────

export function ScheduledMatchRow({ match }) {
  const beginAt = match.beginAt ? DateTime.fromISO(match.beginAt) : null;

  return (
    <div className="flex items-center rounded-md bg-theme-50 dark:bg-theme-800/80 px-2 py-1.5 mb-1 gap-2">
      {/* Team 1 — right-aligned toward centre */}
      <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
        <span className="text-[10px] font-medium text-theme-700 dark:text-theme-200 truncate text-right">{match.team1}</span>
        <LogoBox src={match.team1Logo} size="sm" />
      </div>

      {/* Bo format */}
      <span className="shrink-0 text-[9px] font-semibold text-theme-400 dark:text-theme-500 tabular-nums">
        Bo{match.numberOfGames}
      </span>

      {/* Team 2 — left-aligned from centre */}
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <LogoBox src={match.team2Logo} size="sm" />
        <span className="text-[10px] font-medium text-theme-700 dark:text-theme-200 truncate">{match.team2}</span>
      </div>

      {/* Time + stream link */}
      <div className="shrink-0 flex items-center gap-1.5">
        <span className="text-[10px] text-theme-400 dark:text-theme-500 tabular-nums whitespace-nowrap">
          {beginAt ? beginAt.toFormat("HH:mm") : "TBD"}
        </span>
        {match.streamUrl && (
          <a
            href={match.streamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] font-semibold text-purple-500 hover:text-purple-400 transition-colors whitespace-nowrap"
            onClick={(e) => e.stopPropagation()}
          >
            ▶ Watch
          </a>
        )}
      </div>
    </div>
  );
}

// ── Upcoming tournament modal (PandaScore — fetches scheduled matches) ─────────

export function UpcomingTournamentModal({ tournament, widget, onClose }) {
  const begin = tournament.beginAt ? DateTime.fromISO(tournament.beginAt) : null;
  const end = tournament.endAt ? DateTime.fromISO(tournament.endAt) : null;
  const dateLabel =
    begin && end
      ? `${begin.toFormat("d MMM")} – ${end.toFormat("d MMM yyyy")}`
      : begin
        ? `From ${begin.toFormat("d MMM yyyy")}`
        : "";

  const { data: matchesRaw, error, mutate } = useWidgetAPI(widget, "tournament_matches", {
    "filter[tournament_id]": tournament.id,
    "page[size]": 50,
    sort: "begin_at",
  });
  const isLoading = !matchesRaw && !error;

  const matches = Array.isArray(matchesRaw) ? matchesRaw : [];

  const [visibleDays, setVisibleDays] = useState(2);

  // Group matches by local date, preserving API sort order (already sorted by begin_at)
  const matchesByDate = groupMatchesByDay(matches);
  const dateEntries = Object.entries(matchesByDate);
  const visibleEntries = dateEntries.slice(0, visibleDays);
  const hiddenDays = dateEntries.length - visibleDays;

  const [selectedTeam, setSelectedTeam] = useState(null);

  useEscapeToClose(onClose);
  useBodyScrollLock();

  const modal = createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[95vh] flex flex-col rounded-none sm:rounded-xl bg-theme-100 dark:bg-theme-900 shadow-2xl overflow-hidden mx-0 sm:mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-theme-200 dark:border-theme-700 shrink-0">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-theme-800 dark:text-theme-100">
                {[tournament.leagueName, tournament.name].filter(Boolean).join(" — ")}
              </span>
              {tournament.tier === "s" && (
                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wide bg-amber-500/15 px-1.5 py-0.5 rounded">
                  Tier S
                </span>
              )}
              {tournament.tier === "a" && (
                <span className="text-[9px] font-bold text-sky-500 uppercase tracking-wide bg-sky-500/15 px-1.5 py-0.5 rounded">
                  Tier A
                </span>
              )}
              {tournament.prizepool && (
                <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  Prize Pool: {tournament.prizepool}
                </span>
              )}
            </div>
            {dateLabel && (
              <span className="text-[11px] text-theme-400 dark:text-theme-500 mt-0.5">{dateLabel}</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-theme-400 hover:text-theme-700 dark:text-theme-500 dark:hover:text-theme-200 transition-colors leading-none text-base mt-0.5"
          >
            ✕
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* Scheduled matches */}
          {isLoading ? (
            <div className="flex flex-col gap-1.5">
              <PulseRow /><PulseRow /><PulseRow />
            </div>
          ) : error ? (
            <ErrorState message="Failed to load scheduled matches" onRetry={() => mutate()} />
          ) : matches.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-theme-400 dark:text-theme-500 mb-1.5">
                Schedule — {matches.length} match{matches.length !== 1 ? "es" : ""}
              </p>
              {visibleEntries.map(([dateKey, dayMatches]) => (
                <div key={dateKey} className="mb-3 last:mb-0">
                  <p className="text-[10px] font-semibold text-theme-500 dark:text-theme-400 mb-1 px-1">
                    {formatDayLabel(dateKey, { relative: false, includeYear: true })}
                  </p>
                  {dayMatches.map((match) => (
                    <ScheduledMatchRow key={match.id} match={match} />
                  ))}
                </div>
              ))}
              {hiddenDays > 0 && (
                <button
                  type="button"
                  onClick={() => setVisibleDays((d) => d + 2)}
                  className="w-full mt-1 py-1.5 text-[10px] text-theme-500 dark:text-theme-400 hover:text-theme-700 dark:hover:text-theme-200 transition-colors text-center rounded-md bg-theme-100 dark:bg-theme-800"
                >
                  Show more · {hiddenDays} day{hiddenDays !== 1 ? "s" : ""} remaining
                </button>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-theme-400 dark:text-theme-500 py-4 text-center">
              No matches scheduled yet
            </div>
          )}

          {/* Participating teams — bottom */}
          {tournament.teams?.length > 0 && (
            <div className="border-t border-theme-200 dark:border-theme-700 pt-3 mt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-theme-400 dark:text-theme-500 mb-1.5">
                Participants
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {tournament.teams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => setSelectedTeam(team)}
                    className="flex items-center gap-1.5 rounded-md bg-theme-100 dark:bg-theme-800 hover:bg-theme-200 dark:hover:bg-theme-700 px-2 py-1.5 min-w-0 transition-colors text-left"
                  >
                    <LogoBox src={team.logo} size="md" />
                    <span className="text-[9px] font-medium text-theme-700 dark:text-theme-200 truncate leading-tight">
                      {team.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );

  return (
    <>
      {modal}
      {selectedTeam && (
        <TeamModal
          teamId={selectedTeam.id}
          teamName={selectedTeam.name}
          teamLogo={selectedTeam.logo}
          onClose={() => setSelectedTeam(null)}
        />
      )}
    </>
  );
}
