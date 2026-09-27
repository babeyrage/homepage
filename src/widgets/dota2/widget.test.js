import { describe, expect, it } from "vitest";

import { expectWidgetConfigShape } from "test-utils/widget-config";

import widget from "./widget";

function fixture(body) {
  return Buffer.from(JSON.stringify(body));
}

describe("dota2 widget config", () => {
  it("exports a valid widget config", () => {
    expectWidgetConfigShape(widget);
  });

  it("unwraps the nested data.matches shape on live_matches", () => {
    const result = widget.mappings.live_matches.map(
      fixture({ data: { matches: [{ id: 1, team1: {}, team2: {} }] } }),
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it("prefers the nested team object's numeric id over the unreliable flat team1Id/team2Id", () => {
    // CitoAPI's flat team1Id/team2Id occasionally returns a slug string instead
    // of the numeric id, even though the nested team object's own `id` is
    // always numeric — this is the bug this test guards against regressing.
    const result = widget.mappings.recent_matches.map(
      fixture({
        data: [
          {
            id: 1,
            team1Id: "na-vi",
            team2Id: "lgd",
            team1: { id: 2590, name: "Natus Vincere" },
            team2: { id: 3308, name: "LGD Gaming" },
          },
        ],
      }),
    );

    expect(result[0].team1Id).toBe(2590);
    expect(result[0].team2Id).toBe(3308);
  });

  it("falls back to the flat team1Id/team2Id when no nested team object is present", () => {
    const result = widget.mappings.recent_matches.map(
      fixture({ data: [{ id: 1, team1Id: 42, team2Id: 43 }] }),
    );

    expect(result[0].team1Id).toBe(42);
    expect(result[0].team2Id).toBe(43);
  });

  it("maps a fully-synced ('rich') team profile with roster/win-loss/elo data", () => {
    const result = widget.mappings.match_detail.map(
      fixture({
        data: {
          id: 1,
          team1: {
            id: 2590,
            name: "Natus Vincere",
            tag: "NAVI",
            raw: {
              winCount: 10,
              lossCount: 4,
              drawCount: 0,
              eloRating: 1800,
              followerCount: 50000,
              teamPerformance: { winRate: 71 },
              earningPrize: { prizeAmountUsd: 1000000 },
              players: [
                { id: 1, name: "Active Player", toAt: null },
                { id: 2, name: "Former Player", toAt: "2025-01-01T00:00:00Z" },
              ],
            },
          },
          team2: {},
          games: [],
        },
      }),
    );

    expect(result.team1Profile).toMatchObject({
      name: "Natus Vincere",
      tag: "NAVI",
      winCount: 10,
      lossCount: 4,
      eloRating: 1800,
      winRate: 71,
      earningPrizeUsd: 1000000,
    });
    // Only the still-active roster player (toAt: null) should be included.
    expect(result.team1Profile.players).toEqual([{ id: 1, name: "Active Player", imageUrl: null, countryFlag: null }]);
  });

  it("maps a thin, not-yet-synced team profile without throwing on missing fields", () => {
    const result = widget.mappings.match_detail.map(
      fixture({
        data: {
          id: 1,
          team1: { name: "Some Team", tag: "ST" },
          team2: {},
          games: [],
        },
      }),
    );

    expect(result.team1Profile).toMatchObject({
      name: "Some Team",
      tag: "ST",
      winCount: null,
      lossCount: null,
      eloRating: null,
    });
    expect(result.team1Profile.players).toEqual([]);
  });

  it("returns null team profiles when the match has no team object at all", () => {
    const result = widget.mappings.match_detail.map(fixture({ data: null }));

    expect(result).toBeNull();
  });

  it("sums live per-player net worth/last hits by side and orients via mapsToCitoTeam", () => {
    const result = widget.mappings.recent_matches.map(
      fixture({
        data: [
          {
            id: 1,
            team1Id: 2933,
            team2Id: 2590,
            live: {
              gameTime: 1600.4,
              radiant: { kills: 11, mapsToCitoTeam: "team1" },
              dire: { kills: 10, mapsToCitoTeam: "team2" },
              players: [
                { teamSide: "radiant", netWorth: 22415, lastHits: 450 },
                { teamSide: "radiant", netWorth: 5810, lastHits: 49 },
                { teamSide: "dire", netWorth: 14782, lastHits: 258 },
                { teamSide: "dire", netWorth: 3940, lastHits: 17 },
              ],
            },
          },
        ],
      }),
    );

    const player = (teamSide, netWorth, lastHits) => ({
      accountId: null,
      playerName: null,
      teamTag: null,
      teamSide,
      heroId: null,
      level: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      netWorth,
      gpm: 0,
      xpm: 0,
      lastHits,
      denies: 0,
      items: [],
    });

    expect(result[0].live).toEqual({
      gameTime: 1600.4,
      radiantIsTeam1: true,
      radiant: { kills: 11, netWorth: 28225, lastHits: 499 },
      dire: { kills: 10, netWorth: 18722, lastHits: 275 },
      players: [
        player("radiant", 22415, 450),
        player("radiant", 5810, 49),
        player("dire", 14782, 258),
        player("dire", 3940, 17),
      ],
    });
  });

  it("returns a null live block when the match has no game currently in progress", () => {
    const result = widget.mappings.recent_matches.map(fixture({ data: [{ id: 1 }] }));

    expect(result[0].live).toBeNull();
  });

  it("maps full per-player live fields, including raw numeric item ids", () => {
    const result = widget.mappings.recent_matches.map(
      fixture({
        data: [
          {
            id: 1,
            live: {
              gameTime: 900,
              radiant: { kills: 5, mapsToCitoTeam: "team2" },
              dire: { kills: 3, mapsToCitoTeam: "team1" },
              players: [
                {
                  accountId: 12345,
                  playerName: "Miracle-",
                  teamTag: "NAVI",
                  teamSide: "radiant",
                  heroId: 1,
                  level: 12,
                  kills: 4,
                  deaths: 1,
                  assists: 3,
                  netWorth: 9000,
                  gpm: 620,
                  xpm: 700,
                  lastHits: 120,
                  denies: 5,
                  items: [1, 2, 0, 0, 0, 0],
                },
              ],
            },
          },
        ],
      }),
    );

    expect(result[0].live.players).toEqual([
      {
        accountId: 12345,
        playerName: "Miracle-",
        teamTag: "NAVI",
        teamSide: "radiant",
        heroId: 1,
        level: 12,
        kills: 4,
        deaths: 1,
        assists: 3,
        netWorth: 9000,
        gpm: 620,
        xpm: 700,
        lastHits: 120,
        denies: 5,
        items: [1, 2, 0, 0, 0, 0],
      },
    ]);
  });
});
