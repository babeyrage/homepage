// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

describe("widgets/qbittorrentfusion/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a skeleton tile while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "qbittorrentfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(1);
  });

  it("renders a consolidated stat tile with the leech list collapsed by default", () => {
    useWidgetAPI.mockReturnValue({
      data: [
        { name: "Seeded Movie", state: "uploading", progress: 1, dlspeed: 0, upspeed: 1000, eta: 0, hash: "a" },
        { name: "Leeching Movie", state: "downloading", progress: 0.5, dlspeed: 5000, upspeed: 0, eta: 60, hash: "b" },
      ],
      error: undefined,
    });

    const service = { widget: { type: "qbittorrentfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("leeching")).toBeInTheDocument();
    expect(screen.getByText("1 seeding")).toBeInTheDocument();

    expect(screen.queryByText("Leeching Movie")).not.toBeInTheDocument();
  });

  it("expands to reveal leech rows with progress and speed on click", () => {
    useWidgetAPI.mockReturnValue({
      data: [{ name: "Leeching Movie", state: "downloading", progress: 0.5, dlspeed: 5000, upspeed: 0, eta: 60, hash: "b" }],
      error: undefined,
    });

    const service = { widget: { type: "qbittorrentfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.queryByText("Leeching Movie")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("0 seeding"));

    expect(screen.getByText("Leeching Movie")).toBeInTheDocument();
    expect(screen.getByText("downloading")).toBeInTheDocument();
  });

  it("paginates the expanded leech list instead of rendering it all at once", () => {
    const torrents = Array.from({ length: 7 }, (_, index) => ({
      name: `Torrent ${index}`,
      state: "downloading",
      progress: 0,
      dlspeed: 0,
      upspeed: 0,
      eta: 0,
      hash: `${index}`,
    }));

    useWidgetAPI.mockReturnValue({ data: torrents, error: undefined });

    const service = { widget: { type: "qbittorrentfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    fireEvent.click(screen.getByText("0 seeding"));

    expect(screen.getByText("Torrent 0")).toBeInTheDocument();
    expect(screen.getByText("Torrent 4")).toBeInTheDocument();
    expect(screen.queryByText("Torrent 5")).not.toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    fireEvent.click(screen.getByText("›"));

    expect(screen.queryByText("Torrent 0")).not.toBeInTheDocument();
    expect(screen.getByText("Torrent 5")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("renders error UI when the torrents request errors", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: { message: "nope" } });

    renderWithProviders(<Component service={{ widget: { type: "qbittorrentfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("nope")).toBeInTheDocument();
  });
});
