import { DateTime } from "luxon";
import { useEffect } from "react";

// ── Shared utility functions ──────────────────────────────────────────────────

export function shortRelative(dt) {
  const diff = dt.diffNow("minutes").minutes;
  const abs = Math.abs(diff);
  if (abs < 60) return `in ${Math.round(abs)}m`;
  if (abs < 24 * 60) return `in ${Math.round(abs / 60)}h`;
  return `in ${Math.round(abs / (60 * 24))}d`;
}

export const fmtK = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n ?? 0));

// Format a duration in seconds as "m:ss". Returns null for missing input.
export function fmtDuration(seconds) {
  if (seconds === null || seconds === undefined) return null;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// Group a list of matches by calendar day (local time), keyed by ISO date.
// Matches with no date fall under the "unknown" key.
export function groupMatchesByDay(matches, getDate = (m) => m.beginAt) {
  return matches.reduce((acc, match) => {
    const raw = getDate(match);
    const day = raw ? DateTime.fromISO(raw).toISODate() : "unknown";
    if (!acc[day]) acc[day] = [];
    acc[day].push(match);
    return acc;
  }, {});
}

// Format a day-grouping key (ISO date or "unknown") as a display label.
// relative: show "Today"/"Tomorrow" instead of the weekday name when applicable.
export function formatDayLabel(day, { relative = true, includeYear = false } = {}) {
  if (day === "unknown") return "TBD";
  const dt = DateTime.fromISO(day).startOf("day");
  if (relative) {
    const today = DateTime.now().startOf("day");
    const diff = Math.round(dt.diff(today, "days").days);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
  }
  return dt.toFormat(includeYear ? "cccc, d MMM yyyy" : "cccc, d MMM");
}

// ── Nested-modal coordination ───────────────────────────────────────────────
// A single Escape press should close only the topmost modal, not every modal
// in the stack. Each mounted modal registers itself here; only the modal on
// top of the stack responds to Escape.
const modalStack = [];

export function useEscapeToClose(onClose) {
  useEffect(() => {
    const token = Symbol("modal");
    modalStack.push(token);
    const handler = (e) => {
      if (e.key !== "Escape") return;
      if (modalStack[modalStack.length - 1] !== token) return;
      onClose();
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      const idx = modalStack.indexOf(token);
      if (idx !== -1) modalStack.splice(idx, 1);
    };
  }, [onClose]);
}

// Body scroll lock that stays correct when modals nest: only the first modal
// to mount hides overflow, only the last one to unmount restores it.
let lockCount = 0;
let prevOverflow = "";

export function useBodyScrollLock() {
  useEffect(() => {
    if (lockCount === 0) {
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.style.overflow = prevOverflow;
      }
    };
  }, []);
}
