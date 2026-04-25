import { DateTime } from "luxon";
import { useState } from "react";
import useSWR from "swr";

import { LogoBox } from "../ui/primitives";

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

// ── Individual game row — single button spanning all columns via subgrid ───────
// Clicking anywhere on the row opens the match detail modal.

export function GameRow({ game, idx, team1Id, onGameClick }) {
  const { data, isLoading } = useSWR(
    `/api/widgets/dota2?mode=match&matchId=${game.id}`,
    { revalidateOnFocus: false },
  );

  const t1Won = game.winnerId === team1Id;
  const duration = game.length
    ? `${Math.floor(game.length / 60)}:${String(game.length % 60).padStart(2, "0")}`
    : null;

  if (isLoading || !data) {
    return (
      <div
        style={{ gridColumn: "1 / -1" }}
        className="max-sm:hidden h-8 rounded-sm bg-theme-200/30 dark:bg-theme-900/15 animate-pulse my-px"
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
        {game.team1Score}–{game.team2Score}
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

export function MobileGameRow({ game, idx, team1Id, onGameClick }) {
  const { data, isLoading } = useSWR(
    `/api/widgets/dota2?mode=match&matchId=${game.id}`,
    { revalidateOnFocus: false },
  );

  const t1Won = game.winnerId === team1Id;
  const duration = game.length
    ? `${Math.floor(game.length / 60)}:${String(game.length % 60).padStart(2, "0")}`
    : null;

  if (isLoading || !data) {
    return (
      <div
        style={{ gridColumn: "1 / -1" }}
        className="sm:hidden h-8 rounded-sm bg-theme-200/30 dark:bg-theme-900/15 animate-pulse my-px"
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
        {game.team1Score}–{game.team2Score}
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

// ── Series row (OpenDota reconstructed series) ────────────────────────────────

export function winsNeeded(numberOfGames) {
  return Math.floor((numberOfGames ?? 3) / 2) + 1;
}

export function SeriesRow({ series }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);

  const { team1Id, team1Name, team1Tag, team1Logo, team2Id, team2Name, team2Tag, team2Logo, winnerId, games, numberOfGames } = series;

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
          <span className={`${nameClass(team1Won)} text-right sm:hidden`}>{team1Tag || team1Name}</span>
          <span className={`${nameClass(team1Won)} text-right max-sm:hidden`}>{team1Name}</span>
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
          <span className={`${nameClass(team2Won)} sm:hidden`}>{team2Tag || team2Name}</span>
          <span className={`${nameClass(team2Won)} max-sm:hidden`}>{team2Name}</span>
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

      {/* ── Expanded game rows — subgrid inherits parent columns for perfect pip alignment ── */}
      {expanded && (
        <div
          className="grid items-center border-t border-theme-300/20 dark:border-theme-700/20 py-1"
          style={{ gridColumn: "1 / -1", gridTemplateColumns: "subgrid" }}
        >
          {/* Mobile: Fragment cells sit directly in the subgrid (sm:hidden) */}
          {games.map((game, idx) => (
            <MobileGameRow key={`m-${game.id}`} game={game} idx={idx} team1Id={team1Id} onGameClick={setSelectedGame} />
          ))}
          {/* Desktop: 7-cell fragments — cells carry max-sm:hidden */}
          {games.map((game, idx) => (
            <GameRow key={game.id} game={game} idx={idx} team1Id={team1Id} onGameClick={setSelectedGame} />
          ))}
        </div>
      )}

      {selectedGame && (
        <MatchDetailModal
          game={selectedGame}
          series={series}
          onClose={() => setSelectedGame(null)}
        />
      )}
    </div>
  );
}
