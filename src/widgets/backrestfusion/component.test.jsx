// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

describe("widgets/backrestfusion/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a skeleton tile while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "backrestfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(1);
  });

  it("renders a consolidated stat tile even when widget.fields is configured", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        numPlans: 3,
        numSuccessLatest: 3,
        numFailureLatest: 0,
        numSuccess30Days: 90,
        numFailure30Days: 0,
        bytesAdded30Days: 1024,
      },
      error: undefined,
    });

    const service = {
      widget: { type: "backrestfusion", fields: ["num_success_latest", "num_failure_latest"] },
    };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("plans")).toBeInTheDocument();
    expect(screen.getByText("3/3 succeeded latest")).toBeInTheDocument();
    expect(screen.getByText("0 failed · 1024 added (30d)")).toBeInTheDocument();
    expect(screen.queryByText(/failing/)).not.toBeInTheDocument();
  });

  it("shows a failing badge when the latest run failed", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        numPlans: 3,
        numSuccessLatest: 2,
        numFailureLatest: 1,
        numSuccess30Days: 85,
        numFailure30Days: 5,
        bytesAdded30Days: 2048,
      },
      error: undefined,
    });

    const service = { widget: { type: "backrestfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("1 failing")).toBeInTheDocument();
  });

  it("renders error UI when the summary request errors", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: { message: "nope" } });

    renderWithProviders(<Component service={{ widget: { type: "backrestfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("nope")).toBeInTheDocument();
  });
});
