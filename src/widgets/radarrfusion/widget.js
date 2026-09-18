// Fusion redesign fork of ../radarr — presentation only, see
// /home/babeyrage/.claude/plans/rosy-rolling-crystal.md. Most mappings are
// unchanged, so they're spread from the upstream widget rather than
// duplicated. `queue/details` is the one exception: the expandable queue
// list needs `downloadClient` (which movie of client is handling each item),
// a field the upstream mapping doesn't select. Re-matching it onto the
// upstream's already-sorted/filtered output afterward would be fragile, so
// the whole mapping is duplicated here instead, keeping its exact field
// selection and downloading-first/percent-remaining sort order.
import radarrWidget from "../radarr/widget";

import { asJson } from "utils/proxy/api-helpers";

const widget = {
  ...radarrWidget,
  mappings: {
    ...radarrWidget.mappings,
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
  },
};

export default widget;
