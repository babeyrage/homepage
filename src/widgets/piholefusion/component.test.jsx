// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

import { SettingsContext } from "utils/contexts/settings";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

describe("widgets/piholefusion/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a skeleton tile while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "piholefusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(1);
  });

  it("renders blocked count, queries and gravity", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        domains_being_blocked: "150000",
        dns_queries_today: "48213",
        ads_blocked_today: "9124",
        ads_percentage_today: "18.9",
      },
      error: undefined,
    });

    renderWithProviders(<Component service={{ widget: { type: "piholefusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("9124")).toBeInTheDocument();
    expect(screen.getByText("blocked")).toBeInTheDocument();
    expect(screen.getByText("150000 domains on blocklist")).toBeInTheDocument();
  });

  it("renders error UI when the request errors", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: { message: "nope" } });

    renderWithProviders(<Component service={{ widget: { type: "piholefusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("nope")).toBeInTheDocument();
  });

  it("shows a bad LED when the blocklist is empty (gravity === 0)", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        domains_being_blocked: "0",
        dns_queries_today: "100",
        ads_blocked_today: "0",
        ads_percentage_today: "0",
      },
      error: undefined,
    });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "piholefusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelector("span")).toHaveStyle({ backgroundColor: "#fb7185" });
  });

  it("shows an ok LED when the blocklist is populated", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        domains_being_blocked: "150000",
        dns_queries_today: "48213",
        ads_blocked_today: "9124",
        ads_percentage_today: "18.9",
      },
      error: undefined,
    });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "piholefusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelector("span")).toHaveStyle({ backgroundColor: "#34d399" });
  });

  it("lets a service.widget.highlight config override the built-in gravity LED color", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        domains_being_blocked: "150000",
        dns_queries_today: "48213",
        ads_blocked_today: "9124",
        ads_percentage_today: "18.9",
      },
      error: undefined,
    });

    const service = {
      widget: {
        type: "piholefusion",
        highlight: { gravity: { numeric: { when: "gt", value: 1000, level: "warn" } } },
      },
    };
    const { container } = renderWithProviders(<Component service={service} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelector("span")).toHaveStyle({ backgroundColor: "#f5a524" });
  });

  it("shows an 'ago' staleness label once data arrives after loading", () => {
    // useLastUpdatedLabel only captures a timestamp when `data` actually
    // changes reference, so this exercises the same loading -> loaded
    // transition a real SWR-backed mount goes through, rather than mounting
    // straight into an already-loaded state (which would never trigger a
    // capture and would make this test pass for the wrong reason).
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    const value = { settings: { hideErrors: false }, setSettings: () => {} };
    const service = { widget: { type: "piholefusion" } };
    const { rerender } = render(
      <SettingsContext.Provider value={value}>
        <Component service={service} />
      </SettingsContext.Provider>,
    );

    useWidgetAPI.mockReturnValue({
      data: {
        domains_being_blocked: "150000",
        dns_queries_today: "48213",
        ads_blocked_today: "9124",
        ads_percentage_today: "18.9",
      },
      error: undefined,
    });
    rerender(
      <SettingsContext.Provider value={value}>
        <Component service={service} />
      </SettingsContext.Provider>,
    );

    expect(screen.getByText(/ago|just now/)).toBeInTheDocument();
  });
});
