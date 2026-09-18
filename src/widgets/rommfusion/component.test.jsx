// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

describe("widgets/rommfusion/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a skeleton tile while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "rommfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(1);
  });

  it("renders a consolidated stat tile even when widget.fields is configured", () => {
    useWidgetAPI.mockReturnValue({
      data: { PLATFORMS: 12, ROMS: 3456, SAVES: 78, STATES: 9, FILESIZE: 1024 },
      error: undefined,
    });

    const service = {
      widget: { type: "rommfusion", fields: ["platforms", "totalRoms", "saves", "states"] },
    };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("3456")).toBeInTheDocument();
    expect(screen.getByText("roms")).toBeInTheDocument();
    expect(screen.getByText("12 platforms · 78 saves")).toBeInTheDocument();
    expect(screen.getByText("9 states · 1024")).toBeInTheDocument();
  });

  it("falls back to TOTAL_FILESIZE_BYTES when FILESIZE is absent", () => {
    useWidgetAPI.mockReturnValue({
      data: { PLATFORMS: 1, ROMS: 2, SAVES: 3, STATES: 4, TOTAL_FILESIZE_BYTES: 2048 },
      error: undefined,
    });

    const service = { widget: { type: "rommfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("4 states · 2048")).toBeInTheDocument();
  });

  it("renders error UI when the statistics request errors", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: { message: "nope" } });

    renderWithProviders(<Component service={{ widget: { type: "rommfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("nope")).toBeInTheDocument();
  });

  it("defaults to an ok LED with no configured threshold", () => {
    useWidgetAPI.mockReturnValue({
      data: { PLATFORMS: 1, ROMS: 2, SAVES: 3, STATES: 4, FILESIZE: 5 },
      error: undefined,
    });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "rommfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelector("span")).toHaveStyle({ backgroundColor: "#34d399" });
  });

  it("lets a service.widget.highlight config override the default ok LED color", () => {
    useWidgetAPI.mockReturnValue({
      data: { PLATFORMS: 1, ROMS: 2, SAVES: 3, STATES: 4, FILESIZE: 5 },
      error: undefined,
    });

    const service = {
      widget: {
        type: "rommfusion",
        highlight: { roms: { numeric: { when: "gt", value: 1, level: "warn" } } },
      },
    };
    const { container } = renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(container.querySelector("span")).toHaveStyle({ backgroundColor: "#f5a524" });
  });
});
