import { DateTime } from "luxon";
import { useTranslation } from "next-i18next";
import { useState } from "react";
import useSWR from "swr";

import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";

const TIER_LABELS = { s: "Tier 1", a: "Tier 2", b: "Tier 3" };

function SectionLabel({ children }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wide text-theme-500 dark:text-theme-400 mb-0.5 mt-1.5 first:mt-0">
      {children}
    </div>
  );
}

function PulseRow() {
  return <div className="h-7 w-full rounded-sm bg-theme-200/50 dark:bg-theme-900/20 mb-0.5 animate-pulse" />;
}

function TeamLogo({ src, alt }) {
  if (!src) return null;
  return <img src={src} alt={alt} className="h-3.5 w-3.5 object-contain shrink-0" />;
}

function MatchRow({ match, live }) {
  const beginAt = match.beginAt ? DateTime.fromISO(match.beginAt) : null;

  return (
    <div className="flex flex-col rounded-sm bg-theme-200/50 dark:bg-theme-900/20 px-1.5 py-0.5 mb-0.5">
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-0.5 text-xs text-theme-700 dark:text-theme-200 min-w-0 truncate">
          <TeamLogo src={match.team1Logo} alt={match.team1} />
          <span className="truncate">{match.team1}</span>
          <span className="mx-0.5 text-theme-400 dark:text-theme-500 shrink-0">vs</span>
          <TeamLogo src={match.team2Logo} alt={match.team2} />
          <span className="truncate">{match.team2}</span>
        </span>
        {live ? (
          <span className="shrink-0 text-[9px] font-bold text-red-500">● LIVE</span>
        ) : (
          <span className="shrink-0 text-[10px] text-theme-400 dark:text-theme-500">
            {beginAt ? beginAt.toRelative() : ""}
          </span>
        )}
      </div>
      {match.leagueName && (
        <span className="text-[10px] text-theme-500 dark:text-theme-400 truncate">{match.leagueName}</span>
      )}
    </div>
  );
}

// Match row for schedule display inside a running tournament
function ScheduledMatchRow({ match, live }) {
  const beginAt = match.beginAt ? DateTime.fromISO(match.beginAt) : null;

  return (
    <div className="flex items-center gap-1.5 rounded-sm bg-theme-200/50 dark:bg-theme-900/20 px-1.5 py-0.5 mb-0.5 text-[10px]">
      <div className="flex items-center gap-0.5 flex-1 min-w-0">
        {match.team1Logo && (
          <img src={match.team1Logo} alt={match.team1Name} className="h-3 w-3 object-contain shrink-0" />
        )}
        <span className="text-theme-600 dark:text-theme-300 truncate">{match.team1Name}</span>
        <span className="text-theme-400 dark:text-theme-500 mx-0.5 shrink-0">vs</span>
        {match.team2Logo && (
          <img src={match.team2Logo} alt={match.team2Name} className="h-3 w-3 object-contain shrink-0" />
        )}
        <span className="text-theme-600 dark:text-theme-300 truncate">{match.team2Name}</span>
      </div>
      <div className="shrink-0 flex items-center gap-1">
        {match.numberOfGames && (
          <span className="text-theme-400 dark:text-theme-500">Bo{match.numberOfGames}</span>
        )}
        {live ? (
          <span className="font-bold text-red-500">● LIVE</span>
        ) : (
          beginAt && <span className="text-theme-400 dark:text-theme-500">{beginAt.toRelative()}</span>
        )}
      </div>
    </div>
  );
}

// winsNeeded: Bo1→1, Bo2→2, Bo3→2, Bo5→3 (Math.floor(n/2)+1)
function winsNeeded(numberOfGames) {
  return Math.floor((numberOfGames ?? 3) / 2) + 1;
}

// Collapsible series row: STRATZ-inspired layout.
// Collapsed: team logo+name on each side, vertical pips + score + BoN label in centre.
// Expanded: per-game rows showing kills | duration | kills with winner highlighting.
function SeriesRow({ series }) {
  const [expanded, setExpanded] = useState(false);

  const { team1Id, team1Name, team1Logo, team2Id, team2Name, team2Logo, winnerId, games, numberOfGames } = series;

  const team1Wins = games.filter((g) => g.winnerId === team1Id).length;
  const team2Wins = games.filter((g) => g.winnerId === team2Id).length;
  const pipCount = winsNeeded(numberOfGames);

  const team1Won = winnerId !== null && winnerId === team1Id;
  const team2Won = winnerId !== null && winnerId === team2Id;

  const nameClass = (won) =>
    won
      ? "text-[10px] font-semibold text-theme-700 dark:text-theme-200 truncate"
      : "text-[10px] text-theme-400 dark:text-theme-500 truncate";

  return (
    <div className="mb-1 rounded-md overflow-hidden bg-theme-200/30 dark:bg-theme-900/15">
      {/* Collapsed header */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-theme-200/50 dark:hover:bg-theme-900/30 transition-colors"
      >
        {/* Team 1: logo + name */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {team1Logo ? (
            <img src={team1Logo} alt={team1Name} className="h-5 w-5 object-contain shrink-0" />
          ) : (
            <div className="h-5 w-5 shrink-0" />
          )}
          <span className={nameClass(team1Won)}>{team1Name}</span>
        </div>

        {/* Centre: pips + score + BoN */}
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <div className="flex items-start gap-1.5">
            {/* Team 1 pips */}
            <div className="flex flex-col gap-0.75">
              {Array.from({ length: pipCount }, (_, i) => (
                <span
                  key={i}
                  className={`block w-2 h-2 rounded-full ${i < team1Wins ? "bg-emerald-400 dark:bg-emerald-500" : "bg-theme-300/50 dark:bg-theme-700/50"}`}
                />
              ))}
            </div>
            {/* Score */}
            <span className="text-xs font-bold tabular-nums text-theme-700 dark:text-theme-200 leading-none self-center">
              {team1Wins}–{team2Wins}
            </span>
            {/* Team 2 pips */}
            <div className="flex flex-col gap-0.75">
              {Array.from({ length: pipCount }, (_, i) => (
                <span
                  key={i}
                  className={`block w-2 h-2 rounded-full ${i < team2Wins ? "bg-emerald-400 dark:bg-emerald-500" : "bg-theme-300/50 dark:bg-theme-700/50"}`}
                />
              ))}
            </div>
          </div>
          {numberOfGames && (
            <span className="text-[8px] text-theme-400 dark:text-theme-500 leading-none">
              Bo{numberOfGames}
            </span>
          )}
        </div>

        {/* Team 2: name + logo */}
        <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
          <span className={`${nameClass(team2Won)} text-right`}>{team2Name}</span>
          {team2Logo ? (
            <img src={team2Logo} alt={team2Name} className="h-5 w-5 object-contain shrink-0" />
          ) : (
            <div className="h-5 w-5 shrink-0" />
          )}
        </div>

        <span className="shrink-0 text-[9px] text-theme-400 dark:text-theme-500 select-none">
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      {/* Expanded: individual game rows */}
      {expanded && (
        <div className="border-t border-theme-300/20 dark:border-theme-700/20 px-2 py-1 flex flex-col gap-px">
          {games.map((game, idx) => {
            const t1Won = game.winnerId === team1Id;
            const duration = game.length
              ? `${Math.floor(game.length / 60)}:${String(game.length % 60).padStart(2, "0")}`
              : null;

            return (
              <div key={game.id} className="flex items-center gap-1 py-0.5 text-[9px] leading-none">
                {/* Game label */}
                <span className="shrink-0 w-4 text-theme-300 dark:text-theme-600 font-medium">
                  G{idx + 1}
                </span>

                {/* Team 1 side */}
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <span
                    className={`h-1.5 w-1.5 rounded-full shrink-0 ${t1Won ? "bg-emerald-400 dark:bg-emerald-500" : "bg-theme-300/40 dark:bg-theme-700/40"}`}
                  />
                  <span
                    className={`truncate ${t1Won ? "text-theme-600 dark:text-theme-300 font-semibold" : "text-theme-400 dark:text-theme-500"}`}
                  >
                    {team1Name}
                  </span>
                  {game.team1Score !== null && (
                    <span
                      className={`shrink-0 tabular-nums font-bold ml-auto ${t1Won ? "text-emerald-500 dark:text-emerald-400" : "text-theme-400 dark:text-theme-500"}`}
                    >
                      {game.team1Score}
                    </span>
                  )}
                </div>

                {/* Duration */}
                {duration && (
                  <span className="shrink-0 tabular-nums text-theme-400 dark:text-theme-500 px-1.5 text-[8px]">
                    {duration}
                  </span>
                )}

                {/* Team 2 side */}
                <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
                  {game.team2Score !== null && (
                    <span
                      className={`shrink-0 tabular-nums font-bold mr-auto ${!t1Won ? "text-emerald-500 dark:text-emerald-400" : "text-theme-400 dark:text-theme-500"}`}
                    >
                      {game.team2Score}
                    </span>
                  )}
                  <span
                    className={`truncate text-right ${!t1Won ? "text-theme-600 dark:text-theme-300 font-semibold" : "text-theme-400 dark:text-theme-500"}`}
                  >
                    {team2Name}
                  </span>
                  <span
                    className={`h-1.5 w-1.5 rounded-full shrink-0 ${!t1Won ? "bg-emerald-400 dark:bg-emerald-500" : "bg-theme-300/40 dark:bg-theme-700/40"}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RunningTournamentRow({ tournament, isExpanded, onToggle, schedule, scheduleLoading }) {
  const begin = tournament.beginAt ? DateTime.fromISO(tournament.beginAt) : null;
  const end = tournament.endAt ? DateTime.fromISO(tournament.endAt) : null;
  const dateRange =
    begin && end ? `${begin.toFormat("d MMM")} – ${end.toFormat("d MMM")}` : (begin?.toFormat("d MMM yyyy") ?? "");

  const seasonLabel = tournament.season ? `Season ${tournament.season}` : "";
  const title = [tournament.leagueName, seasonLabel].filter(Boolean).join(" - ");
  const subtitle = tournament.name ?? "";
  const teams = tournament.teams ?? [];

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between rounded-sm bg-theme-200/50 dark:bg-theme-900/20 px-1.5 py-0.5 gap-1 text-left hover:bg-theme-200/80 dark:hover:bg-theme-900/40 transition-colors"
      >
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs text-theme-700 dark:text-theme-200 truncate">{title}</span>
          {subtitle && <span className="text-[10px] text-theme-500 dark:text-theme-400 truncate">{subtitle}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex flex-col items-end">
            {tournament.tier && (
              <span className="text-[10px] text-theme-500 dark:text-theme-400">
                {TIER_LABELS[tournament.tier] ?? tournament.tier.toUpperCase()}
              </span>
            )}
            {dateRange && <span className="text-[10px] text-theme-400 dark:text-theme-500">{dateRange}</span>}
          </div>
          <span className="text-[10px] text-theme-400 dark:text-theme-500 select-none">{isExpanded ? "▾" : "▸"}</span>
        </div>
      </button>

      {isExpanded && (
        <div className="mt-px ml-1.5 border-l border-theme-300/40 dark:border-theme-700/40 pl-1.5 pt-0.5">
          {scheduleLoading ? (
            <>
              <PulseRow />
              <PulseRow />
            </>
          ) : (
            <>
              {/* Participating teams */}
              {teams.length > 0 && (
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mb-1.5">
                  {teams.map((team) => (
                    <div key={team.id} className="flex items-center gap-0.5 min-w-0">
                      {team.logo ? (
                        <img src={team.logo} alt={team.name} className="h-3 w-3 object-contain shrink-0" />
                      ) : (
                        <div className="h-3 w-3 shrink-0" />
                      )}
                      <span className="text-[9px] text-theme-600 dark:text-theme-300 truncate">{team.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Live now */}
              {schedule.live.length > 0 && (
                <>
                  <SectionLabel>Live</SectionLabel>
                  {schedule.live.map((m) => (
                    <ScheduledMatchRow key={m.id} match={m} live />
                  ))}
                </>
              )}

              {/* Upcoming matches */}
              {schedule.upcoming.length > 0 && (
                <>
                  <SectionLabel>Upcoming</SectionLabel>
                  {schedule.upcoming.map((m) => (
                    <ScheduledMatchRow key={m.id} match={m} />
                  ))}
                </>
              )}

              {/* Past results */}
              {schedule.past.length > 0 && (
                <>
                  <SectionLabel>Results</SectionLabel>
                  {[...schedule.past]
                    .sort((a, b) => (b.beginAt ?? "").localeCompare(a.beginAt ?? ""))
                    .map((s) => (
                      <SeriesRow key={s.id} series={s} />
                    ))}
                </>
              )}

              {!schedule.live.length && !schedule.upcoming.length && !schedule.past.length && (
                <div className="text-[10px] text-theme-500 dark:text-theme-400 py-0.5 text-center">
                  No match data available
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CompletedTournamentRow({ tournament, isExpanded, onToggle, series, seriesLoading }) {
  const endedAt = tournament.endAt ? DateTime.fromISO(tournament.endAt).toRelative() : null;
  const teams = tournament.teams ?? [];

  const seasonLabel = tournament.season ? `Season ${tournament.season}` : "";
  const title = [tournament.leagueName, seasonLabel].filter(Boolean).join(" - ");
  const subtitle = tournament.name ?? "";

  return (
    <div className="mb-0.5">
      {/* Clickable header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between rounded-sm bg-theme-200/50 dark:bg-theme-900/20 px-1.5 py-0.5 gap-1 text-left hover:bg-theme-200/80 dark:hover:bg-theme-900/40 transition-colors"
      >
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs text-theme-700 dark:text-theme-200 truncate">{title}</span>
          {subtitle && <span className="text-[10px] text-theme-500 dark:text-theme-400 truncate">{subtitle}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex flex-col items-end">
            {tournament.tier && (
              <span className="text-[10px] text-theme-500 dark:text-theme-400">
                {TIER_LABELS[tournament.tier] ?? tournament.tier.toUpperCase()}
              </span>
            )}
            {endedAt && <span className="text-[10px] text-theme-400 dark:text-theme-500">{endedAt}</span>}
          </div>
          <span className="text-[10px] text-theme-400 dark:text-theme-500 select-none">{isExpanded ? "▾" : "▸"}</span>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-px ml-1.5 border-l border-theme-300/40 dark:border-theme-700/40 pl-1.5 pt-0.5">
          {seriesLoading ? (
            <>
              <PulseRow />
              <PulseRow />
            </>
          ) : (
            <>
              {/* Participating teams — 2-column grid */}
              {teams.length > 0 && (
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mb-1.5">
                  {teams.map((team) => (
                    <div key={team.id} className="flex items-center gap-0.5 min-w-0">
                      {team.logo ? (
                        <img src={team.logo} alt={team.name} className="h-3 w-3 object-contain shrink-0" />
                      ) : (
                        <div className="h-3 w-3 shrink-0" />
                      )}
                      <span className="text-[9px] text-theme-600 dark:text-theme-300 truncate">{team.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Series results */}
              {series.length > 0 ? (
                <div className={teams.length > 0 ? "border-t border-theme-300/20 dark:border-theme-700/20 pt-1" : ""}>
                  {[...series]
                    .sort((a, b) => (b.beginAt ?? "").localeCompare(a.beginAt ?? ""))
                    .map((s) => (
                      <SeriesRow key={s.id} series={s} />
                    ))}
                </div>
              ) : (
                <div className="text-[10px] text-theme-500 dark:text-theme-400 py-0.5 text-center">
                  No data available
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const [expandedRunningId, setExpandedRunningId] = useState(null);
  const [expandedCompletedId, setExpandedCompletedId] = useState(null);

  const { data: liveData, error: liveError } = useWidgetAPI(widget, "live_matches");
  const { data: upcomingData, error: upcomingError } = useWidgetAPI(widget, "upcoming_matches");
  const { data: runningTournamentsData, error: runningTournamentsError } = useWidgetAPI(widget, "running_tournaments");
  const { data: upcomingTournamentsData, error: upcomingTournamentsError } = useWidgetAPI(
    widget,
    "upcoming_tournaments",
  );
  const { data: completedTournamentsData } = useWidgetAPI(widget, "completed_tournaments");

  // Schedule for the expanded running tournament (live + upcoming + past)
  const { data: scheduleData, isLoading: scheduleLoading } = useSWR(
    expandedRunningId ? `/api/widgets/dota2?tournamentId=${expandedRunningId}&mode=schedule` : null,
    { revalidateOnFocus: false },
  );

  // Past series for the expanded completed tournament
  const { data: expandedSeriesData, isLoading: expandedSeriesLoading } = useSWR(
    expandedCompletedId ? `/api/widgets/dota2?tournamentId=${expandedCompletedId}` : null,
    { revalidateOnFocus: false },
  );

  if (liveError && upcomingError && !liveData && !upcomingData) {
    return <Container service={service} error={liveError} />;
  }

  const liveMatches = Array.isArray(liveData) ? liveData : [];
  const upcomingMatches = Array.isArray(upcomingData) ? upcomingData : [];
  const runningTournaments = Array.isArray(runningTournamentsData) ? runningTournamentsData : [];
  const upcomingTournaments = Array.isArray(upcomingTournamentsData) ? upcomingTournamentsData : [];
  const completedTournaments = Array.isArray(completedTournamentsData) ? completedTournamentsData : [];

  const matchesLoading = !liveData && !liveError && !upcomingData && !upcomingError;
  const tournamentsLoading =
    !runningTournamentsData && !runningTournamentsError && !upcomingTournamentsData && !upcomingTournamentsError;

  const emptySchedule = { live: [], upcoming: [], past: [] };

  return (
    <Container service={service}>
      <div className="flex flex-row w-full gap-3">
        {/* Left panel — Matches */}
        <div className="flex flex-col flex-1 min-w-0">
          {matchesLoading ? (
            <>
              <SectionLabel>{t("dota2.live", "Live")}</SectionLabel>
              <PulseRow />
              <SectionLabel>{t("dota2.upcoming", "Upcoming")}</SectionLabel>
              <PulseRow />
              <PulseRow />
            </>
          ) : (
            <>
              {liveMatches.length > 0 && (
                <>
                  <SectionLabel>{t("dota2.live", "Live")}</SectionLabel>
                  {liveMatches.map((match) => (
                    <MatchRow key={match.id} match={match} live />
                  ))}
                </>
              )}

              <SectionLabel>{t("dota2.upcoming", "Upcoming")}</SectionLabel>
              {upcomingMatches.length === 0 ? (
                <div className="text-[10px] text-theme-500 dark:text-theme-400 text-center py-1">
                  {t("dota2.noMatches", "No matches scheduled")}
                </div>
              ) : (
                upcomingMatches.map((match) => <MatchRow key={match.id} match={match} live={false} />)
              )}
            </>
          )}
        </div>

        {/* Right panel — Tournaments */}
        <div className="flex flex-col flex-1 min-w-0">
          {tournamentsLoading ? (
            <>
              <SectionLabel>{t("dota2.ongoing", "Ongoing")}</SectionLabel>
              <PulseRow />
              <SectionLabel>{t("dota2.upcoming", "Upcoming")}</SectionLabel>
              <PulseRow />
              <PulseRow />
            </>
          ) : (
            <>
              {runningTournaments.length > 0 && (
                <>
                  <SectionLabel>{t("dota2.ongoing", "Ongoing")}</SectionLabel>
                  {runningTournaments.map((tournament) => (
                    <RunningTournamentRow
                      key={tournament.id}
                      tournament={tournament}
                      isExpanded={expandedRunningId === tournament.id}
                      onToggle={() => setExpandedRunningId((prev) => (prev === tournament.id ? null : tournament.id))}
                      schedule={expandedRunningId === tournament.id ? (scheduleData ?? emptySchedule) : emptySchedule}
                      scheduleLoading={expandedRunningId === tournament.id && scheduleLoading}
                    />
                  ))}
                </>
              )}

              {upcomingTournaments.length > 0 && (
                <>
                  <SectionLabel>{t("dota2.upcoming", "Upcoming")}</SectionLabel>
                  {upcomingTournaments.map((tournament) => (
                    <div
                      key={tournament.id}
                      className="flex flex-col rounded-sm bg-theme-200/50 dark:bg-theme-900/20 px-1.5 py-0.5 mb-0.5"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs text-theme-700 dark:text-theme-200 truncate">
                          {[tournament.leagueName, tournament.season ? `Season ${tournament.season}` : ""]
                            .filter(Boolean)
                            .join(" - ")}
                        </span>
                        {tournament.prizepool && (
                          <span className="shrink-0 text-[10px] text-theme-500 dark:text-theme-400">
                            {tournament.prizepool}
                          </span>
                        )}
                      </div>
                      {tournament.name && (
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] text-theme-500 dark:text-theme-400 truncate">
                            {tournament.name}
                          </span>
                          {tournament.beginAt && (
                            <span className="shrink-0 text-[10px] text-theme-400 dark:text-theme-500">
                              {DateTime.fromISO(tournament.beginAt).toFormat("d MMM")}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}

              {completedTournaments.length > 0 && (
                <>
                  <SectionLabel>{t("dota2.completed", "Completed")}</SectionLabel>
                  {completedTournaments.map((tournament) => (
                    <CompletedTournamentRow
                      key={tournament.id}
                      tournament={tournament}
                      isExpanded={expandedCompletedId === tournament.id}
                      onToggle={() =>
                        setExpandedCompletedId((prev) => (prev === tournament.id ? null : tournament.id))
                      }
                      series={expandedCompletedId === tournament.id ? (expandedSeriesData?.series ?? []) : []}
                      seriesLoading={expandedCompletedId === tournament.id && expandedSeriesLoading}
                    />
                  ))}
                </>
              )}

              {!runningTournamentsError &&
                !upcomingTournamentsError &&
                runningTournaments.length === 0 &&
                upcomingTournaments.length === 0 &&
                completedTournaments.length === 0 && (
                  <div className="text-[10px] text-theme-500 dark:text-theme-400 text-center py-1">
                    {t("dota2.noTournaments", "No tournaments")}
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </Container>
  );
}
