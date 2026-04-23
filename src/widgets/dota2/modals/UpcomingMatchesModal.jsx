import { DateTime } from "luxon";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";

import { ModalMatchRow } from "../matches/MatchRow";

// ── Upcoming matches modal ────────────────────────────────────────────────────

export function UpcomingMatchesModal({ matches, showAbsolute, onToggleTime, onClose }) {
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
        className="relative w-full max-w-lg max-h-[95vh] flex flex-col rounded-none sm:rounded-xl bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden mx-0 sm:mx-4"
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
