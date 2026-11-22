import { getUsage } from "./collector.mjs";

import getServiceWidget from "utils/config/service-helpers";
import createLogger from "utils/logger";
import { sanitizeErrorURL } from "utils/proxy/api-helpers";
import { httpProxy } from "utils/proxy/http";

const logger = createLogger("claudeusageProxy");

export const REMOTE_TTL_MS = 15 * 1000;
const state = (globalThis.__claudeUsageProxy ??= { entries: new Map() });

// Remote mode: `url` points at the agent (agent.mjs) running on the host where Claude Code lives,
// e.g. over a Twingate resource. Local mode (no `url`): read this machine's ~/.claude directly.
async function fetchRemote(widget) {
  const url = `${String(widget.url).replace(/\/$/, "")}/usage`;
  const headers = widget.key ? { Authorization: `Bearer ${widget.key}` } : {};
  const [status, , data] = await httpProxy(url, { method: "GET", headers });
  if (status !== 200) return { ok: false, status, url, message: `Agent returned HTTP ${status}` };
  try {
    return { ok: true, data: JSON.parse(data.toString()) };
  } catch {
    return { ok: false, status: 502, url, message: "Agent returned invalid JSON" };
  }
}

export default async function claudeusageProxyHandler(req, res) {
  const { group, service, index } = req.query;
  if (!group || !service) return res.status(400).json({ error: "Invalid proxy service type" });

  const widget = await getServiceWidget(group, service, index);
  if (widget?.type !== "claudeusage") return res.status(400).json({ error: "Invalid proxy service type" });

  if (!widget.url) {
    try {
      return res.status(200).json(await getUsage(widget));
    } catch (e) {
      logger.error("Failed to read local Claude usage: %s", e.message);
      return res.status(500).json({ error: { message: "Failed to read Claude usage", url: null } });
    }
  }

  const cacheKey = `${group}/${service}/${index ?? ""}`;
  const cached = state.entries.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < REMOTE_TTL_MS) return res.status(200).json(cached.data);

  const result = await fetchRemote(widget);
  if (result.ok) {
    state.entries.set(cacheKey, { data: result.data, fetchedAt: Date.now() });
    return res.status(200).json(result.data);
  }
  // Agent/tunnel down: serve last good data rather than an error tile.
  if (cached) return res.status(200).json(cached.data);

  logger.error("Claude usage agent error %d at %s", result.status, sanitizeErrorURL(result.url));
  return res
    .status(result.status >= 400 ? result.status : 502)
    .json({ error: { message: result.message, url: sanitizeErrorURL(result.url) } });
}
