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

function shortRelative(dt) {
  const diff = dt.diffNow("minutes").minutes;
  const abs = Math.abs(diff);
  if (abs < 60) return `in ${Math.round(abs)}m`;
  if (abs < 24 * 60) return `in ${Math.round(abs / 60)}h`;
  return `in ${Math.round(abs / (60 * 24))}d`;
}

function MatchRow({ match, live, showAbsolute }) {
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

function ModalMatchRow({ match, showAbsolute }) {
  const beginAt = match.beginAt ? DateTime.fromISO(match.beginAt) : null;

  return (
    <div className="flex items-center gap-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-2.5 mb-1.5">
      {/* Team 1 */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <LogoBox src={match.team1Logo} size="md" />
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate">{match.team1}</span>
      </div>

      {/* Centre: time */}
      <div className="shrink-0 flex flex-col items-center gap-0.5 min-w-[52px]">
        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">vs</span>
        <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 tabular-nums">
          {beginAt
            ? showAbsolute
              ? beginAt.toFormat("HH:mm")
              : beginAt.toRelative()
            : ""}
        </span>
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

// ── Hero portrait icon ────────────────────────────────────────────────────────

function HeroIcon({ hero }) {
  return (
    <div className="h-7 w-6 shrink-0 rounded-sm overflow-hidden bg-black/30 dark:bg-black/50 ring-1 ring-white/10">
      {hero?.img && (
        <img src={hero.img} alt={hero.name ?? ""} className="h-full w-full object-cover object-top" title={hero.name} />
      )}
    </div>
  );
}

// Hero group wrapper — subtle tinted ring indicates faction (Radiant=emerald, Dire=red)
function HeroGroup({ isRadiant, children }) {
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
function FirstPickBadge() {
  return (
    <span className="shrink-0 text-[7px] font-bold text-amber-400 uppercase tracking-wide bg-amber-400/10 ring-1 ring-amber-400/30 px-1 py-px rounded-sm leading-none whitespace-nowrap">
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
    <>
      {/* Col 1: game label */}
      <span className="max-sm:hidden text-[9px] text-theme-400 dark:text-theme-500 font-medium tabular-nums leading-none self-center">
        G{idx + 1}
      </span>

      {/* Col 2: left team — FP badge + faction-tinted hero group, right-aligned toward pip */}
      <div className="max-sm:hidden flex items-center gap-1.5 justify-end py-1 min-w-0">
        {leftHasFirstPick && <FirstPickBadge />}
        <HeroGroup isRadiant={t1IsRadiant}>
          {leftPicks.length > 0
            ? leftPicks.slice(0, 5).map((hero, i) => <HeroIcon key={i} hero={hero} />)
            : <span className="w-16 text-[8px] text-theme-400/50 dark:text-theme-500/50 text-center leading-none">—</span>}
        </HeroGroup>
      </div>

      {/* Col 3: left win pip — centred via flex to match series pip column */}
      <div className="max-sm:hidden flex items-center justify-center">
        <span className={`block w-1.5 h-1.5 rounded-full ${t1Won ? "bg-emerald-400 dark:bg-emerald-500" : "bg-theme-300/50 dark:bg-theme-700/50"}`} />
      </div>

      {/* Col 4: kill score */}
      <span className="max-sm:hidden text-[9px] font-bold tabular-nums text-theme-700 dark:text-theme-200 text-center py-1 leading-none self-center">
        {game.team1Score}–{game.team2Score}
      </span>

      {/* Col 5: right win pip — centred via flex */}
      <div className="max-sm:hidden flex items-center justify-center">
        <span className={`block w-1.5 h-1.5 rounded-full ${!t1Won ? "bg-emerald-400 dark:bg-emerald-500" : "bg-theme-300/50 dark:bg-theme-700/50"}`} />
      </div>

      {/* Col 6: right team — faction-tinted hero group + FP badge, left-aligned from pip */}
      <div className="max-sm:hidden flex items-center gap-1.5 py-1 min-w-0">
        <HeroGroup isRadiant={!t1IsRadiant}>
          {rightPicks.length > 0
            ? rightPicks.slice(0, 5).map((hero, i) => <HeroIcon key={i} hero={hero} />)
            : <span className="w-16 text-[8px] text-theme-400/50 dark:text-theme-500/50 text-center leading-none">—</span>}
        </HeroGroup>
        {rightHasFirstPick && <FirstPickBadge />}
      </div>

      {/* Col 7: duration */}
      <span className="max-sm:hidden text-[8px] tabular-nums text-theme-400 dark:text-theme-500 py-1 leading-none self-center text-right">
        {duration ?? ""}
      </span>
    </>
  );
}

// ── Mobile game row — two-row layout for small screens ───────────────────────

function MobileGameRow({ game, idx, team1Id }) {
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
      <div className="h-12 rounded-sm bg-theme-200/30 dark:bg-theme-900/15 animate-pulse my-px" />
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
    <div className="mb-1 rounded-sm bg-theme-200/20 dark:bg-theme-900/10 px-2 py-1">
      {/* Row 1: game number · score · duration */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-bold text-theme-500 dark:text-theme-400 uppercase tracking-wide">G{idx + 1}</span>
        <div className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${t1Won ? "bg-emerald-400" : "bg-theme-300/50 dark:bg-theme-700/50"}`} />
          <span className="text-[10px] font-bold tabular-nums text-theme-700 dark:text-theme-200">
            {game.team1Score}–{game.team2Score}
          </span>
          <span className={`w-1.5 h-1.5 rounded-full ${!t1Won ? "bg-emerald-400" : "bg-theme-300/50 dark:bg-theme-700/50"}`} />
        </div>
        <span className="text-[9px] tabular-nums text-theme-400 dark:text-theme-500">{duration ?? ""}</span>
      </div>
      {/* Row 2: FP + heroes left · heroes right + FP */}
      <div className="flex items-center justify-between gap-1">
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
    </div>
  );
}

// ── Series row (OpenDota reconstructed series) ────────────────────────────────

function winsNeeded(numberOfGames) {
  return Math.floor((numberOfGames ?? 3) / 2) + 1;
}

function SeriesRow({ series }) {
  const [expanded, setExpanded] = useState(false);

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
          {/* Mobile: two-row card per game (spans all columns) */}
          {games.map((game, idx) => (
            <div key={`m-${game.id}`} className="sm:hidden py-0.5" style={{ gridColumn: "1 / -1" }}>
              <MobileGameRow game={game} idx={idx} team1Id={team1Id} />
            </div>
          ))}
          {/* Desktop: 7-cell fragments — cells carry max-sm:hidden */}
          {games.map((game, idx) => (
            <GameRow key={game.id} game={game} idx={idx} team1Id={team1Id} />
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
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal panel */}
      <div
        className="relative w-full max-w-2xl max-h-[95vh] flex flex-col rounded-xl bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden mx-0 sm:mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Banner ── */}
        <div className="relative h-36 w-full shrink-0 bg-zinc-800 overflow-hidden">
          <img
            src={`https://cdn.datdota.com/images/leagues/${leagueId}_big.png`}
            alt={name}
            className="w-full h-full object-cover object-center"
          />
          {/* Stronger gradient — ensures text is readable over any image */}
          <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-black/10" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2 right-2 text-white/70 hover:text-white transition-colors leading-none text-base bg-black/40 rounded-full w-6 h-6 flex items-center justify-center"
          >
            ✕
          </button>
          <div className="absolute bottom-3 left-3 right-10 flex flex-col gap-1">
            {/* Tier badge */}
            <div className="flex items-center gap-1.5">
              {tierId === 1 && (
                <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wide bg-black/50 px-1.5 py-0.5 rounded">
                  Premium
                </span>
              )}
              {tierId === 2 && (
                <span className="text-[9px] font-bold text-sky-400 uppercase tracking-wide bg-black/50 px-1.5 py-0.5 rounded">
                  Professional
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
                  <div className="grid grid-cols-2 gap-1.5">
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

// ── Scheduled match row (inside UpcomingTournamentModal) ──────────────────────

function ScheduledMatchRow({ match }) {
  const beginAt = match.beginAt ? DateTime.fromISO(match.beginAt) : null;

  return (
    <div className="flex items-center rounded-md bg-zinc-50 dark:bg-zinc-800/80 px-2 py-1.5 mb-1 gap-2">
      {/* Team 1 — right-aligned toward centre */}
      <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
        <span className="text-[10px] font-medium text-zinc-700 dark:text-zinc-200 truncate text-right">{match.team1}</span>
        <LogoBox src={match.team1Logo} size="sm" />
      </div>

      {/* Bo format */}
      <span className="shrink-0 text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 tabular-nums">
        Bo{match.numberOfGames}
      </span>

      {/* Team 2 — left-aligned from centre */}
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <LogoBox src={match.team2Logo} size="sm" />
        <span className="text-[10px] font-medium text-zinc-700 dark:text-zinc-200 truncate">{match.team2}</span>
      </div>

      {/* Time + stream link */}
      <div className="shrink-0 flex items-center gap-1.5">
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 tabular-nums whitespace-nowrap">
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

function UpcomingTournamentModal({ tournament, widget, onClose }) {
  const begin = tournament.beginAt ? DateTime.fromISO(tournament.beginAt) : null;
  const end = tournament.endAt ? DateTime.fromISO(tournament.endAt) : null;
  const dateLabel =
    begin && end
      ? `${begin.toFormat("d MMM")} – ${end.toFormat("d MMM yyyy")}`
      : begin
        ? `From ${begin.toFormat("d MMM yyyy")}`
        : "";

  const { data: matchesRaw, isLoading } = useWidgetAPI(widget, "tournament_matches", {
    "filter[tournament_id]": tournament.id,
    "page[size]": 50,
    sort: "begin_at",
  });

  const matches = Array.isArray(matchesRaw) ? matchesRaw : [];

  const [visibleDays, setVisibleDays] = useState(2);

  // Group matches by local date
  const matchesByDate = matches.reduce((groups, match) => {
    const dateKey = match.beginAt
      ? DateTime.fromISO(match.beginAt).toFormat("cccc, d MMM yyyy")
      : "TBD";
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(match);
    return groups;
  }, {});

  const dateEntries = Object.entries(matchesByDate);
  const visibleEntries = dateEntries.slice(0, visibleDays);
  const hiddenDays = dateEntries.length - visibleDays;

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[95vh] flex flex-col rounded-xl bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden mx-0 sm:mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
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
          {/* Participating teams */}
          {tournament.teams?.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-1.5">
                Participants
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {tournament.teams.map((team) => (
                  <div
                    key={team.id}
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

          {/* Scheduled matches */}
          {isLoading ? (
            <div className="flex flex-col gap-1.5">
              <PulseRow /><PulseRow /><PulseRow />
            </div>
          ) : matches.length > 0 ? (
            <div className={tournament.teams?.length > 0 ? "border-t border-zinc-200 dark:border-zinc-700 pt-3" : ""}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-1.5">
                Schedule — {matches.length} match{matches.length !== 1 ? "es" : ""}
              </p>
              {visibleEntries.map(([dateKey, dayMatches]) => (
                <div key={dateKey} className="mb-3 last:mb-0">
                  <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1 px-1">
                    {dateKey}
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
                  className="w-full mt-1 py-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors text-center rounded-md bg-zinc-100 dark:bg-zinc-800"
                >
                  Show more · {hiddenDays} day{hiddenDays !== 1 ? "s" : ""} remaining
                </button>
              )}
            </div>
          ) : (
            !isLoading && (
              <div className="text-[11px] text-zinc-400 dark:text-zinc-500 py-4 text-center">
                No matches scheduled yet
              </div>
            )
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── PandaScore upcoming tournament row ────────────────────────────────────────

function UpcomingTournamentRow({ tournament, onClick }) {
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

// ── Upcoming matches modal ────────────────────────────────────────────────────

function CompletedTournamentsModal({ tournaments, onSelect, onClose }) {
  const { t } = useTranslation();

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[95vh] flex flex-col rounded-xl bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden mx-0 sm:mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <span className="text-sm font-semibold text-theme-700 dark:text-theme-200">
            {t("dota2.completed", "Completed")}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-theme-400 hover:text-theme-600 dark:text-theme-500 dark:hover:text-theme-300 transition-colors leading-none text-base"
          >
            ✕
          </button>
        </div>

        {/* Scrollable list */}
        <div className="overflow-y-auto px-3 py-2">
          {tournaments.map((tournament) => (
            <TournamentRow
              key={tournament.leagueId}
              tournament={{ ...tournament, isCurrent: false }}
              onClick={() => onSelect(tournament)}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function UpcomingMatchesModal({ matches, showAbsolute, onToggleTime, onClose }) {
  const { t } = useTranslation();

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const today = DateTime.now().startOf("day");
  const formatDayLabel = (isoDate) => {
    const dt = DateTime.fromISO(isoDate).startOf("day");
    const diff = Math.round(dt.diff(today, "days").days);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return dt.toFormat("cccc, d MMM");
  };

  const grouped = matches.reduce((acc, match) => {
    const day = match.beginAt ? DateTime.fromISO(match.beginAt).toISODate() : "unknown";
    if (!acc[day]) acc[day] = [];
    acc[day].push(match);
    return acc;
  }, {});

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[95vh] flex flex-col rounded-xl bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden mx-0 sm:mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <span className="text-base font-bold text-zinc-800 dark:text-zinc-100">
            {t("dota2.upcoming", "Upcoming Matches")}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleTime}
              className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors select-none bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md"
            >
              {showAbsolute ? "⏱ Countdown" : "⏱ Time"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors leading-none text-lg"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable match list */}
        <div className="overflow-y-auto px-4 py-3">
          {Object.keys(grouped).sort().map((day) => (
            <div key={day} className="mb-1">
              {/* Day heading with rule */}
              <div className="flex items-center gap-2 mb-2 mt-3 first:mt-0">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 shrink-0">
                  {formatDayLabel(day)}
                </span>
                <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
              </div>
              {grouped[day].map((match) => (
                <ModalMatchRow key={match.id} match={match} showAbsolute={showAbsolute} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const [modalTournament, setModalTournament] = useState(null);
  const [modalUpcomingTournament, setModalUpcomingTournament] = useState(null);
  const [showAbsoluteTime, setShowAbsoluteTime] = useState(true);
  const [showUpcomingModal, setShowUpcomingModal] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);

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
      <div className="flex flex-col sm:flex-row w-full gap-3">

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
                    <MatchRow key={match.id} match={match} live showAbsolute={false} />
                  ))}
                </>
              )}

              {/* Upcoming header with countdown/time toggle */}
              <div className="flex items-center justify-between mb-0.5 mt-1.5 first:mt-0">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-theme-500 dark:text-theme-400">
                  {t("dota2.upcoming", "Upcoming")}
                </span>
                {upcomingMatches.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAbsoluteTime((v) => !v)}
                    className="text-[9px] text-theme-400 dark:text-theme-500 hover:text-theme-600 dark:hover:text-theme-300 transition-colors select-none"
                  >
                    {showAbsoluteTime ? "⏱ Countdown" : "⏱ Time"}
                  </button>
                )}
              </div>
              {upcomingMatches.length === 0 ? (
                <div className="text-[10px] text-theme-500 dark:text-theme-400 text-center py-1">
                  {t("dota2.noMatches", "No matches scheduled")}
                </div>
              ) : (() => {
                const PREVIEW_COUNT = 6;
                const preview = upcomingMatches.slice(0, PREVIEW_COUNT);
                const hasMore = upcomingMatches.length > PREVIEW_COUNT;

                const today = DateTime.now().startOf("day");
                const formatDayLabel = (isoDate) => {
                  const dt = DateTime.fromISO(isoDate).startOf("day");
                  const diff = Math.round(dt.diff(today, "days").days);
                  if (diff === 0) return "Today";
                  if (diff === 1) return "Tomorrow";
                  return dt.toFormat("cccc, d MMM");
                };

                // Group a list of matches by calendar day, preserving sort order
                const groupByDay = (matches) =>
                  matches.reduce((acc, match) => {
                    const day = match.beginAt ? DateTime.fromISO(match.beginAt).toISODate() : "unknown";
                    if (!acc[day]) acc[day] = [];
                    acc[day].push(match);
                    return acc;
                  }, {});

                const grouped = groupByDay(preview);

                return (
                  <>
                    {Object.keys(grouped).sort().map((day) => (
                      <div key={day}>
                        <div className="text-[9px] font-semibold uppercase tracking-wide text-theme-400 dark:text-theme-500 mt-1 mb-0.5">
                          {formatDayLabel(day)}
                        </div>
                        {grouped[day].map((match) => (
                          <MatchRow key={match.id} match={match} live={false} showAbsolute={showAbsoluteTime} />
                        ))}
                      </div>
                    ))}
                    {hasMore && (
                      <button
                        type="button"
                        onClick={() => setShowUpcomingModal(true)}
                        className="w-full text-[9px] text-theme-400 dark:text-theme-500 hover:text-theme-600 dark:hover:text-theme-300 transition-colors text-center py-0.5 mt-0.5"
                      >
                        Show more ▾
                      </button>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </div>

        {/* ── Right panel: Tournaments ────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0">
          {tournamentsLoading ? (
            <>
              <SectionLabel>{t("dota2.ongoing", "Ongoing")}</SectionLabel>
              <PulseRow />
              <PulseRow />
              <SectionLabel>{t("dota2.upcoming", "Upcoming")}</SectionLabel>
              <PulseRow />
            </>
          ) : (
            <>
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

              {/* PandaScore upcoming tournaments */}
              {upcomingTournaments.length > 0 && (
                <>
                  <SectionLabel>{t("dota2.upcoming", "Upcoming")}</SectionLabel>
                  {upcomingTournaments.map((tournament) => (
                    <UpcomingTournamentRow
                      key={tournament.id}
                      tournament={tournament}
                      onClick={() => setModalUpcomingTournament(tournament)}
                    />
                  ))}
                </>
              )}

              {/* DatDota past tournaments */}
              {pastTournaments.length > 0 && (
                <>
                  <SectionLabel>{t("dota2.completed", "Completed")}</SectionLabel>
                  {pastTournaments.slice(0, 8).map((tournament) => (
                    <TournamentRow
                      key={tournament.leagueId}
                      tournament={{ ...tournament, isCurrent: false }}
                      onClick={() => setModalTournament({ ...tournament, isCurrent: false })}
                    />
                  ))}
                  {pastTournaments.length > 8 && (
                    <button
                      type="button"
                      onClick={() => setShowCompletedModal(true)}
                      className="w-full text-[9px] text-theme-400 dark:text-theme-500 hover:text-theme-600 dark:hover:text-theme-300 transition-colors text-center py-0.5 mt-0.5"
                    >
                      Show more ▾
                    </button>
                  )}
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

      {/* ── Completed tournaments modal ───────────────────────────────────── */}
      {showCompletedModal && (
        <CompletedTournamentsModal
          tournaments={pastTournaments}
          onSelect={(t) => { setShowCompletedModal(false); setModalTournament({ ...t, isCurrent: false }); }}
          onClose={() => setShowCompletedModal(false)}
        />
      )}

      {/* ── Upcoming matches modal ────────────────────────────────────────── */}
      {showUpcomingModal && (
        <UpcomingMatchesModal
          matches={upcomingMatches}
          showAbsolute={showAbsoluteTime}
          onToggleTime={() => setShowAbsoluteTime((v) => !v)}
          onClose={() => setShowUpcomingModal(false)}
        />
      )}

      {/* ── DatDota tournament modal ──────────────────────────────────────── */}
      {modalTournament && (
        <TournamentModal
          tournament={modalTournament}
          onClose={() => setModalTournament(null)}
        />
      )}

      {/* ── PandaScore upcoming tournament modal ──────────────────────────── */}
      {modalUpcomingTournament && (
        <UpcomingTournamentModal
          tournament={modalUpcomingTournament}
          widget={widget}
          onClose={() => setModalUpcomingTournament(null)}
        />
      )}
    </Container>
  );
}
