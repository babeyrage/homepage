import { useTranslation } from "next-i18next/pages";

import { Led, MonoLabel, Bar, FUSION_COLORS, FUSION_MONO } from "../../components/widgets/fusion/primitives";

import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";

// Unlike the stock proxmox component, which aggregates every matched node
// into one CPU/RAM figure, each service entry here targets exactly one node
// (via widget.node), so the fork can show that node's own uptime and its
// CPU/RAM/DISK load as three bars instead of a cluster-wide average.
function barColorForPct(pct) {
  if (pct >= 85) return FUSION_COLORS.bad;
  if (pct >= 60) return FUSION_COLORS.warn;
  return FUSION_COLORS.ok;
}

function ResourceBar({ label, pct }) {
  return (
    <div className="flex flex-col gap-0.5 w-full">
      <div className="flex items-center justify-between">
        <MonoLabel>{label}</MonoLabel>
        <span className="text-[9.5px] tabular-nums text-theme-500 dark:text-theme-400" style={{ fontFamily: FUSION_MONO }}>
          {Math.round(pct)}%
        </span>
      </div>
      <Bar pct={pct} color={barColorForPct(pct)} />
    </div>
  );
}

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const { data: clusterData, error: clusterError } = useWidgetAPI(widget, "cluster/resources");

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

  return (
    <Container service={service}>
      <div className="flex flex-col gap-1.5 w-full px-2 py-1.5">
        <div className="flex items-baseline gap-1.5">
          <Led color={online ? FUSION_COLORS.ok : FUSION_COLORS.bad} glow={online} className="translate-y-[-2px]" />
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
        </div>
        <ResourceBar label="cpu" pct={cpuPct} />
        <ResourceBar label="ram" pct={memPct} />
        <ResourceBar label="disk" pct={diskPct} />
      </div>
    </Container>
  );
}
