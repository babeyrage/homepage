import { asJson } from "utils/proxy/api-helpers";
import credentialedProxyHandler from "utils/proxy/handlers/credentialed";

// CitoAPI stream platform codes observed in the wild: 1 = Twitch, 11 = YouTube, 99 = Kick.
// streamUrl is frequently null for Twitch/YouTube — derive a playable URL from platform + streamId.
function deriveStreamUrl(stream) {
  if (stream.streamUrl) return stream.streamUrl;
  if (stream.platform === 1) return `https://twitch.tv/${stream.streamId}`;
  if (stream.platform === 11) {
    // Observed streamId shape: "<eventId> - <videoId>"
    const videoId = stream.streamId?.split(" - ").pop()?.trim();
    return videoId ? `https://youtube.com/watch?v=${videoId}` : null;
  }
  if (stream.platform === 99) return `https://kick.com/${stream.streamId}`;
  return null;
}

// Pick the best stream URL from CitoAPI's raw.streams[] shape:
// prefer official English stream -> any official stream -> main (non-event) -> first available.
function pickStreamUrl(streamsList) {
  if (!Array.isArray(streamsList) || streamsList.length === 0) return null;
  const resolved = streamsList
    .map((s) => ({ ...s, url: deriveStreamUrl(s) }))
    .filter((s) => s.url);
  if (resolved.length === 0) return null;
  const official = resolved.filter((s) => s.isEventStream);
  const candidate =
    official.find((s) => s.languageCode === "en") ??
    official[0] ??
    resolved.find((s) => !s.isEventStream) ??
    resolved[0];
  return candidate?.url ?? null;
}

function mapMatch(m) {
  const team1 = m.team1 ?? {};
  const team2 = m.team2 ?? {};
  return {
    id: m.id,
    tournamentId: m.tournamentId,
    leagueName: m.tournamentName ?? "",
    team1Id: m.team1Id,
    team2Id: m.team2Id,
    team1: m.team1Name ?? team1.name ?? "TBD",
    team2: m.team2Name ?? team2.name ?? "TBD",
    team1Tag: team1.tag ?? "",
    team2Tag: team2.tag ?? "",
    team1Logo: team1.imageUrl ?? null,
    team2Logo: team2.imageUrl ?? null,
    team1Score: m.team1Score ?? 0,
    team2Score: m.team2Score ?? 0,
    winnerTeamId: m.winnerTeamId ?? null,
    bestOf: m.bestOf ?? 3,
    status: m.status ?? null,
    beginAt: m.startsAt,
    streamUrl: pickStreamUrl(m.raw?.streams),
  };
}

function mapDraftAction(d) {
  return { teamId: d.teamId, heroId: d.heroId, heroName: d.heroName, action: d.action, order: d.order, phase: d.phase };
}

function mapPlayerStat(p) {
  return {
    accountId: p.accountId,
    playerName: p.playerName ?? null,
    teamId: p.teamId,
    isRadiant: p.isRadiant,
    heroId: p.heroId,
    heroName: p.heroName,
    kills: p.kills ?? 0,
    deaths: p.deaths ?? 0,
    assists: p.assists ?? 0,
    gpm: p.gpm ?? 0,
    xpm: p.xpm ?? 0,
    lastHits: p.lastHits ?? 0,
    denies: p.denies ?? 0,
    heroDamage: p.heroDamage ?? 0,
    towerDamage: p.towerDamage ?? 0,
    benchmarkPercentiles: p.benchmarkPercentiles ?? null,
  };
}

function mapGame(g) {
  return {
    id: g.id,
    gameNumber: g.gameNumber,
    openDotaMatchId: g.openDotaMatchId ?? null,
    duration: g.duration ?? null,
    radiantTeamId: g.radiantTeamId ?? null,
    direTeamId: g.direTeamId ?? null,
    winnerTeamId: g.winnerTeamId ?? null,
    draft: Array.isArray(g.draft) ? g.draft.map(mapDraftAction) : [],
    playerStats: Array.isArray(g.playerStats) ? g.playerStats.map(mapPlayerStat) : [],
  };
}

const widget = {
  api: "https://api.citoapi.com/api/v1/dota2/{endpoint}",
  proxyHandler: credentialedProxyHandler,

  mappings: {
    // Response shape differs from the other list endpoints: array is nested at data.matches.
    live_matches: {
      endpoint: "matches/live",
      map: (data) => {
        const body = asJson(data);
        const matches = Array.isArray(body?.data?.matches) ? body.data.matches : [];
        return matches.map(mapMatch);
      },
    },

    upcoming_matches: {
      endpoint: "matches/upcoming",
      map: (data) => {
        const body = asJson(data);
        const matches = Array.isArray(body?.data) ? body.data : [];
        return matches.map(mapMatch);
      },
    },

    recent_matches: {
      endpoint: "matches/recent",
      map: (data) => {
        const body = asJson(data);
        const matches = Array.isArray(body?.data) ? body.data : [];
        return matches.map(mapMatch);
      },
    },

    // Path-parameterised endpoint — call sites must build the request URL manually
    // (segments aren't supported by the stock useWidgetAPI hook), see ui/utils.js's
    // useMatchDetail().
    match_detail: {
      endpoint: "matches/{matchId}",
      segments: ["matchId"],
      map: (data) => {
        const body = asJson(data);
        const m = body?.data;
        if (!m) return null;
        return {
          ...mapMatch(m),
          games: Array.isArray(m.games) ? m.games.map(mapGame) : [],
        };
      },
    },

    tournaments: {
      endpoint: "tournaments",
      map: (data) => {
        const body = asJson(data);
        const tournaments = Array.isArray(body?.data) ? body.data : [];
        return tournaments.map((t) => ({
          id: t.id,
          name: t.name ?? "",
          imageUrl: t.imageUrl ?? null,
          prizePool: t.prizePool ?? null,
          currency: t.currency ?? null,
          startsAt: t.startsAt ?? null,
          endsAt: t.endsAt ?? null,
          status: t.status ?? null,
        }));
      },
    },
  },
};

export default widget;
