import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const host = "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const markupGoImageUrl = process.env.MARKUPGO_IMAGE_URL || "https://api.markupgo.com/api/v1/image";
const maxJsonBytes = 12 * 1024 * 1024;

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
      sendJson(res, 200, { status: "ok" });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/render") {
      await handleRender(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/download-image") {
      await handleDownloadImage(url, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/download-images-zip") {
      await handleDownloadImagesZip(req, res);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendText(res, 405, "Method not allowed");
      return;
    }

    await serveStatic(url, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(port, host, () => {
  console.log(`JSON Carousel Generator listening on http://${host}:${port}`);
});

async function handleRender(req, res) {
  const data = await readJson(req);
  const html = typeof data.html === "string" ? data.html : "";
  const width = clampInt(data.width, 1080, 100, 4096);
  const height = clampInt(data.height, 1920, 100, 4096);

  if (!html.trim()) {
    sendJson(res, 400, { error: "html is required" });
    return;
  }

  const apiKey = process.env.MARKUPGO_API_KEY;
  if (!apiKey) {
    sendJson(res, 500, { error: "MARKUPGO_API_KEY is not set. Add it in Railway Variables." });
    return;
  }

  const normalizedHtml = normalizeCanvasHtml(html, width, height);
  const payload = {
    source: {
      type: "html",
      data: normalizedHtml
    },
    options: {
      properties: {
        format: "png",
        width,
        height
      }
    }
  };

  const started = Date.now();
  const response = await fetch(markupGoImageUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60000)
  });

  const text = await response.text();
  let result = {};
  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    sendJson(res, 502, {
      error: `MarkupGo returned non-JSON: ${text.slice(0, 300)}`,
      render_kb: htmlKb(normalizedHtml)
    });
    return;
  }

  if (!response.ok) {
    sendJson(res, 502, {
      error: `MarkupGo API error: ${response.status} ${text.slice(0, 500)}`,
      render_kb: htmlKb(normalizedHtml)
    });
    return;
  }

  const imageUrl = extractMarkupGoUrl(result);
  if (!imageUrl) {
    sendJson(res, 502, {
      error: "Could not extract MarkupGo result URL",
      raw: result
    });
    return;
  }

  sendJson(res, 200, {
    url: imageUrl,
    raw: result,
    render_kb: htmlKb(normalizedHtml),
    duration_ms: Date.now() - started
  });
}

async function handleDownloadImage(url, res) {
  const imageUrl = url.searchParams.get("url") || "";
  const filename = sanitizeFilename(url.searchParams.get("filename") || "image.png");
  const target = validateDownloadUrl(imageUrl);

  if (!target.ok) {
    sendJson(res, 400, { error: target.error });
    return;
  }

  const response = await fetch(target.url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) {
    sendJson(res, 502, { error: `Image download failed: HTTP ${response.status}` });
    return;
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const bytes = Buffer.from(await response.arrayBuffer());
  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store"
  });
  res.end(bytes);
}

async function handleDownloadImagesZip(req, res) {
  const data = await readJson(req);
  const items = Array.isArray(data.items) ? data.items.slice(0, 60) : [];

  if (items.length === 0) {
    sendJson(res, 400, { error: "items must be a non-empty array" });
    return;
  }

  const files = [];
  for (const item of items) {
    const target = validateDownloadUrl(item && item.url);
    if (!target.ok) {
      sendJson(res, 400, { error: target.error });
      return;
    }

    const response = await fetch(target.url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) {
      sendJson(res, 502, { error: `Image download failed for ${item.filename || target.url}: HTTP ${response.status}` });
      return;
    }

    files.push({
      name: sanitizeFilename(item.filename || `image-${files.length + 1}.png`),
      data: Buffer.from(await response.arrayBuffer())
    });
  }

  const zip = createZip(files);
  const filename = sanitizeFilename(data.filename || "carousel-images.zip");
  res.writeHead(200, {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store"
  });
  res.end(zip);
}

async function serveStatic(url, res) {
  const requestedPath = url.pathname === "/" ? "/generator.html" : decodeURIComponent(url.pathname);
  const filePath = path.resolve(__dirname, `.${requestedPath}`);

  if (!filePath.startsWith(__dirname)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      sendText(res, 403, "Forbidden");
      return;
    }

    const content = await fs.readFile(filePath);
    const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    send(res, 200, contentType, content);
  } catch (error) {
    sendText(res, error && error.code === "ENOENT" ? 404 : 500, error && error.code === "ENOENT" ? "Not found" : "Server error");
  }
}

async function readJson(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxJsonBytes) {
      throw new Error("Request body too large");
    }
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function normalizeCanvasHtml(html, width, height) {
  const headExtra = [
    '<meta charset="UTF-8">',
    "<style>",
    `html,body{width:${width}px;height:${height}px;margin:0;padding:0;overflow:hidden;background:transparent;}`,
    "*{box-sizing:border-box;}",
    `body>*:first-child{width:${width}px;min-height:${height}px;margin:0;}`,
    "</style>"
  ].join("");

  return withUtf8Document(html, headExtra);
}

function withUtf8Document(html, headExtra) {
  let extra = headExtra;
  if (/<meta\s+charset=/i.test(html)) {
    extra = extra.replace('<meta charset="UTF-8">', "");
  }
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, match => `${match}${extra}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, match => `${match}<head>${extra}</head>`);
  }
  return `<!doctype html><html><head>${extra}</head><body>${html}</body></html>`;
}

function extractMarkupGoUrl(obj) {
  if (!obj || typeof obj !== "object") {
    return "";
  }

  for (const key of ["url", "image", "imageUrl"]) {
    if (typeof obj[key] === "string" && obj[key].startsWith("http")) {
      return obj[key];
    }
  }

  if (typeof obj.raw === "string") {
    try {
      const raw = JSON.parse(obj.raw);
      const rawUrl = extractMarkupGoUrl(raw);
      if (rawUrl) {
        return rawUrl;
      }
    } catch {
      // Ignore raw parsing failures.
    }
  }

  if (obj.path) {
    return `https://files.markupgo.com/${String(obj.path).replace(/^\/+/, "")}`;
  }

  return "";
}

function validateDownloadUrl(value) {
  try {
    const parsed = new URL(String(value || ""));
    const allowedHosts = new Set(["files.markupgo.com", "api.markupgo.com"]);
    if (parsed.protocol !== "https:") {
      return { ok: false, error: "Only https MarkupGo URLs are allowed" };
    }
    if (!allowedHosts.has(parsed.hostname)) {
      return { ok: false, error: "Only MarkupGo file URLs are allowed" };
    }
    return { ok: true, url: parsed.href };
  } catch {
    return { ok: false, error: "Invalid image URL" };
  }
}

function sanitizeFilename(value) {
  const cleaned = String(value || "download")
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "download";
}

function clampInt(value, fallback, min, max) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

function htmlKb(html) {
  return Math.round(Buffer.byteLength(html) / 10.24) / 100;
}

function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = Buffer.from(file.name, "utf8");
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
    const crc = crc32(data);
    const localHeader = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), nameBytes
    ]);
    localParts.push(localHeader, data);

    const centralHeader = Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), nameBytes
    ]);
    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralSize), u32(offset), u16(0)
  ]);

  return Buffer.concat([...localParts, ...centralParts, endRecord]);
}

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let j = 0; j < 8; j += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function sendJson(res, status, body) {
  send(res, status, "application/json; charset=utf-8", JSON.stringify(body));
}

function sendText(res, status, body) {
  send(res, status, "text/plain; charset=utf-8", body);
}

function send(res, status, contentType, body) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  res.end(body);
}
