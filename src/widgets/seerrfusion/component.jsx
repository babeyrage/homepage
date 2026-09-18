import { useTranslation } from "next-i18next/pages";

import { StatTile, Chip, FUSION_COLORS, useLastUpdatedLabel } from "../../components/widgets/fusion/primitives";

import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";

// Unlike the stock seerr component, this fork always renders one
// consolidated tile rather than a per-field Block grid. `widget.fields`
// still opts into fetching issue counts (the one thing worth toggling),
// but it's stripped before reaching Container: Container filters children
// by a `field` prop (matching Block's contract) whenever widget.fields is
// set, which would silently drop StatTile since it has no such prop —
// including for users who already had `fields:` configured for the stock
// widget before switching to this fork.
export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;
  const isIssueEnabled = Boolean(widget.fields?.includes("issues"));
  const containerService = { ...service, widget: { ...widget, fields: undefined } };

  const { data: statsData, error: statsError } = useWidgetAPI(widget, "request/count");
  const { data: issueData, error: issueError } = useWidgetAPI(widget, isIssueEnabled ? "issue/count" : "");
  const updatedAgo = useLastUpdatedLabel(statsData);

  if (statsError || (isIssueEnabled && issueError)) {
    return <Container service={containerService} error={statsError ?? issueError} />;
  }

  if (!statsData || (isIssueEnabled && !issueData)) {
    return (
      <Container service={containerService}>
        <StatTile />
      </Container>
    );
  }

  // Older Seerr versions expose "available" instead of "completed".
  const completed = statsData.completed ?? statsData.available;
  const openIssues = issueData?.open ?? 0;
  const ledColor =
    isIssueEnabled && openIssues > 0
      ? FUSION_COLORS.bad
      : statsData.pending > 0
        ? FUSION_COLORS.warn
        : FUSION_COLORS.ok;

  return (
    <Container service={containerService}>
      <StatTile
        ledColor={ledColor}
        primary={t("common.number", { value: statsData.pending })}
        primaryLabel="pending"
        secondary={`${t("common.number", { value: statsData.approved })} approved · ${t("common.number", { value: completed })} completed`}
        tertiary={
          isIssueEnabled
            ? `${t("common.number", { value: openIssues })} / ${t("common.number", { value: issueData.total })} issues`
            : undefined
        }
        tertiaryBadge={isIssueEnabled && openIssues > 0 && <Chip color={FUSION_COLORS.bad}>open</Chip>}
        updatedAgo={updatedAgo}
      />
    </Container>
  );
}
