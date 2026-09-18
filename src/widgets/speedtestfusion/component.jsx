import { useTranslation } from "next-i18next/pages";

import { StatTile, FUSION_COLORS, HighlightColors, useLastUpdatedLabel } from "../../components/widgets/fusion/primitives";

import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";

function builtInPingColor(ping) {
  if (ping === undefined) return FUSION_COLORS.ok;
  if (ping > 150) return FUSION_COLORS.bad;
  if (ping > 50) return FUSION_COLORS.warn;
  return FUSION_COLORS.ok;
}

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const endpoint = widget.version === 2 ? "latestv2" : "latestv1";
  const { data, error } = useWidgetAPI(widget, endpoint);

  const bitratePrecision =
    !widget?.bitratePrecision || Number.isNaN(widget?.bitratePrecision) || widget?.bitratePrecision < 0
      ? 0
      : widget.bitratePrecision;

  const rawPing = data?.data?.ping;
  const updatedAgo = useLastUpdatedLabel(data);

  if (error || data?.error) {
    return <Container service={service} error={error ?? data.error} />;
  }

  if (!data?.data) {
    return (
      <Container service={service}>
        <StatTile />
      </Container>
    );
  }

  const download = t("common.bitrate", {
    value: widget.version === 2 ? data.data.download * 8 : data.data.download * 1000 * 1000,
    decimals: bitratePrecision,
  });
  const upload = t("common.bitrate", {
    value: widget.version === 2 ? data.data.upload * 8 : data.data.upload * 1000 * 1000,
    decimals: bitratePrecision,
  });
  const pingLabel = t("common.ms", { value: data.data.ping, style: "unit", unit: "millisecond" });

  return (
    <Container service={service}>
      <HighlightColors>
        {(getColor) => (
          <StatTile
            ledColor={getColor("ping", rawPing, builtInPingColor(rawPing))}
            primary={download}
            primaryLabel="down"
            secondary={`${upload} up`}
            tertiary={`${pingLabel} ping`}
            updatedAgo={updatedAgo}
          />
        )}
      </HighlightColors>
    </Container>
  );
}
