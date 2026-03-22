import { asJson } from "utils/proxy/api-helpers";
import genericProxyHandler from "utils/proxy/handlers/generic";

// PandaScore tiers that correspond to Tier 1 (s, a) and Tier 2 (b) in Dota 2
const ALLOWED_TIERS = new Set(["s", "a"]);

// Format a PandaScore prizepool string like "1000000 United States Dollar"
// into a compact, symbol-prefixed form like "$1M".
const CURRENCY_SYMBOLS = {
  "united states dollar": "$",
  "euro": "€",
  "british pound": "£",
  "pound sterling": "£",
  "chinese yuan": "¥",
  "japanese yen": "¥",
  "swedish krona": "kr",
};

function formatPrizepool(raw) {
  if (!raw) return "";
  // PandaScore format: "<amount> <Currency Name>"
  const match = String(raw).match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (!match) return raw;
  const amount = parseFloat(match[1]);
  const currencyKey = match[2].toLowerCase();
  const symbol = CURRENCY_SYMBOLS[currencyKey] ?? "";
  const formatted = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
  return symbol ? `${symbol}${formatted}` : `${formatted} ${match[2]}`;
}

// Pick the best stream URL from a PandaScore streams_list:
// prefer official English, then any official, then main, then first available.
function pickStreamUrl(streamsList) {
  if (!Array.isArray(streamsList) || streamsList.length === 0) return null;
  const official = streamsList.filter((s) => s.official);
  const candidate =
    official.find((s) => s.language === "en") ??
    official[0] ??
    streamsList.find((s) => s.main) ??
    streamsList[0];
  return candidate?.raw_url ?? null;
}

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
            streamUrl: pickStreamUrl(match.streams_list),
          }));
      },
    },

    upcoming_matches: {
      endpoint: "matches/upcoming?page[size]=50&sort=begin_at",
      map: (data) => {
        const matches = asJson(data);
        if (!Array.isArray(matches)) return [];
        return matches
          .filter((match) => ALLOWED_TIERS.has(match.tournament?.tier))
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
            streamUrl: pickStreamUrl(match.streams_list),
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
          streamUrl: pickStreamUrl(match.streams_list),
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
            prizepool: formatPrizepool(t.prizepool),
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
