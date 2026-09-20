// Fusion redesign fork of ./proxmox-status — presentation only, see
// /home/babeyrage/.claude/plans/rosy-rolling-crystal.md for the fork
// pattern and rationale. Unlike the src/widgets/<name>fusion forks, this
// component has no widget `type` to register: item.jsx renders it directly
// for any service with proxmoxNode + proxmoxVMID set, so the fork is swapped
// in at that single call site instead. Keeps ./proxmox-status.jsx (upstream
// Homepage, untouched) mergeable, and confines this file's churn to the
// visual language, not the status logic it mirrors 1:1.
//
// Same status→severity mapping as the original, just resolved to
// FUSION_COLORS instead of ad hoc Tailwind color/opacity classes, so this
// badge reads as the same palette as every Led/Chip/Bar elsewhere in the
// Fusion redesign rather than its own slightly-off greens/oranges/reds.
// "paused" gets FUSION_COLORS.paused (a neutral slate) rather than borrowing
// blue, which already means something else (active/info) in this palette —
// same reasoning FUSION_COLORS' own comment gives for that color existing.
import { useTranslation } from "next-i18next/pages";
import useSWR from "swr";

import { Led, FUSION_COLORS } from "components/widgets/fusion/primitives";

const NEUTRAL = FUSION_COLORS.paused;

export default function ProxmoxStatusFusion({ service, style }) {
  const { t } = useTranslation();

  const vmType = service.proxmoxType || "qemu";
  const apiUrl = `/api/proxmox/stats/${service.proxmoxNode}/${service.proxmoxVMID}?type=${vmType}`;

  const { data, error } = useSWR(apiUrl);

  let statusLabel = t("docker.unknown");
  let color = NEUTRAL;
  let glow = false;

  if (error) {
    statusLabel = t("docker.error");
    color = FUSION_COLORS.bad;
  } else if (data) {
    if (data.status === "running") {
      statusLabel = t("docker.running");
      color = FUSION_COLORS.ok;
      glow = true;
    }

    if (data.status === "stopped") {
      statusLabel = t("docker.exited");
      color = FUSION_COLORS.warn;
    }

    if (data.status === "paused") {
      statusLabel = "paused";
      color = NEUTRAL;
    }

    if (data.status === "offline") {
      statusLabel = "offline";
      color = FUSION_COLORS.warn;
    }

    if (data.status === "not found") {
      statusLabel = t("docker.not_found");
      color = FUSION_COLORS.warn;
    }
  }

  const backgroundClass =
    style === "dot" ? "p-4 hover:bg-theme-500/10 dark:hover:bg-theme-900/20" : "px-1.5 py-0.5 bg-theme-500/10 dark:bg-theme-900/50";

  return (
    <div
      className={`w-auto text-center overflow-hidden ${backgroundClass} rounded-b-[3px] proxmoxstatus proxmoxstatus-${statusLabel
        .toLowerCase()
        .replace(" ", "-")}`}
      title={statusLabel}
    >
      {style !== "dot" ? (
        <div className="text-[8px] font-bold uppercase" style={{ color }}>
          {statusLabel}
        </div>
      ) : (
        <Led color={color} glow={glow} />
      )}
    </div>
  );
}
