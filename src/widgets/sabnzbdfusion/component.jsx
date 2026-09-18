import { useTranslation } from "next-i18next/pages";

import { StatTile, FUSION_COLORS } from "../../components/widgets/fusion/primitives";

import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";

function fromUnits(value) {
  const units = ["B", "K", "M", "G", "T", "P"];
  const [number, unit] = value.split(" ");
  const index = units.indexOf(unit);
  if (index === -1) {
    return 0;
  }
  return parseFloat(number) * 1024 ** index;
}

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const { data: queueData, error: queueError } = useWidgetAPI(widget, "queue");

  if (queueError) {
    return <Container service={service} error={queueError} />;
  }

  if (!queueData) {
    return (
      <Container service={service}>
        <StatTile />
      </Container>
    );
  }

  const { queue } = queueData;
  const ledColor = queue.noofslots > 0 ? FUSION_COLORS.infra : FUSION_COLORS.ok;

  return (
    <Container service={service}>
      <StatTile
        ledColor={ledColor}
        primary={t("common.number", { value: queue.noofslots })}
        primaryLabel="queue"
        secondary={`↓ ${t("common.byterate", { value: fromUnits(queue.speed) })}`}
        tertiary={queue.noofslots > 0 ? queue.timeleft : undefined}
      />
    </Container>
  );
}
