#!/usr/bin/env node
// Claude usage agent: run this on the machine where Claude Code is used.
// Copy agent.mjs and collector.mjs together (Node 18+, no dependencies), then:
//   CLAUDE_USAGE_TOKEN=<long random string> node agent.mjs
// Env: PORT (default 3021), HOST (default 0.0.0.0), CLAUDE_USAGE_TOKEN (required),
//      CLAUDE_BIN, CLAUDE_PROJECTS_DIR, CLAUDE_USAGE_LIMITS=false to skip `claude -p /usage`.
import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

import { getUsage } from "./collector.mjs";

const token = process.env.CLAUDE_USAGE_TOKEN;
if (!token || token.length < 16) {
  console.error("Set CLAUDE_USAGE_TOKEN to a random string of at least 16 characters.");
  process.exit(1);
}
const port = Number(process.env.PORT ?? 3021);
const host = process.env.HOST ?? "0.0.0.0";

const opts = {
  claudeBin: process.env.CLAUDE_BIN,
  projectsDir: process.env.CLAUDE_PROJECTS_DIR,
  limits: process.env.CLAUDE_USAGE_LIMITS === "false" ? false : undefined,
};

function authorized(header = "") {
  const given = Buffer.from(header.replace(/^Bearer /, ""));
  const want = Buffer.from(token);
  return given.length === want.length && timingSafeEqual(given, want);
}

createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "GET" || req.url?.split("?")[0] !== "/usage") {
    res.statusCode = 404;
    return res.end('{"error":"not found"}');
  }
  if (!authorized(req.headers.authorization)) {
    res.statusCode = 401;
    return res.end('{"error":"unauthorized"}');
  }
  try {
    return res.end(JSON.stringify(await getUsage(opts)));
  } catch (e) {
    console.error("usage failed:", e.message);
    res.statusCode = 500;
    return res.end('{"error":"failed"}');
  }
}).listen(port, host, () => console.log(`claude usage agent listening on ${host}:${port}`));
