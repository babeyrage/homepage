// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

describe("widgets/patchmonfusion/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a skeleton tile while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "patchmonfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(1);
  });

  it("summarizes host counts into a consolidated tile", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        total: 5,
        hosts: [
          { updates_count: 0, needs_reboot: false, security_updates_count: 0 },
          { updates_count: 2, needs_reboot: false, security_updates_count: 0 },
          { updates_count: 1, needs_reboot: true, security_updates_count: 0 },
          { updates_count: 0, needs_reboot: false, security_updates_count: 0 },
          { updates_count: 0, needs_reboot: false, security_updates_count: 0 },
        ],
      },
      error: undefined,
    });

    const service = { widget: { type: "patchmonfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("hosts")).toBeInTheDocument();
    expect(screen.getByText("2 outdated · 1 need reboot")).toBeInTheDocument();
    expect(screen.getByText("0 security updates")).toBeInTheDocument();
    expect(screen.queryByText(/urgent/)).not.toBeInTheDocument();
  });

  it("shows an urgent badge when hosts have pending security updates", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        total: 2,
        hosts: [
          { updates_count: 3, needs_reboot: false, security_updates_count: 2 },
          { updates_count: 0, needs_reboot: false, security_updates_count: 0 },
        ],
      },
      error: undefined,
    });

    const service = { widget: { type: "patchmonfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("2 urgent")).toBeInTheDocument();
  });

  it("renders error UI when the hosts request errors", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: { message: "nope" } });

    renderWithProviders(<Component service={{ widget: { type: "patchmonfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("nope")).toBeInTheDocument();
  });
});
