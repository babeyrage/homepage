import { DateTime } from "luxon";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { LogoBox } from "../ui/primitives";
import { formatDayLabel, groupMatchesByDay, useBodyScrollLock, useEscapeToClose } from "../ui/utils";
import { TeamModal } from "../modals/TeamModal";
import { ModalMatchRow } from "../matches/MatchRow";
import { SeriesRow } from "../matches/SeriesRow";

// ── Tournament modal (CitoAPI — matches are client-side-filtered from the ── //
// widget's already-fetched live/upcoming/recent lists by tournamentId; there is
// no dedicated tournament-scoped matches endpoint in use here).

const PAGE_SIZE = 10;

function collectParticipants(matchLists) {
  const byId = new Map();
  for (const list of matchLists) {
    for (const m of list) {
      if (m.team1Id != null && !byId.has(m.team1Id)) {
        byId.set(m.team1Id, { teamId: m.team1Id, name: m.team1, logo: m.team1Logo });
      }
      if (m.team2Id != null && !byId.has(m.team2Id)) {
        byId.set(m.team2Id, { teamId: m.team2Id, name: m.team2, logo: m.team2Logo });
      }
    }
  }
  return Array.from(byId.values());
}

export function TournamentModal({ tournament, status, liveMatches, upcomingMatches, recentMatches, widget, onClose }) {
  const { id, name, imageUrl, prizePool, currency, startsAt, endsAt } = tournament;

  const begin = startsAt ? DateTime.fromISO(startsAt) : null;
  const end = endsAt ? DateTime.fromISO(endsAt) : null;
  const dateLabel =
    begin && end
      ? `${begin.toFormat("d MMM")} – ${end.toFormat("d MMM yyyy")}`
      : begin
        ? `From ${begin.toFormat("d MMM yyyy")}`
        : "";

  const liveForTournament = useMemo(() => liveMatches.filter((m) => m.tournamentId === id), [liveMatches, id]);
  const upcomingForTournament = useMemo(() => upcomingMatches.filter((m) => m.tournamentId === id), [upcomingMatches, id]);
  const recentForTournament = useMemo(() => recentMatches.filter((m) => m.tournamentId === id), [recentMatches, id]);

  const participants = useMemo(
    () => collectParticipants([liveForTournament, upcomingForTournament, recentForTournament]),
    [liveForTournament, upcomingForTournament, recentForTournament],
  );

  const [visibleResults, setVisibleResults] = useState(PAGE_SIZE);
  const [visibleDays, setVisibleDays] = useState(2);
  const [selectedTeam, setSelectedTeam] = useState(null);

  const visibleRecent = recentForTournament.slice(0, visibleResults);
  const hasMoreResults = recentForTournament.length > visibleResults;
  const remainingResults = recentForTournament.length - visibleResults;

  const upcomingByDate = groupMatchesByDay(upcomingForTournament);
  const upcomingDateEntries = Object.entries(upcomingByDate).sort(([a], [b]) => a.localeCompare(b));
  const visibleUpcomingEntries = upcomingDateEntries.slice(0, visibleDays);
  const hiddenDays = upcomingDateEntries.length - visibleDays;

  const hasAnyMatches = liveForTournament.length > 0 || upcomingForTournament.length > 0 || recentForTournament.length > 0;

  useEscapeToClose(onClose);
  useBodyScrollLock();

  const modal = createPortal(
    // Backdrop — click outside to close
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal panel */}
      <div
        className="relative w-full max-w-2xl max-h-[95vh] flex flex-col rounded-none sm:rounded-xl bg-theme-100 dark:bg-theme-900 shadow-2xl overflow-hidden mx-0 sm:mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Banner ── */}
        <div className="relative h-44 w-full shrink-0 bg-theme-800 overflow-hidden">
          {imageUrl ? (
            <img src={imageUrl} alt={name} className="w-full h-full object-cover object-center" />
          ) : (
            <div className="w-full h-full bg-linear-to-br from-theme-700 to-theme-900" />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-black/10" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-2 right-2 text-white/70 hover:text-white transition-colors leading-none text-base bg-black/40 rounded-full w-6 h-6 flex items-center justify-center"
          >
            ✕
          </button>
          <div className="absolute bottom-3 left-3 right-10 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {status === "live" && (
                <span className="flex items-center gap-1 text-[9px] font-bold text-red-400 uppercase tracking-wide bg-black/50 px-1.5 py-0.5 rounded">
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-400" />
                  </span>
                  Live
                </span>
              )}
              {status === "upcoming" && (
                <span className="text-[9px] font-bold text-sky-400 uppercase tracking-wide bg-black/50 px-1.5 py-0.5 rounded">
                  Upcoming
                </span>
              )}
              {status === "completed" && (
                <span className="text-[9px] font-bold text-theme-300 uppercase tracking-wide bg-black/50 px-1.5 py-0.5 rounded">
                  Completed
                </span>
              )}
              {prizePool && (
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide bg-black/50 px-1.5 py-0.5 rounded">
                  {currency ?? "$"}{Number(prizePool).toLocaleString()}
                </span>
              )}
            </div>
            {/* Tournament name */}
            <span
              className="text-base font-bold text-white leading-tight"
              style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}
            >
              {name}
            </span>
            {/* Date range */}
            {dateLabel && (
              <span
                className="text-[11px] font-medium text-white/80"
                style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
              >
                {dateLabel}
              </span>
            )}
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* Participants — top */}
          {participants.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-theme-400 dark:text-theme-500 mb-1.5">
                Participants — {participants.length} teams
              </p>
              <div className={`grid gap-1 ${participants.length > 8 ? "grid-cols-3" : "grid-cols-2"}`}>
                {participants.map((team) => (
                  <button
                    key={team.teamId}
                    type="button"
                    onClick={() => setSelectedTeam(team)}
                    className="flex items-center gap-1.5 rounded-md bg-theme-100 dark:bg-theme-800 hover:bg-theme-200 dark:hover:bg-theme-700 px-2 py-1.5 min-w-0 transition-colors text-left"
                  >
                    <LogoBox src={team.logo} size="sm" />
                    <span className={`font-medium text-theme-700 dark:text-theme-200 truncate leading-tight ${participants.length > 8 ? "text-[9px]" : "text-[10px]"}`}>
                      {team.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Live series */}
          {liveForTournament.length > 0 && (
            <div className="border-t border-theme-200 dark:border-theme-700 pt-3 mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-theme-400 dark:text-theme-500 mb-1.5">
                Live — {liveForTournament.length} match{liveForTournament.length !== 1 ? "es" : ""}
              </p>
              {liveForTournament.map((m) => <SeriesRow key={m.id} series={m} widget={widget} />)}
            </div>
          )}

          {/* Upcoming schedule */}
          {upcomingForTournament.length > 0 && (
            <div className="border-t border-theme-200 dark:border-theme-700 pt-3 mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-theme-400 dark:text-theme-500 mb-1.5">
                Schedule — {upcomingForTournament.length} match{upcomingForTournament.length !== 1 ? "es" : ""}
              </p>
              {visibleUpcomingEntries.map(([dateKey, dayMatches]) => (
                <div key={dateKey} className="mb-3 last:mb-0">
                  <p className="text-[10px] font-semibold text-theme-500 dark:text-theme-400 mb-1 px-1">
                    {formatDayLabel(dateKey, { relative: false, includeYear: true })}
                  </p>
                  {dayMatches.map((match) => <ModalMatchRow key={match.id} match={match} />)}
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
          )}

          {/* Results */}
          {recentForTournament.length > 0 && (
            <div className="border-t border-theme-200 dark:border-theme-700 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-theme-400 dark:text-theme-500 mb-1.5">
                Results — {recentForTournament.length} series
              </p>
              {visibleRecent.map((s) => <SeriesRow key={s.id} series={s} widget={widget} />)}
              {hasMoreResults && (
                <button
                  type="button"
                  onClick={() => setVisibleResults((c) => c + PAGE_SIZE)}
                  className="w-full mt-1 py-1.5 text-[10px] text-theme-500 dark:text-theme-400 hover:text-theme-700 dark:hover:text-theme-200 transition-colors text-center rounded-md bg-theme-100 dark:bg-theme-800"
                >
                  Show {Math.min(remainingResults, PAGE_SIZE)} more · {remainingResults} remaining
                </button>
              )}
              {visibleResults > PAGE_SIZE && (
                <button
                  type="button"
                  onClick={() => setVisibleResults(PAGE_SIZE)}
                  className="w-full mt-0.5 py-1 text-[10px] text-theme-400 dark:text-theme-500 hover:text-theme-700 dark:hover:text-theme-200 transition-colors text-center"
                >
                  Show less
                </button>
              )}
            </div>
          )}

          {!hasAnyMatches && (
            <div className="text-[11px] text-theme-400 dark:text-theme-500 py-4 text-center">
              No match data available
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
          teamId={selectedTeam.teamId}
          teamName={selectedTeam.name}
          teamLogo={selectedTeam.logo}
          onClose={() => setSelectedTeam(null)}
        />
      )}
    </>
  );
}
