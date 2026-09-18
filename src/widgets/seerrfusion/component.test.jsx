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

  it("renders a skeleton tile while loading", () => {
    useWidgetAPI
      .mockReturnValueOnce({ data: undefined, error: undefined }) // request/count
      .mockReturnValueOnce({ data: undefined, error: undefined }); // issue/count disabled

    const { container } = renderWithProviders(
      <Component service={{ widget: { type: "seerrfusion", url: "http://x" } }} />,
      { settings: { hideErrors: false } },
    );

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(1);
  });

  it("renders a consolidated stat tile with default fields (no issues)", () => {
    useWidgetAPI
      .mockReturnValueOnce({ data: { pending: 3, approved: 5, completed: 40 }, error: undefined })
      .mockReturnValueOnce({ data: undefined, error: undefined }); // issue/count disabled (endpoint = "")

    const service = { widget: { type: "seerrfusion", url: "http://x" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(useWidgetAPI.mock.calls[1][1]).toBe("");
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(screen.getByText("5 approved · 40 completed")).toBeInTheDocument();
  });

  it("falls back from completed to available on older Seerr responses", () => {
    useWidgetAPI
      .mockReturnValueOnce({ data: { pending: 1, approved: 2, available: 9 }, error: undefined })
      .mockReturnValueOnce({ data: undefined, error: undefined });

    const service = { widget: { type: "seerrfusion", url: "http://x", fields: ["pending", "approved", "completed"] } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("2 approved · 9 completed")).toBeInTheDocument();
  });

  it("shows open/total issues and a badge when issues are enabled and open > 0", () => {
    useWidgetAPI
      .mockReturnValueOnce({ data: { pending: 0, approved: 2, completed: 4 }, error: undefined })
      .mockReturnValueOnce({ data: { open: 1, total: 2 }, error: undefined });

    const service = {
      widget: { type: "seerrfusion", url: "http://x", fields: ["pending", "approved", "completed", "issues"] },
    };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(useWidgetAPI.mock.calls[1][1]).toBe("issue/count");
    expect(screen.getByText("1 / 2 issues")).toBeInTheDocument();
    expect(screen.getByText("open")).toBeInTheDocument();
  });

  it("renders error UI when issues are enabled and issue/count errors", () => {
    useWidgetAPI
      .mockReturnValueOnce({ data: { pending: 0, approved: 0, available: 0 }, error: undefined })
      .mockReturnValueOnce({ data: undefined, error: { message: "nope" } });

    renderWithProviders(
      <Component service={{ widget: { type: "seerrfusion", url: "http://x", fields: ["issues"] } }} />,
      { settings: { hideErrors: false } },
    );

    expect(screen.getAllByText(/widget\.api_error/i).length).toBeGreaterThan(0);
    expect(screen.getByText("nope")).toBeInTheDocument();
  });
});
