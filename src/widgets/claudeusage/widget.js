import claudeusageProxyHandler from "./proxy";

// Local-only widget: reads ~/.claude/projects transcripts and `claude -p /usage` on the host.
// There is no upstream URL, so `api` is a placeholder required by the widget shape.
const widget = {
  api: "{url}/",
  proxyHandler: claudeusageProxyHandler,

  mappings: {
    overview: {
      endpoint: "overview",
    },
  },
};

export default widget;
