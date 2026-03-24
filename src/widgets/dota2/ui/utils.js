// ── Shared utility functions ──────────────────────────────────────────────────

export function shortRelative(dt) {
  const diff = dt.diffNow("minutes").minutes;
  const abs = Math.abs(diff);
  if (abs < 60) return `in ${Math.round(abs)}m`;
  if (abs < 24 * 60) return `in ${Math.round(abs / 60)}h`;
  return `in ${Math.round(abs / (60 * 24))}d`;
}

export const fmtK = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n ?? 0));
