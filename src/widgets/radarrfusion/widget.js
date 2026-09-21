// Fusion redesign fork of ../radarr — presentation only, see
// /home/babeyrage/.claude/plans/rosy-rolling-crystal.md. Mappings are
// duplicated rather than spread from ../radarr/widget: that stock module is
// imported (via genericProxyHandler) by utils/proxy/validate-widget-data,
// which imports widgets/widgets, which imports both radarr/widget and
// radarrfusion/widget — spreading `radarrWidget.mappings` here closed that
// into a circular import, leaving `radarrWidget` undefined whenever
// radarr/widget.js itself was the entry point (e.g. its own widget.test.js).
// `queue/details` additionally selects `downloadClient`, which the upstream
// mapping doesn't, for the expandable queue list.
import { asJson, jsonArrayFilter } from "utils/proxy/api-helpers";
import genericProxyHandler from "utils/proxy/handlers/generic";

const widget = {
  api: "{url}/api/v3/{endpoint}?apikey={key}",
  proxyHandler: genericProxyHandler,

  mappings: {
    movie: {
      endpoint: "movie",
      map: (data) => ({
        wanted: jsonArrayFilter(data, (item) => item.monitored && !item.hasFile && item.isAvailable).length,
        have: jsonArrayFilter(data, (item) => item.hasFile).length,
        missing: jsonArrayFilter(data, (item) => item.monitored && !item.hasFile).length,
        all: asJson(data).map((entry) => ({
          title: entry.title,
          id: entry.id,
        })),
      }),
    },
    "queue/status": {
      endpoint: "queue/status",
      validate: ["totalCount"],
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
            movieId: entry.movieId ?? entry.id,
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
      params: ["start", "end", "unmonitored"],
    },
    update: {
      // Same endpoint Radarr's own UI polls for its sidebar "update available"
      // badge — array, newest version first; data[0].installed is false when
      // an update hasn't been installed yet. Radarr reports every entry as
      // installed when it detects it's running in Docker (self-update is
      // disabled there), so the badge only lights up for native installs.
      endpoint: "update",
    },
  },
};

export default widget;
