// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

describe("widgets/traefikfusion/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a skeleton tile while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "traefikfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(1);
  });

  it("renders router/service/middleware totals with no warnings or errors", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        http: {
          routers: { total: 33, warnings: 0, errors: 0 },
          services: { total: 21, warnings: 0, errors: 0 },
          middlewares: { total: 13, warnings: 0, errors: 0 },
        },
      },
      error: undefined,
    });

    renderWithProviders(<Component service={{ widget: { type: "traefikfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("33")).toBeInTheDocument();
    expect(screen.getByText("routers")).toBeInTheDocument();
    expect(screen.getByText("21 services · 13 middleware")).toBeInTheDocument();
  });

  it("surfaces errors and warnings when present", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        http: {
          routers: { total: 5, warnings: 0, errors: 1 },
          services: { total: 5, warnings: 2, errors: 0 },
          middlewares: { total: 2, warnings: 0, errors: 0 },
        },
      },
      error: undefined,
    });

    renderWithProviders(<Component service={{ widget: { type: "traefikfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("1 errors · 2 warnings")).toBeInTheDocument();
  });

  it("renders error UI when the request errors", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: { message: "nope" } });

    renderWithProviders(<Component service={{ widget: { type: "traefikfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("nope")).toBeInTheDocument();
  });
});
