import { createPortal } from "react-dom";

import { ModalMatchRow } from "../matches/MatchRow";
import { formatDayLabel, groupMatchesByDay, useBodyScrollLock, useEscapeToClose } from "../ui/utils";

// ── Upcoming matches modal ────────────────────────────────────────────────────

export function UpcomingMatchesModal({ matches, showAbsolute, onToggleTime, onClose }) {
  useEscapeToClose(onClose);
  useBodyScrollLock();

  const grouped = groupMatchesByDay(matches);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[95vh] flex flex-col rounded-none sm:rounded-xl bg-theme-100 dark:bg-theme-900 shadow-2xl overflow-hidden mx-0 sm:mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme-200 dark:border-theme-700 shrink-0">
          <span className="text-base font-bold text-theme-800 dark:text-theme-100">
            Upcoming Matches
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleTime}
              className="text-xs text-theme-500 dark:text-theme-400 hover:text-theme-700 dark:hover:text-theme-200 transition-colors select-none bg-theme-100 dark:bg-theme-800 px-2 py-1 rounded-md"
            >
              {showAbsolute ? "⏱ Countdown" : "⏱ Time"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-theme-400 hover:text-theme-600 dark:text-theme-500 dark:hover:text-theme-300 transition-colors leading-none text-lg"
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
                <span className="text-xs font-bold uppercase tracking-wider text-theme-500 dark:text-theme-400 shrink-0">
                  {formatDayLabel(day)}
                </span>
                <div className="flex-1 h-px bg-theme-200 dark:bg-theme-700" />
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
