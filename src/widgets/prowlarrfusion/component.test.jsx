// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

describe("widgets/prowlarrfusion/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a skeleton tile while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "prowlarrfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(1);
  });

  it("sums indexer stats into a consolidated tile", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        indexers: [
          { numberOfGrabs: 10, numberOfQueries: 100, numberOfFailedGrabs: 0, numberOfFailedQueries: 1 },
          { numberOfGrabs: 5, numberOfQueries: 50, numberOfFailedGrabs: 2, numberOfFailedQueries: 0 },
        ],
      },
      error: undefined,
    });

    const service = { widget: { type: "prowlarrfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("grabs")).toBeInTheDocument();
    expect(screen.getByText("150 queries")).toBeInTheDocument();
    expect(screen.getByText("2 failed grabs · 1 failed queries")).toBeInTheDocument();
  });

  it("renders error UI when the indexerstats request errors", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: { message: "nope" } });

    renderWithProviders(<Component service={{ widget: { type: "prowlarrfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("nope")).toBeInTheDocument();
  });
});
