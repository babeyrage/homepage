// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useSWR } = vi.hoisted(() => ({ useSWR: vi.fn() }));

vi.mock("swr", () => ({
  default: useSWR,
}));

import ProxmoxStatusFusion from "./proxmox-status-fusion";

describe("components/services/proxmox-status-fusion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders unknown when data is not available yet", () => {
    useSWR.mockReturnValue({ data: undefined, error: undefined });

    render(<ProxmoxStatusFusion service={{ proxmoxNode: "n1", proxmoxVMID: "100" }} />);

    expect(screen.getByText("docker.unknown")).toBeInTheDocument();
  });

  it("renders error in the bad Fusion color when SWR returns an error", () => {
    useSWR.mockReturnValue({ data: undefined, error: new Error("nope") });

    render(<ProxmoxStatusFusion service={{ proxmoxNode: "n1", proxmoxVMID: "100" }} />);

    const label = screen.getByText("docker.error");
    expect(label).toBeInTheDocument();
    expect(label).toHaveStyle({ color: "#fb7185" });
  });

  it("requests vm stats and renders running in the ok Fusion color", () => {
    useSWR.mockReturnValue({ data: { status: "running" }, error: undefined });

    render(<ProxmoxStatusFusion service={{ proxmoxNode: "n1", proxmoxVMID: "100" }} />);

    expect(useSWR).toHaveBeenCalledWith("/api/proxmox/stats/n1/100?type=qemu");
    const label = screen.getByText("docker.running");
    expect(label).toHaveStyle({ color: "#34d399" });
  });

  it("renders paused vms in the neutral Fusion paused color", () => {
    useSWR.mockReturnValue({ data: { status: "paused" }, error: undefined });

    render(<ProxmoxStatusFusion service={{ proxmoxNode: "n1", proxmoxVMID: "100", proxmoxType: "lxc" }} />);

    expect(useSWR).toHaveBeenCalledWith("/api/proxmox/stats/n1/100?type=lxc");
    const label = screen.getByText("paused");
    expect(label).toHaveStyle({ color: "#94a3b8" });
  });

  it("renders other terminal statuses (stopped/offline/not found) in the warn Fusion color", () => {
    useSWR.mockReturnValue({ data: { status: "stopped" }, error: undefined });
    let result = render(<ProxmoxStatusFusion service={{ proxmoxNode: "n1", proxmoxVMID: "100" }} />);
    expect(screen.getByText("docker.exited")).toHaveStyle({ color: "#f5a524" });
    result.unmount();

    useSWR.mockReturnValue({ data: { status: "offline" }, error: undefined });
    result = render(<ProxmoxStatusFusion service={{ proxmoxNode: "n1", proxmoxVMID: "100" }} />);
    expect(screen.getByText("offline")).toHaveStyle({ color: "#f5a524" });
    result.unmount();

    useSWR.mockReturnValue({ data: { status: "not found" }, error: undefined });
    render(<ProxmoxStatusFusion service={{ proxmoxNode: "n1", proxmoxVMID: "100" }} />);
    expect(screen.getByText("docker.not_found")).toHaveStyle({ color: "#f5a524" });
  });

  it("renders the shared Led primitive, glowing, when style=dot and status is running", () => {
    useSWR.mockReturnValue({ data: { status: "running" }, error: undefined });

    const { container } = render(
      <ProxmoxStatusFusion service={{ proxmoxNode: "n1", proxmoxVMID: "100" }} style="dot" />,
    );

    const led = container.querySelector("span");
    expect(led).toHaveStyle({ backgroundColor: "#34d399", boxShadow: "0 0 6px #34d399" });
    expect(screen.queryByText("docker.running")).not.toBeInTheDocument();
  });

  it("renders the Led without glow when style=dot and status is not running", () => {
    useSWR.mockReturnValue({ data: { status: "stopped" }, error: undefined });

    const { container } = render(
      <ProxmoxStatusFusion service={{ proxmoxNode: "n1", proxmoxVMID: "100" }} style="dot" />,
    );

    const led = container.querySelector("span");
    expect(led).toHaveStyle({ backgroundColor: "#f5a524" });
    expect(led.style.boxShadow).toBe("");
  });
});
