import createLogger from "utils/logger";
import { cachedRequest } from "utils/proxy/http";

const logger = createLogger("dota2");

const OPENDOTA_BASE = "https://api.opendota.com/api";

// Static item id -> {dname, img} lookup, shared by handleMatch (post-game
// item builds) and handleConstants (live-game item icons, which have no
// OpenDota match to key off yet). cachedRequest already caches the underlying
// `/constants/items` call for 24h, so calling this from both handlers costs
// nothing extra beyond the first fetch.
async function fetchItemMap() {
  const itemConstantsRaw = await cachedRequest(`${OPENDOTA_BASE}/constants/items`, 1440);
  const itemMap = new Map();
  if (itemConstantsRaw && typeof itemConstantsRaw === "object") {
    for (const [name, data] of Object.entries(itemConstantsRaw)) {
      if (typeof data.id === "number" && data.id > 0) {
        itemMap.set(data.id, {
          dname: data.dname ?? name,
          img: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${name}.png`,
        });
      }
    }
  }
  return itemMap;
}

function toItem(itemMap, id) {
  if (!id) return null;
  const entry = itemMap.get(id);
  return entry ? { id, name: entry.dname, img: entry.img } : { id, name: "", img: null };
}

// ── mode=match ──────────────────────────────────────────────────────────────────
// CitoAPI has no item builds, net worth, hero level, or backpack data. This mode
// fetches OpenDota's full match record (keyed by the CitoAPI game's openDotaMatchId)
// purely to extract that enrichment, keyed by accountId so it can be merged onto
// CitoAPI player rows client-side.
async function handleMatch(req, res) {
  const { matchId } = req.query;
  if (!matchId || !/^\d+$/.test(matchId)) {
    return res.status(400).json({ error: "Missing or invalid matchId" });
  }

  try {
    const [matchRaw, itemMap] = await Promise.all([
      cachedRequest(`${OPENDOTA_BASE}/matches/${matchId}`, 60),
      fetchItemMap(),
    ]);

    const players = Array.isArray(matchRaw.players) ? matchRaw.players : [];
    const byAccount = {};
    for (const p of players) {
      if (p.account_id == null) continue;
      byAccount[String(p.account_id)] = {
        level: p.level ?? 0,
        netWorth: p.net_worth ?? 0,
        items: [p.item_0, p.item_1, p.item_2, p.item_3, p.item_4, p.item_5].map((id) => toItem(itemMap, id)),
        backpack: [p.backpack_0, p.backpack_1, p.backpack_2].map((id) => toItem(itemMap, id)),
        neutral: toItem(itemMap, p.item_neutral),
      };
    }

    return res.json({ matchId: matchRaw.match_id, players: byAccount });
  } catch (e) {
    logger.error("OpenDota match item lookup failed (matchId=%s): %s", matchId, e);
    return res.status(500).json({ error: "Failed to fetch match data" });
  }
}

// ── mode=constants ──────────────────────────────────────────────────────────────
// Static hero/id lookup (id -> {name, img}), used to render hero portraits for
// CitoAPI draft entries and player stats, which only carry heroId/heroName. Also
// exposes the item map for the same reason: CitoAPI's live feed carries raw
// numeric item ids per player, and a still-in-progress game has no OpenDota
// match to key handleMatch's per-match item lookup off of yet — this static
// constants map resolves item icons without needing one.
async function handleConstants(req, res) {
  try {
    const [heroesRaw, itemMap] = await Promise.all([
      cachedRequest(`${OPENDOTA_BASE}/heroes`, 1440),
      fetchItemMap(),
    ]);

    const heroes = {};
    if (Array.isArray(heroesRaw)) {
      for (const h of heroesRaw) {
        const shortName = h.name?.replace("npc_dota_hero_", "") ?? "";
        heroes[h.id] = {
          name: h.localized_name ?? shortName,
          img: shortName
            ? `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${shortName}.png`
            : null,
        };
      }
    }

    const items = {};
    for (const [id, entry] of itemMap) {
      items[id] = { name: entry.dname, img: entry.img };
    }

    return res.json({ heroes, items });
  } catch (e) {
    logger.error("OpenDota constants fetch failed: %s", e);
    return res.status(500).json({ error: "Failed to fetch constants" });
  }
}

export default async function handler(req, res) {
  const { mode } = req.query;

  if (mode === "match") return handleMatch(req, res);
  if (mode === "constants") return handleConstants(req, res);

  return res.status(400).json({ error: "Invalid or missing mode" });
}
