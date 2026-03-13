import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import { useTranslation } from "next-i18next";

import useWidgetAPI from "utils/proxy/use-widget-api";

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const { data, error } = useWidgetAPI(widget, null);

  if (error) {
    return <Container service={service} error={error} />;
  }

  if (!data) {
    return (
      <Container service={service}>
        <Block label="m365.healthy" />
        <Block label="m365.degraded" />
        <Block label="m365.activeIssues" />
        <Block label="m365.total" />
      </Container>
    );
  }

  return (
    <Container service={service}>
      <Block label="m365.healthy" value={t("common.number", { value: data.healthy })} />
      <Block label="m365.degraded" value={t("common.number", { value: data.degraded })} />
      <Block label="m365.activeIssues" value={t("common.number", { value: data.activeIssues })} />
      <Block label="m365.total" value={t("common.number", { value: data.total })} />
    </Container>
  );
}
