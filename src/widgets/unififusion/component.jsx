import { useTranslation } from "next-i18next/pages";

import { StatTile, FUSION_COLORS, useLastUpdatedLabel } from "../../components/widgets/fusion/primitives";

import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const { data, error } = useWidgetAPI(widget, "stat/sites");
  const updatedAgo = useLastUpdatedLabel(data);

  if (error) {
    return <Container service={service} error={error} />;
  }

  const defaultSite = widget.site
    ? data?.data.find((s) => s.desc === widget.site)
    : data?.data?.find((s) => s.name === "default");

  if (!defaultSite) {
    if (widget.site) {
      return <Container service={service} error={{ message: `Site '${widget.site}' not found` }} />;
    }

    return (
      <Container service={service}>
        <StatTile />
      </Container>
    );
  }

  const wan = defaultSite.health.find((h) => h.subsystem === "wan");
  const lan = defaultSite.health.find((h) => h.subsystem === "lan");
  const wlan = defaultSite.health.find((h) => h.subsystem === "wlan");
  [wan, lan, wlan].forEach((s) => {
    if (s) {
      s.up = s.status === "ok";
      s.show = s.status !== "unknown";
    }
  });

  const uptime = wan?.["gw_system-stats"]
    ? `${t("common.number", { value: wan["gw_system-stats"].uptime / 86400, maximumFractionDigits: 1 })} ${t("unifi.days")}`
    : null;

  if (!(wan?.show || lan?.show || wlan?.show || uptime)) {
    return (
      <Container service={service}>
        <StatTile ledColor={FUSION_COLORS.warn} primary="—" secondary={t("unifi.empty_data")} updatedAgo={updatedAgo} />
      </Container>
    );
  }

  const clients = (lan?.show ? lan.num_user : 0) + (wlan?.show ? wlan.num_user : 0);

  const statusParts = [];
  if (wan?.show) statusParts.push(`wan ${wan.up ? t("unifi.up") : t("unifi.down")}`);
  if (lan?.show) statusParts.push(`lan ${lan.up ? t("unifi.up") : t("unifi.down")}`);
  if (wlan?.show) statusParts.push(`wlan ${wlan.up ? t("unifi.up") : t("unifi.down")}`);

  const ledColor =
    wan?.show && !wan.up
      ? FUSION_COLORS.bad
      : (lan?.show && !lan.up) || (wlan?.show && !wlan.up)
        ? FUSION_COLORS.warn
        : FUSION_COLORS.ok;

  return (
    <Container service={service}>
      <StatTile
        ledColor={ledColor}
        primary={t("common.number", { value: clients })}
        primaryLabel="clients"
        secondary={uptime ?? undefined}
        tertiary={statusParts.length > 0 ? statusParts.join(" · ") : undefined}
        updatedAgo={updatedAgo}
      />
    </Container>
  );
}
