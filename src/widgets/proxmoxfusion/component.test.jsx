// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

describe("widgets/proxmoxfusion/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a skeleton tile while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "proxmoxfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(1);
  });

  it("renders uptime and cpu/ram/disk bars for the matched node", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        data: [
          {
            type: "node",
            node: "zeus",
            status: "online",
            uptime: 90000,
            cpu: 0.42,
            maxcpu: 8,
            mem: 4_000_000_000,
            maxmem: 8_000_000_000,
            disk: 200_000_000_000,
            maxdisk: 500_000_000_000,
          },
          {
            type: "node",
            node: "apollo",
            status: "online",
            uptime: 1,
            cpu: 0.9,
            maxcpu: 4,
            mem: 1,
            maxmem: 2,
            disk: 1,
            maxdisk: 2,
          },
          { type: "qemu", node: "zeus", template: 0, status: "running" },
          { type: "qemu", node: "zeus", template: 0, status: "stopped" },
          { type: "qemu", node: "zeus", template: 1, status: "stopped" },
          { type: "lxc", node: "zeus", template: 0, status: "running" },
          { type: "lxc", node: "zeus", template: 0, status: "running" },
          { type: "qemu", node: "apollo", template: 0, status: "running" },
        ],
      },
      error: undefined,
    });

    const service = { widget: { type: "proxmoxfusion", node: "zeus" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("90000")).toBeInTheDocument();
    expect(screen.getByText("uptime")).toBeInTheDocument();
    expect(screen.getByText("cpu")).toBeInTheDocument();
    expect(screen.getByText("ram")).toBeInTheDocument();
    expect(screen.getByText("root")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();

    // Detail figures riding along on the existing cluster/resources payload.
    expect(screen.getByText("8c")).toBeInTheDocument();
    expect(screen.getByText("4000000000/8000000000")).toBeInTheDocument();
    expect(screen.getByText("200000000000/500000000000")).toBeInTheDocument();

    // Guest counts scoped to zeus only — apollo's qemu guest isn't counted.
    expect(screen.getByText("vms")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("lxc")).toBeInTheDocument();
    expect(screen.getByText("2/2")).toBeInTheDocument();
  });

  it("shows an offline state when the matched node is not online", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        data: [{ type: "node", node: "zeus", status: "offline" }],
      },
      error: undefined,
    });

    const service = { widget: { type: "proxmoxfusion", node: "zeus" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByText("offline")).toBeInTheDocument();
    expect(screen.getAllByText("0%")).toHaveLength(3);
  });

  it("renders error UI when the cluster/resources request errors", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: { message: "nope" } });

    renderWithProviders(<Component service={{ widget: { type: "proxmoxfusion" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("nope")).toBeInTheDocument();
  });
});
