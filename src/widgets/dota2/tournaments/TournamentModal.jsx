import { DateTime } from "luxon";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";

import { LogoBox, PulseRow } from "../ui/primitives";
import { TeamModal } from "../modals/TeamModal";
import { SeriesRow } from "../matches/SeriesRow";

// ── Tournament modal (portal — renders outside widget container) ──────────────

const PAGE_SIZE = 10;

export function TournamentModal({ tournament, onClose }) {
  const { leagueId, isCurrent, name, tierId, first, last } = tournament;

  const begin = first ? DateTime.fromISO(first) : null;
  const end = last ? DateTime.fromISO(last) : null;
  const dateLabel =
    begin && end ? `${begin.toFormat("d MMM")} – ${end.toFormat("d MMM yyyy")}` : "";

  const url = `/api/widgets/dota2?mode=tournament&leagueId=${leagueId}&isCurrent=${isCurrent}`;
  const { data, isLoading } = useSWR(url, { revalidateOnFocus: false });

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedTeam, setSelectedTeam] = useState(null);
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
              {/* Participants — top */}
              {teams.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-theme-400 dark:text-theme-500 mb-1.5">
                    Participants — {teams.length} teams
                  </p>
                  <div className={`grid gap-1 ${teams.length > 8 ? "grid-cols-3" : "grid-cols-2"}`}>
                    {teams.map((team) => (
                      <button
                        key={team.teamId}
                        type="button"
                        onClick={() => setSelectedTeam(team)}
                        className="flex items-center gap-1.5 rounded-md bg-theme-100 dark:bg-theme-800 hover:bg-theme-200 dark:hover:bg-theme-700 px-2 py-1.5 min-w-0 transition-colors text-left"
                      >
                        <LogoBox src={team.logo} size="sm" />
                        <span className={`font-medium text-theme-700 dark:text-theme-200 truncate leading-tight ${teams.length > 8 ? "text-[9px]" : "text-[10px]"}`}>
                          {team.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Series results */}
              {series.length > 0 ? (
                <div className="border-t border-theme-200 dark:border-theme-700 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-theme-400 dark:text-theme-500 mb-1.5">
                    Results — {series.length} series
                  </p>
                  {visibleSeries.map((s) => (
                    <SeriesRow key={s.seriesId} series={s} />
                  ))}
                  {hasMore && (
                    <button
                      type="button"
                      onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                      className="w-full mt-1 py-1.5 text-[10px] text-theme-500 dark:text-theme-400 hover:text-theme-700 dark:hover:text-theme-200 transition-colors text-center rounded-md bg-theme-100 dark:bg-theme-800"
                    >
                      Show {Math.min(remaining, PAGE_SIZE)} more · {remaining} remaining
                    </button>
                  )}
                  {visibleCount > PAGE_SIZE && (
                    <button
                      type="button"
                      onClick={() => setVisibleCount(PAGE_SIZE)}
                      className="w-full mt-0.5 py-1 text-[10px] text-theme-400 dark:text-theme-500 hover:text-theme-700 dark:hover:text-theme-200 transition-colors text-center"
                    >
                      Show less
                    </button>
                  )}
                </div>
              ) : (
                !isLoading && (
                  <div className="text-[11px] text-theme-400 dark:text-theme-500 py-4 text-center">
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
