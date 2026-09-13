import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const host = "0.0.0.0";
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/health") {
      send(res, 200, "application/json; charset=utf-8", JSON.stringify({ status: "ok" }));
      return;
    }

    const requestedPath = url.pathname === "/" ? "/generator.html" : decodeURIComponent(url.pathname);
    const filePath = path.resolve(__dirname, `.${requestedPath}`);

    if (!filePath.startsWith(__dirname)) {
      send(res, 403, "text/plain; charset=utf-8", "Forbidden");
      return;
    }

    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      send(res, 403, "text/plain; charset=utf-8", "Forbidden");
      return;
    }

    const content = await fs.readFile(filePath);
    const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    send(res, 200, contentType, content);
  } catch (error) {
    const status = error && error.code === "ENOENT" ? 404 : 500;
    send(res, status, "text/plain; charset=utf-8", status === 404 ? "Not found" : "Server error");
  }
});

server.listen(port, host, () => {
  console.log(`JSON Carousel Generator listening on http://${host}:${port}`);
});

function send(res, status, contentType, body) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  res.end(body);
}
