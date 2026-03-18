import { DateTime } from "luxon";
import { useTranslation } from "next-i18next";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";

import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";

// ── Shared UI primitives ──────────────────────────────────────────────────────

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

// Static size map — all strings are literals so Tailwind JIT picks them up
const LOGO_SIZES = {
  xs: { box: "h-4 w-4", img: "h-3 w-3" },   // per-game rows inside a series
  sm: { box: "h-5 w-5", img: "h-4 w-4" },   // PandaScore match rows
  md: { box: "h-6 w-6", img: "h-5 w-5" },   // series header
  lg: { box: "h-7 w-7", img: "h-6 w-6" },   // teams grid
};

// Fixed-size container that normalises every logo to the same visual footprint.
// overflow-hidden clips wide/tall logos; the neutral background fills transparent areas.
function LogoBox({ src, alt = "", size = "md" }) {
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

// ── PandaScore live / upcoming match row ──────────────────────────────────────

function MatchRow({ match, live }) {
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
              {beginAt ? beginAt.toRelative() : ""}
            </span>
          )}
        </div>
      </div>

      {/* League name */}
      {match.leagueName && (
        <span className="text-[9px] text-theme-500 dark:text-theme-400 truncate">{match.leagueName}</span>
      )}
    </div>
  );
}

// ── Hero portrait icon ────────────────────────────────────────────────────────

function HeroIcon({ hero }) {
  return (
    <div className="h-7 w-5.5 shrink-0 rounded-sm overflow-hidden bg-black/30 dark:bg-black/50 ring-1 ring-white/10">
      {hero?.img && (
        <img src={hero.img} alt={hero.name ?? ""} className="h-full w-full object-cover object-top" title={hero.name} />
      )}
    </div>
  );
}

// Radiant (R) / Dire (D) faction badge
function SideBadge({ isRadiant }) {
  return (
    <span
      className={`shrink-0 text-[7px] font-bold leading-none px-0.5 py-px rounded ${
        isRadiant
          ? "text-emerald-400 bg-emerald-400/15 ring-1 ring-emerald-400/30"
          : "text-red-400 bg-red-400/15 ring-1 ring-red-400/30"
      }`}
    >
      {isRadiant ? "R" : "D"}
    </span>
  );
}

// ── Shared grid column template ───────────────────────────────────────────────
// Used by BOTH the series header button and the game-rows container so that
// columns 3 & 5 (the pip columns) sit at the exact same horizontal position.
//  col 1: label         4.5rem  — "Finished\n17 Mar, 14:32" or "G#"
//  col 2: left team     1fr     — team name+logo / badges+heroes
//  col 3: left pip      6px     — win pip dot
//  col 4: separator     3rem    — "vs" text / kill score
//  col 5: right pip     6px     — win pip dot
//  col 6: right team    1fr     — team logo+name / heroes+badges
//  col 7: meta          3.5rem  — "Bo3 +/-" / duration
const SERIES_GRID = "4.5rem 1fr 6px 3rem 6px 1fr 3.5rem";

// ── Individual game row — returns 7 Fragment cells for the shared grid ─────────

function GameRow({ game, idx, team1Id }) {
  const { data, isLoading } = useSWR(
    `/api/widgets/dota2?mode=match&matchId=${game.id}`,
    { revalidateOnFocus: false },
  );

  const t1Won = game.winnerId === team1Id;
  const duration = game.length
    ? `${Math.floor(game.length / 60)}:${String(game.length % 60).padStart(2, "0")}`
    : null;

  if (isLoading || !data) {
    // Single full-span cell while loading
    return (
      <div
        style={{ gridColumn: "1 / -1" }}
        className="h-8 rounded-sm bg-theme-200/30 dark:bg-theme-900/15 animate-pulse my-px"
      />
    );
  }

  const { radiantPicks, direPicks, firstPickIsRadiant } = data;
  const t1IsRadiant = game.team1IsRadiant ?? true;

  const leftPicks  = t1IsRadiant ? radiantPicks : direPicks;
  const rightPicks = t1IsRadiant ? direPicks    : radiantPicks;

  const showFirstPick = firstPickIsRadiant !== null && firstPickIsRadiant !== undefined;
  const leftHasFirstPick  = showFirstPick && (t1IsRadiant === firstPickIsRadiant);
  const rightHasFirstPick = showFirstPick && (t1IsRadiant !== firstPickIsRadiant);

  const FirstPickBadge = () => (
    <span className="shrink-0 text-[7px] font-bold text-sky-400 uppercase tracking-wide bg-sky-400/10 ring-1 ring-sky-400/30 px-1 py-px rounded leading-none">
      1st
    </span>
  );

  return (
    <>
      {/* Col 1: game label */}
      <span className="text-[9px] text-theme-400 dark:text-theme-500 font-medium tabular-nums leading-none py-1.5">
        G{idx + 1}
      </span>

      {/* Col 2: left team — badges right-aligned, heroes flush against pip */}
      <div className="flex items-center gap-1 justify-end py-1.5 min-w-0">
        {leftHasFirstPick && <FirstPickBadge />}
        <SideBadge isRadiant={t1IsRadiant} />
        <div className="flex items-center gap-px">
          {leftPicks.slice(0, 5).map((hero, i) => <HeroIcon key={i} hero={hero} />)}
        </div>
      </div>

      {/* Col 3: left win pip — vertically centred in cell */}
      <span
        className={`block w-1.5 h-1.5 rounded-full mx-auto ${t1Won ? "bg-emerald-400 dark:bg-emerald-500" : "bg-theme-300/50 dark:bg-theme-700/50"}`}
      />

      {/* Col 4: kill score */}
      <span className="text-[9px] font-bold tabular-nums text-theme-700 dark:text-theme-200 text-center py-1.5 leading-none">
        {game.team1Score}–{game.team2Score}
      </span>

      {/* Col 5: right win pip */}
      <span
        className={`block w-1.5 h-1.5 rounded-full mx-auto ${!t1Won ? "bg-emerald-400 dark:bg-emerald-500" : "bg-theme-300/50 dark:bg-theme-700/50"}`}
      />

      {/* Col 6: right team — heroes flush against pip, badges left-aligned */}
      <div className="flex items-center gap-1 py-1.5 min-w-0">
        <div className="flex items-center gap-px">
          {rightPicks.slice(0, 5).map((hero, i) => <HeroIcon key={i} hero={hero} />)}
        </div>
        <SideBadge isRadiant={!t1IsRadiant} />
        {rightHasFirstPick && <FirstPickBadge />}
      </div>

      {/* Col 7: duration */}
      <span className="text-[8px] tabular-nums text-theme-400 dark:text-theme-500 py-1.5 leading-none">
        {duration ?? ""}
      </span>
    </>
  );
}

// ── Series row (OpenDota reconstructed series) ────────────────────────────────

function winsNeeded(numberOfGames) {
  return Math.floor((numberOfGames ?? 3) / 2) + 1;
}

function SeriesRow({ series }) {
  const [expanded, setExpanded] = useState(false);

  const { team1Id, team1Name, team1Logo, team2Id, team2Name, team2Logo, winnerId, games, numberOfGames } = series;

  const team1Wins = games.filter((g) => g.winnerId === team1Id).length;
  const team2Wins = games.filter((g) => g.winnerId === team2Id).length;
  const pipCount = winsNeeded(numberOfGames);

  const team1Won = winnerId !== null && winnerId === team1Id;
  const team2Won = winnerId !== null && winnerId === team2Id;

  const lastGame = games.length > 0 ? games[games.length - 1] : null;
  const finishedAt =
    lastGame?.startTime && lastGame?.length
      ? DateTime.fromSeconds(lastGame.startTime + lastGame.length)
      : null;

  const nameClass = (won) =>
    won
      ? "text-[10px] font-semibold text-theme-700 dark:text-theme-200 truncate"
      : "text-[10px] text-theme-400 dark:text-theme-500 truncate";

  return (
    <div className="mb-1 rounded-md overflow-hidden bg-theme-200/30 dark:bg-theme-900/15">
      {/* ── Header — same SERIES_GRID template as game rows container ── */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full grid items-center gap-x-2 px-2 py-1.5 hover:bg-theme-200/50 dark:hover:bg-theme-900/30 transition-colors"
        style={{ gridTemplateColumns: SERIES_GRID }}
      >
        {/* Col 1: FINISHED + date */}
        <div className="flex flex-col items-start min-w-0">
          <span className="text-[8px] font-bold uppercase tracking-wide text-theme-500 dark:text-theme-400 leading-none">
            Finished
          </span>
          {finishedAt && (
            <span className="text-[8px] text-theme-400 dark:text-theme-500 leading-none tabular-nums mt-px whitespace-nowrap">
              {finishedAt.toFormat("d MMM, HH:mm")}
            </span>
          )}
        </div>

        {/* Col 2: team1 name + logo */}
        <div className="flex items-center gap-1.5 justify-end min-w-0">
          <span className={`${nameClass(team1Won)} text-right`}>{team1Name}</span>
          <LogoBox src={team1Logo} size="md" />
        </div>

        {/* Col 3: team1 win pips — stacked vertically */}
        <div className="flex flex-col items-center gap-0.5">
          {Array.from({ length: pipCount }, (_, i) => (
            <span
              key={i}
              className={`block w-1.5 h-1.5 rounded-full ${i < team1Wins ? "bg-emerald-400 dark:bg-emerald-500" : "bg-theme-300/50 dark:bg-theme-700/50"}`}
            />
          ))}
        </div>

        {/* Col 4: vs */}
        <span className="text-[9px] font-medium text-theme-500 dark:text-theme-400 leading-none text-center">
          vs
        </span>

        {/* Col 5: team2 win pips — stacked vertically */}
        <div className="flex flex-col items-center gap-0.5">
          {Array.from({ length: pipCount }, (_, i) => (
            <span
              key={i}
              className={`block w-1.5 h-1.5 rounded-full ${i < team2Wins ? "bg-emerald-400 dark:bg-emerald-500" : "bg-theme-300/50 dark:bg-theme-700/50"}`}
            />
          ))}
        </div>

        {/* Col 6: team2 logo + name */}
        <div className="flex items-center gap-1.5 min-w-0">
          <LogoBox src={team2Logo} size="md" />
          <span className={nameClass(team2Won)}>{team2Name}</span>
        </div>

        {/* Col 7: Bo3/5 + toggle */}
        <div className="flex items-center justify-between gap-1">
          {numberOfGames && (
            <span className="text-[8px] text-theme-400 dark:text-theme-500 tabular-nums leading-none">
              Bo{numberOfGames}
            </span>
          )}
          <span className="text-sm font-bold text-theme-400 dark:text-theme-500 select-none leading-none">
            {expanded ? "−" : "+"}
          </span>
        </div>
      </button>

      {/* ── Expanded game rows — same SERIES_GRID so pip columns align ── */}
      {expanded && (
        <div
          className="border-t border-theme-300/20 dark:border-theme-700/20 grid items-center gap-x-2 px-2 py-1"
          style={{ gridTemplateColumns: SERIES_GRID }}
        >
          {games.map((game, idx) => (
            <GameRow
              key={game.id}
              game={game}
              idx={idx}
              team1Id={team1Id}
              team2Id={team2Id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tournament modal (portal — renders outside widget container) ──────────────

const PAGE_SIZE = 10;

function TournamentModal({ tournament, onClose }) {
  const { leagueId, isCurrent, name, tierId, first, last } = tournament;

  const begin = first ? DateTime.fromISO(first) : null;
  const end = last ? DateTime.fromISO(last) : null;
  const dateLabel =
    begin && end ? `${begin.toFormat("d MMM")} – ${end.toFormat("d MMM yyyy")}` : "";

  const url = `/api/widgets/dota2?mode=tournament&leagueId=${leagueId}&isCurrent=${isCurrent}`;
  const { data, isLoading } = useSWR(url, { revalidateOnFocus: false });

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const teams = data?.teams ?? [];
  const series = data?.series ?? [];
  const visibleSeries = series.slice(0, visibleCount);
  const hasMore = series.length > visibleCount;
  const remaining = series.length - visibleCount;

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return createPortal(
    // Backdrop — click outside to close
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal panel */}
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{name}</span>
              {tierId === 1 && (
                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wide bg-amber-500/15 px-1.5 py-0.5 rounded">
                  Premium
                </span>
              )}
              {tierId === 2 && (
                <span className="text-[9px] font-bold text-sky-500 uppercase tracking-wide bg-sky-500/15 px-1.5 py-0.5 rounded">
                  Professional
                </span>
              )}
            </div>
            {dateLabel && (
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">{dateLabel}</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200 transition-colors leading-none text-base mt-0.5"
          >
            ✕
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <div className="flex flex-col gap-1.5">
              <PulseRow />
              <PulseRow />
              <PulseRow />
              <PulseRow />
              <PulseRow />
            </div>
          ) : (
            <>
              {/* Participants */}
              {teams.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-1.5">
                    Participants
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {teams.map((team) => (
                      <div
                        key={team.teamId}
                        className="flex items-center gap-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 min-w-0"
                      >
                        <LogoBox src={team.logo} size="md" />
                        <span className="text-[9px] font-medium text-zinc-700 dark:text-zinc-200 truncate leading-tight">
                          {team.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Series results */}
              {series.length > 0 ? (
                <div className={teams.length > 0 ? "border-t border-zinc-200 dark:border-zinc-700 pt-3" : ""}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-1.5">
                    Results — {series.length} series
                  </p>
                  {visibleSeries.map((s) => (
                    <SeriesRow key={s.seriesId} series={s} />
                  ))}
                  {hasMore && (
                    <button
                      type="button"
                      onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                      className="w-full mt-1 py-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors text-center rounded-md bg-zinc-100 dark:bg-zinc-800"
                    >
                      Show {Math.min(remaining, PAGE_SIZE)} more · {remaining} remaining
                    </button>
                  )}
                  {visibleCount > PAGE_SIZE && (
                    <button
                      type="button"
                      onClick={() => setVisibleCount(PAGE_SIZE)}
                      className="w-full mt-0.5 py-1 text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors text-center"
                    >
                      Show less
                    </button>
                  )}
                </div>
              ) : (
                !isLoading && (
                  <div className="text-[11px] text-zinc-400 dark:text-zinc-500 py-4 text-center">
                    No match data available
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── DatDota tournament row ─────────────────────────────────────────────────────

function TournamentRow({ tournament, onClick }) {
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

// ── PandaScore upcoming tournament row (no expansion) ─────────────────────────

function UpcomingTournamentRow({ tournament }) {
  const beginAt = tournament.beginAt ? DateTime.fromISO(tournament.beginAt) : null;
  const title = [tournament.leagueName, tournament.season ? `Season ${tournament.season}` : ""]
    .filter(Boolean)
    .join(" - ");

  return (
    <div className="flex flex-col rounded-sm bg-theme-200/50 dark:bg-theme-900/20 px-1.5 py-0.5 mb-0.5">
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs text-theme-700 dark:text-theme-200 truncate">{title}</span>
        {tournament.prizepool && (
          <span className="shrink-0 text-[10px] text-theme-500 dark:text-theme-400">{tournament.prizepool}</span>
        )}
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
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const [modalTournament, setModalTournament] = useState(null);

  // ── PandaScore: live + upcoming matches, upcoming tournaments ─────────────
  const { data: liveData, error: liveError } = useWidgetAPI(widget, "live_matches");
  const { data: upcomingData, error: upcomingError } = useWidgetAPI(widget, "upcoming_matches");
  const { data: upcomingTournamentsData, error: upcomingTournamentsError } = useWidgetAPI(
    widget,
    "upcoming_tournaments",
  );

  // ── DatDota: current + past tournament listing ────────────────────────────
  const { data: leaguesData, error: leaguesError } = useSWR("/api/widgets/dota2?mode=leagues", {
    revalidateOnFocus: false,
  });

  // ── Derived state ─────────────────────────────────────────────────────────
  const liveMatches = Array.isArray(liveData) ? liveData : [];
  const upcomingMatches = Array.isArray(upcomingData) ? upcomingData : [];
  const upcomingTournaments = Array.isArray(upcomingTournamentsData) ? upcomingTournamentsData : [];
  const currentTournaments = Array.isArray(leaguesData?.current) ? leaguesData.current : [];
  const pastTournaments = Array.isArray(leaguesData?.past) ? leaguesData.past : [];

  const matchesLoading = !liveData && !liveError && !upcomingData && !upcomingError;
  const tournamentsLoading = !leaguesData && !leaguesError && !upcomingTournamentsData && !upcomingTournamentsError;

  if (liveError && upcomingError && !liveData && !upcomingData) {
    return <Container service={service} error={liveError} />;
  }

  return (
    <Container service={service}>
      <div className="flex flex-row w-full gap-3">

        {/* ── Left panel: Matches ─────────────────────────────────────────── */}
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

        {/* ── Right panel: Tournaments ────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0">
          {tournamentsLoading ? (
            <>
              <SectionLabel>{t("dota2.upcoming", "Upcoming")}</SectionLabel>
              <PulseRow />
              <SectionLabel>{t("dota2.ongoing", "Ongoing")}</SectionLabel>
              <PulseRow />
              <PulseRow />
            </>
          ) : (
            <>
              {/* PandaScore upcoming tournaments */}
              {upcomingTournaments.length > 0 && (
                <>
                  <SectionLabel>{t("dota2.upcoming", "Upcoming")}</SectionLabel>
                  {upcomingTournaments.map((tournament) => (
                    <UpcomingTournamentRow key={tournament.id} tournament={tournament} />
                  ))}
                </>
              )}

              {/* DatDota current (ongoing) tournaments */}
              {currentTournaments.length > 0 && (
                <>
                  <SectionLabel>{t("dota2.ongoing", "Ongoing")}</SectionLabel>
                  {currentTournaments.map((tournament) => (
                    <TournamentRow
                      key={tournament.leagueId}
                      tournament={{ ...tournament, isCurrent: true }}
                      onClick={() => setModalTournament({ ...tournament, isCurrent: true })}
                    />
                  ))}
                </>
              )}

              {/* DatDota past tournaments */}
              {pastTournaments.length > 0 && (
                <>
                  <SectionLabel>{t("dota2.completed", "Completed")}</SectionLabel>
                  {pastTournaments.map((tournament) => (
                    <TournamentRow
                      key={tournament.leagueId}
                      tournament={{ ...tournament, isCurrent: false }}
                      onClick={() => setModalTournament({ ...tournament, isCurrent: false })}
                    />
                  ))}
                </>
              )}

              {!leaguesError &&
                !upcomingTournamentsError &&
                upcomingTournaments.length === 0 &&
                currentTournaments.length === 0 &&
                pastTournaments.length === 0 && (
                  <div className="text-[10px] text-theme-500 dark:text-theme-400 text-center py-1">
                    {t("dota2.noTournaments", "No tournaments")}
                  </div>
                )}
            </>
          )}
        </div>
      </div>

      {/* ── Tournament modal ─────────────────────────────────────────────── */}
      {modalTournament && (
        <TournamentModal
          tournament={modalTournament}
          onClose={() => setModalTournament(null)}
        />
      )}
    </Container>
  );
}
