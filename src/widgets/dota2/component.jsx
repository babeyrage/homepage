import { useTranslation } from "next-i18next/pages";
import { useState } from "react";
import useSWR from "swr";

import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";

import { SectionLabel, MatchPulseRow, TournamentPulseRow } from "./ui/primitives";
import { formatDayLabel, groupMatchesByDay } from "./ui/utils";
import { MatchRow } from "./matches/MatchRow";
import { TournamentRow } from "./tournaments/TournamentRow";
import { TournamentModal } from "./tournaments/TournamentModal";
import { UpcomingTournamentRow } from "./tournaments/UpcomingTournamentRow";
import { UpcomingTournamentModal } from "./tournaments/UpcomingTournamentModal";
import { CompletedTournamentsModal } from "./modals/CompletedTournamentsModal";
import { UpcomingMatchesModal } from "./modals/UpcomingMatchesModal";

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
                    <MatchRow key={match.id} match={match} live showAbsolute={false} />
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
              {/* DatDota current (ongoing) tournaments */}
              {currentTournaments.length > 0 && (
                <>
                  <SectionLabel>{t("dota2.ongoing", "Ongoing Tournaments")}</SectionLabel>
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
                  <SectionLabel>{t("dota2.upcoming", "Upcoming Tournaments")}</SectionLabel>
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
