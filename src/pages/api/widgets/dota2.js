import createLogger from "utils/logger";
import { cachedRequest } from "utils/proxy/http";

const logger = createLogger("dota2");

const DATDOTA_BASE = "https://datdota.com/api";
const OPENDOTA_BASE = "https://api.opendota.com/api";

// DatDota tier IDs: 1 = PREMIUM, 2 = PROFESSIONAL
const ALLOWED_TIER_IDS = new Set([1, 2]);

function filterAndCategoriseLeagues(raw) {
  const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
  const now = Date.now();
  const fourWeeksAgo = now - 60 * 24 * 60 * 60 * 1000;

  return list
    .filter((l) => {
      if (!ALLOWED_TIER_IDS.has(l.tier?.id)) return false;
      return new Date(l.first).getTime() >= fourWeeksAgo;
    })
    .map((l) => ({
      leagueId: l.leagueId,
      name: l.name,
      tier: l.tier?.name ?? "",
      tierId: l.tier?.id ?? 0,
      first: l.first,
      last: l.last,
      count: l.count ?? 0,
      isCurrent: new Date(l.last).getTime() >= now,
      tags: l.tags ?? [],
    }))
    .sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      return new Date(b.last) - new Date(a.last);
    });
}

function seriesTypeToNumberOfGames(type) {
  if (type === 0) return 1;
  if (type === 2) return 5;
  return 3;
}

function reconstructSeries(matches) {
  const seriesMap = new Map();

  for (const m of matches) {
    // Treat series_id 0 as individual BO1 matches to avoid incorrect grouping
    const sid = m.series_id || `solo_${m.match_id}`;

    if (!seriesMap.has(sid)) {
      seriesMap.set(sid, {
        seriesId: sid,
        numberOfGames: seriesTypeToNumberOfGames(m.series_type),
        team1Id: m.radiant_team_id,
        team1Name: m.radiant_name ?? "TBD",
        team1Logo: null,
        team2Id: m.dire_team_id,
        team2Name: m.dire_name ?? "TBD",
        team2Logo: null,
        team1Wins: 0,
        team2Wins: 0,
        winnerId: null,
        startTime: m.start_time,
        games: [],
      });
    }

    const s = seriesMap.get(sid);
    const t1IsRadiant = s.team1Id === m.radiant_team_id;
    const t1Won = t1IsRadiant ? m.radiant_win : !m.radiant_win;

    if (t1Won) s.team1Wins += 1;
    else s.team2Wins += 1;

    if (m.start_time < s.startTime) s.startTime = m.start_time;

    s.games.push({
      id: m.match_id,
      startTime: m.start_time,
      // Normalise field name to match SeriesRow expectations
      length: m.duration,
      team1Score: t1IsRadiant ? m.radiant_score : m.dire_score,
      team2Score: t1IsRadiant ? m.dire_score : m.radiant_score,
      winnerId: t1Won ? s.team1Id : s.team2Id,
    });
  }

  for (const s of seriesMap.values()) {
    s.games.sort((a, b) => a.startTime - b.startTime);
    const needed = Math.floor(s.numberOfGames / 2) + 1;
    if (s.team1Wins >= needed) s.winnerId = s.team1Id;
    else if (s.team2Wins >= needed) s.winnerId = s.team2Id;
  }

  return [...seriesMap.values()].sort((a, b) => b.startTime - a.startTime);
}

export default async function handler(req, res) {
  const { mode, leagueId, isCurrent } = req.query;

  // ── mode=leagues ─────────────────────────────────────────────────────────────
  // Fetches DatDota league list, filters to PREMIUM/PROFESSIONAL within the last
  // 4 weeks, and splits into current (ongoing) vs past tournaments.
  if (mode === "leagues") {
    try {
      const raw = await cachedRequest(`${DATDOTA_BASE}/leagues`, 60);
      const leagues = filterAndCategoriseLeagues(raw);
      return res.json({
        current: leagues.filter((l) => l.isCurrent),
        past: leagues.filter((l) => !l.isCurrent),
      });
    } catch (e) {
      logger.error("DatDota leagues fetch failed: %s", e);
      return res.status(500).json({ error: "Failed to fetch tournament data" });
    }
  }

  // ── mode=tournament ───────────────────────────────────────────────────────────
  // Fetches OpenDota matches + teams for a specific league, reconstructs series
  // from individual game entries, and enriches series with team logos.
  if (mode === "tournament") {
    if (!leagueId || !/^\d+$/.test(leagueId)) {
      return res.status(400).json({ error: "Missing or invalid leagueId" });
    }

    // Current tournaments refresh more often than past ones
    const ttl = isCurrent === "true" ? 5 : 30;

    try {
      const [matchesRaw, teamsRaw] = await Promise.all([
        cachedRequest(`${OPENDOTA_BASE}/leagues/${leagueId}/matches`, ttl),
        cachedRequest(`${OPENDOTA_BASE}/leagues/${leagueId}/teams`, 60),
      ]);

      const teams = Array.isArray(teamsRaw)
        ? teamsRaw.map((t) => ({
            teamId: t.team_id,
            name: t.name ?? "Unknown",
            tag: t.tag ?? "",
            logo: t.logo_url ?? null,
            wins: t.wins ?? 0,
            losses: t.losses ?? 0,
          }))
        : [];

      const series = Array.isArray(matchesRaw) ? reconstructSeries(matchesRaw) : [];

      // Enrich series with team names + logos from the teams endpoint.
      // The /leagues/{id}/matches response omits radiant_name / dire_name, so
      // team names must be resolved here from the teams list.
      const teamMap = new Map(teams.map((t) => [t.teamId, t]));
      for (const s of series) {
        const t1 = teamMap.get(s.team1Id);
        const t2 = teamMap.get(s.team2Id);
        if (t1) {
          s.team1Name = t1.name;
          s.team1Logo = t1.logo;
        }
        if (t2) {
          s.team2Name = t2.name;
          s.team2Logo = t2.logo;
        }
      }

      return res.json({ teams, series });
    } catch (e) {
      logger.error("OpenDota tournament fetch failed (leagueId=%s): %s", leagueId, e);
      return res.status(500).json({ error: "Failed to fetch tournament data" });
    }
  }

  return res.status(400).json({ error: "Invalid or missing mode" });
}
