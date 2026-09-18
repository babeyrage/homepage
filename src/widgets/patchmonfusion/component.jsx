import { useTranslation } from "next-i18next/pages";

import {
  StatTile,
  Chip,
  FUSION_COLORS,
  HighlightColors,
  useLastUpdatedLabel,
} from "../../components/widgets/fusion/primitives";

import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const { data, error } = useWidgetAPI(widget, "hosts", { include: "stats" });

  const hosts = data?.hosts ?? [];
  const totalHosts = data?.total ?? hosts.length;
  const outdated = hosts.filter((h) => (h.updates_count ?? 0) > 0).length;
  const needsReboot = hosts.filter((h) => h.needs_reboot === true).length;
  const securityUpdates = hosts.reduce((sum, h) => sum + (h.security_updates_count ?? 0), 0);

  // Built-in combined threshold (outdated > 0/5, needsReboot > 0,
  // securityUpdates > 0), reproducing the stock component's default
  // severity levels for a single consolidated tile's LED. A user's own
  // services.yaml widget.highlight config — resolved per field below via
  // HighlightColors, most-severe field wins — takes priority.
  const builtInLedColor =
    securityUpdates > 0 || outdated > 5
      ? FUSION_COLORS.bad
      : outdated > 0 || needsReboot > 0
        ? FUSION_COLORS.warn
        : FUSION_COLORS.ok;

  const updatedAgo = useLastUpdatedLabel(data);

  if (error) {
    return <Container service={service} error={error} />;
  }

  if (!data) {
    return (
      <Container service={service}>
        <StatTile />
      </Container>
    );
  }

  return (
    <Container service={service}>
      <HighlightColors>
        {(getColor) => {
          const ledColor =
            getColor("securityUpdates", securityUpdates) ??
            getColor("outdated", outdated) ??
            getColor("needsReboot", needsReboot) ??
            builtInLedColor;
          return (
            <StatTile
              ledColor={ledColor}
              primary={t("common.number", { value: totalHosts })}
              primaryLabel="hosts"
              secondary={`${t("common.number", { value: outdated })} outdated · ${t("common.number", { value: needsReboot })} need reboot`}
              tertiary={`${t("common.number", { value: securityUpdates })} security updates`}
              tertiaryBadge={
                securityUpdates > 0 && (
                  <Chip color={FUSION_COLORS.bad}>{t("common.number", { value: securityUpdates })} urgent</Chip>
                )
              }
              updatedAgo={updatedAgo}
            />
          );
        }}
      </HighlightColors>
    </Container>
  );
}
