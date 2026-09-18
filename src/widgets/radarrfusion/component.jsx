import { useTranslation } from "next-i18next/pages";

import QueueEntry from "../../components/widgets/queue/queueEntry";
import { StatTile, FUSION_COLORS } from "../../components/widgets/fusion/primitives";

import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";
import parseTimeSpan from "utils/parse-timespan";

function getProgress(sizeLeft, size) {
  if (!Number.isFinite(size) || size <= 0) return 0;
  return Math.min(100, Math.max(0, (1 - sizeLeft / size) * 100));
}

function formatDownloadState(downloadState) {
  switch (downloadState) {
    case "importBlocked":
      return "import blocked";
    case "importPending":
      return "import pending";
    case "failedPending":
      return "failed pending";
    default:
      // camelCase status strings (e.g. "downloadClientUnavailable") -> "download client unavailable"
      return downloadState?.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  }
}

function getActivity(status, trackedDownloadState) {
  const completedStates = ["importBlocked", "importPending", "importing", "failedPending"];
  const downloadState =
    status === "completed" && completedStates.includes(trackedDownloadState)
      ? trackedDownloadState
      : (status ?? trackedDownloadState);

  return formatDownloadState(downloadState);
}

function isFailed(entry) {
  return (
    entry.trackedDownloadStatus === "warning" ||
    entry.status === "failed" ||
    entry.trackedDownloadState === "failedPending"
  );
}

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const { data: moviesData, error: moviesError } = useWidgetAPI(widget, "movie");
  const { data: queuedData, error: queuedError } = useWidgetAPI(widget, "queue/status");
  const { data: queueDetailsData, error: queueDetailsError } = useWidgetAPI(widget, "queue/details");

  if (moviesError || queuedError || queueDetailsError) {
    const finalError = moviesError ?? queuedError ?? queueDetailsError;
    return <Container service={service} error={finalError} />;
  }

  if (!moviesData || !queuedData || !queueDetailsData) {
    return (
      <Container service={service}>
        <StatTile />
      </Container>
    );
  }

  const enableQueue = widget?.enableQueue && Array.isArray(queueDetailsData) && queueDetailsData.length > 0;
  const failedCount = queueDetailsData.filter(isFailed).length;
  const ledColor = moviesData.missing === 0 ? FUSION_COLORS.ok : failedCount > 0 ? FUSION_COLORS.bad : FUSION_COLORS.warn;

  return (
    <>
      <Container service={service}>
        <StatTile
          ledColor={ledColor}
          primary={t("common.number", { value: moviesData.missing })}
          secondary={`${t("common.number", { value: moviesData.wanted })} wanted · ${t("common.number", { value: moviesData.have })} movies`}
          tertiary={`${t("common.number", { value: queuedData.totalCount })} queued${
            failedCount > 0 ? ` · ${t("common.number", { value: failedCount })} failed` : ""
          }`}
        />
      </Container>
      {enableQueue &&
        queueDetailsData.map((queueEntry) => (
          <QueueEntry
            progress={getProgress(queueEntry.sizeLeft, queueEntry.size)}
            timeLeft={
              queueEntry.timeLeft ? t("common.duration", { value: parseTimeSpan(queueEntry.timeLeft) }) : null
            }
            title={moviesData.all.find((entry) => entry.id === queueEntry.movieId)?.title ?? t("radarr.unknown")}
            activity={getActivity(queueEntry.status, queueEntry.trackedDownloadState)}
            key={`${queueEntry.movieId}-${queueEntry.sizeLeft}`}
          />
        ))}
    </>
  );
}
