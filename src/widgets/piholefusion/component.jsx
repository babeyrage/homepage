import { useTranslation } from "next-i18next/pages";

import { StatTile, FUSION_COLORS } from "../../components/widgets/fusion/primitives";

import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const { data, error } = useWidgetAPI(widget);

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

  const blocked = parseInt(data.ads_blocked_today, 10);
  const queries = parseInt(data.dns_queries_today, 10);
  const percent = parseFloat(data.ads_percentage_today).toPrecision(3);
  const gravity = parseInt(data.domains_being_blocked, 10);

  return (
    <Container service={service}>
      <StatTile
        ledColor={FUSION_COLORS.ok}
        primary={t("common.number", { value: blocked })}
        primaryLabel="blocked"
        secondary={`${t("common.number", { value: queries })} queries · ${t("common.percent", { value: percent })}`}
        tertiary={`${t("common.number", { value: gravity })} domains on blocklist`}
      />
    </Container>
  );
}
