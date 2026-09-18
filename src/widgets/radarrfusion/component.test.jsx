// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

describe("widgets/radarrfusion/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a skeleton tile while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "radarrfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(1);
  });

  it("renders a consolidated stat tile with the queue collapsed by default", () => {
    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint === "movie")
        return {
          data: {
            wanted: 1,
            missing: 2,
            have: 3,
            all: [
              { id: 10, title: "Queued Movie" },
              { id: 11, title: "Imported Movie" },
            ],
          },
          error: undefined,
        };
      if (endpoint === "queue/status") return { data: { totalCount: 1 }, error: undefined };
      if (endpoint === "queue/details")
        return {
          data: [
            {
              movieId: 10,
              sizeLeft: 0,
              size: 0,
              status: "queued",
              trackedDownloadState: "downloading",
              downloadClient: "qBittorrent",
            },
            {
              movieId: 11,
              sizeLeft: 0,
              size: 100,
              status: "completed",
              trackedDownloadState: "importPending",
              downloadClient: "SABnzbd",
            },
          ],
          error: undefined,
        };
      return { data: undefined, error: undefined };
    });

    const service = { widget: { type: "radarrfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("missing")).toBeInTheDocument();
    expect(screen.getByText("1 wanted · 3 movies")).toBeInTheDocument();
    expect(screen.getByText("1 queued")).toBeInTheDocument();

    // Collapsed by default: no queue rows rendered yet.
    expect(screen.queryByText("Queued Movie")).not.toBeInTheDocument();
    expect(screen.queryByText("Imported Movie")).not.toBeInTheDocument();
  });

  it("expands to reveal queue rows with download client and speed on click", () => {
    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint === "movie")
        return {
          data: { wanted: 1, missing: 2, have: 3, all: [{ id: 10, title: "Queued Movie" }] },
          error: undefined,
        };
      if (endpoint === "queue/status") return { data: { totalCount: 1 }, error: undefined };
      if (endpoint === "queue/details")
        return {
          data: [
            {
              movieId: 10,
              sizeLeft: 1000,
              size: 2000,
              status: "downloading",
              trackedDownloadState: "downloading",
              downloadClient: "qBittorrent",
              timeLeft: "00:00:10",
            },
          ],
          error: undefined,
        };
      return { data: undefined, error: undefined };
    });

    const service = { widget: { type: "radarrfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.queryByText("Queued Movie")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("1 queued"));

    expect(screen.getByText("Queued Movie")).toBeInTheDocument();
    expect(screen.getByText("qBittorrent")).toBeInTheDocument();
    expect(screen.getByText("downloading")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();

    // Status and speed are the two things this row exists to make legible,
    // so both get bold accent-colored treatment rather than muted grey text.
    const status = screen.getByText("downloading");
    expect(status.className).toMatch(/font-bold/);
    expect(status.style.color).toBeTruthy();

    const speed = screen.getByText("100");
    expect(speed.className).toMatch(/font-bold/);
    expect(speed.style.color).toBeTruthy();
  });

  it("paginates the expanded queue instead of rendering it all at once", () => {
    const queueDetails = Array.from({ length: 7 }, (_, index) => ({
      movieId: index,
      sizeLeft: 0,
      size: 0,
      status: "paused",
      trackedDownloadState: "queued",
      downloadClient: "SABnzbd",
    }));
    const movies = queueDetails.map((entry) => ({ id: entry.movieId, title: `Movie ${entry.movieId}` }));

    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint === "movie") return { data: { wanted: 0, missing: 0, have: 0, all: movies }, error: undefined };
      if (endpoint === "queue/status") return { data: { totalCount: 7 }, error: undefined };
      if (endpoint === "queue/details") return { data: queueDetails, error: undefined };
      return { data: undefined, error: undefined };
    });

    const service = { widget: { type: "radarrfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    fireEvent.click(screen.getByText("7 queued"));

    // Page size is 5: first page shows movies 0-4, not 5 or 6.
    expect(screen.getByText("Movie 0")).toBeInTheDocument();
    expect(screen.getByText("Movie 4")).toBeInTheDocument();
    expect(screen.queryByText("Movie 5")).not.toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    fireEvent.click(screen.getByText("›"));

    expect(screen.queryByText("Movie 0")).not.toBeInTheDocument();
    expect(screen.getByText("Movie 5")).toBeInTheDocument();
    expect(screen.getByText("Movie 6")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("gives different download clients visually distinct chip colors", () => {
    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint === "movie")
        return {
          data: {
            wanted: 0,
            missing: 0,
            have: 0,
            all: [
              { id: 1, title: "Torrent Movie" },
              { id: 2, title: "Usenet Movie" },
            ],
          },
          error: undefined,
        };
      if (endpoint === "queue/status") return { data: { totalCount: 2 }, error: undefined };
      if (endpoint === "queue/details")
        return {
          data: [
            { movieId: 1, sizeLeft: 0, size: 0, status: "paused", trackedDownloadState: "queued", downloadClient: "qBittorrent" },
            { movieId: 2, sizeLeft: 0, size: 0, status: "paused", trackedDownloadState: "queued", downloadClient: "SABnzbd" },
          ],
          error: undefined,
        };
      return { data: undefined, error: undefined };
    });

    const service = { widget: { type: "radarrfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    fireEvent.click(screen.getByText("2 queued"));

    const qbitColor = screen.getByText("qBittorrent").style.color;
    const sabColor = screen.getByText("SABnzbd").style.color;
    expect(qbitColor).toBeTruthy();
    expect(sabColor).toBeTruthy();
    expect(qbitColor).not.toBe(sabColor);
  });

  it("shows a failed badge when a queue entry has failed", () => {
    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint === "movie") return { data: { wanted: 0, missing: 1, have: 5, all: [] }, error: undefined };
      if (endpoint === "queue/status") return { data: { totalCount: 1 }, error: undefined };
      if (endpoint === "queue/details")
        return {
          data: [
            {
              movieId: 20,
              sizeLeft: 50,
              size: 100,
              status: "failed",
              trackedDownloadState: "failedPending",
              downloadClient: "SABnzbd",
            },
          ],
          error: undefined,
        };
      return { data: undefined, error: undefined };
    });

    const service = { widget: { type: "radarrfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("1 queued")).toBeInTheDocument();
    expect(screen.getByText("1 failed")).toBeInTheDocument();
  });
});
