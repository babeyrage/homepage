// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

describe("widgets/sabnzbdfusion/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a skeleton tile while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "sabnzbdfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(1);
  });

  it("renders a consolidated stat tile for an active queue", () => {
    useWidgetAPI.mockReturnValue({
      data: { queue: { speed: "1.5 M", noofslots: 3, timeleft: "0:12:34" } },
      error: undefined,
    });

    const service = { widget: { type: "sabnzbdfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("queue")).toBeInTheDocument();
    expect(screen.getByText(`↓ ${1.5 * 1024 ** 2}`)).toBeInTheDocument();
    expect(screen.getByText("0:12:34")).toBeInTheDocument();
  });

  it("hides the timeleft line when the queue is empty", () => {
    useWidgetAPI.mockReturnValue({
      data: { queue: { speed: "0 B", noofslots: 0, timeleft: "0:00:00" } },
      error: undefined,
    });

    const service = { widget: { type: "sabnzbdfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.queryByText("0:00:00")).not.toBeInTheDocument();
  });

  it("renders error UI when the queue request errors", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: { message: "nope" } });

    renderWithProviders(<Component service={{ widget: { type: "sabnzbdfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("nope")).toBeInTheDocument();
  });
});
