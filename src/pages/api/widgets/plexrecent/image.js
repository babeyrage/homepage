import getServiceWidget from 'utils/config/service-helpers';
import { httpProxy } from 'utils/proxy/http';

export default async function handler(req, res) {
  const { group, service, index, path } = req.query;

  if (!group || !service || !path) {
    return res.status(400).end();
  }

  const widget = await getServiceWidget(group, service, index);
  if (!widget) return res.status(400).end();

  const decodedPath = decodeURIComponent(path);
  if (!decodedPath.startsWith('/library/')) {
    return res.status(403).end();
  }

  const url = `${widget.url}${decodedPath}`;
  const [status, contentType, data] = await httpProxy(url, {
    headers: { 'X-Plex-Token': widget.key },
  });

  if (status !== 200) return res.status(status).end();

  res.setHeader('Content-Type', contentType || 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).send(data);
}
