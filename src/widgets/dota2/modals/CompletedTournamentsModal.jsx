import { createPortal } from "react-dom";

import { TournamentRow } from "../tournaments/TournamentRow";
import { useBodyScrollLock, useEscapeToClose } from "../ui/utils";

// ── Completed tournaments modal ───────────────────────────────────────────────

export function CompletedTournamentsModal({ tournaments, onSelect, onClose }) {
  useEscapeToClose(onClose);
  useBodyScrollLock();

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[95vh] flex flex-col rounded-none sm:rounded-xl bg-theme-100 dark:bg-theme-900 shadow-2xl overflow-hidden mx-0 sm:mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme-200 dark:border-theme-700 shrink-0">
          <span className="text-sm font-semibold text-theme-700 dark:text-theme-200">
            Completed
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
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
