import { useTranslation } from "next-i18next/pages";

import { StatTile, FUSION_COLORS, useLastUpdatedLabel } from "../../components/widgets/fusion/primitives";

import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const { data, error } = useWidgetAPI(widget, "overview");
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

  const { routers, services, middlewares } = data.http;
  const warnings = (routers.warnings ?? 0) + (services.warnings ?? 0) + (middlewares.warnings ?? 0);
  const errors = (routers.errors ?? 0) + (services.errors ?? 0) + (middlewares.errors ?? 0);

  const ledColor = errors > 0 ? FUSION_COLORS.bad : warnings > 0 ? FUSION_COLORS.warn : FUSION_COLORS.ok;

  return (
    <Container service={service}>
      <StatTile
        ledColor={ledColor}
        primary={t("common.number", { value: routers.total })}
        primaryLabel="routers"
        secondary={`${t("common.number", { value: services.total })} services · ${t("common.number", { value: middlewares.total })} middleware`}
        tertiary={
          errors > 0 || warnings > 0
            ? `${t("common.number", { value: errors })} errors · ${t("common.number", { value: warnings })} warnings`
            : undefined
        }
        updatedAgo={updatedAgo}
      />
    </Container>
  );
}
