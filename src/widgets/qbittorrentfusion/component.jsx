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

// Rows per expanded page — keeps a busy torrent client's leech list from
// turning the tile into an unbounded scroll; paged via QueuePager instead.
const LEECH_PAGE_SIZE = 5;

const STATE_PRIORITY = ["downloading", "forcedDL", "metaDL", "forcedMetaDL", "checkingDL", "stalledDL", "queuedDL", "pausedDL"];

function formatState(state) {
  switch (state) {
    case "metaDL":
      return "fetching metadata";
    case "forcedMetaDL":
      return "forced metadata";
    case "checkingDL":
      return "checking";
    case "stalledDL":
      return "stalled";
    case "queuedDL":
      return "queued";
    case "pausedDL":
      return "paused";
    case "forcedDL":
      return "forced dl";
    default:
      // camelCase status strings -> "download loading"-style spaced words
      return state?.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  }
}

function getStatusColor(state) {
  if (state === "pausedDL") return FUSION_COLORS.paused;
  if (state === "downloading" || state === "forcedDL") return FUSION_COLORS.infra;
  if (state === "stalledDL" || state === "queuedDL") return FUSION_COLORS.warn;
  return undefined;
}

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);

  const { data: torrentData, error: torrentError } = useWidgetAPI(widget, "torrents");
  const updatedAgo = useLastUpdatedLabel(torrentData);

  if (torrentError) {
    return <Container service={service} error={torrentError} />;
  }

  if (!torrentData) {
    return (
      <Container service={service}>
        <StatTile />
      </Container>
    );
  }

  let rateDl = 0;
  let rateUl = 0;
  let completed = 0;
  const leechTorrents = [];

  for (let i = 0; i < torrentData.length; i += 1) {
    const torrent = torrentData[i];
    rateDl += torrent.dlspeed;
    rateUl += torrent.upspeed;
    if (torrent.progress === 1) {
      completed += 1;
    }
    if (torrent.state.includes("DL") || torrent.state === "downloading") {
      leechTorrents.push(torrent);
    }
  }

  const leech = torrentData.length - completed;
  leechTorrents.sort((firstTorrent, secondTorrent) => {
    const firstStateIndex = STATE_PRIORITY.indexOf(firstTorrent.state);
    const secondStateIndex = STATE_PRIORITY.indexOf(secondTorrent.state);
    if (firstStateIndex !== secondStateIndex) {
      return firstStateIndex - secondStateIndex;
    }
    return secondTorrent.progress - firstTorrent.progress;
  });

  const hasLeech = leechTorrents.length > 0;
  const ledColor = leech > 0 ? FUSION_COLORS.infra : FUSION_COLORS.ok;

  const pageCount = Math.max(1, Math.ceil(leechTorrents.length / LEECH_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageEntries = leechTorrents.slice(safePage * LEECH_PAGE_SIZE, safePage * LEECH_PAGE_SIZE + LEECH_PAGE_SIZE);

  return (
    <>
      <Container service={service}>
        <StatTile
          ledColor={ledColor}
          primary={t("common.number", { value: leech })}
          primaryLabel="leeching"
          secondary={`↓ ${t("common.bibyterate", { value: rateDl, decimals: 1 })} · ↑ ${t("common.bibyterate", { value: rateUl, decimals: 1 })}`}
          tertiary={`${t("common.number", { value: completed })} seeding`}
          expandable={hasLeech}
          expanded={expanded}
          onToggleExpand={() => {
            setExpanded((value) => !value);
            setPage(0);
          }}
          updatedAgo={updatedAgo}
        />
      </Container>
      {hasLeech &&
        expanded &&
        pageEntries.map((torrent) => (
          <QueueRow
            key={torrent.hash ?? torrent.name}
            title={torrent.name}
            progress={torrent.progress * 100}
            status={formatState(torrent.state)}
            statusColor={getStatusColor(torrent.state)}
            timeLeft={t("common.duration", { value: torrent.eta })}
            speed={t("common.bibyterate", { value: torrent.dlspeed, decimals: 1 })}
            barColor={FUSION_COLORS.infra}
          />
        ))}
      {hasLeech && expanded && (
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
