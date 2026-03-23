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
  const fourWeeksAgo = now - 28 * 24 * 60 * 60 * 1000;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  return list
    .filter((l) => {
      if (!ALLOWED_TIER_IDS.has(l.tier?.id)) return false;
      const lastTime = new Date(l.last).getTime();
      // Keep leagues that are still ongoing (within 7-day buffer) OR ended within the last 4 weeks
      return lastTime + sevenDays >= now || lastTime >= fourWeeksAgo;
    })
    .map((l) => ({
      leagueId: l.leagueId,
      name: l.name,
      tier: l.tier?.name ?? "",
      tierId: l.tier?.id ?? 0,
      first: l.first,
      last: l.last,
      count: l.count ?? 0,
      // A tournament is ongoing if today falls within first → last + 7-day buffer.
      // The buffer handles rest days and breaks between stages.
      isCurrent:
        new Date(l.first).getTime() <= now &&
        new Date(l.last).getTime() + sevenDays >= now,
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
        team1Tag: "",
        team1Logo: null,
        team2Id: m.dire_team_id,
        team2Name: m.dire_name ?? "TBD",
        team2Tag: "",
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
      team1IsRadiant: t1IsRadiant,
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
  const { mode, leagueId, isCurrent, matchId } = req.query;

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
          s.team1Tag  = t1.tag;
          s.team1Logo = t1.logo;
        }
        if (t2) {
          s.team2Name = t2.name;
          s.team2Tag  = t2.tag;
          s.team2Logo = t2.logo;
        }
      }

      return res.json({ teams, series });
    } catch (e) {
      logger.error("OpenDota tournament fetch failed (leagueId=%s): %s", leagueId, e);
      return res.status(500).json({ error: "Failed to fetch tournament data" });
    }
  }

  // ── mode=match ────────────────────────────────────────────────────────────────
  // Fetches full match detail + heroes list, returns hero picks per side and
  // first-pick team. Heroes list is cached for 24 h; match data for 60 min
  // (completed matches never change but long TTL avoids redundant requests).
  if (mode === "match") {
    if (!matchId || !/^\d+$/.test(matchId)) {
      return res.status(400).json({ error: "Missing or invalid matchId" });
    }

    try {
      const [matchRaw, heroesRaw, itemConstantsRaw] = await Promise.all([
        cachedRequest(`${OPENDOTA_BASE}/matches/${matchId}`, 60),
        cachedRequest(`${OPENDOTA_BASE}/heroes`, 1440),
        cachedRequest(`${OPENDOTA_BASE}/constants/items`, 1440),
      ]);

      // Build hero lookup: id → { id, name, img }
      const heroMap = new Map();
      if (Array.isArray(heroesRaw)) {
        for (const h of heroesRaw) {
          const shortName = h.name?.replace("npc_dota_hero_", "") ?? "";
          heroMap.set(h.id, {
            id: h.id,
            name: h.localized_name ?? shortName,
            img: shortName
              ? `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${shortName}.png`
              : null,
          });
        }
      }

      // Build item lookup: id → { name, dname, img } using OpenDota constants
      const itemMap = new Map();
      if (itemConstantsRaw && typeof itemConstantsRaw === "object") {
        for (const [name, data] of Object.entries(itemConstantsRaw)) {
          if (typeof data.id === "number" && data.id > 0) {
            itemMap.set(data.id, {
              name,
              dname: data.dname ?? name,
              img: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${name}.png`,
            });
          }
        }
      }

      const toItem = (id) => {
        if (!id) return null;
        const entry = itemMap.get(id);
        return entry
          ? { id, name: entry.dname, img: entry.img }
          : { id, name: "", img: null };
      };

      // picks_bans filtered to picks only, sorted by draft order
      const picks = Array.isArray(matchRaw.picks_bans)
        ? matchRaw.picks_bans.filter((p) => p.is_pick).sort((a, b) => a.order - b.order)
        : [];

      const toHero = (p) => heroMap.get(p.hero_id) ?? { id: p.hero_id, name: "", img: null };
      const radiantPicks = picks.filter((p) => p.team === 0).map(toHero);
      const direPicks = picks.filter((p) => p.team === 1).map(toHero);

      // First pick = team of the lowest-order pick entry (null if no draft data)
      const firstPickIsRadiant = picks.length > 0 ? picks[0].team === 0 : null;

      // Per-player stats — slot 0-4 = Radiant, 128-132 = Dire
      const players = Array.isArray(matchRaw.players)
        ? matchRaw.players.map((p) => {
            const hero = heroMap.get(p.hero_id) ?? { id: p.hero_id, name: "", img: null };
            return {
              slot: p.player_slot,
              isRadiant: p.player_slot < 128,
              proName: p.name ?? null,
              personaname: p.personaname ?? null,
              hero,
              level: p.level ?? 0,
              kills: p.kills ?? 0,
              deaths: p.deaths ?? 0,
              assists: p.assists ?? 0,
              lastHits: p.last_hits ?? 0,
              denies: p.denies ?? 0,
              netWorth: p.net_worth ?? 0,
              gpm: p.gold_per_min ?? 0,
              xpm: p.xp_per_min ?? 0,
              heroDamage: p.hero_damage ?? 0,
              towerDamage: p.tower_damage ?? 0,
              heroHealing: p.hero_healing ?? 0,
              items: [p.item_0, p.item_1, p.item_2, p.item_3, p.item_4, p.item_5].map(toItem),
              backpack: [p.backpack_0, p.backpack_1, p.backpack_2].map(toItem),
              neutral: toItem(p.item_neutral),
            };
          })
        : [];

      const radiantPlayers = players.filter((p) => p.isRadiant);
      const direPlayers    = players.filter((p) => !p.isRadiant);

      return res.json({
        matchId: matchRaw.match_id,
        duration: matchRaw.duration,
        radiantScore: matchRaw.radiant_score,
        direScore: matchRaw.dire_score,
        radiantWin: matchRaw.radiant_win,
        firstPickIsRadiant,
        radiantPicks,
        direPicks,
        radiantPlayers,
        direPlayers,
      });
    } catch (e) {
      logger.error("OpenDota match fetch failed (matchId=%s): %s", matchId, e);
      return res.status(500).json({ error: "Failed to fetch match data" });
    }
  }

  return res.status(400).json({ error: "Invalid or missing mode" });
}
