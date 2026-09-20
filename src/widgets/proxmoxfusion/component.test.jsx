// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

import { SettingsContext } from "utils/contexts/settings";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

const ONLINE_NODE = {
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
};

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

  it("shows an ok LED when every bar is under its built-in threshold", () => {
    useWidgetAPI.mockReturnValue({ data: { data: [ONLINE_NODE] }, error: undefined });

    const { container } = renderWithProviders(
      <Component service={{ widget: { type: "proxmoxfusion", node: "zeus" } }} />,
      { settings: { hideErrors: false } },
    );

    expect(container.querySelector("span")).toHaveStyle({ backgroundColor: "#34d399" });
  });

  it("folds a bar crossing the built-in danger threshold into the top LED", () => {
    useWidgetAPI.mockReturnValue({
      data: { data: [{ ...ONLINE_NODE, disk: 480_000_000_000 }] }, // 96% root usage
      error: undefined,
    });

    const { container } = renderWithProviders(
      <Component service={{ widget: { type: "proxmoxfusion", node: "zeus" } }} />,
      { settings: { hideErrors: false } },
    );

    expect(container.querySelector("span")).toHaveStyle({ backgroundColor: "#fb7185" });
  });

  it("lets a service.widget.highlight config override a bar's built-in color", () => {
    useWidgetAPI.mockReturnValue({ data: { data: [ONLINE_NODE] }, error: undefined });

    const service = {
      widget: {
        type: "proxmoxfusion",
        node: "zeus",
        // cpuPct is 42%, well under the built-in 60% warn threshold, but the
        // override below flags anything above 10% — proves the config wins
        // over barColorForPct's fallback.
        highlight: { cpu: { numeric: { when: "gt", value: 10, level: "danger" } } },
      },
    };
    const { container } = renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(container.querySelector("span")).toHaveStyle({ backgroundColor: "#fb7185" });
  });

  it("shows an 'ago' staleness label once data arrives after loading", () => {
    // useLastUpdatedLabel only captures a timestamp when `data` actually
    // changes reference, so this exercises the same loading -> loaded
    // transition a real SWR-backed mount goes through, rather than mounting
    // straight into an already-loaded state (which would never trigger a
    // capture and would make this test pass for the wrong reason).
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    const value = { settings: { hideErrors: false }, setSettings: () => {} };
    const service = { widget: { type: "proxmoxfusion", node: "zeus" } };
    const { rerender } = render(
      <SettingsContext.Provider value={value}>
        <Component service={service} />
      </SettingsContext.Provider>,
    );

    useWidgetAPI.mockReturnValue({ data: { data: [ONLINE_NODE] }, error: undefined });
    rerender(
      <SettingsContext.Provider value={value}>
        <Component service={service} />
      </SettingsContext.Provider>,
    );

    expect(screen.getByText(/ago|just now/)).toBeInTheDocument();
  });
});
