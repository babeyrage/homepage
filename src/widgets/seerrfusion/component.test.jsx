// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

describe("widgets/seerrfusion/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Results are built once and returned by reference on every mock call
  // (keyed by endpoint) rather than via a fixed-length mockReturnValueOnce
  // queue, matching real SWR's stable-`data`-reference guarantee and not
  // assuming an exact render count — useLastUpdatedLabel's useCurrentTime
  // dependency legitimately triggers one extra render pass on mount (React
  // re-renders once more when useSyncExternalStore's snapshot changes
  // between render and the commit-phase subscribe call), so a queue sized
  // for exactly one render's worth of calls is the wrong assumption here.
  function mockEndpoints(statsResult, issueResult) {
    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint === "request/count") return statsResult;
      if (endpoint === "issue/count") return issueResult;
      return { data: undefined, error: undefined }; // issue/count disabled (endpoint = "")
    });
  }

  it("renders a skeleton tile while loading", () => {
    mockEndpoints({ data: undefined, error: undefined }, { data: undefined, error: undefined });

    const { container } = renderWithProviders(
      <Component service={{ widget: { type: "seerrfusion", url: "http://x" } }} />,
      { settings: { hideErrors: false } },
    );

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(1);
  });

  it("renders a consolidated stat tile with default fields (no issues)", () => {
    mockEndpoints({ data: { pending: 3, approved: 5, completed: 40 }, error: undefined }, { data: undefined, error: undefined });

    const service = { widget: { type: "seerrfusion", url: "http://x" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(useWidgetAPI.mock.calls[1][1]).toBe("");
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(screen.getByText("5 approved · 40 completed")).toBeInTheDocument();
  });

  it("falls back from completed to available on older Seerr responses", () => {
    mockEndpoints({ data: { pending: 1, approved: 2, available: 9 }, error: undefined }, { data: undefined, error: undefined });

    const service = { widget: { type: "seerrfusion", url: "http://x", fields: ["pending", "approved", "completed"] } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("2 approved · 9 completed")).toBeInTheDocument();
  });

  it("shows open/total issues and a badge when issues are enabled and open > 0", () => {
    mockEndpoints({ data: { pending: 0, approved: 2, completed: 4 }, error: undefined }, { data: { open: 1, total: 2 }, error: undefined });

    const service = {
      widget: { type: "seerrfusion", url: "http://x", fields: ["pending", "approved", "completed", "issues"] },
    };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(useWidgetAPI.mock.calls[1][1]).toBe("issue/count");
    expect(screen.getByText("1 / 2 issues")).toBeInTheDocument();
    expect(screen.getByText("open")).toBeInTheDocument();
  });

  it("renders error UI when issues are enabled and issue/count errors", () => {
    mockEndpoints(
      { data: { pending: 0, approved: 0, available: 0 }, error: undefined },
      { data: undefined, error: { message: "nope" } },
    );

    renderWithProviders(
      <Component service={{ widget: { type: "seerrfusion", url: "http://x", fields: ["issues"] } }} />,
      { settings: { hideErrors: false } },
    );

    expect(screen.getAllByText(/widget\.api_error/i).length).toBeGreaterThan(0);
    expect(screen.getByText("nope")).toBeInTheDocument();
  });
});
