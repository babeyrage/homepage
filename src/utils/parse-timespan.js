// Parses a .NET TimeSpan string (as returned by the Radarr/Sonarr queue APIs), e.g.
// "00:06:52.8668712" or "1.02:03:04", into a whole number of seconds.
export default function parseTimeSpan(value) {
  if (typeof value !== "string" || value.length === 0) return null;

  const match = value.match(/^(?:(\d+)\.)?(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?$/);
  if (!match) return null;

  const [, days, hours, minutes, seconds] = match;
  return (Number(days ?? 0) * 86400 + Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds));
}
