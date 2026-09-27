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
});
