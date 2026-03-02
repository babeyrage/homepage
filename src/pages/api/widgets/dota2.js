import { servicesFromConfig } from "utils/config/service-helpers";
import createLogger from "utils/logger";
import { cachedRequest } from "utils/proxy/http";

const logger = createLogger("dota2");

function findDota2Key(groups) {
  for (const group of groups) {
    for (const service of group.services ?? []) {
      if (service.widget?.type === "dota2" && service.widget.key) {
        return service.widget.key;
      }
    }
    const nestedKey = findDota2Key(group.groups ?? []);
    if (nestedKey) return nestedKey;
  }
  return null;
}

function mapScheduled(match) {
  const team1 = match.opponents?.[0]?.opponent;
  const team2 = match.opponents?.[1]?.opponent;
  return {
    id: match.id,
    beginAt: match.begin_at ?? null,
    team1Name: team1?.name ?? "TBD",
    team1Logo: team1?.image_url ?? null,
    team2Name: team2?.name ?? "TBD",
    team2Logo: team2?.image_url ?? null,
    numberOfGames: match.number_of_games ?? null,
  };
}

function mapSeries(match) {
  const team1 = match.opponents?.[0]?.opponent;
  const team2 = match.opponents?.[1]?.opponent;
  return {
    id: match.id,
    beginAt: match.begin_at ?? null,
    team1Id: team1?.id ?? null,
    team1Name: team1?.name ?? "TBD",
    team1Logo: team1?.image_url ?? null,
    team2Id: team2?.id ?? null,
    team2Name: team2?.name ?? "TBD",
    team2Logo: team2?.image_url ?? null,
    numberOfGames: match.number_of_games ?? null,
    winnerId: match.winner?.id ?? match.winner_id ?? null,
    games: (match.games ?? []).map((game) => {
      const t1Stats = game.teams?.find((t) => t.team?.id === (team1?.id ?? null));
      const t2Stats = game.teams?.find((t) => t.team?.id === (team2?.id ?? null));
      return {
        id: game.id,
        winnerId: game.winner?.id ?? game.winner_id ?? null,
        length: game.length ?? null,
        team1Score: t1Stats?.score ?? null,
        team2Score: t2Stats?.score ?? null,
      };
    }),
  };
}

export default async function handler(req, res) {
  const { tournamentId, mode } = req.query;

  if (!tournamentId || !/^\d+$/.test(tournamentId)) {
    return res.status(400).json({ error: "Missing or invalid tournamentId" });
  }

  let apiKey;
  try {
    const groups = await servicesFromConfig();
    apiKey = findDota2Key(groups);
  } catch (e) {
    logger.error("Failed to load services config: %s", e);
    return res.status(500).json({ error: "Failed to load configuration" });
  }

  if (!apiKey) {
    return res.status(400).json({ error: "No Dota 2 API key found in configuration" });
  }

  const base = `https://api.pandascore.co/dota2`;

  if (mode === "schedule") {
    const [liveRaw, upcomingRaw, pastRaw] = await Promise.all([
      cachedRequest(
        `${base}/matches/running?token=${apiKey}&filter[tournament_id]=${tournamentId}&page[size]=5`,
        2,
      ),
      cachedRequest(
        `${base}/matches/upcoming?token=${apiKey}&filter[tournament_id]=${tournamentId}&sort=begin_at&page[size]=10`,
        10,
      ),
      cachedRequest(
        `${base}/matches/past?token=${apiKey}&filter[tournament_id]=${tournamentId}&sort=-begin_at&page[size]=10`,
        10,
      ),
    ]);

    return res.json({
      live: Array.isArray(liveRaw) ? liveRaw.filter((m) => m.opponents?.length === 2).map(mapScheduled) : [],
      upcoming: Array.isArray(upcomingRaw)
        ? upcomingRaw.filter((m) => m.opponents?.length === 2).map(mapScheduled)
        : [],
      past: Array.isArray(pastRaw) ? pastRaw.filter((m) => m.opponents?.length === 2).map(mapSeries) : [],
    });
  }

  // Default: past matches only (used by completed tournament expansion)
  const data = await cachedRequest(
    `${base}/matches/past?token=${apiKey}&filter[tournament_id]=${tournamentId}&sort=-begin_at&page[size]=20`,
    10,
  );

  if (!Array.isArray(data)) {
    return res.json({ series: [] });
  }

  return res.json({
    series: data.filter((match) => match.opponents?.length === 2).map(mapSeries),
  });
}
