import { useTranslation } from "next-i18next/pages";

import { Chip, FUSION_COLORS, StatTile, useLastUpdatedLabel } from "../../components/widgets/fusion/primitives";

import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const { data: grabsData, error: grabsError } = useWidgetAPI(widget, "indexerstats");
  // Not folded into the error/loading gates below — an update check failing
  // (or being unsupported) shouldn't block the rest of the tile, it just
  // means no badge.
  const { data: updateData } = useWidgetAPI(widget, "update");
  const updatedAgo = useLastUpdatedLabel(grabsData);

  if (grabsError) {
    return <Container service={service} error={grabsError} />;
  }

  if (!grabsData) {
    return (
      <Container service={service}>
        <StatTile />
      </Container>
    );
  }

  let numberOfGrabs = 0;
  let numberOfQueries = 0;
  let numberOfFailedGrabs = 0;
  let numberOfFailedQueries = 0;
  grabsData?.indexers?.forEach((element) => {
    numberOfGrabs += element.numberOfGrabs;
    numberOfQueries += element.numberOfQueries;
    numberOfFailedGrabs += element.numberOfFailedGrabs;
    numberOfFailedQueries += element.numberOfFailedQueries;
  });

  const totalFailed = numberOfFailedGrabs + numberOfFailedQueries;
  const ledColor = totalFailed > 0 ? FUSION_COLORS.bad : FUSION_COLORS.ok;
  const updateAvailable = Array.isArray(updateData) && updateData.length > 0 && !updateData[0].installed;

  return (
    <Container service={service}>
      <StatTile
        ledColor={ledColor}
        primary={t("common.number", { value: numberOfGrabs })}
        primaryLabel="grabs"
        secondary={`${t("common.number", { value: numberOfQueries })} queries`}
        tertiary={`${t("common.number", { value: numberOfFailedGrabs })} failed grabs · ${t("common.number", { value: numberOfFailedQueries })} failed queries`}
        tertiaryBadge={updateAvailable && <Chip color={FUSION_COLORS.warn}>update</Chip>}
        updatedAgo={updatedAgo}
      />
    </Container>
  );
}
