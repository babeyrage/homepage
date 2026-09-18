// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

describe("widgets/pbsfusion/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a skeleton tile while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "pbsfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(1);
  });

  it("renders backup count and usage for the matched datastore", () => {
    useWidgetAPI.mockReturnValue({
      data: [
        {
          id: "69e22f10a61280ecf6a6d9d2",
          name: "ragenetwork-offsite-zues",
          size_gb: 1000,
          metrics: {
            used_bytes: 400,
            available_bytes: 600,
            used_percent: 40,
            backup_count: 12,
          },
          gc: { last_run: "2026-09-01T00:00:00Z", status: "ok", next_scheduled: "2026-09-19T00:00:00Z" },
          verification: { last_run: "2026-09-01T00:00:00Z", status: "ok", next_scheduled: "2026-09-19T00:00:00Z" },
          immutable_backup: { enabled: true },
        },
        {
          id: "69d49d33a4a5f98fddf09334",
          name: "ragenetwork-offsite-apollo",
          size_gb: 1000,
          metrics: { used_bytes: 1, available_bytes: 1, used_percent: 50, backup_count: 1 },
          gc: { status: "ok" },
          verification: { status: "ok" },
          immutable_backup: { enabled: false },
        },
      ],
      error: undefined,
    });

    const service = { widget: { type: "pbsfusion", datastoreName: "ragenetwork-offsite-zues" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("backups")).toBeInTheDocument();
    expect(screen.getByText("gc ok · verify ok")).toBeInTheDocument();
    expect(screen.getByText("immutable")).toBeInTheDocument();
  });

  it("shows a not-found state when no datastore matches datastoreName", () => {
    useWidgetAPI.mockReturnValue({
      data: [
        {
          id: "69d49d33a4a5f98fddf09334",
          name: "ragenetwork-offsite-apollo",
          metrics: { used_bytes: 1, available_bytes: 1, used_percent: 1, backup_count: 1 },
          gc: { status: "ok" },
          verification: { status: "ok" },
        },
      ],
      error: undefined,
    });

    const service = { widget: { type: "pbsfusion", datastoreName: "ragenetwork-offsite-zues" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("datastore not found")).toBeInTheDocument();
  });

  it("shows a host-unreachable state when the datastore has null metrics", () => {
    useWidgetAPI.mockReturnValue({
      data: [
        {
          id: "69e22f10a61280ecf6a6d9d2",
          name: "ragenetwork-offsite-zues",
          metrics: null,
          gc: { status: "never" },
          verification: { status: "never" },
        },
      ],
      error: undefined,
    });

    const service = { widget: { type: "pbsfusion", datastoreName: "ragenetwork-offsite-zues" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("host unreachable")).toBeInTheDocument();
    expect(screen.getByText("gc never · verify never")).toBeInTheDocument();
  });

  it("renders error UI when the datastores request errors", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: { message: "nope" } });

    renderWithProviders(<Component service={{ widget: { type: "pbsfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("nope")).toBeInTheDocument();
  });
});
