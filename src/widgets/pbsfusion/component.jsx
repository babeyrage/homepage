import { useTranslation } from "next-i18next/pages";

import { StatTile, Chip, FUSION_COLORS } from "../../components/widgets/fusion/primitives";

import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const { data, error } = useWidgetAPI(widget, "datastores");

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

  const datastore = data.find((entry) => widget.datastoreName === undefined || entry.name === widget.datastoreName);
  const notFound = !datastore;
  const offline = !notFound && datastore.metrics === null;

  const gcStatus = datastore?.gc?.status;
  const verificationStatus = datastore?.verification?.status;
  const hasFault = gcStatus === "error" || verificationStatus === "error";
  const isHealthy = gcStatus === "ok" && verificationStatus === "ok";

  let ledColor = FUSION_COLORS.warn;
  if (notFound || offline || hasFault) {
    ledColor = FUSION_COLORS.bad;
  } else if (isHealthy) {
    ledColor = FUSION_COLORS.ok;
  }

  const usedBytes = datastore?.metrics?.used_bytes;
  const totalBytes = datastore?.metrics ? datastore.metrics.used_bytes + datastore.metrics.available_bytes : undefined;

  let secondary;
  if (notFound) {
    secondary = "datastore not found";
  } else if (offline) {
    secondary = "host unreachable";
  } else {
    secondary = `${t("common.bytes", { value: usedBytes })} of ${t("common.bytes", { value: totalBytes })} · ${t("common.percent", { value: datastore.metrics.used_percent, maximumFractionDigits: 1 })}`;
  }

  return (
    <Container service={service}>
      <StatTile
        ledColor={ledColor}
        primary={notFound || offline ? "—" : t("common.number", { value: datastore.metrics.backup_count })}
        primaryLabel={notFound || offline ? undefined : "backups"}
        secondary={secondary}
        tertiary={!notFound ? `gc ${gcStatus} · verify ${verificationStatus}` : undefined}
        tertiaryBadge={
          !notFound && datastore.immutable_backup?.enabled ? <Chip color={FUSION_COLORS.ok}>immutable</Chip> : undefined
        }
      />
    </Container>
  );
}
