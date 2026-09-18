// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

function session(overrides) {
  return {
    id: "1",
    mediaType: "movie",
    mediaTitle: "A Movie",
    username: "kyle",
    durationMs: 100000,
    progressMs: 50000,
    state: "playing",
    videoDecision: "directplay",
    audioDecision: "directplay",
    ...overrides,
  };
}

describe("widgets/tracearrfusion/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a skeleton tile while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "tracearrfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(1);
  });

  it("renders a consolidated stat tile with sessions collapsed by default", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        summary: { total: 2, transcodes: 1, directPlays: 1, totalBitrate: "24.3 Mbps" },
        data: [
          session({ id: "1", mediaTitle: "Direct Play Movie" }),
          session({ id: "2", mediaTitle: "Transcode Movie", videoDecision: "transcode", audioDecision: "transcode" }),
        ],
      },
      error: undefined,
    });

    const service = { widget: { type: "tracearrfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("streams")).toBeInTheDocument();
    expect(screen.getByText("1 transcoding · 1 direct play")).toBeInTheDocument();
    expect(screen.getByText("24.3 Mbps")).toBeInTheDocument();

    expect(screen.queryByText("Direct Play Movie (kyle)")).not.toBeInTheDocument();
  });

  it("expands to reveal session rows with playback decision and progress on click", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        summary: { total: 1, transcodes: 0, directPlays: 1, totalBitrate: "8 Mbps" },
        data: [session({ id: "1", mediaTitle: "A Movie", username: "kyle" })],
      },
      error: undefined,
    });

    const service = { widget: { type: "tracearrfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.queryByText("A Movie (kyle)")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("8 Mbps"));

    expect(screen.getByText("A Movie (kyle)")).toBeInTheDocument();
    expect(screen.getByText("direct play")).toBeInTheDocument();
    expect(screen.getByText("playing")).toBeInTheDocument();
    expect(screen.getByText("00:50 / 01:40")).toBeInTheDocument();
  });

  it("labels an episode with season/episode and shows paused state", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        summary: { total: 1, transcodes: 0, directPlays: 0, totalBitrate: "4 Mbps" },
        data: [
          session({
            id: "1",
            mediaType: "episode",
            mediaTitle: "Pilot",
            showTitle: "A Show",
            seasonNumber: 1,
            episodeNumber: 2,
            username: "kyle",
            state: "paused",
          }),
        ],
      },
      error: undefined,
    });

    const service = { widget: { type: "tracearrfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    fireEvent.click(screen.getByText("4 Mbps"));

    expect(screen.getByText("A Show: S01·E02 - Pilot (kyle)")).toBeInTheDocument();
    expect(screen.getByText("paused")).toBeInTheDocument();
  });

  it("paginates the expanded session list instead of rendering it all at once", () => {
    const sessions = Array.from({ length: 7 }, (_, index) => session({ id: `${index}`, mediaTitle: `Movie ${index}` }));

    useWidgetAPI.mockReturnValue({
      data: {
        summary: { total: 7, transcodes: 0, directPlays: 7, totalBitrate: "50 Mbps" },
        data: sessions,
      },
      error: undefined,
    });

    const service = { widget: { type: "tracearrfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    fireEvent.click(screen.getByText("50 Mbps"));

    expect(screen.getByText("Movie 0 (kyle)")).toBeInTheDocument();
    expect(screen.getByText("Movie 4 (kyle)")).toBeInTheDocument();
    expect(screen.queryByText("Movie 5 (kyle)")).not.toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    fireEvent.click(screen.getByText("›"));

    expect(screen.queryByText("Movie 0 (kyle)")).not.toBeInTheDocument();
    expect(screen.getByText("Movie 5 (kyle)")).toBeInTheDocument();
    expect(screen.getByText("Movie 6 (kyle)")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("renders error UI when the streams request errors", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: { message: "nope" } });

    renderWithProviders(<Component service={{ widget: { type: "tracearrfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("nope")).toBeInTheDocument();
  });
});
