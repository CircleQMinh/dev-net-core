import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SEO_SITE_ORIGIN } from "../shared/seo/buildSeoMetadata.mjs";
import { staticSeoRoutes } from "../shared/seo/seoRoutes.mjs";

const repositoryRoot = process.cwd();
const clientRoot = path.join(repositoryRoot, "build-framework", "client");
const manifestPath = path.join(
  repositoryRoot,
  "shared",
  "content",
  "curriculumSeoManifest.generated.json"
);
const fallbackPath = path.join(clientRoot, "__spa-fallback.html");
const notFoundPath = path.join(clientRoot, "404.html");
const sitemapPath = path.join(clientRoot, "sitemap.xml");
const robotsPath = path.join(clientRoot, "robots.txt");

assert.ok(
  fs.existsSync(clientRoot),
  "Run npm run build:framework before finalizing framework output."
);
assert.ok(
  fs.existsSync(fallbackPath),
  "Framework output is missing __spa-fallback.html."
);
assert.ok(fs.existsSync(manifestPath), "The curriculum SEO manifest is missing.");

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const sitemapPaths = buildSitemapPaths({
  contentEntries: manifest.entries,
  staticRoutes: staticSeoRoutes,
});

for (const pathname of sitemapPaths) {
  assert.ok(
    fs.existsSync(getRouteHtmlPath(pathname)),
    `Cannot finalize sitemap because ${pathname} has no static HTML artifact.`
  );
}

const sitemap = createSitemapXml(sitemapPaths);
const robots = createRobotsTxt();
const finalizedFallback = addNotFoundMetadata(
  fs.readFileSync(fallbackPath, "utf8")
);

fs.writeFileSync(sitemapPath, sitemap, "utf8");
fs.writeFileSync(robotsPath, robots, "utf8");
fs.writeFileSync(fallbackPath, finalizedFallback, "utf8");
fs.writeFileSync(notFoundPath, finalizedFallback, "utf8");

console.log(
  `Finalized framework output with ${sitemapPaths.length} sitemap URLs, ` +
    "candidate robots.txt, and dedicated 404.html."
);

export function buildSitemapPaths({ contentEntries, staticRoutes }) {
  assert.ok(Array.isArray(contentEntries), "Content entries must be an array.");
  assert.ok(Array.isArray(staticRoutes), "Static routes must be an array.");

  const paths = [
    ...staticRoutes.filter((route) => route.sitemap).map((route) => route.path),
    ...contentEntries.map((entry) => entry.canonicalPath),
  ];
  const uniquePaths = new Set(paths);

  assert.equal(
    uniquePaths.size,
    paths.length,
    "Sitemap paths must be unique."
  );

  for (const pathname of paths) {
    assert.ok(
      isCanonicalPath(pathname),
      `Sitemap path "${pathname}" must be canonical and trailing-slash.`
    );
  }

  return paths;
}

export function createSitemapXml(paths) {
  const urlEntries = paths
    .map(
      (pathname) =>
        `  <url>\n    <loc>${escapeXml(
          `${SEO_SITE_ORIGIN}${pathname}`
        )}</loc>\n  </url>`
    )
    .join("\n");

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `${urlEntries}\n` +
    "</urlset>\n"
  );
}

export function createRobotsTxt() {
  return (
    "User-agent: *\n" +
    "Allow: /\n\n" +
    `Sitemap: ${SEO_SITE_ORIGIN}/sitemap.xml\n`
  );
}

export function addNotFoundMetadata(html) {
  const startMarker = "<!-- framework-finalizer:not-found-head:start -->";
  const endMarker = "<!-- framework-finalizer:not-found-head:end -->";
  const managedBlockPattern = new RegExp(
    `${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}`,
    "g"
  );
  const withoutManagedBlock = html.replace(managedBlockPattern, "");
  const metadataBlock =
    `${startMarker}` +
    "<title>Page Not Found | DEV_NET_CORE</title>" +
    '<meta name="description" content="The requested DEV_NET_CORE page could not be found."/>' +
    '<meta name="robots" content="noindex,follow"/>' +
    `${endMarker}`;

  assert.ok(
    withoutManagedBlock.includes("</head>"),
    "Framework fallback output must contain a closing head tag."
  );
  assert.ok(
    withoutManagedBlock.includes("404 - Page Not Found"),
    "Framework fallback output must contain visible Not Found content."
  );
  assert.equal(
    /<link\b[^>]*\brel=["']canonical["']/i.test(withoutManagedBlock),
    false,
    "Framework fallback must not contain a canonical link."
  );
  assert.equal(
    withoutManagedBlock.includes('type="application/ld+json"'),
    false,
    "Framework fallback must not contain structured data."
  );

  return withoutManagedBlock.replace(
    "</head>",
    `${metadataBlock}</head>`
  );
}

function getRouteHtmlPath(pathname) {
  return pathname === "/"
    ? path.join(clientRoot, "index.html")
    : path.join(clientRoot, ...pathname.split("/").filter(Boolean), "index.html");
}

function isCanonicalPath(value) {
  return (
    value === "/" ||
    (typeof value === "string" &&
      /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)+$/.test(value))
  );
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
