import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import * as fs from "fs";
import * as path from "path";

const app = express();
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }

    const origin = req.header("origin");

    if (origin && origins.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      limit: "50mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false, limit: "50mb" }));
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;

      const duration = Date.now() - start;

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    });

    next();
  });
}

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, req: Request, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host") || "";
  const actualBaseUrl = `${protocol}://${host}`;

  let manifest = fs.readFileSync(manifestPath, "utf-8");
  manifest = manifest.replace(/https:\/\/[^/]+\.(replit\.dev|replit\.app|picard\.replit\.dev)[^"]*?(?=\/\d{13}-)/g, actualBaseUrl);
  manifest = manifest.replace(/https:\/\/[^/]+\.(replit\.dev|replit\.app|picard\.replit\.dev)[^"]*?(?=\/assets\/)/g, actualBaseUrl);

  res.send(manifest);
}

function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function configureExpoAndLanding(app: express.Application) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html",
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();

  // ErMate Web App - WhatsApp Web style interface
  const webAppTemplatePath = path.resolve(process.cwd(), "server", "templates", "web-app.html");
  const webAppTemplate = fs.existsSync(webAppTemplatePath) ? fs.readFileSync(webAppTemplatePath, "utf-8") : null;

  app.get("/web", (_req: Request, res: Response) => {
    if (webAppTemplate) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(webAppTemplate);
    } else {
      res.status(404).send("Web app not found");
    }
  });

  log("Serving static Expo files with dynamic manifest routing");

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }

    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, req, res);
    }

    if (req.path === "/") {
      const webIndexPath = path.resolve(process.cwd(), "static-build/web/index.html");
      if (fs.existsSync(webIndexPath)) {
        return res.sendFile(webIndexPath);
      }
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName,
      });
    }

    next();
  });

  app.get("/manifest.webmanifest", (_req: Request, res: Response) => {
    const manifestPath = path.resolve(process.cwd(), "static-build", "manifest.webmanifest");
    if (fs.existsSync(manifestPath)) {
      res.setHeader("Content-Type", "application/manifest+json");
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(manifestPath);
    } else {
      res.status(404).json({ error: "PWA manifest not found" });
    }
  });

  app.get("/sw.js", (_req: Request, res: Response) => {
    // Derive a build-specific cache version from the timestamp folder in static-build
    let cacheVersion = "ermate-pwa-v3";
    try {
      const entries = fs.readdirSync(path.resolve(process.cwd(), "static-build"));
      const tsFolder = entries.find((e) => /^\d{13}/.test(e));
      if (tsFolder) cacheVersion = `ermate-pwa-${tsFolder}`;
    } catch {}

    const offlineHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ErMate — Offline</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0a0e1a;color:#f0f4ff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}.card{background:#1a2236;border:1px solid #2a3a55;border-radius:20px;padding:40px 32px;max-width:400px;text-align:center}.icon{width:56px;height:56px;border-radius:14px;background:#1f2d45;display:flex;align-items:center;justify-content:center;margin:0 auto 20px}svg{width:28px;height:28px;stroke:#94a3b8;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}h2{font-size:20px;font-weight:700;margin-bottom:8px}p{font-size:14px;color:#94a3b8;line-height:1.6;margin-bottom:24px}a{display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:10px 24px;border-radius:10px;font-size:14px;font-weight:600}</style></head><body><div class="card"><div class="icon"><svg viewBox="0 0 24 24"><path d="M1 6s4-2 11-2 11 2 11 2"/><path d="M1 18s4 2 11 2 11-2 11-2"/><line x1="1" y1="12" x2="23" y2="12"/><line x1="12" y1="4" x2="12" y2="20"/></svg></div><h2>You are offline</h2><p>Cases you have already opened are available below. New cases and updates require a connection.</p><a href="/web">View Cached Cases</a></div></body></html>`;

    const swContent = `
const CACHE = '${cacheVersion}';
const PRECACHE = ['/web', '/assets/images/icon.png', '/assets/images/favicon.png'];

// Install — pre-cache key assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(PRECACHE).catch(function() {});
    }).then(function() { return self.skipWaiting(); })
  );
});

// Activate — delete old caches, claim clients immediately
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// Message — allow manual skip-waiting
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Offline fallback HTML
const OFFLINE_HTML = ${JSON.stringify(offlineHtml)};

// Fetch — network first, cache fallback, offline page last resort
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  // API calls — never cache, let them fail naturally if offline
  var url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request).then(function(networkRes) {
      // Network succeeded — update cache in background, return fresh response
      if (networkRes && networkRes.status === 200) {
        var clone = networkRes.clone();
        caches.open(CACHE).then(function(cache) { cache.put(event.request, clone); });
      }
      return networkRes;
    }).catch(function() {
      // Network failed — try cache
      return caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        // Nothing in cache — return offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html' } });
        }
        // For non-navigation (images, scripts) just fail silently
        return new Response('', { status: 503 });
      });
    })
  );
});
`.trim();

    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Service-Worker-Allowed", "/");
    res.send(swContent);
  });

  // Serve Expo asset requests that use ?unstable_path query param (e.g. vector icon fonts)
  app.get("/assets/", (req: Request, res: Response, next: NextFunction) => {
    const unstablePath = req.query.unstable_path as string | undefined;
    if (!unstablePath) return next();

    // Resolve relative to project root, prevent directory traversal
    const resolved = path.resolve(process.cwd(), unstablePath.replace(/^\.\//, ""));
    const cwd = path.resolve(process.cwd());
    if (!resolved.startsWith(cwd)) {
      return res.status(403).send("Forbidden");
    }

    if (fs.existsSync(resolved)) {
      return res.sendFile(resolved);
    }
    next();
  });

  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app.use(express.static(path.resolve(process.cwd(), "static-build")));
  app.use(express.static(path.resolve(process.cwd(), "static-build/web")));

  log("Expo routing: Checking expo-platform header on / and /manifest");
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };

    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    res.status(status).json({ message });

    throw err;
  });
}

(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);

  configureExpoAndLanding(app);

  const server = await registerRoutes(app);

  setupErrorHandler(app);

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`express server serving on port ${port}`);
    },
  );
})();
