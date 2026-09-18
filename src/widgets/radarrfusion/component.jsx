import { useState } from "react";
import { useTranslation } from "next-i18next/pages";

import { StatTile, QueueRow, QueuePager, Chip, FUSION_COLORS } from "../../components/widgets/fusion/primitives";

import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";
import parseTimeSpan from "utils/parse-timespan";

// Rows per expanded page — keeps a large queue from turning the tile into
// an unbounded scroll; paged via QueuePager instead.
const QUEUE_PAGE_SIZE = 5;

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

// Colors the QueueRow status text so an at-a-glance scan of the expanded
// list can tell active transfers from stalled/pending ones without reading
// every word: red for failures, blue while actually transferring, amber for
// anything mid-import, slate for a deliberately paused item, and the row's
// own neutral default for everything else (e.g. queued).
function getStatusColor(activity, failed) {
  if (failed) return FUSION_COLORS.bad;
  if (activity === "downloading") return FUSION_COLORS.infra;
  if (activity === "paused") return FUSION_COLORS.paused;
  if (activity?.includes("import") || activity?.includes("pending")) return FUSION_COLORS.warn;
  return undefined;
}

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);

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

  const hasQueue = Array.isArray(queueDetailsData) && queueDetailsData.length > 0;
  const failedCount = queueDetailsData.filter(isFailed).length;
  const ledColor = moviesData.missing === 0 ? FUSION_COLORS.ok : failedCount > 0 ? FUSION_COLORS.bad : FUSION_COLORS.warn;

  const pageCount = Math.max(1, Math.ceil(queueDetailsData.length / QUEUE_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageEntries = queueDetailsData.slice(safePage * QUEUE_PAGE_SIZE, safePage * QUEUE_PAGE_SIZE + QUEUE_PAGE_SIZE);

  return (
    <>
      <Container service={service}>
        <StatTile
          ledColor={ledColor}
          primary={t("common.number", { value: moviesData.missing })}
          primaryLabel="missing"
          secondary={`${t("common.number", { value: moviesData.wanted })} wanted · ${t("common.number", { value: moviesData.have })} movies`}
          tertiary={`${t("common.number", { value: queuedData.totalCount })} queued`}
          tertiaryBadge={
            failedCount > 0 && (
              <Chip color={FUSION_COLORS.bad}>{t("common.number", { value: failedCount })} failed</Chip>
            )
          }
          expandable={hasQueue}
          expanded={expanded}
          onToggleExpand={() => {
            setExpanded((value) => !value);
            setPage(0);
          }}
        />
      </Container>
      {hasQueue &&
        expanded &&
        pageEntries.map((queueEntry) => {
          const timeLeftSeconds = queueEntry.timeLeft ? parseTimeSpan(queueEntry.timeLeft) : null;
          const speed =
            timeLeftSeconds && queueEntry.sizeLeft
              ? t("common.byterate", { value: queueEntry.sizeLeft / timeLeftSeconds })
              : null;
          const timeLeft = timeLeftSeconds ? t("common.duration", { value: timeLeftSeconds }) : null;
          const activity = getActivity(queueEntry.status, queueEntry.trackedDownloadState);
          const failed = isFailed(queueEntry);

          return (
            <QueueRow
              key={`${queueEntry.movieId}-${queueEntry.sizeLeft}`}
              title={moviesData.all.find((entry) => entry.id === queueEntry.movieId)?.title ?? t("radarr.unknown")}
              client={queueEntry.downloadClient}
              progress={getProgress(queueEntry.sizeLeft, queueEntry.size)}
              status={activity}
              statusColor={getStatusColor(activity, failed)}
              timeLeft={timeLeft}
              speed={speed}
              barColor={failed ? FUSION_COLORS.bad : FUSION_COLORS.infra}
            />
          );
        })}
      {hasQueue && expanded && (
        <QueuePager
          page={safePage}
          pageCount={pageCount}
          onPrev={() => setPage((value) => Math.max(0, value - 1))}
          onNext={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
        />
      )}
    </>
  );
}
