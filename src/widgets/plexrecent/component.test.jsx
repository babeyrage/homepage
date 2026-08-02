// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";
import { expectBlockValue } from "test-utils/widget-assertions";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

vi.mock("next-i18next/pages", () => ({
  useTranslation: () => ({
    t: (key, opts) => (opts?.value !== undefined ? `${key}:${opts.value}` : key),
  }),
}));

// next/image requires Next runtime features; stub it for component tests.
vi.mock("next/image", () => ({
  default: (props) => {
    const { src, alt, className, onError } = props;
    // This is a unit-test stub for next/image; using <img> is intentional here.
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} src={src} className={className} onError={onError} />;
  },
}));

import Component from "./component";

const service = { widget: { type: "plexrecent" } };

const movie = {
  id: "1",
  title: "Test Movie",
  year: 2024,
  type: "movie",
  date_added: "01/01/2024",
  duration: 120,
  contentRating: "PG-13",
  rating: "7.5",
  audienceRating: "8.0",
  summary: "A test movie.",
  coverPoster: "/api/widgets/plexrecent/image?path=movie.jpg",
};

const tvShow = {
  id: "100",
  showTitle: "Test Show",
  poster: "/api/widgets/plexrecent/image?path=show.jpg",
  episodes: [
    { id: "101", title: "Pilot", seasonNumber: 1, episodeNumber: 1, date_added: "02/01/2024" },
    { id: "102", title: "Episode 2", seasonNumber: 1, episodeNumber: 2, date_added: "03/01/2024" },
  ],
};

describe("widgets/plexrecent/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders placeholders while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    const { container } = renderWithProviders(<Component service={service} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelectorAll(".service-block")).toHaveLength(2);
    expect(screen.getByText("plex.movies")).toBeInTheDocument();
    expect(screen.getByText("plex.tv")).toBeInTheDocument();
  });

  it("renders error UI when endpoint errors", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: { message: "nope" } });

    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getAllByText(/widget\.api_error/i).length).toBeGreaterThan(0);
    expect(screen.getByText("nope")).toBeInTheDocument();
  });

  it("renders movie/show counts when loaded", () => {
    useWidgetAPI.mockReturnValue({
      data: { streams: 0, totalMovies: 42, totalShows: 7, recentMovies: [], recentTV: [] },
      error: undefined,
    });

    const { container } = renderWithProviders(<Component service={service} />, {
      settings: { hideErrors: false },
    });

    expectBlockValue(container, "plex.movies", "common.number:42");
    expectBlockValue(container, "plex.tv", "common.number:7");
  });

  it("hides the recent-movies and recent-tv rows when both lists are empty", () => {
    useWidgetAPI.mockReturnValue({
      data: { streams: 0, totalMovies: 0, totalShows: 0, recentMovies: [], recentTV: [] },
      error: undefined,
    });

    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.queryByText("plex.recentMovies")).not.toBeInTheDocument();
    expect(screen.queryByText("plex.recentTV")).not.toBeInTheDocument();
  });

  it("renders recent movie and tv posters", () => {
    useWidgetAPI.mockReturnValue({
      data: { streams: 0, totalMovies: 1, totalShows: 1, recentMovies: [movie], recentTV: [tvShow] },
      error: undefined,
    });

    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByAltText("Test Movie")).toHaveAttribute("src", movie.coverPoster);
    expect(screen.getByAltText("Test Show")).toHaveAttribute("src", tvShow.poster);
    // Episode count badge on the show poster
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("opens a movie popup on click and closes it on outside click", () => {
    useWidgetAPI.mockReturnValue({
      data: { streams: 0, totalMovies: 1, totalShows: 0, recentMovies: [movie], recentTV: [] },
      error: undefined,
    });

    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    fireEvent.click(screen.getByAltText("Test Movie"));
    expect(screen.getByText("Test Movie (2024)")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("Test Movie (2024)")).not.toBeInTheDocument();
  });

  it("closes an open popup on Escape", () => {
    useWidgetAPI.mockReturnValue({
      data: { streams: 0, totalMovies: 1, totalShows: 0, recentMovies: [movie], recentTV: [] },
      error: undefined,
    });

    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    fireEvent.click(screen.getByAltText("Test Movie"));
    expect(screen.getByText("Test Movie (2024)")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Test Movie (2024)")).not.toBeInTheDocument();
  });
});
