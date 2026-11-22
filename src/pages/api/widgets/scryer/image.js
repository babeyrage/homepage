import getServiceWidget from "utils/config/service-helpers";
import { httpProxy } from "utils/proxy/http";

// Scryer serves posters/stills from /images/... behind the same bearer auth as
// its API, so the browser can't load them directly — proxy them server-side.
export default async function handler(req, res) {
  const { group, service, index, path } = req.query;
  if (!group || !service || typeof path !== "string") return res.status(400).end();

  const widget = await getServiceWidget(group, service, index);
  if (widget?.type !== "scryer") return res.status(400).end();

  const decoded = decodeURIComponent(path);
  if (!decoded.startsWith("/images/") || decoded.includes("..") || decoded.includes("//")) {
    return res.status(403).end();
  }

  const [status, contentType, data] = await httpProxy(new URL(decoded, widget.url), {
    headers: { Authorization: `Bearer ${widget.key}` },
  });
  if (status !== 200) return res.status(status).end();

  res.setHeader("Content-Type", contentType || "image/jpeg");
  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.status(200).send(data);
}
