// Fusion redesign fork of ../prowlarr — presentation only, see
// /home/babeyrage/.claude/plans/rosy-rolling-crystal.md. Previously
// re-exported ../prowlarr/widget directly since the API/proxy contract was
// unchanged; now duplicated instead so the `update` mapping (used for the
// update-available badge) can be added here without touching the upstream
// prowlarr/widget.js counterpart.
import genericProxyHandler from "utils/proxy/handlers/generic";

const widget = {
  api: "{url}/api/v1/{endpoint}?apikey={key}",
  proxyHandler: genericProxyHandler,

  mappings: {
    indexer: {
      endpoint: "indexer",
    },
    indexerstats: {
      endpoint: "indexerstats",
    },
    update: {
      // Same endpoint Prowlarr's own UI polls for its sidebar "update
      // available" badge — array, newest version first; data[0].installed is
      // false when an update hasn't been installed yet. Prowlarr reports
      // every entry as installed when it detects it's running in Docker
      // (self-update is disabled there), so the badge only lights up for
      // native installs.
      endpoint: "update",
    },
  },
};

export default widget;
