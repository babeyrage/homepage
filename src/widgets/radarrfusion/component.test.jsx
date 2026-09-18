// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

vi.mock("../../components/widgets/queue/queueEntry", () => ({
  default: ({ title, activity, progress }) => (
    <div data-testid="queue-entry" data-activity={activity} data-progress={progress}>
      {title}
    </div>
  ),
}));

import Component from "./component";

describe("widgets/radarrfusion/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a skeleton tile while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "radarrfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(1);
  });

  it("renders a consolidated stat tile and queue entries when enabled", () => {
    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint === "movie")
        return {
          data: {
            wanted: 1,
            missing: 2,
            have: 3,
            all: [
              { id: 10, title: "Queued Movie" },
              { id: 11, title: "Imported Movie" },
            ],
          },
          error: undefined,
        };
      if (endpoint === "queue/status") return { data: { totalCount: 1 }, error: undefined };
      if (endpoint === "queue/details")
        return {
          data: [
            {
              movieId: 10,
              sizeLeft: 0,
              size: 0,
              status: "queued",
              trackedDownloadState: "downloading",
            },
            {
              movieId: 11,
              sizeLeft: 0,
              size: 100,
              status: "completed",
              trackedDownloadState: "importPending",
            },
          ],
          error: undefined,
        };
      return { data: undefined, error: undefined };
    });

    const service = { widget: { type: "radarrfusion", enableQueue: true } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1 wanted · 3 movies")).toBeInTheDocument();
    expect(screen.getByText("1 queued")).toBeInTheDocument();

    const queueEntries = screen.getAllByTestId("queue-entry");
    expect(queueEntries.map((el) => el.textContent)).toEqual(["Queued Movie", "Imported Movie"]);
    expect(queueEntries.map((el) => [el.dataset.activity, el.dataset.progress])).toEqual([
      ["queued", "0"],
      ["import pending", "100"],
    ]);
  });

  it("shows a failed count when a queue entry has failed", () => {
    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint === "movie") return { data: { wanted: 0, missing: 1, have: 5, all: [] }, error: undefined };
      if (endpoint === "queue/status") return { data: { totalCount: 1 }, error: undefined };
      if (endpoint === "queue/details")
        return {
          data: [{ movieId: 20, sizeLeft: 50, size: 100, status: "failed", trackedDownloadState: "failedPending" }],
          error: undefined,
        };
      return { data: undefined, error: undefined };
    });

    const service = { widget: { type: "radarrfusion" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("1 queued · 1 failed")).toBeInTheDocument();
  });
});
