// Minimal static file server for Heroku (no dependencies).
// Heroku sets PORT; locally it defaults to 5173.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = process.env.PORT || 5173;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const AGENT_URL = process.env.AGENT_URL; // the agent app, e.g. https://<agent-app>.herokuapp.com
const AGENT_SECRET = process.env.AGENT_SHARED_SECRET;
const MAX_AGENT_BODY = 16 * 1024;

// Chat widget → Google ADK agent app. The shared secret stays here; the browser never sees it.
function proxyAgent(req, res) {
  if (!AGENT_URL || !AGENT_SECRET) { res.writeHead(503); return res.end("Agent not configured"); }
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > MAX_AGENT_BODY) { res.writeHead(413); res.end("Too large"); req.destroy(); }
  });
  req.on("end", async () => {
    if (res.writableEnded) return;
    try {
      const r = await fetch(AGENT_URL.replace(/\/$/, "") + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Westerly-Agent-Secret": AGENT_SECRET },
        body,
        signal: AbortSignal.timeout(45000),
      });
      res.writeHead(r.status, { "Content-Type": "application/json" });
      res.end(await r.text());
    } catch (e) {
      res.writeHead(502); res.end("Agent unavailable");
    }
  });
}

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (req.method === "POST" && urlPath === "/api/agent") return proxyAgent(req, res);
    let file = path.normalize(path.join(ROOT, urlPath === "/" ? "index.html" : urlPath));
    // Don't serve files outside the folder, backups, or the server itself
    if (!file.startsWith(ROOT) || /backup|server\.js|package\.json|Procfile/.test(path.basename(file))) {
      res.writeHead(404); return res.end("Not found");
    }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end("Not found"); }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(PORT, () => console.log(`Westerly Market running on port ${PORT}`));
