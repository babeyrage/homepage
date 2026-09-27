import { DateTime } from "luxon";
import { useTranslation } from "next-i18next/pages";
import { useMemo, useState } from "react";

import { SectionLabel, ZoneLabel, MatchPulseRow, TournamentPulseRow } from "./ui/primitives";
import { formatDayLabel, groupMatchesByDay } from "./ui/utils";
import { MatchRow } from "./matches/MatchRow";
import { LiveMatchPanel } from "./matches/LiveMatchPanel";
import { TournamentRow } from "./tournaments/TournamentRow";
import { TournamentModal } from "./tournaments/TournamentModal";
import { CompletedTournamentsModal } from "./modals/CompletedTournamentsModal";
import { UpcomingMatchesModal } from "./modals/UpcomingMatchesModal";

import useWidgetAPI from "utils/proxy/use-widget-api";
import Container from "components/services/widget/container";

// ── Main component ────────────────────────────────────────────────────────────

// Only surface completed tournaments that wrapped up recently — CitoAPI's
// listing otherwise goes back indefinitely and buries anything current.
const COMPLETED_WINDOW_DAYS = 30;

// CitoAPI's own tournament.status is null for a large share of tournaments —
// fall back to cross-referencing the tournament's id against whichever match
// list currently references it. A tournament with no live/upcoming match (or
// no matches at all) is treated as completed.
function deriveTournamentStatus(tournament, liveMatches, upcomingMatches) {
  if (tournament.status) return tournament.status;
  if (liveMatches.some((m) => m.tournamentId === tournament.id)) return "live";
  if (upcomingMatches.some((m) => m.tournamentId === tournament.id)) return "upcoming";
  return "completed";
}

// A completed tournament with no end/start date at all can't be judged for
// recency — exclude it rather than let stale, undated entries pile up.
function isRecentlyCompleted(tournament, cutoff) {
  const finished = tournament.endsAt ?? tournament.startsAt;
  if (!finished) return false;
  const finishedAt = DateTime.fromISO(finished);
  return finishedAt.isValid && finishedAt >= cutoff;
}

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const [modalTournament, setModalTournament] = useState(null);
  const [showAbsoluteTime, setShowAbsoluteTime] = useState(true);
  const [showUpcomingModal, setShowUpcomingModal] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [liveMatchPanel, setLiveMatchPanel] = useState(null);

  const { data: liveData, error: liveError } = useWidgetAPI(widget, "live_matches");
  const { data: upcomingData, error: upcomingError } = useWidgetAPI(widget, "upcoming_matches");
  const { data: recentData, error: recentError } = useWidgetAPI(widget, "recent_matches");
  const { data: tournamentsData, error: tournamentsError } = useWidgetAPI(widget, "tournaments");

  // ── Derived state ─────────────────────────────────────────────────────────
  const liveMatches = Array.isArray(liveData) ? liveData : [];
  const upcomingMatches = Array.isArray(upcomingData) ? upcomingData : [];
  const recentMatches = Array.isArray(recentData) ? recentData : [];
  const tournaments = Array.isArray(tournamentsData) ? tournamentsData : [];

  const { ongoingTournaments, upcomingTournaments, completedTournaments } = useMemo(() => {
    const live = Array.isArray(liveData) ? liveData : [];
    const upcoming = Array.isArray(upcomingData) ? upcomingData : [];
    const list = Array.isArray(tournamentsData) ? tournamentsData : [];
    const cutoff = DateTime.now().minus({ days: COMPLETED_WINDOW_DAYS });

    const ongoing = [];
    const scheduled = [];
    const completed = [];
    for (const tournament of list) {
      const status = deriveTournamentStatus(tournament, live, upcoming);
      if (status === "live") ongoing.push(tournament);
      else if (status === "upcoming") scheduled.push(tournament);
      else if (isRecentlyCompleted(tournament, cutoff)) completed.push(tournament);
    }
    return { ongoingTournaments: ongoing, upcomingTournaments: scheduled, completedTournaments: completed };
  }, [tournamentsData, liveData, upcomingData]);

  const matchesLoading = !liveData && !liveError && !upcomingData && !upcomingError;
  const tournamentsLoading = !tournamentsData && !tournamentsError;

  if (liveError && upcomingError && !liveData && !upcomingData) {
    return <Container service={service} error={liveError} />;
  }

  return (
    <Container service={service}>
      <div className="flex flex-col w-full">
        <ZoneLabel>{t("dota2.title", "Dota 2")}</ZoneLabel>
        <div className="flex flex-col sm:flex-row w-full gap-3">

          {/* ── Left panel: Matches ─────────────────────────────────────────── */}
          <div className="flex flex-col flex-1 min-w-0">
            {matchesLoading ? (
              <>
                <SectionLabel>{t("dota2.live", "Live Matches")}</SectionLabel>
                <MatchPulseRow />
                <SectionLabel>{t("dota2.upcoming", "Upcoming Matches")}</SectionLabel>
                <MatchPulseRow />
                <MatchPulseRow />
              </>
            ) : (
              <>
                {liveMatches.length > 0 && (
                  <>
                    <SectionLabel>{t("dota2.live", "Live Matches")}</SectionLabel>
                    {liveMatches.map((match) => (
                      <MatchRow
                        key={match.id}
                        match={match}
                        live
                        showAbsolute={false}
                        onClick={match.live ? () => setLiveMatchPanel(match) : undefined}
                      />
                    ))}
                  </>
                )}

                {/* Upcoming header with countdown/time toggle */}
                <div className="flex items-center justify-between mb-0.5 mt-1.5 first:mt-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-theme-500 dark:text-theme-400">
                    {t("dota2.upcoming", "Upcoming Matches")}
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

                  const grouped = groupMatchesByDay(preview);

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
                          className="w-full text-[9px] font-medium text-theme-400 dark:text-theme-500 hover:text-theme-600 dark:hover:text-theme-300 bg-theme-200/50 dark:bg-theme-900/20 hover:bg-theme-200/80 dark:hover:bg-theme-900/40 border border-theme-300/30 dark:border-theme-700/30 transition-colors text-center py-1 mt-0.5 rounded-sm"
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
                <SectionLabel>{t("dota2.ongoing", "Ongoing Tournaments")}</SectionLabel>
                <TournamentPulseRow />
                <TournamentPulseRow />
                <SectionLabel>{t("dota2.upcoming", "Upcoming Tournaments")}</SectionLabel>
                <TournamentPulseRow />
              </>
            ) : (
              <>
                {ongoingTournaments.length > 0 && (
                  <>
                    <SectionLabel>{t("dota2.ongoing", "Ongoing Tournaments")}</SectionLabel>
                    {ongoingTournaments.map((tournament) => (
                      <TournamentRow
                        key={tournament.id}
                        tournament={tournament}
                        status="live"
                        onClick={() => setModalTournament({ tournament, status: "live" })}
                      />
                    ))}
                  </>
                )}

                {upcomingTournaments.length > 0 && (
                  <>
                    <SectionLabel>{t("dota2.upcoming", "Upcoming Tournaments")}</SectionLabel>
                    {upcomingTournaments.map((tournament) => (
                      <TournamentRow
                        key={tournament.id}
                        tournament={tournament}
                        status="upcoming"
                        onClick={() => setModalTournament({ tournament, status: "upcoming" })}
                      />
                    ))}
                  </>
                )}

                {completedTournaments.length > 0 && (
                  <>
                    <SectionLabel>{t("dota2.completed", "Completed")}</SectionLabel>
                    {completedTournaments.slice(0, 8).map((tournament) => (
                      <TournamentRow
                        key={tournament.id}
                        tournament={tournament}
                        status="completed"
                        onClick={() => setModalTournament({ tournament, status: "completed" })}
                      />
                    ))}
                    {completedTournaments.length > 8 && (
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

                {!tournamentsError &&
                  ongoingTournaments.length === 0 &&
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
      </div>

      {/* ── Completed tournaments modal ───────────────────────────────────── */}
      {showCompletedModal && (
        <CompletedTournamentsModal
          tournaments={completedTournaments}
          onSelect={(tournament) => { setShowCompletedModal(false); setModalTournament({ tournament, status: "completed" }); }}
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

      {/* ── Live in-game panel ───────────────────────────────────────────── */}
      {liveMatchPanel && (
        <LiveMatchPanel match={liveMatchPanel} onClose={() => setLiveMatchPanel(null)} />
      )}

      {/* ── Tournament modal ─────────────────────────────────────────────── */}
      {modalTournament && (
        <TournamentModal
          tournament={modalTournament.tournament}
          status={modalTournament.status}
          liveMatches={liveMatches}
          upcomingMatches={upcomingMatches}
          recentMatches={recentMatches}
          widget={widget}
          onClose={() => setModalTournament(null)}
        />
      )}
    </Container>
  );
}
