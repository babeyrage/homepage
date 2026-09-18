import { useTranslation } from "next-i18next/pages";

import { StatTile, Chip, FUSION_COLORS } from "../../components/widgets/fusion/primitives";

import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";

// StatTile doesn't consume Block's highlight-threshold system (there's no
// per-field context to key off of for one consolidated tile), so the
// severity levels configured via services.yaml's widget.highlight for the
// stock component (outdated > 0/5, needsReboot > 0, securityUpdates > 0)
// are reproduced directly here as ledColor thresholds instead.
export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const { data, error } = useWidgetAPI(widget, "hosts", { include: "stats" });

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

  const hosts = data.hosts ?? [];
  const totalHosts = data.total ?? hosts.length;
  const outdated = hosts.filter((h) => (h.updates_count ?? 0) > 0).length;
  const needsReboot = hosts.filter((h) => h.needs_reboot === true).length;
  const securityUpdates = hosts.reduce((sum, h) => sum + (h.security_updates_count ?? 0), 0);

  const ledColor =
    securityUpdates > 0 || outdated > 5
      ? FUSION_COLORS.bad
      : outdated > 0 || needsReboot > 0
        ? FUSION_COLORS.warn
        : FUSION_COLORS.ok;

  return (
    <Container service={service}>
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
      />
    </Container>
  );
}
