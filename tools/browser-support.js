import { existsSync, readFile } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { URL } from "node:url";
import { chromium } from "playwright-core";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function chromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const executable = candidates.find(existsSync);
  if (!executable) {
    throw new Error("Chrome not found. Set CHROME_PATH to run browser tools.");
  }
  return executable;
}

export function launchBrowser() {
  return chromium.launch({
    executablePath: chromeExecutable(),
    headless: true,
  });
}

export function createStaticServer(root = process.cwd()) {
  return createServer((request, response) => {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    let pathname;
    try {
      pathname = decodeURIComponent(requestUrl.pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }
    const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
    const filePath = resolve(root, relativePath);

    if (filePath !== root && !filePath.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }

    readFile(filePath, (error, content) => {
      if (error) {
        response.writeHead(error.code === "ENOENT" ? 404 : 500).end();
        return;
      }

      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type":
          contentTypes[extname(filePath)] ?? "application/octet-stream",
      });
      response.end(content);
    });
  });
}

export function listen(server) {
  return new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveListen(server.address().port));
  });
}

export function closeServer(server) {
  return new Promise((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
}

export function collectBrowserErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}
