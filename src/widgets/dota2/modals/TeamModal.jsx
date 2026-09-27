import { createPortal } from "react-dom";

import { ErrorState, LogoBox, PulseRow } from "../ui/primitives";
import { useBodyScrollLock, useEscapeToClose, useMatchDetail } from "../ui/utils";

// ── Team detail modal ─────────────────────────────────────────────────────────
// CitoAPI has no team-by-id lookup — team profile data only comes embedded in a
// match's detail response, and only for teams CitoAPI has fully synced. `side`
// picks team1Profile/team2Profile off that one reference match.

function StatCell({ label, value, color = "text-theme-700 dark:text-theme-200", bar }) {
  if (value == null) return null;
  return (
    <div className="flex flex-col items-center py-2.5 px-1 gap-0.5 border-r border-theme-200 dark:border-theme-700 last:border-r-0">
      <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-[9px] font-semibold uppercase tracking-wide text-theme-400 dark:text-theme-500">{label}</span>
      {bar != null && (
        <div className="w-10 h-1 mt-0.5 rounded-full bg-theme-200 dark:bg-theme-700 overflow-hidden">
          <div className={`h-full rounded-full ${bar >= 50 ? "bg-emerald-500" : "bg-red-400"}`} style={{ width: `${bar}%` }} />
        </div>
      )}
    </div>
  );
}

export function TeamModal({ matchId, side, teamName, teamLogo, widget, onClose }) {
  const { data: detail, error, isLoading } = useMatchDetail(widget, matchId);
  const profile = side === "team2" ? detail?.team2Profile : detail?.team1Profile;

  useEscapeToClose(onClose);
  useBodyScrollLock();

  const hasRecord = profile && (profile.winCount != null || profile.lossCount != null);
  const totalGames = hasRecord ? (profile.winCount ?? 0) + (profile.lossCount ?? 0) + (profile.drawCount ?? 0) : 0;
  const winRate = profile?.winRate ?? (totalGames > 0 ? Math.round(((profile.winCount ?? 0) / totalGames) * 100) : null);
  const hasProfileExtras = hasRecord || profile?.eloRating != null || profile?.followerCount != null || profile?.earningPrizeUsd != null;

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
            <LogoBox src={profile?.imageUrl ?? teamLogo} size="lg" />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-theme-800 dark:text-theme-100 truncate">{profile?.name ?? teamName}</span>
              <div className="flex items-center gap-1.5">
                {profile?.tag && (
                  <span className="text-[10px] text-theme-400 dark:text-theme-500">{profile.tag}</span>
                )}
                {profile?.countryName && (
                  <span className="flex items-center gap-1 text-[10px] text-theme-400 dark:text-theme-500">
                    {profile.countryFlag && <img src={profile.countryFlag} alt="" className="h-2.5 w-auto" />}
                    {profile.countryName}
                  </span>
                )}
                {profile?.worldRanking != null && (
                  <span className="text-[10px] font-semibold text-amber-500 dark:text-amber-400">#{profile.worldRanking} world</span>
                )}
              </div>
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

        {/* ── Stat strip — only the fields CitoAPI actually synced for this team ── */}
        {hasProfileExtras && (
          <div className="grid grid-cols-4 border-t border-b border-theme-200 dark:border-theme-700 shrink-0">
            <StatCell label="Wins" value={profile.winCount} color="text-emerald-500" />
            <StatCell label="Losses" value={profile.lossCount} color="text-red-400" />
            <StatCell
              label="Win Rate"
              value={winRate !== null ? `${winRate}%` : null}
              color={winRate >= 50 ? "text-emerald-500" : "text-red-400"}
              bar={winRate}
            />
            <StatCell label="Elo" value={profile.eloRating} color="text-amber-500 dark:text-amber-400" />
          </div>
        )}

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => <PulseRow key={i} />)}
            </div>
          ) : error ? (
            <ErrorState message="Failed to load team data" />
          ) : !profile ? (
            <div className="py-8 text-center text-[11px] text-theme-400 dark:text-theme-500">
              No profile data available for this team
            </div>
          ) : (
            <>
              {(profile.followerCount != null || profile.earningPrizeUsd != null) && (
                <div className="flex items-center gap-4 mb-4">
                  {profile.followerCount != null && (
                    <div className="flex flex-col items-center flex-1 py-2 rounded-md bg-theme-100 dark:bg-theme-800">
                      <span className="text-sm font-bold tabular-nums text-theme-700 dark:text-theme-200">{profile.followerCount.toLocaleString()}</span>
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-theme-400 dark:text-theme-500">Followers</span>
                    </div>
                  )}
                  {profile.earningPrizeUsd != null && (
                    <div className="flex flex-col items-center flex-1 py-2 rounded-md bg-theme-100 dark:bg-theme-800">
                      <span className="text-sm font-bold tabular-nums text-emerald-500">${profile.earningPrizeUsd.toLocaleString()}</span>
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-theme-400 dark:text-theme-500">Prize Money</span>
                    </div>
                  )}
                </div>
              )}

              {profile.players?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-theme-400 dark:text-theme-500 mb-1.5">
                    Current Roster
                  </p>
                  <div className="flex flex-col gap-1">
                    {profile.players.map((player) => (
                      <div key={player.id} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md bg-theme-100 dark:bg-theme-800">
                        {player.imageUrl ? (
                          <img src={player.imageUrl} alt="" className="h-6 w-6 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-theme-300 dark:bg-theme-700 shrink-0" />
                        )}
                        <span className="text-[11px] font-semibold flex-1 truncate text-theme-700 dark:text-theme-200">
                          {player.name ?? "Unknown Player"}
                        </span>
                        {player.countryFlag && <img src={player.countryFlag} alt="" className="h-2.5 w-auto shrink-0" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!hasProfileExtras && !profile.players?.length && (
                <div className="py-6 text-center text-[11px] text-theme-400 dark:text-theme-500">
                  Limited profile data available for this team
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
