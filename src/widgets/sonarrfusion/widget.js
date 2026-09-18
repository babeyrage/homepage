// Fusion redesign fork of ../sonarr — presentation only, see
// /home/babeyrage/.claude/plans/rosy-rolling-crystal.md. Mappings are
// duplicated rather than spread from ../sonarr/widget: that stock module is
// imported (via genericProxyHandler) by utils/proxy/validate-widget-data,
// which imports widgets/widgets, which imports both sonarr/widget and
// sonarrfusion/widget — spreading `sonarrWidget.mappings` here closed that
// into a circular import, leaving `sonarrWidget` undefined whenever
// sonarr/widget.js itself was the entry point (e.g. its own widget.test.js).
// `queue/details` additionally selects `downloadClient`, which the upstream
// mapping doesn't, for the expandable queue list.
import { asJson } from "utils/proxy/api-helpers";
import genericProxyHandler from "utils/proxy/handlers/generic";

const widget = {
  api: "{url}/api/v3/{endpoint}?apikey={key}",
  proxyHandler: genericProxyHandler,

  mappings: {
    series: {
      endpoint: "series",
      map: (data) =>
        asJson(data).map((entry) => ({
          title: entry.title,
          id: entry.id,
        })),
    },
    queue: {
      endpoint: "queue",
      validate: ["totalRecords"],
    },
    "wanted/missing": {
      endpoint: "wanted/missing",
      validate: ["totalRecords"],
    },
    "queue/details": {
      endpoint: "queue/details",
      map: (data) =>
        asJson(data)
          .map((entry) => ({
            trackedDownloadState: entry.trackedDownloadState,
            trackedDownloadStatus: entry.trackedDownloadStatus,
            timeLeft: entry.timeleft,
            size: entry.size,
            sizeLeft: entry.sizeleft,
            seriesId: entry.seriesId,
            episodeTitle: entry.episode?.title ?? entry.title,
            episodeId: entry.episodeId ?? entry.id,
            status: entry.status,
            downloadClient: entry.downloadClient,
          }))
          .sort((a, b) => {
            const downloadingA = (a.status ?? a.trackedDownloadState) === "downloading";
            const downloadingB = (b.status ?? b.trackedDownloadState) === "downloading";
            if (downloadingA && !downloadingB) {
              return -1;
            }
            if (downloadingB && !downloadingA) {
              return 1;
            }

            const percentA = a.size > 0 ? a.sizeLeft / a.size : 1;
            const percentB = b.size > 0 ? b.sizeLeft / b.size : 1;
            if (percentA < percentB) {
              return -1;
            }
            if (percentA > percentB) {
              return 1;
            }
            return 0;
          }),
    },
    calendar: {
      endpoint: "calendar",
      params: ["start", "end", "unmonitored", "includeSeries", "includeEpisodeFile", "includeEpisodeImages"],
    },
  },
};

export default widget;
