import { useTranslation } from "next-i18next/pages";

import { StatTile, FUSION_COLORS } from "../../components/widgets/fusion/primitives";

import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const endpoint = widget.version === 2 ? "latestv2" : "latestv1";
  const { data, error } = useWidgetAPI(widget, endpoint);

  const bitratePrecision =
    !widget?.bitratePrecision || Number.isNaN(widget?.bitratePrecision) || widget?.bitratePrecision < 0
      ? 0
      : widget.bitratePrecision;

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
  const ping = t("common.ms", { value: data.data.ping, style: "unit", unit: "millisecond" });

  return (
    <Container service={service}>
      <StatTile
        ledColor={FUSION_COLORS.ok}
        primary={download}
        primaryLabel="down"
        secondary={`${upload} up`}
        tertiary={`${ping} ping`}
      />
    </Container>
  );
}
