// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

describe("widgets/speedtestfusion/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a skeleton tile while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "speedtestfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(1);
  });

  it("renders download/upload/ping for the v2 endpoint", () => {
    useWidgetAPI.mockReturnValue({
      data: { data: { download: 10, upload: 20, ping: 3 } },
      error: undefined,
    });

    renderWithProviders(<Component service={{ widget: { type: "speedtestfusion", version: 2 } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("down")).toBeInTheDocument();
    expect(screen.getByText("160 up")).toBeInTheDocument();
    expect(screen.getByText("3 ping")).toBeInTheDocument();
  });

  it("renders error UI when the request errors", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: { message: "nope" } });

    renderWithProviders(<Component service={{ widget: { type: "speedtestfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("nope")).toBeInTheDocument();
  });

  it("shows a bad LED when ping is above 150ms", () => {
    useWidgetAPI.mockReturnValue({ data: { data: { download: 10, upload: 20, ping: 200 } }, error: undefined });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "speedtestfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelector("span")).toHaveStyle({ backgroundColor: "#fb7185" });
  });

  it("shows a warn LED when ping is between 50ms and 150ms", () => {
    useWidgetAPI.mockReturnValue({ data: { data: { download: 10, upload: 20, ping: 80 } }, error: undefined });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "speedtestfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelector("span")).toHaveStyle({ backgroundColor: "#f5a524" });
  });

  it("shows an ok LED when ping is 50ms or under", () => {
    useWidgetAPI.mockReturnValue({ data: { data: { download: 10, upload: 20, ping: 20 } }, error: undefined });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "speedtestfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelector("span")).toHaveStyle({ backgroundColor: "#34d399" });
  });

  it("lets a service.widget.highlight config override the built-in ping LED color", () => {
    useWidgetAPI.mockReturnValue({ data: { data: { download: 10, upload: 20, ping: 20 } }, error: undefined });

    const service = {
      widget: {
        type: "speedtestfusion",
        highlight: { ping: { numeric: { when: "gte", value: 10, level: "danger" } } },
      },
    };
    const { container } = renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(container.querySelector("span")).toHaveStyle({ backgroundColor: "#fb7185" });
  });
});
