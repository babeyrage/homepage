import { useState } from "react";
import { useTranslation } from "next-i18next/pages";

import {
  StatTile,
  QueueRow,
  QueuePager,
  FUSION_COLORS,
  useLastUpdatedLabel,
} from "../../components/widgets/fusion/primitives";

import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";

// Rows per expanded page — keeps a busy server's session list from turning
// the tile into an unbounded scroll; paged via QueuePager instead.
const SESSIONS_PAGE_SIZE = 5;

function millisecondsToString(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = hours > 0 ? [hours, minutes, seconds] : [minutes, seconds];
  return parts.map((part) => part.toString().padStart(2, "0")).join(":");
}

function getStreamTitle(session) {
  const { mediaType, mediaTitle, showTitle, seasonNumber, episodeNumber, username } = session;
  let title = mediaTitle;
  if (mediaType === "episode") {
    const seasonStr = `S${seasonNumber.toString().padStart(2, "0")}`;
    const episodeStr = `E${episodeNumber.toString().padStart(2, "0")}`;
    title = `${showTitle}: ${seasonStr}·${episodeStr} - ${mediaTitle}`;
  }
  return username ? `${title} (${username})` : title;
}

// Collapses the video/audio decision pair into one label — "transcode" is
// the resource-expensive case worth calling out distinctly from a cheap
// direct play/stream, mirroring the stock component's icon logic.
function getDecision({ videoDecision, audioDecision }) {
  if (videoDecision === "directplay" && audioDecision === "directplay") return "direct play";
  if (videoDecision === "copy" && audioDecision === "copy") return "direct stream";
  return "transcode";
}

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);

  const { data: activityData, error: activityError } = useWidgetAPI(widget, "streams", {
    refreshInterval: 5000,
  });
  const updatedAgo = useLastUpdatedLabel(activityData);

  if (activityError) {
    return <Container service={service} error={activityError} />;
  }

  if (!activityData || !activityData.data) {
    return (
      <Container service={service}>
        <StatTile />
      </Container>
    );
  }

  const { summary } = activityData;
  const playing = [...activityData.data].sort((a, b) => a.progressMs - b.progressMs);
  const hasSessions = playing.length > 0;
  // Transcoding is the load-bearing case for the Plex host, so it earns the
  // amber LED even though nothing here has actually failed.
  const ledColor = summary.transcodes > 0 ? FUSION_COLORS.warn : FUSION_COLORS.ok;

  const pageCount = Math.max(1, Math.ceil(playing.length / SESSIONS_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageEntries = playing.slice(safePage * SESSIONS_PAGE_SIZE, safePage * SESSIONS_PAGE_SIZE + SESSIONS_PAGE_SIZE);

  return (
    <>
      <Container service={service}>
        <StatTile
          ledColor={ledColor}
          primary={t("common.number", { value: summary.total })}
          primaryLabel="streams"
          secondary={`${t("common.number", { value: summary.transcodes })} transcoding · ${t("common.number", { value: summary.directPlays })} direct play`}
          tertiary={summary.totalBitrate}
          expandable={hasSessions}
          expanded={expanded}
          onToggleExpand={() => {
            setExpanded((value) => !value);
            setPage(0);
          }}
          updatedAgo={updatedAgo}
        />
      </Container>
      {hasSessions &&
        expanded &&
        pageEntries.map((session) => {
          const decision = getDecision(session);
          const paused = session.state === "paused";
          return (
            <QueueRow
              key={session.id}
              title={getStreamTitle(session)}
              client={decision}
              progress={session.durationMs > 0 ? (session.progressMs / session.durationMs) * 100 : 0}
              status={paused ? "paused" : "playing"}
              statusColor={paused ? FUSION_COLORS.paused : FUSION_COLORS.ok}
              timeLeft={`${millisecondsToString(session.progressMs)} / ${millisecondsToString(session.durationMs)}`}
              barColor={decision === "transcode" ? FUSION_COLORS.warn : FUSION_COLORS.infra}
            />
          );
        })}
      {hasSessions && expanded && (
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
