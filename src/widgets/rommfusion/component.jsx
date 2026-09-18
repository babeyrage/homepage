import { useTranslation } from "next-i18next/pages";

import { StatTile, FUSION_COLORS, HighlightColors, useLastUpdatedLabel } from "../../components/widgets/fusion/primitives";

import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";

// Unlike the stock romm component, this fork always renders one consolidated
// tile rather than a per-field Block grid, so `widget.fields` (used to pick
// which stock Blocks show) is stripped before reaching Container: Container
// filters children by a `field`/`label` prop match whenever widget.fields is
// set, which would silently drop StatTile since it has neither — including
// for users who already had `fields:` configured for the stock widget.
export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;
  const containerService = { ...service, widget: { ...widget, fields: undefined } };

  const { data: response, error: responseError } = useWidgetAPI(widget, "statistics");

  // ROMS/PLATFORMS/SAVES/STATES/FILESIZE are pure library counts — there's
  // no legitimate built-in "unhealthy" signal to derive a threshold from,
  // so the LED just stays ok by default unless a user opts into their own
  // threshold via services.yaml's widget.highlight.
  const updatedAgo = useLastUpdatedLabel(response);

  if (responseError) {
    return <Container service={containerService} error={responseError} />;
  }

  if (!response) {
    return (
      <Container service={containerService}>
        <StatTile />
      </Container>
    );
  }

  const totalFileSize = response.FILESIZE ?? response.TOTAL_FILESIZE_BYTES;

  return (
    <Container service={containerService}>
      <HighlightColors>
        {(getColor) => (
          <StatTile
            ledColor={getColor("roms", response.ROMS, FUSION_COLORS.ok)}
            primary={t("common.number", { value: response.ROMS })}
            primaryLabel="roms"
            secondary={`${t("common.number", { value: response.PLATFORMS })} platforms · ${t("common.number", { value: response.SAVES })} saves`}
            tertiary={`${t("common.number", { value: response.STATES })} states · ${t("common.bytes", { value: totalFileSize })}`}
            updatedAgo={updatedAgo}
          />
        )}
      </HighlightColors>
    </Container>
  );
}
