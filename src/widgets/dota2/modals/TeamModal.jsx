import { DateTime } from "luxon";
import { useState } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";

import { ErrorState, LogoBox, PulseRow } from "../ui/primitives";
import { fmtDuration, useBodyScrollLock, useEscapeToClose } from "../ui/utils";

// ── Team detail modal ─────────────────────────────────────────────────────────

export function TeamModal({ teamId, teamName, teamLogo, onClose }) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/widgets/dota2?mode=team&teamId=${teamId}`,
    { revalidateOnFocus: false },
  );

  useEscapeToClose(onClose);
  useBodyScrollLock();

  const [expandedMatchId, setExpandedMatchId] = useState(null);
  const totalGames = data ? (data.wins ?? 0) + (data.losses ?? 0) : 0;
  const winRate = totalGames > 0 ? Math.round((data.wins / totalGames) * 100) : null;

  return createPortal(
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[95vh] flex flex-col rounded-none sm:rounded-xl bg-theme-100 dark:bg-theme-900 shadow-2xl overflow-hidden mx-0 sm:mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header: logo + name + close ── */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <LogoBox src={teamLogo} size="lg" />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-theme-800 dark:text-theme-100 truncate">{teamName}</span>
              {data?.tag && (
                <span className="text-[10px] text-theme-400 dark:text-theme-500">{data.tag}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-theme-400 hover:text-theme-700 dark:hover:text-theme-200 transition-colors text-base leading-none"
          >
            ✕
          </button>
        </div>

        {/* ── Stat strip ── */}
        {data && (
          <div className="grid grid-cols-4 border-t border-b border-theme-200 dark:border-theme-700 shrink-0">
            {[
              { label: "Rating", value: data.rating ?? "—", color: "text-amber-500 dark:text-amber-400" },
              { label: "Wins", value: data.wins, color: "text-emerald-500" },
              { label: "Losses", value: data.losses, color: "text-red-400" },
              { label: "Win Rate", value: winRate !== null ? `${winRate}%` : "—", color: winRate >= 50 ? "text-emerald-500" : "text-red-400", bar: winRate },
            ].map(({ label, value, color, bar }) => (
              <div key={label} className="flex flex-col items-center py-2.5 px-1 gap-0.5 border-r border-theme-200 dark:border-theme-700 last:border-r-0">
                <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
                <span className="text-[9px] font-semibold uppercase tracking-wide text-theme-400 dark:text-theme-500">{label}</span>
                {bar != null && (
                  <div className="w-10 h-1 mt-0.5 rounded-full bg-theme-200 dark:bg-theme-700 overflow-hidden">
                    <div className={`h-full rounded-full ${bar >= 50 ? "bg-emerald-500" : "bg-red-400"}`} style={{ width: `${bar}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: 8 }).map((_, i) => <PulseRow key={i} />)}
            </div>
          ) : error ? (
            <ErrorState message="Failed to load team stats" onRetry={() => mutate()} />
          ) : !data || (!data.players?.length && !data.heroes?.length && !data.recentMatches?.length) ? (
            <div className="py-8 text-center text-[11px] text-theme-400 dark:text-theme-500">
              No stats available for this team
            </div>
          ) : (
            <>
              {/* Current Roster */}
              {data.players?.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-theme-400 dark:text-theme-500 mb-1.5">
                    Current Roster
                  </p>
                  <div className="flex flex-col gap-1">
                    {data.players.map((player) => {
                      const pr = player.gamesPlayed > 0 ? Math.round((player.wins / player.gamesPlayed) * 100) : null;
                      return (
                        <div key={player.accountId} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md bg-theme-100 dark:bg-theme-800">
                          <span className={`text-[11px] font-semibold flex-1 truncate ${player.name ? "text-theme-700 dark:text-theme-200" : "text-theme-400 dark:text-theme-500 italic"}`}>
                            {player.name ?? "Unknown Player"}
                          </span>
                          <span className="text-[10px] tabular-nums text-theme-500 dark:text-theme-400 shrink-0">
                            {player.gamesPlayed} matches
                          </span>
                          {pr !== null && (
                            <div className="flex flex-col items-end gap-0.5 shrink-0 w-10">
                              <span className={`text-[10px] tabular-nums font-semibold leading-none ${pr >= 50 ? "text-emerald-500" : "text-red-400"}`}>
                                {pr}%
                              </span>
                              <div className="w-full h-1 rounded-full bg-theme-200 dark:bg-theme-700 overflow-hidden">
                                <div className={`h-full rounded-full ${pr >= 50 ? "bg-emerald-500" : "bg-red-400"}`} style={{ width: `${pr}%` }} />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recent Matches */}
              {data.recentMatches?.length > 0 && (
                <div className="border-t border-theme-200 dark:border-theme-700 pt-3 mb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-theme-400 dark:text-theme-500 mb-1.5">
                    Recent Matches
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {data.recentMatches.map((match) => {
                      const isOpen = expandedMatchId === match.matchId;
                      const date = match.startTime
                        ? DateTime.fromSeconds(match.startTime).toFormat("d MMM yyyy")
                        : null;
                      const teamScore = match.radiant ? match.radiantScore : match.direScore;
                      const oppScore  = match.radiant ? match.direScore    : match.radiantScore;
                      return (
                        <div key={match.matchId} className="rounded-md overflow-hidden">
                          {/* Collapsed row — date left, opponent centre, result right */}
                          <button
                            type="button"
                            onClick={() => setExpandedMatchId(isOpen ? null : match.matchId)}
                            className={`w-full grid grid-cols-[auto_1fr_auto_auto] gap-x-2 items-center px-2.5 py-1.5 text-left transition-colors
                              ${match.won
                                ? "bg-emerald-500/5 dark:bg-emerald-500/10 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/15"
                                : "bg-red-500/5 dark:bg-red-500/10 hover:bg-red-500/10 dark:hover:bg-red-500/15"}`}
                          >
                            {/* Date */}
                            <span className="text-[10px] tabular-nums text-theme-400 dark:text-theme-500 shrink-0 w-16">
                              {date ?? "—"}
                            </span>
                            {/* Opponent */}
                            <div className="flex items-center gap-1.5 min-w-0">
                              <LogoBox src={match.opposingTeamLogo} size="xs" />
                              <span className="text-[11px] font-medium text-theme-700 dark:text-theme-200 truncate">
                                {match.opposingTeamName}
                              </span>
                            </div>
                            {/* W/L */}
                            <span className={`text-[10px] font-bold shrink-0 ${match.won ? "text-emerald-500" : "text-red-400"}`}>
                              {match.won ? "W" : "L"}
                            </span>
                            {/* Chevron */}
                            <span className={`text-[9px] text-theme-400 dark:text-theme-500 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}>
                              ▼
                            </span>
                          </button>

                          {/* Expanded stats */}
                          {isOpen && (
                            <div className="bg-theme-100 dark:bg-theme-800/80 border-t border-theme-200 dark:border-theme-700">
                              {/* Score banner */}
                              <div className="flex flex-col items-center py-2.5 gap-1 border-b border-theme-200 dark:border-theme-700">
                                <div className="flex items-center justify-center gap-4">
                                  <span className={`text-2xl font-black tabular-nums w-8 text-right ${match.won ? "text-emerald-500" : "text-red-400"}`}>{teamScore}</span>
                                  <span className="text-xs text-theme-400 dark:text-theme-500 font-medium">–</span>
                                  <span className={`text-2xl font-black tabular-nums w-8 text-left ${!match.won ? "text-emerald-500" : "text-red-400"}`}>{oppScore}</span>
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${match.won ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-400"}`}>
                                  {match.won ? "Victory" : "Defeat"}
                                </span>
                              </div>
                              {/* Tournament */}
                              {match.leagueName && (
                                <div className="px-3 py-1.5 border-t border-theme-200 dark:border-theme-700 flex items-center gap-1.5">
                                  <span className="text-[9px] font-semibold uppercase tracking-wide text-theme-400 dark:text-theme-500 shrink-0">Tournament</span>
                                  <span className="text-[10px] text-theme-600 dark:text-theme-300 truncate">{match.leagueName}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Most Played Heroes — table */}
              {data.heroes?.length > 0 && (
                <div className="border-t border-theme-200 dark:border-theme-700 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-theme-400 dark:text-theme-500 mb-1.5">
                    Most Played Heroes
                  </p>
                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-2 mb-1">
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-theme-400 dark:text-theme-500">Hero</span>
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-theme-400 dark:text-theme-500 text-right">Played</span>
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-theme-400 dark:text-theme-500 text-right w-14">Win Rate</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {data.heroes.map((hero) => {
                      const hr = hero.gamesPlayed > 0 ? Math.round((hero.wins / hero.gamesPlayed) * 100) : null;
                      return (
                        <div key={hero.heroId} className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-2 py-1 rounded-md bg-theme-100 dark:bg-theme-800">
                          {/* Hero portrait + name */}
                          <div className="flex items-center gap-2 min-w-0">
                            {hero.img ? (
                              <img
                                src={hero.img}
                                alt={hero.name}
                                className="h-5 w-9 rounded-sm object-cover object-center shrink-0"
                              />
                            ) : (
                              <div className="h-5 w-9 rounded-sm bg-theme-300 dark:bg-theme-700 shrink-0" />
                            )}
                            <span className="text-[11px] font-medium text-theme-700 dark:text-theme-200 truncate">
                              {hero.name}
                            </span>
                          </div>
                          {/* Games played */}
                          <span className="text-[10px] tabular-nums text-theme-500 dark:text-theme-400 text-right shrink-0">
                            {hero.gamesPlayed}
                          </span>
                          {/* Win rate + bar */}
                          <div className="flex flex-col items-end gap-0.5 shrink-0 w-14">
                            {hr !== null ? (
                              <>
                                <span className={`text-[10px] tabular-nums font-semibold leading-none ${hr >= 50 ? "text-emerald-500" : "text-red-400"}`}>
                                  {hr}%
                                </span>
                                <div className="w-full h-1 rounded-full bg-theme-200 dark:bg-theme-700 overflow-hidden">
                                  <div className={`h-full rounded-full ${hr >= 50 ? "bg-emerald-500" : "bg-red-400"}`} style={{ width: `${hr}%` }} />
                                </div>
                              </>
                            ) : (
                              <span className="text-[10px] text-theme-400">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
