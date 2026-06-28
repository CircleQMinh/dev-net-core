import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildSeoMetadata,
  SEO_SITE_ORIGIN,
} from "../shared/seo/buildSeoMetadata.mjs";
import { staticSeoRoutes } from "../shared/seo/seoRoutes.mjs";
import { frameworkOutputBudgets } from "./framework-output-budgets.mjs";

const repositoryRoot = process.cwd();
const clientRoot = path.join(repositoryRoot, "build-framework", "client");
const frameworkFallbackPath = path.join(clientRoot, "__spa-fallback.html");
const notFoundPath = path.join(clientRoot, "404.html");
const robotsPath = path.join(clientRoot, "robots.txt");
const sitemapPath = path.join(clientRoot, "sitemap.xml");
const manifest = JSON.parse(
  fs.readFileSync(
    path.join(
      repositoryRoot,
      "shared",
      "content",
      "curriculumSeoManifest.generated.json"
    ),
    "utf8"
  )
);
const staticRoutes = staticSeoRoutes.filter((route) => route.sitemap);
const expectedRoutes = [
  ...staticRoutes.map((route) => ({
    contentEntry: undefined,
    pathname: route.path,
  })),
  ...manifest.entries.map((entry) => ({
    contentEntry: entry,
    pathname: entry.canonicalPath,
  })),
];

const spaIndexPath = path.join(repositoryRoot, "dist", "index.html");

assert.ok(fs.existsSync(spaIndexPath));
assert.ok(fs.existsSync(frameworkFallbackPath));
assert.ok(fs.existsSync(path.join(clientRoot, "theme-bootstrap.js")));
assert.ok(fs.existsSync(path.join(repositoryRoot, "dist", "theme-bootstrap.js")));
assert.ok(
  fs.readFileSync(spaIndexPath, "utf8").includes(
    '<script src="/theme-bootstrap.js"></script>'
  ),
  "The SPA output must load the static theme bootstrap."
);
assert.ok(
  fs.readFileSync(frameworkFallbackPath, "utf8").includes(
    '<script src="/theme-bootstrap.js"></script>'
  ),
  "The framework SPA fallback must load the static theme bootstrap."
);
assert.equal(
  fs.existsSync(path.join(repositoryRoot, "build-framework", "server")),
  false
);

validateFinalizedOutput();

for (const route of expectedRoutes) {
  validateRoute(route);
}

for (const routePath of [
  "/bug-report/",
  "/changelog/",
  "/practice/",
  "/simulation/",
  "/simulation/setup/",
]) {
  assert.equal(
    fs.existsSync(getRouteHtmlPath(routePath)),
    false,
    `${routePath} must remain SPA-only while it is excluded from the sitemap.`
  );
}

const generatedIndexFiles = findFiles(clientRoot, "index.html");
const generatedRouteDataFiles = findFiles(clientRoot, "_.data");
const generatedClientFiles = findAllFiles(clientRoot);

assert.equal(
  generatedIndexFiles.length,
  expectedRoutes.length,
  "Framework output contains an unexpected number of static route artifacts."
);

validateOutputBudgets({
  generatedClientFiles,
  generatedIndexFiles,
  generatedRouteDataFiles,
});

console.log(
  `Validated ${expectedRoutes.length} framework route artifacts ` +
    `(${manifest.entries.length} curriculum topics).`
);

function validateRoute({ contentEntry, pathname }) {
  const htmlPath = getRouteHtmlPath(pathname);
  const dataPath = getRouteDataPath(pathname);
  const metadata = buildSeoMetadata({ contentEntry, pathname });

  assert.ok(fs.existsSync(htmlPath), `Missing HTML artifact for ${pathname}.`);
  if (pathname.startsWith("/content/")) {
    assert.ok(fs.existsSync(dataPath), `Missing data artifact for ${pathname}.`);
  }

  const html = fs.readFileSync(htmlPath, "utf8");
  const canonicalUrl = `${SEO_SITE_ORIGIN}${pathname}`;

  assert.ok(
    html.includes(`<title>${escapeHtml(metadata.title)}</title>`),
    `Incorrect title for ${pathname}.`
  );
  assert.ok(
    html.includes(
      `<meta name="description" content="${escapeHtml(metadata.description)}"/>`
    ),
    `Incorrect description for ${pathname}.`
  );
  assert.ok(
    html.includes('<meta name="robots" content="index,follow"/>'),
    `Missing index directive for ${pathname}.`
  );
  assert.ok(
    html.includes(`<link rel="canonical" href="${canonicalUrl}"/>`),
    `Incorrect canonical URL for ${pathname}.`
  );
  assert.ok(
    html.includes(`<meta property="og:url" content="${canonicalUrl}"/>`),
    `Incorrect Open Graph URL for ${pathname}.`
  );
  assert.ok(
    html.includes(
      '<meta property="og:image" content="https://www.dev-net-core.com/og/default-og-image.png"/>'
    ),
    `Missing Open Graph image for ${pathname}.`
  );
  assert.ok(
    html.includes("<h1"),
    `Missing visible source HTML heading for ${pathname}.`
  );
  assert.ok(
    html.includes('<script src="/theme-bootstrap.js"></script>'),
    `Missing static theme bootstrap for ${pathname}.`
  );
  assert.equal(
    html.includes("Loading content..."),
    false,
    `Static output for ${pathname} contains a loading placeholder.`
  );

  if (metadata.structuredData) {
    assert.ok(
      html.includes('data-dev-net-core-seo="structured-data"'),
      `Missing structured data for ${pathname}.`
    );
  }

  if (contentEntry) {
    assert.ok(
      html.includes(escapeHtml(contentEntry.subtopic)),
      `Missing topic content for ${pathname}.`
    );
  }
}

function validateFinalizedOutput() {
  assert.ok(fs.existsSync(sitemapPath), "Missing finalized sitemap.xml.");
  assert.ok(fs.existsSync(robotsPath), "Missing finalized robots.txt.");
  assert.ok(fs.existsSync(notFoundPath), "Missing dedicated 404.html.");

  const sitemap = fs.readFileSync(sitemapPath, "utf8");
  const robots = fs.readFileSync(robotsPath, "utf8");
  const expectedUrls = expectedRoutes.map(
    ({ pathname }) => `${SEO_SITE_ORIGIN}${pathname}`
  );
  const sitemapUrls = Array.from(
    sitemap.matchAll(/<loc>([^<]+)<\/loc>/g),
    (match) => match[1]
  );

  assert.ok(
    sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>'),
    "Sitemap must declare UTF-8 XML."
  );
  assert.ok(
    sitemap.includes(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ),
    "Sitemap must use the standard sitemap namespace."
  );
  assert.equal(sitemap.includes("<lastmod>"), false);
  assert.equal(sitemap.includes("<priority>"), false);
  assert.equal(sitemap.includes("<changefreq>"), false);
  assert.equal(
    new Set(sitemapUrls).size,
    sitemapUrls.length,
    "Sitemap URLs must be unique."
  );
  assert.deepEqual(
    sitemapUrls,
    expectedUrls,
    "Sitemap URLs must exactly match the validated static route set."
  );

  for (const sitemapUrl of sitemapUrls) {
    const url = new URL(sitemapUrl);

    assert.equal(url.origin, SEO_SITE_ORIGIN);
    assert.ok(
      url.pathname === "/" || url.pathname.endsWith("/"),
      `Sitemap URL ${sitemapUrl} must use a trailing slash.`
    );
    assert.ok(
      fs.existsSync(getRouteHtmlPath(url.pathname)),
      `Sitemap URL ${sitemapUrl} has no static HTML artifact.`
    );
  }

  for (const excludedPath of [
    "/bug-report/",
    "/changelog/",
    "/practice/",
    "/simulation/",
    "/simulation/setup/",
  ]) {
    assert.equal(
      sitemapUrls.includes(`${SEO_SITE_ORIGIN}${excludedPath}`),
      false,
      `${excludedPath} must remain excluded from the sitemap.`
    );
  }

  assert.ok(
    robots.includes(`Sitemap: ${SEO_SITE_ORIGIN}/sitemap.xml`),
    "Candidate robots.txt must advertise the finalized sitemap."
  );
  assert.equal(
    fs
      .readFileSync(
        path.join(repositoryRoot, "public", "robots.txt"),
        "utf8"
      )
      .includes("Sitemap:"),
    false,
    "The legacy SPA robots source must not advertise the candidate sitemap."
  );

  for (const artifactPath of [frameworkFallbackPath, notFoundPath]) {
    const html = fs.readFileSync(artifactPath, "utf8");

    assert.ok(html.includes("<title>Page Not Found | DEV_NET_CORE</title>"));
    assert.ok(html.includes('<meta name="robots" content="noindex,follow"/>'));
    assert.ok(html.includes("404 - Page Not Found"));
    assert.ok(html.includes('<script src="/theme-bootstrap.js"></script>'));
    assert.ok(html.includes("window.__reactRouterContext"));
    assert.equal(
      /<link\b[^>]*\brel=["']canonical["']/i.test(html),
      false,
      `${path.basename(artifactPath)} must not contain a canonical link.`
    );
    assert.equal(
      html.includes('property="og:url"'),
      false,
      `${path.basename(artifactPath)} must not contain an Open Graph URL.`
    );
    assert.equal(
      html.includes('type="application/ld+json"'),
      false,
      `${path.basename(artifactPath)} must not contain structured data.`
    );
  }

  assert.notEqual(
    fs.readFileSync(notFoundPath, "utf8"),
    fs.readFileSync(path.join(clientRoot, "index.html"), "utf8"),
    "Dedicated 404.html must not be a copy of the homepage."
  );
}

function getRouteHtmlPath(pathname) {
  return pathname === "/"
    ? path.join(clientRoot, "index.html")
    : path.join(clientRoot, ...pathname.split("/").filter(Boolean), "index.html");
}

function getRouteDataPath(pathname) {
  return pathname === "/"
    ? path.join(clientRoot, "_.data")
    : path.join(clientRoot, ...pathname.split("/").filter(Boolean), "_.data");
}

function findFiles(directory, fileName) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return findFiles(entryPath, fileName);
    }

    return entry.name === fileName ? [entryPath] : [];
  });
}

function findAllFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    return entry.isDirectory() ? findAllFiles(entryPath) : [entryPath];
  });
}

function validateOutputBudgets({
  generatedClientFiles,
  generatedIndexFiles,
  generatedRouteDataFiles,
}) {
  const totalBytes = sumFileSizes(generatedClientFiles);
  const largestHtmlBytes = maximumFileSize(generatedIndexFiles);
  const largestRouteDataBytes = maximumFileSize(generatedRouteDataFiles);

  assert.ok(
    generatedIndexFiles.length <= frameworkOutputBudgets.maximumRouteCount,
    `Framework route count ${generatedIndexFiles.length} exceeds the ` +
      `${frameworkOutputBudgets.maximumRouteCount} route budget.`
  );
  assert.ok(
    totalBytes <= frameworkOutputBudgets.maximumTotalBytes,
    `Framework client output ${formatMiB(totalBytes)} exceeds the ` +
      `${formatMiB(frameworkOutputBudgets.maximumTotalBytes)} budget.`
  );
  assert.ok(
    largestHtmlBytes <= frameworkOutputBudgets.maximumHtmlBytes,
    `Largest route HTML ${formatKiB(largestHtmlBytes)} exceeds the ` +
      `${formatKiB(frameworkOutputBudgets.maximumHtmlBytes)} budget.`
  );
  assert.ok(
    largestRouteDataBytes <= frameworkOutputBudgets.maximumRouteDataBytes,
    `Largest route data ${formatKiB(largestRouteDataBytes)} exceeds the ` +
      `${formatKiB(frameworkOutputBudgets.maximumRouteDataBytes)} budget.`
  );

  console.log(
    "Framework output budgets: " +
      `${generatedIndexFiles.length}/${frameworkOutputBudgets.maximumRouteCount} routes, ` +
      `${formatMiB(totalBytes)}/${formatMiB(frameworkOutputBudgets.maximumTotalBytes)} total, ` +
      `${formatKiB(largestHtmlBytes)}/${formatKiB(frameworkOutputBudgets.maximumHtmlBytes)} max HTML, ` +
      `${formatKiB(largestRouteDataBytes)}/${formatKiB(frameworkOutputBudgets.maximumRouteDataBytes)} max route data.`
  );
}

function sumFileSizes(files) {
  return files.reduce((total, filePath) => total + fs.statSync(filePath).size, 0);
}

function maximumFileSize(files) {
  return files.reduce(
    (maximum, filePath) => Math.max(maximum, fs.statSync(filePath).size),
    0
  );
}

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(2)} KiB`;
}

function formatMiB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
