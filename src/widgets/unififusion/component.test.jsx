// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

describe("widgets/unififusion/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a skeleton tile while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "unififusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(1);
  });

  it("renders a site-not-found error when widget.site doesn't match", () => {
    useWidgetAPI.mockReturnValue({
      data: { data: [{ name: "default", desc: "Default", health: [] }] },
      error: undefined,
    });

    renderWithProviders(<Component service={{ widget: { type: "unififusion", site: "Nope" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("Site 'Nope' not found")).toBeInTheDocument();
  });

  it("renders client count, uptime and subsystem status when all up", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        data: [
          {
            name: "default",
            desc: "Default",
            health: [
              { subsystem: "wan", status: "ok", num_user: 0, num_adopted: 0, "gw_system-stats": { uptime: 86400 } },
              { subsystem: "lan", status: "ok", num_user: 2, num_adopted: 5 },
              { subsystem: "wlan", status: "ok", num_user: 3, num_adopted: 6 },
            ],
          },
        ],
      },
      error: undefined,
    });

    renderWithProviders(<Component service={{ widget: { type: "unififusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("clients")).toBeInTheDocument();
    expect(screen.getByText("wan unifi.up · lan unifi.up · wlan unifi.up")).toBeInTheDocument();
  });

  it("flags wan outage in the status line", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        data: [
          {
            name: "default",
            desc: "Default",
            health: [
              { subsystem: "wan", status: "error", num_user: 0, num_adopted: 0 },
              { subsystem: "lan", status: "ok", num_user: 4, num_adopted: 5 },
            ],
          },
        ],
      },
      error: undefined,
    });

    renderWithProviders(<Component service={{ widget: { type: "unififusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("wan unifi.down · lan unifi.up")).toBeInTheDocument();
  });

  it("renders error UI when the request errors", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: { message: "nope" } });

    renderWithProviders(<Component service={{ widget: { type: "unififusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("nope")).toBeInTheDocument();
  });
});
