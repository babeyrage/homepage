import getServiceWidget from "utils/config/service-helpers";
import createLogger from "utils/logger";
import { httpProxy } from "utils/proxy/http";

const logger = createLogger("m365ProxyHandler");

const TOKEN_CACHE = {};

async function getAccessToken(tenantId, clientId, clientSecret) {
  const cacheKey = `${tenantId}:${clientId}`;
  const cached = TOKEN_CACHE[cacheKey];

  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  }).toString();

  const [status, , data] = await httpProxy(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (status !== 200) {
    logger.error("Failed to get M365 access token, status %d", status);
    return null;
  }

  const json = JSON.parse(Buffer.isBuffer(data) ? data.toString() : data);
  TOKEN_CACHE[cacheKey] = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };

  return json.access_token;
}

export default async function proxyHandler(req, res) {
  const { group, service, index } = req.query;

  if (!group || !service) {
    return res.status(400).json({ error: "Invalid proxy service type" });
  }

  const widget = await getServiceWidget(group, service, index);
  if (!widget) {
    return res.status(400).json({ error: "Invalid proxy service type" });
  }

  const { tenantId, clientId, clientSecret } = widget;
  if (!tenantId || !clientId || !clientSecret) {
    return res.status(400).json({ error: "M365 widget requires tenantId, clientId, and clientSecret" });
  }

  const accessToken = await getAccessToken(tenantId, clientId, clientSecret);
  if (!accessToken) {
    return res.status(401).json({ error: "Failed to authenticate with Microsoft Graph API" });
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  const [healthStatus, , healthData] = await httpProxy(
    "https://graph.microsoft.com/v1.0/admin/serviceAnnouncements/healthOverviews",
    { headers },
  );

  if (healthStatus !== 200) {
    const body = Buffer.isBuffer(healthData) ? healthData.toString() : JSON.stringify(healthData);
    logger.error("Failed to fetch M365 health overviews, status %d: %s", healthStatus, body);
    return res.status(healthStatus).json({ error: "Failed to fetch M365 health data", detail: body });
  }

  const issuesUrl = new URL("https://graph.microsoft.com/v1.0/admin/serviceAnnouncements/issues");
  issuesUrl.searchParams.set("$filter", "isResolved eq false");

  const [issuesStatus, , issuesData] = await httpProxy(issuesUrl.toString(), { headers });

  if (issuesStatus !== 200) {
    const body = Buffer.isBuffer(issuesData) ? issuesData.toString() : JSON.stringify(issuesData);
    logger.error("Failed to fetch M365 active issues, status %d: %s", issuesStatus, body);
    return res.status(issuesStatus).json({ error: "Failed to fetch M365 issues data", detail: body });
  }

  const health = JSON.parse(Buffer.isBuffer(healthData) ? healthData.toString() : healthData);
  const issues = JSON.parse(Buffer.isBuffer(issuesData) ? issuesData.toString() : issuesData);

  const services = health.value ?? [];
  const activeIssues = issues.value ?? [];

  const total = services.length;
  const healthy = services.filter((s) => s.status === "serviceOperational").length;
  const degraded = total - healthy;

  return res.status(200).json({
    total,
    healthy,
    degraded,
    activeIssues: activeIssues.length,
  });
}
