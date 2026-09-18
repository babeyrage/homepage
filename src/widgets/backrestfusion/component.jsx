import { useTranslation } from "next-i18next/pages";

import { StatTile, Chip, FUSION_COLORS, useLastUpdatedLabel } from "../../components/widgets/fusion/primitives";

import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";

// Unlike the stock backrest component, this fork always renders one
// consolidated tile rather than a per-field Block grid, so `widget.fields`
// is stripped before reaching Container: Container filters children by a
// `field`/`label` prop match whenever widget.fields is set, which would
// silently drop StatTile since it has neither — including for users who
// already had `fields:` configured for the stock widget.
//
// The GetSummaryDashboard endpoint this widget calls is pre-aggregated
// server-side (see ../backrest/proxy.js) into totals only — no per-plan
// name or last-run timestamp reaches the client today, so (unlike the
// queue-style MEDIA forks) there's no per-item list to expand here.
export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;
  const containerService = { ...service, widget: { ...widget, fields: undefined } };

  const { data, error } = useWidgetAPI(widget, "summary");
  const updatedAgo = useLastUpdatedLabel(data);

  if (error) {
    return <Container service={containerService} error={error} />;
  }

  if (!data) {
    return (
      <Container service={containerService}>
        <StatTile />
      </Container>
    );
  }

  const ledColor =
    data.numFailureLatest > 0 ? FUSION_COLORS.bad : data.numFailure30Days > 0 ? FUSION_COLORS.warn : FUSION_COLORS.ok;

  return (
    <Container service={containerService}>
      <StatTile
        ledColor={ledColor}
        primary={t("common.number", { value: data.numPlans })}
        primaryLabel="plans"
        secondary={`${t("common.number", { value: data.numSuccessLatest })}/${t("common.number", { value: data.numPlans })} succeeded latest`}
        tertiary={`${t("common.number", { value: data.numFailure30Days })} failed · ${t("common.bytes", { value: data.bytesAdded30Days })} added (30d)`}
        tertiaryBadge={
          data.numFailureLatest > 0 && (
            <Chip color={FUSION_COLORS.bad}>{t("common.number", { value: data.numFailureLatest })} failing</Chip>
          )
        }
        updatedAgo={updatedAgo}
      />
    </Container>
  );
}
