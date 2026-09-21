// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

describe("widgets/sonarrfusion/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a skeleton tile while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "sonarrfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(1);
  });

  it("renders a consolidated stat tile with the queue collapsed by default", () => {
    const wantedResult = { data: { totalRecords: 12 }, error: undefined };
    const queueResult = { data: { totalRecords: 2 }, error: undefined };
    const seriesResult = {
      data: [
        { id: 1, title: "Show A" },
        { id: 2, title: "Show B" },
      ],
      error: undefined,
    };
    const queueDetailsResult = {
      data: [
        {
          seriesId: 1,
          episodeId: 10,
          episodeTitle: "Pilot",
          sizeLeft: 0,
          size: 0,
          status: "downloading",
          trackedDownloadState: "downloading",
          downloadClient: "qBittorrent",
        },
      ],
      error: undefined,
    };
    const emptyResult = { data: undefined, error: undefined };

    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint === "wanted/missing") return wantedResult;
      if (endpoint === "queue") return queueResult;
      if (endpoint === "series") return seriesResult;
      if (endpoint === "queue/details") return queueDetailsResult;
      return emptyResult;
    });

    const service = { widget: { type: "sonarrfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("missing")).toBeInTheDocument();
    expect(screen.getByText("2 series")).toBeInTheDocument();
    expect(screen.getByText("2 queued")).toBeInTheDocument();
    expect(screen.queryByText("Show A: Pilot")).not.toBeInTheDocument();
  });

  it("expands to reveal queue rows with download client and speed on click", () => {
    const wantedResult = { data: { totalRecords: 12 }, error: undefined };
    const queueResult = { data: { totalRecords: 1 }, error: undefined };
    const seriesResult = { data: [{ id: 1, title: "Show A" }], error: undefined };
    const queueDetailsResult = {
      data: [
        {
          seriesId: 1,
          episodeId: 10,
          episodeTitle: "Pilot",
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
    const emptyResult = { data: undefined, error: undefined };

    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint === "wanted/missing") return wantedResult;
      if (endpoint === "queue") return queueResult;
      if (endpoint === "series") return seriesResult;
      if (endpoint === "queue/details") return queueDetailsResult;
      return emptyResult;
    });

    const service = { widget: { type: "sonarrfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    fireEvent.click(screen.getByText("1 queued"));

    expect(screen.getByText("Show A: Pilot")).toBeInTheDocument();
    expect(screen.getByText("qBittorrent")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("shows a failed badge when a queue entry has failed", () => {
    const wantedResult = { data: { totalRecords: 3 }, error: undefined };
    const queueResult = { data: { totalRecords: 1 }, error: undefined };
    const seriesResult = { data: [], error: undefined };
    const queueDetailsResult = {
      data: [
        {
          seriesId: 5,
          episodeId: 50,
          episodeTitle: "Bad Episode",
          sizeLeft: 50,
          size: 100,
          status: "failed",
          trackedDownloadState: "failedPending",
          downloadClient: "SABnzbd",
        },
      ],
      error: undefined,
    };
    const emptyResult = { data: undefined, error: undefined };

    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint === "wanted/missing") return wantedResult;
      if (endpoint === "queue") return queueResult;
      if (endpoint === "series") return seriesResult;
      if (endpoint === "queue/details") return queueDetailsResult;
      return emptyResult;
    });

    const service = { widget: { type: "sonarrfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("1 queued")).toBeInTheDocument();
    expect(screen.getByText("1 failed")).toBeInTheDocument();
  });

  it("shows an update badge when the newest reported version isn't installed", () => {
    const wantedResult = { data: { totalRecords: 0 }, error: undefined };
    const queueResult = { data: { totalRecords: 0 }, error: undefined };
    const seriesResult = { data: [], error: undefined };
    const queueDetailsResult = { data: [], error: undefined };
    const updateResult = { data: [{ version: "4.0.9", installed: false }], error: undefined };
    const emptyResult = { data: undefined, error: undefined };

    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint === "wanted/missing") return wantedResult;
      if (endpoint === "queue") return queueResult;
      if (endpoint === "series") return seriesResult;
      if (endpoint === "queue/details") return queueDetailsResult;
      if (endpoint === "update") return updateResult;
      return emptyResult;
    });

    const service = { widget: { type: "sonarrfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("update")).toBeInTheDocument();
  });

  it("hides the update badge once the newest reported version is installed", () => {
    const wantedResult = { data: { totalRecords: 0 }, error: undefined };
    const queueResult = { data: { totalRecords: 0 }, error: undefined };
    const seriesResult = { data: [], error: undefined };
    const queueDetailsResult = { data: [], error: undefined };
    const updateResult = { data: [{ version: "4.0.9", installed: true }], error: undefined };
    const emptyResult = { data: undefined, error: undefined };

    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint === "wanted/missing") return wantedResult;
      if (endpoint === "queue") return queueResult;
      if (endpoint === "series") return seriesResult;
      if (endpoint === "queue/details") return queueDetailsResult;
      if (endpoint === "update") return updateResult;
      return emptyResult;
    });

    const service = { widget: { type: "sonarrfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.queryByText("update")).not.toBeInTheDocument();
  });
});
