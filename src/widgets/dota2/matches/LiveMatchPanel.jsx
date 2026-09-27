import { createPortal } from "react-dom";

import { ItemSlot, LogoBox } from "../ui/primitives";
import { orientLiveSides, useBodyScrollLock, useEscapeToClose, useHeroConstants, useItemConstants } from "../ui/utils";

// ── Live in-game panel ──────────────────────────────────────────────────────
//
// Adapted from a League of Legends live-series component. The core problem is
// the same one that component solved — a series has team1/team2, but the game
// underneath has two sides (Radiant/Dire here, Blue/Red there) that swap
// between games, so the team on the left of the header is not reliably the
// side shown below. CitoAPI removes the guesswork LoL required: instead of
// matching on a team slug, it hands back `mapsToCitoTeam` directly on each
// side (see mapLiveTelemetry in widget.js / orientLiveSides in ui/utils.js).
//
// The stat surface is narrower than the LoL original: CitoAPI's live feed has
// no tower/barracks counts (only an undocumented `buildingState` bitmask —
// not worth guessing at without a spec) and no Roshan/Aegis equivalent, so
// this panel shows what's actually confirmed live: net worth, kills, and last
// hits per side, plus the series score. Net worth is shown as a share of the
// combined total (not a raw difference) for the same reason the LoL version
// does — "2k networth" means nothing at minute 5 and everything at minute 35.

const thousands = (n) => `${(n / 1000).toFixed(1)}k`;

function clock(seconds) {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function sideColor(side) {
  return side === "radiant" ? "bg-emerald-500" : "bg-red-500";
}

function sideBorder(side) {
  return side === "radiant" ? "border-emerald-500/50" : "border-red-500/50";
}

// One row of a live player's current state. This is genuinely richer than the
// LoL component's team-level-only telemetry — CitoAPI's live feed carries a
// full per-player snapshot (hero, level, KDA, farm, raw item ids), so rather
// than leaving that on the table this surfaces it as a compact scoreboard.
function LivePlayerRow({ player, heroes, items }) {
  const hero = heroes[player.heroId] ?? { name: null, img: null };
  const slots = Array.from({ length: 6 }, (_, i) => {
    const id = player.items[i];
    return id ? items[id] ?? { id, name: "", img: null } : null;
  });

  return (
    <div className={`flex items-center gap-1.5 py-1 border-l-2 pl-1.5 ${sideBorder(player.teamSide)}`}>
      <div className="w-7 h-4 shrink-0 rounded-sm overflow-hidden bg-theme-800">
        {hero.img && <img src={hero.img} alt={hero.name ?? ""} className="w-full h-full object-cover object-top" />}
      </div>
      <span className="w-16 shrink-0 text-[9px] text-theme-600 dark:text-theme-300 truncate">
        {player.playerName ?? hero.name ?? "—"}
      </span>
      <span className="w-9 shrink-0 text-center text-[9px] tabular-nums text-theme-500 dark:text-theme-400">
        Lv{player.level}
      </span>
      <span className="w-12 shrink-0 text-center text-[9px] tabular-nums text-theme-500 dark:text-theme-400">
        {player.kills}/{player.deaths}/{player.assists}
      </span>
      <span className="w-10 shrink-0 text-right text-[9px] font-semibold tabular-nums text-amber-500">
        {thousands(player.netWorth)}
      </span>
      <div className="flex gap-0.5 ml-1 shrink-0">
        {slots.map((item, i) => <ItemSlot key={i} item={item} size="sm" />)}
      </div>
    </div>
  );
}

function LiveScoreboard({ left, right, teamLeft, teamRight, heroes, items }) {
  if (left.players.length === 0 && right.players.length === 0) return null;
  return (
    <div className="mt-3 -mx-4 px-4 overflow-x-auto">
      <div className="min-w-max">
        <div className="text-[9px] font-semibold uppercase tracking-wide text-theme-400 dark:text-theme-500 mb-0.5">
          {teamLeft}
        </div>
        {left.players.map((p) => <LivePlayerRow key={p.accountId ?? `${p.teamSide}-${p.playerName}`} player={p} heroes={heroes} items={items} />)}
        <div className="text-[9px] font-semibold uppercase tracking-wide text-theme-400 dark:text-theme-500 mt-2 mb-0.5">
          {teamRight}
        </div>
        {right.players.map((p) => <LivePlayerRow key={p.accountId ?? `${p.teamSide}-${p.playerName}`} player={p} heroes={heroes} items={items} />)}
      </div>
    </div>
  );
}

export function LiveMatchPanel({ match, onClose }) {
  const sides = orientLiveSides(match.live);
  const heroes = useHeroConstants();
  const items = useItemConstants();

  useEscapeToClose(onClose);
  useBodyScrollLock();

  if (!sides) return null;

  const { left, right, gameTime } = sides;
  const totalNetWorth = left.netWorth + right.netWorth;
  const leftShare = totalNetWorth > 0 ? (left.netWorth / totalNetWorth) * 100 : 50;

  const gamesPlayed = match.team1Score + match.team2Score;

  return createPortal(
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[95vh] flex flex-col rounded-none sm:rounded-xl bg-theme-100 dark:bg-theme-900 shadow-2xl overflow-y-auto overflow-x-hidden mx-0 sm:mx-4 px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: league + live badge + clock + close */}
        <div className="flex items-center gap-2 mb-3 text-[10px]">
          <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 font-bold uppercase tracking-wide text-red-500">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
            </span>
            Live
          </span>
          {match.leagueName && <span className="truncate opacity-70 text-theme-600 dark:text-theme-300">{match.leagueName}</span>}
          <span className="ml-auto font-mono tabular-nums text-theme-500 dark:text-theme-400">{clock(gameTime)}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-theme-400 hover:text-theme-700 dark:hover:text-theme-200 transition-colors text-base leading-none"
          >
            ✕
          </button>
        </div>

        {/* Teams + series score */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <LogoBox src={match.team1Logo} size="lg" />
            <span className="text-sm font-semibold text-theme-800 dark:text-theme-100 truncate">{match.team1}</span>
          </div>
          <div className="shrink-0 text-center">
            <div className="font-mono text-xl font-bold tabular-nums text-theme-800 dark:text-theme-100">
              {match.team1Score}
              <span className="px-1.5 opacity-30">–</span>
              {match.team2Score}
            </div>
            {match.bestOf > 1 && (
              <div className="mt-1 flex justify-center gap-1">
                {Array.from({ length: match.bestOf }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 w-3 rounded-full ${i < gamesPlayed ? "bg-theme-400 dark:bg-theme-500" : "bg-theme-300/40 dark:bg-theme-700/40"}`}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-end text-right">
            <span className="text-sm font-semibold text-theme-800 dark:text-theme-100 truncate">{match.team2}</span>
            <LogoBox src={match.team2Logo} size="lg" />
          </div>
        </div>

        {/* Net worth split bar */}
        <div className="flex items-baseline justify-between text-[11px]">
          <span className={`font-mono tabular-nums text-theme-700 dark:text-theme-200 ${leftShare > 50 ? "font-bold" : ""}`}>
            {thousands(left.netWorth)}
          </span>
          <span className="text-[9px] uppercase tracking-wide text-theme-400 dark:text-theme-500">Net Worth</span>
          <span className={`font-mono tabular-nums text-theme-700 dark:text-theme-200 ${leftShare < 50 ? "font-bold" : ""}`}>
            {thousands(right.netWorth)}
          </span>
        </div>
        <div className="mt-1 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
          <div className={`h-full rounded-l-full ${sideColor(left.side)}`} style={{ width: `${leftShare}%` }} />
          <div className={`h-full rounded-r-full ${sideColor(right.side)}`} style={{ width: `${100 - leftShare}%` }} />
        </div>

        {/* Kills / last hits comparison */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          {[
            ["Kills", left.kills, right.kills],
            ["Last Hits", left.lastHits, right.lastHits],
          ].map(([label, a, b]) => (
            <div key={label} className="rounded-md bg-theme-200/50 dark:bg-theme-800 px-1.5 py-1.5">
              <div className="font-mono text-sm tabular-nums">
                <span className={a > b ? "font-bold text-theme-800 dark:text-theme-100" : "text-theme-500 dark:text-theme-400"}>{a}</span>
                <span className="px-1 opacity-30">–</span>
                <span className={b > a ? "font-bold text-theme-800 dark:text-theme-100" : "text-theme-500 dark:text-theme-400"}>{b}</span>
              </div>
              <div className="text-[9px] uppercase tracking-wide text-theme-400 dark:text-theme-500">{label}</div>
            </div>
          ))}
        </div>

        {/* Live per-player scoreboard */}
        <LiveScoreboard
          left={left}
          right={right}
          teamLeft={match.team1}
          teamRight={match.team2}
          heroes={heroes}
          items={items}
        />
      </div>
    </div>,
    document.body,
  );
}
