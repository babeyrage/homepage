import { asJson } from "utils/proxy/api-helpers";
import genericProxyHandler from "utils/proxy/handlers/generic";

// PandaScore tiers that correspond to Tier 1 (s, a) and Tier 2 (b) in Dota 2
const ALLOWED_TIERS = new Set(["s", "a"]);

const widget = {
  api: "https://api.pandascore.co/dota2/{endpoint}?token={key}",
  proxyHandler: genericProxyHandler,

  mappings: {
    live_matches: {
      // filter[tier] is not supported on matches endpoints — tier filtering is done in map()
      endpoint: "matches/running?page[size]=10&sort=-begin_at",
      map: (data) => {
        const matches = asJson(data);
        if (!Array.isArray(matches)) return [];
        return matches
          .filter((match) => ALLOWED_TIERS.has(match.tournament?.tier))
          .slice(0, 5)
          .map((match) => ({
            id: match.id,
            team1: match.opponents?.[0]?.opponent?.name ?? "TBD",
            team2: match.opponents?.[1]?.opponent?.name ?? "TBD",
            team1Logo: match.opponents?.[0]?.opponent?.image_url ?? null,
            team2Logo: match.opponents?.[1]?.opponent?.image_url ?? null,
            leagueName: match.league?.name ?? match.tournament?.name ?? "",
            serieName: match.serie?.full_name ?? "",
            beginAt: match.begin_at,
            status: match.status,
          }));
      },
    },

    upcoming_matches: {
      endpoint: "matches/upcoming?page[size]=10&sort=begin_at",
      map: (data) => {
        const matches = asJson(data);
        if (!Array.isArray(matches)) return [];
        return matches
          .filter((match) => ALLOWED_TIERS.has(match.tournament?.tier))
          .slice(0, 5)
          .map((match) => ({
            id: match.id,
            team1: match.opponents?.[0]?.opponent?.name ?? "TBD",
            team2: match.opponents?.[1]?.opponent?.name ?? "TBD",
            team1Logo: match.opponents?.[0]?.opponent?.image_url ?? null,
            team2Logo: match.opponents?.[1]?.opponent?.image_url ?? null,
            leagueName: match.league?.name ?? match.tournament?.name ?? "",
            serieName: match.serie?.full_name ?? "",
            beginAt: match.begin_at,
            status: match.status,
          }));
      },
    },

    // Fetch scheduled matches for a specific tournament by ID.
    // Caller passes { "filter[tournament_id]": id, "page[size]": 50, sort: "begin_at" }
    // via useWidgetAPI(widget, "tournament_matches", queryParams).
    tournament_matches: {
      endpoint: "matches/upcoming",
      optionalParams: ["filter[tournament_id]", "page[size]", "sort"],
      map: (data) => {
        const matches = asJson(data);
        if (!Array.isArray(matches)) return [];
        return matches.map((match) => ({
          id: match.id,
          team1: match.opponents?.[0]?.opponent?.name ?? "TBD",
          team2: match.opponents?.[1]?.opponent?.name ?? "TBD",
          team1Logo: match.opponents?.[0]?.opponent?.image_url ?? null,
          team2Logo: match.opponents?.[1]?.opponent?.image_url ?? null,
          status: match.status,
          beginAt: match.begin_at,
          numberOfGames: match.number_of_games ?? 3,
        }));
      },
    },

    upcoming_tournaments: {
      endpoint: "tournaments/upcoming?page[size]=10&filter[tier]=s,a&sort=begin_at",
      map: (data) => {
        const tournaments = asJson(data);
        if (!Array.isArray(tournaments)) return [];
        return tournaments
          .filter((t) => ALLOWED_TIERS.has(t.tier))
          .slice(0, 3)
          .map((t) => ({
            id: t.id,
            name: t.name ?? "",
            leagueName: t.league?.name ?? "",
            season: t.serie?.season ?? "",
            beginAt: t.begin_at,
            endAt: t.end_at,
            tier: t.tier ?? "",
            prizepool: t.prizepool ?? "",
            teams: (t.teams ?? []).slice(0, 8).map((team) => ({
              id: team.id,
              name: team.name ?? "",
              logo: team.image_url ?? null,
            })),
          }));
      },
    },

  },
};

export default widget;
