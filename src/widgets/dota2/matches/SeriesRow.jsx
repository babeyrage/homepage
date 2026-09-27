import { DateTime } from "luxon";
import { useState } from "react";

import { LogoBox } from "../ui/primitives";
import { fmtDuration, useHeroConstants, useMatchDetail } from "../ui/utils";

import { MatchDetailModal } from "./MatchDetailModal";

// ── Hero portrait icon ────────────────────────────────────────────────────────

export function HeroIcon({ hero }) {
  return (
    <div className="h-7 w-6 shrink-0 rounded-sm overflow-hidden bg-black/30 dark:bg-black/50 ring-1 ring-white/10">
      {hero?.img && (
        <img src={hero.img} alt={hero.name ?? ""} className="h-full w-full object-cover object-top" title={hero.name} />
      )}
    </div>
  );
}

// Hero group wrapper — subtle tinted ring indicates faction (Radiant=emerald, Dire=red)
export function HeroGroup({ isRadiant, children }) {
  return (
    <div
      className={`flex items-center gap-1 p-px rounded-sm ${
        isRadiant
          ? "ring-1 ring-emerald-500/35 bg-emerald-500/5"
          : "ring-1 ring-red-500/35 bg-red-500/5"
      }`}
    >
      {children}
    </div>
  );
}

// First-pick badge — shown only for the team that received the first pick
export function FirstPickBadge() {
  return (
    <span className="shrink-0 text-[9px] font-bold text-amber-400 uppercase tracking-wide bg-amber-400/10 ring-1 ring-amber-400/30 px-1 py-px rounded-sm leading-none whitespace-nowrap">
      FP
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

// ── Derive per-game presentational state from CitoAPI's draft[]/playerStats[] ──
// (game is already resolved via the parent's match_detail fetch — no per-game
// network call needed here, unlike the old OpenDota-backed useGameDetail.)

function deriveGameView(game, team1Id, heroes) {
  const draft = game.draft ?? [];
  const picks = draft.filter((d) => d.action === "pick");
  const toHero = (p) => heroes[p.heroId] ?? { name: p.heroName, img: null };

  const leftPicks = picks
    .filter((p) => p.teamId === team1Id)
    .sort((a, b) => a.order - b.order)
    .map(toHero);
  const rightPicks = picks
    .filter((p) => p.teamId !== team1Id)
    .sort((a, b) => a.order - b.order)
    .map(toHero);

  const firstPick = picks.length > 0 ? picks.reduce((a, b) => (a.order < b.order ? a : b)) : null;
  const leftHasFirstPick = !!firstPick && firstPick.teamId === team1Id;
  const rightHasFirstPick = !!firstPick && firstPick.teamId !== team1Id;

  const t1IsRadiant = game.radiantTeamId === team1Id;

  const stats = game.playerStats ?? [];
  const team1Score = stats.filter((p) => p.teamId === team1Id).reduce((sum, p) => sum + (p.kills ?? 0), 0);
  const team2Score = stats.filter((p) => p.teamId !== team1Id).reduce((sum, p) => sum + (p.kills ?? 0), 0);

  return {
    t1Won: game.winnerTeamId === team1Id,
    duration: fmtDuration(game.duration),
    t1IsRadiant,
    leftPicks,
    rightPicks,
    leftHasFirstPick,
    rightHasFirstPick,
    team1Score,
    team2Score,
  };
}

// ── Individual game row — single button spanning all columns via subgrid ───────
// Clicking anywhere on the row opens the match detail modal.

export function GameRow({ game, idx, team1Id, heroes, onGameClick }) {
  const { t1Won, duration, t1IsRadiant, leftPicks, rightPicks, leftHasFirstPick, rightHasFirstPick, team1Score, team2Score } =
    deriveGameView(game, team1Id, heroes);

  return (
    <button
      type="button"
      onClick={() => onGameClick?.(game)}
      className="max-sm:hidden grid items-center py-1 hover:bg-theme-200/50 dark:hover:bg-theme-900/30 transition-colors cursor-pointer"
      style={{ gridColumn: "1 / -1", gridTemplateColumns: "subgrid" }}
    >
      {/* Col 1: game label */}
      <span className="text-[9px] text-theme-400 dark:text-theme-500 font-medium tabular-nums leading-none self-center">
        G{idx + 1}
      </span>

      {/* Col 2: left team — FP badge + faction-tinted hero group, right-aligned toward pip */}
      <div className="flex items-center gap-1.5 justify-end py-1 min-w-0">
        {leftHasFirstPick && <FirstPickBadge />}
        <HeroGroup isRadiant={t1IsRadiant}>
          {leftPicks.length > 0
            ? leftPicks.slice(0, 5).map((hero, i) => <HeroIcon key={i} hero={hero} />)
            : <span className="w-16 text-[8px] text-theme-400/50 dark:text-theme-500/50 text-center leading-none">—</span>}
        </HeroGroup>
      </div>

      {/* Col 3: left win pip */}
      <div className="flex items-center justify-center">
        <span className={`block w-1.5 h-1.5 rounded-full ${t1Won ? "bg-emerald-400 dark:bg-emerald-500" : "bg-theme-300/50 dark:bg-theme-700/50"}`} />
      </div>

      {/* Col 4: kill score */}
      <span className="text-[9px] font-bold tabular-nums text-theme-700 dark:text-theme-200 text-center py-1 leading-none self-center">
        {team1Score}–{team2Score}
      </span>

      {/* Col 5: right win pip */}
      <div className="flex items-center justify-center">
        <span className={`block w-1.5 h-1.5 rounded-full ${!t1Won ? "bg-emerald-400 dark:bg-emerald-500" : "bg-theme-300/50 dark:bg-theme-700/50"}`} />
      </div>

      {/* Col 6: right team — faction-tinted hero group + FP badge, left-aligned from pip */}
      <div className="flex items-center gap-1.5 py-1 min-w-0">
        <HeroGroup isRadiant={!t1IsRadiant}>
          {rightPicks.length > 0
            ? rightPicks.slice(0, 5).map((hero, i) => <HeroIcon key={i} hero={hero} />)
            : <span className="w-16 text-[8px] text-theme-400/50 dark:text-theme-500/50 text-center leading-none">—</span>}
        </HeroGroup>
        {rightHasFirstPick && <FirstPickBadge />}
      </div>

      {/* Col 7: duration */}
      <div className="flex items-center justify-end py-1">
        <span className="text-[8px] tabular-nums text-theme-400 dark:text-theme-500 leading-none">
          {duration ?? ""}
        </span>
      </div>
    </button>
  );
}

// ── Mobile game row — single button spanning all columns via subgrid ──────────
// Clicking anywhere on the row opens the match detail modal.

export function MobileGameRow({ game, idx, team1Id, heroes, onGameClick }) {
  const { t1Won, duration, t1IsRadiant, leftPicks, rightPicks, leftHasFirstPick, rightHasFirstPick, team1Score, team2Score } =
    deriveGameView(game, team1Id, heroes);

  return (
    <button
      type="button"
      onClick={() => onGameClick?.(game)}
      className="sm:hidden grid items-center py-1 hover:bg-theme-200/50 dark:hover:bg-theme-900/30 transition-colors cursor-pointer"
      style={{ gridColumn: "1 / -1", gridTemplateColumns: "subgrid" }}
    >
      {/* Col 1: game label */}
      <span className="text-xs text-theme-600 dark:text-theme-300 font-semibold tabular-nums leading-none self-center">
        G{idx + 1}
      </span>
      {/* Col 2: left spacer */}
      <div />
      {/* Col 3: left win pip — same column as series pip */}
      <div className="flex items-center justify-center">
        <span className={`block w-1.5 h-1.5 rounded-full ${t1Won ? "bg-emerald-400 dark:bg-emerald-500" : "bg-theme-300/50 dark:bg-theme-700/50"}`} />
      </div>
      {/* Col 4: kill score */}
      <span className="text-[9px] font-bold tabular-nums text-theme-700 dark:text-theme-200 text-center leading-none self-center">
        {team1Score}–{team2Score}
      </span>
      {/* Col 5: right win pip — same column as series pip */}
      <div className="flex items-center justify-center">
        <span className={`block w-1.5 h-1.5 rounded-full ${!t1Won ? "bg-emerald-400 dark:bg-emerald-500" : "bg-theme-300/50 dark:bg-theme-700/50"}`} />
      </div>
      {/* Col 6: right spacer */}
      <div />
      {/* Col 7: duration */}
      <div className="flex items-end justify-end">
        <span className="text-[8px] tabular-nums text-theme-400 dark:text-theme-500 leading-none">
          {duration ?? ""}
        </span>
      </div>
      {/* Row 2: FP badge + heroes — spans all columns */}
      <div
        className="flex items-center justify-between gap-1 pt-1 pb-1"
        style={{ gridColumn: "1 / -1" }}
      >
        <div className="flex items-center gap-1">
          {leftHasFirstPick && <FirstPickBadge />}
          <HeroGroup isRadiant={t1IsRadiant}>
            {leftPicks.length > 0
              ? leftPicks.slice(0, 5).map((hero, i) => <HeroIcon key={i} hero={hero} />)
              : <span className="w-10 text-[8px] text-theme-400/50 dark:text-theme-500/50 text-center leading-none">—</span>}
          </HeroGroup>
        </div>
        <div className="flex items-center gap-1 justify-end">
          <HeroGroup isRadiant={!t1IsRadiant}>
            {rightPicks.length > 0
              ? rightPicks.slice(0, 5).map((hero, i) => <HeroIcon key={i} hero={hero} />)
              : <span className="w-10 text-[8px] text-theme-400/50 dark:text-theme-500/50 text-center leading-none">—</span>}
          </HeroGroup>
          {rightHasFirstPick && <FirstPickBadge />}
        </div>
      </div>
    </button>
  );
}

// ── Series row (CitoAPI match, with games lazily loaded via match_detail) ──────

export function winsNeeded(numberOfGames) {
  return Math.floor((numberOfGames ?? 3) / 2) + 1;
}

export function SeriesRow({ series, widget }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const heroes = useHeroConstants();

  const { data: matchDetail, isLoading } = useMatchDetail(widget, expanded ? series.id : null);
  const games = matchDetail?.games ?? [];

  const {
    id, team1Id, team1, team1Tag, team1Logo, team2Id, team2, team2Tag, team2Logo,
    winnerTeamId, team1Score, team2Score, bestOf, beginAt,
  } = series;

  const pipCount = winsNeeded(bestOf);
  const team1Won = winnerTeamId !== null && winnerTeamId === team1Id;
  const team2Won = winnerTeamId !== null && winnerTeamId === team2Id;

  const finishedAt = beginAt ? DateTime.fromISO(beginAt) : null;

  const nameClass = (won) =>
    won
      ? "text-[10px] font-semibold text-theme-700 dark:text-theme-200 truncate"
      : "text-[10px] text-theme-400 dark:text-theme-500 truncate";

  return (
    <div
      className="mb-1 rounded-md overflow-hidden bg-theme-200/30 dark:bg-theme-900/15 grid items-center gap-x-2 px-2"
      style={{ gridTemplateColumns: SERIES_GRID }}
    >
      {/* ── Header — subgrid so cells inherit parent columns exactly ── */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="grid items-center py-1.5 hover:bg-theme-200/50 dark:hover:bg-theme-900/30 transition-colors"
        style={{ gridColumn: "1 / -1", gridTemplateColumns: "subgrid" }}
      >
        {/* Col 1: status label + date — SeriesRow is reused for live series inside
            TournamentModal, so the label reflects the match's own status rather
            than assuming "finished". */}
        <div className="flex flex-col items-start min-w-0">
          {series.status === "live" ? (
            <span className="flex items-center gap-1 leading-none">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
              </span>
              <span className="text-[8px] font-bold uppercase tracking-wide text-red-500">Live</span>
            </span>
          ) : (
            <span className="text-[8px] font-bold uppercase tracking-wide text-theme-500 dark:text-theme-400 leading-none">
              {series.status === "upcoming" ? "Upcoming" : "Finished"}
            </span>
          )}
          {finishedAt && (
            <span className="text-[8px] text-theme-400 dark:text-theme-500 leading-none tabular-nums mt-px whitespace-nowrap">
              {finishedAt.toFormat("d MMM, HH:mm")}
            </span>
          )}
        </div>

        {/* Col 2: team1 name + logo */}
        <div className="flex items-center gap-1.5 justify-end min-w-0">
          <span className={`${nameClass(team1Won)} text-right sm:hidden`}>{team1Tag || team1}</span>
          <span className={`${nameClass(team1Won)} text-right max-sm:hidden`}>{team1}</span>
          <LogoBox src={team1Logo} size="md" />
        </div>

        {/* Col 3: team1 win pips — stacked vertically */}
        <div className="flex flex-col items-center gap-0.5">
          {Array.from({ length: pipCount }, (_, i) => (
            <span
              key={i}
              className={`block w-1.5 h-1.5 rounded-full ${i < team1Score ? "bg-emerald-400 dark:bg-emerald-500" : "bg-theme-300/50 dark:bg-theme-700/50"}`}
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
              className={`block w-1.5 h-1.5 rounded-full ${i < team2Score ? "bg-emerald-400 dark:bg-emerald-500" : "bg-theme-300/50 dark:bg-theme-700/50"}`}
            />
          ))}
        </div>

        {/* Col 6: team2 logo + name */}
        <div className="flex items-center gap-1.5 min-w-0">
          <LogoBox src={team2Logo} size="md" />
          <span className={`${nameClass(team2Won)} sm:hidden`}>{team2Tag || team2}</span>
          <span className={`${nameClass(team2Won)} max-sm:hidden`}>{team2}</span>
        </div>

        {/* Col 7: Bo3/5 + toggle */}
        <div className="flex items-center justify-between gap-1">
          {bestOf && (
            <span className="text-[8px] text-theme-400 dark:text-theme-500 tabular-nums leading-none">
              Bo{bestOf}
            </span>
          )}
          <span className="text-sm font-bold text-theme-400 dark:text-theme-500 select-none leading-none">
            {expanded ? "−" : "+"}
          </span>
        </div>
      </button>

      {/* ── Expanded game rows — subgrid inherits parent columns for perfect pip alignment ── */}
      {expanded && (
        <div
          className="grid items-center border-t border-theme-300/20 dark:border-theme-700/20 py-1"
          style={{ gridColumn: "1 / -1", gridTemplateColumns: "subgrid" }}
        >
          {isLoading ? (
            <div
              style={{ gridColumn: "1 / -1" }}
              className="h-8 rounded-sm bg-theme-200/30 dark:bg-theme-900/15 animate-pulse my-px"
            />
          ) : (
            <>
              {/* Mobile: Fragment cells sit directly in the subgrid (sm:hidden) */}
              {games.map((game, idx) => (
                <MobileGameRow key={`m-${game.id}`} game={game} idx={idx} team1Id={team1Id} heroes={heroes} onGameClick={setSelectedGame} />
              ))}
              {/* Desktop: 7-cell fragments — cells carry max-sm:hidden */}
              {games.map((game, idx) => (
                <GameRow key={game.id} game={game} idx={idx} team1Id={team1Id} heroes={heroes} onGameClick={setSelectedGame} />
              ))}
            </>
          )}
        </div>
      )}

      {selectedGame && (
        <MatchDetailModal
          game={selectedGame}
          series={series}
          heroes={heroes}
          onClose={() => setSelectedGame(null)}
        />
      )}
    </div>
  );
}
