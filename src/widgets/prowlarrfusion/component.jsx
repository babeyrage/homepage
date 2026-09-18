import { useTranslation } from "next-i18next/pages";

import { StatTile, FUSION_COLORS, useLastUpdatedLabel } from "../../components/widgets/fusion/primitives";

import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const { data: grabsData, error: grabsError } = useWidgetAPI(widget, "indexerstats");
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

  return (
    <Container service={service}>
      <StatTile
        ledColor={ledColor}
        primary={t("common.number", { value: numberOfGrabs })}
        primaryLabel="grabs"
        secondary={`${t("common.number", { value: numberOfQueries })} queries`}
        tertiary={`${t("common.number", { value: numberOfFailedGrabs })} failed grabs · ${t("common.number", { value: numberOfFailedQueries })} failed queries`}
        updatedAgo={updatedAgo}
      />
    </Container>
  );
}
