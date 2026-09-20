import { useTranslation } from "next-i18next/pages";

import {
  Led,
  MonoLabel,
  Bar,
  FUSION_COLORS,
  FUSION_MONO,
  HighlightColors,
  useLastUpdatedLabel,
} from "../../components/widgets/fusion/primitives";

import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";

// Unlike the stock proxmox component, which aggregates every matched node
// into one CPU/RAM figure, each service entry here targets exactly one node
// (via widget.node), so the fork can show that node's own uptime and its
// CPU/RAM/DISK load as three bars instead of a cluster-wide average.
//
// Built-in fallback thresholds, used whenever a bar's field has no
// widget.highlight override in services.yaml (resolved via HighlightColors
// below) — reproduces this fork's original hardcoded behavior.
function barColorForPct(pct) {
  if (pct >= 85) return FUSION_COLORS.bad;
  if (pct >= 60) return FUSION_COLORS.warn;
  return FUSION_COLORS.ok;
}

const SEVERITY_RANK = { [FUSION_COLORS.ok]: 0, [FUSION_COLORS.warn]: 1, [FUSION_COLORS.bad]: 2 };

// Most-severe-wins across the three resource bars — same "combined LED"
// convention as pbsfusion/patchmonfusion, so a glance at the top LED reflects
// more than plain reachability once any bar crosses into warn/danger.
function worstColor(colors) {
  return colors.reduce((worst, color) => (SEVERITY_RANK[color] > SEVERITY_RANK[worst] ? color : worst), FUSION_COLORS.ok);
}

// `detail` is an optional secondary figure shown beside the percentage —
// e.g. absolute used/total bytes, or a core count — sourced from fields the
// cluster/resources response already carries, so it costs no extra request.
// `title` is an optional tooltip on the label itself, for a metric whose
// name alone is ambiguous (e.g. "root" vs. the node's real storage pools).
function ResourceBar({ label, pct, detail, title, color }) {
  return (
    <div className="flex flex-col gap-0.5 w-full">
      <div className="flex items-center justify-between gap-2">
        <MonoLabel title={title}>{label}</MonoLabel>
        <span className="flex items-baseline gap-1.5" style={{ fontFamily: FUSION_MONO }}>
          {detail && (
            <span className="text-[9px] tabular-nums text-theme-400/70 dark:text-theme-500/60">{detail}</span>
          )}
          <span className="text-[9.5px] tabular-nums text-theme-500 dark:text-theme-400">{Math.round(pct)}%</span>
        </span>
      </div>
      <Bar pct={pct} color={color} />
    </div>
  );
}

// A single "label count" pair for the guest-count row, e.g. "vms 3/5".
function GuestCount({ label, running, total }) {
  return (
    <div className="flex items-center gap-1">
      <MonoLabel>{label}</MonoLabel>
      <span className="text-[9.5px] tabular-nums text-theme-500 dark:text-theme-400" style={{ fontFamily: FUSION_MONO }}>
        {running}/{total}
      </span>
    </div>
  );
}

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const { data: clusterData, error: clusterError } = useWidgetAPI(widget, "cluster/resources");
  const updatedAgo = useLastUpdatedLabel(clusterData);

  if (clusterError) {
    return <Container service={service} error={clusterError} />;
  }

  if (!clusterData || !clusterData.data) {
    return (
      <Container service={service}>
        <div className="flex flex-col gap-1.5 w-full px-2 py-1.5 animate-pulse">
          <div className="h-4 w-16 rounded-sm bg-theme-300/40 dark:bg-theme-800/40" />
          <div className="h-1 w-full rounded-full bg-theme-300/30 dark:bg-theme-800/30" />
          <div className="h-1 w-full rounded-full bg-theme-300/30 dark:bg-theme-800/30" />
          <div className="h-1 w-full rounded-full bg-theme-300/30 dark:bg-theme-800/30" />
        </div>
      </Container>
    );
  }

  const node = clusterData.data.find(
    (item) => item.type === "node" && (widget.node === undefined || widget.node === item.node),
  );
  const online = node?.status === "online";
  const cpuPct = online ? node.cpu * 100 : 0;
  const memPct = online && node.maxmem ? (node.mem / node.maxmem) * 100 : 0;
  const diskPct = online && node.maxdisk ? (node.disk / node.maxdisk) * 100 : 0;

  // Same cluster/resources payload also lists every VM/LXC with the node
  // they live on, so the guest counts for this node come free of charge —
  // matching the stock proxmox widget's cluster-wide filter, just scoped to
  // a single node instead of summed across all of them.
  const vms = online
    ? clusterData.data.filter((item) => item.type === "qemu" && item.template === 0 && item.node === node.node)
    : [];
  const lxc = online
    ? clusterData.data.filter((item) => item.type === "lxc" && item.template === 0 && item.node === node.node)
    : [];
  const runningVMs = vms.filter((item) => item.status === "running").length;
  const runningLXC = lxc.filter((item) => item.status === "running").length;

  return (
    <Container service={service}>
      <HighlightColors>
        {(getColor) => {
          const cpuColor = getColor("cpu", cpuPct, barColorForPct(cpuPct));
          const ramColor = getColor("ram", memPct, barColorForPct(memPct));
          const diskColor = getColor("disk", diskPct, barColorForPct(diskPct));
          const ledColor = online ? worstColor([cpuColor, ramColor, diskColor]) : FUSION_COLORS.bad;

          return (
            <div className="flex flex-col gap-1.5 w-full px-2 py-1.5">
              <div className="flex items-baseline gap-1.5">
                <Led color={ledColor} glow={online} className="translate-y-[-2px]" />
                <span className="text-[13px] font-extrabold leading-tight tabular-nums" style={{ fontFamily: FUSION_MONO }}>
                  {online ? t("common.duration", { value: node.uptime }) : "offline"}
                </span>
                {online && (
                  <span
                    className="text-[9px] font-semibold uppercase tracking-widest text-theme-500 dark:text-theme-400/80"
                    style={{ fontFamily: FUSION_MONO }}
                  >
                    uptime
                  </span>
                )}
                {updatedAgo && (
                  <span
                    className="ml-auto text-[9px] leading-snug text-theme-400/50 dark:text-theme-500/40 shrink-0"
                    style={{ fontFamily: FUSION_MONO }}
                  >
                    {updatedAgo}
                  </span>
                )}
              </div>
              {online && (
                <div className="flex items-center gap-3 w-full">
                  <GuestCount label="vms" running={runningVMs} total={vms.length} />
                  <GuestCount label="lxc" running={runningLXC} total={lxc.length} />
                </div>
              )}
              <ResourceBar label="cpu" pct={cpuPct} detail={online ? `${node.maxcpu}c` : undefined} color={cpuColor} />
              <ResourceBar
                label="ram"
                pct={memPct}
                detail={online ? `${t("common.bytes", { value: node.mem })}/${t("common.bytes", { value: node.maxmem })}` : undefined}
                color={ramColor}
              />
              <ResourceBar
                label="root"
                title="Root filesystem usage — not the node's storage pools (ZFS/LVM/Ceph/etc.), where VM and LXC disks actually live"
                pct={diskPct}
                detail={online ? `${t("common.bytes", { value: node.disk })}/${t("common.bytes", { value: node.maxdisk })}` : undefined}
                color={diskColor}
              />
            </div>
          );
        }}
      </HighlightColors>
    </Container>
  );
}
