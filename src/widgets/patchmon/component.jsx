import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import { useTranslation } from "next-i18next";

import useWidgetAPI from "utils/proxy/use-widget-api";

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
        <Block label="patchmon.totalHosts" />
        <Block label="patchmon.outdated" />
        <Block label="patchmon.needsReboot" />
        <Block label="patchmon.securityUpdates" />
      </Container>
    );
  }

  const hosts = data.hosts ?? [];
  const totalHosts = data.total ?? hosts.length;
  const outdated = hosts.filter((h) => (h.updates_count ?? 0) > 0).length;
  const needsReboot = hosts.filter((h) => h.needs_reboot === true).length;
  const securityUpdates = hosts.reduce((sum, h) => sum + (h.security_updates_count ?? 0), 0);

  return (
    <Container service={service}>
      <Block label="patchmon.totalHosts" value={t("common.number", { value: totalHosts })} />
      <Block label="patchmon.outdated" value={t("common.number", { value: outdated })} highlightValue={outdated} />
      <Block label="patchmon.needsReboot" value={t("common.number", { value: needsReboot })} highlightValue={needsReboot} />
      <Block label="patchmon.securityUpdates" value={t("common.number", { value: securityUpdates })} highlightValue={securityUpdates} />
    </Container>
  );
}
