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

  it("shows an update badge when the newest reported version isn't installed", () => {
    const grabsResult = {
      data: { indexers: [{ numberOfGrabs: 1, numberOfQueries: 1, numberOfFailedGrabs: 0, numberOfFailedQueries: 0 }] },
      error: undefined,
    };
    const updateResult = { data: [{ version: "1.28.0", installed: false }], error: undefined };
    const emptyResult = { data: undefined, error: undefined };

    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint === "indexerstats") return grabsResult;
      if (endpoint === "update") return updateResult;
      return emptyResult;
    });

    const service = { widget: { type: "prowlarrfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("update")).toBeInTheDocument();
  });

  it("hides the update badge once the newest reported version is installed", () => {
    const grabsResult = {
      data: { indexers: [{ numberOfGrabs: 1, numberOfQueries: 1, numberOfFailedGrabs: 0, numberOfFailedQueries: 0 }] },
      error: undefined,
    };
    const updateResult = { data: [{ version: "1.28.0", installed: true }], error: undefined };
    const emptyResult = { data: undefined, error: undefined };

    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint === "indexerstats") return grabsResult;
      if (endpoint === "update") return updateResult;
      return emptyResult;
    });

    const service = { widget: { type: "prowlarrfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.queryByText("update")).not.toBeInTheDocument();
  });

  it("renders error UI when the indexerstats request errors", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: { message: "nope" } });

    renderWithProviders(<Component service={{ widget: { type: "prowlarrfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("nope")).toBeInTheDocument();
  });
});
