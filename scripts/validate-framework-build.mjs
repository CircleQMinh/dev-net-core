import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildSeoMetadata,
  SEO_SITE_ORIGIN,
} from "../shared/seo/buildSeoMetadata.mjs";
import { staticSeoRoutes } from "../shared/seo/seoRoutes.mjs";

const repositoryRoot = process.cwd();
const clientRoot = path.join(repositoryRoot, "build-framework", "client");
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

assert.ok(fs.existsSync(path.join(repositoryRoot, "dist", "index.html")));
assert.ok(fs.existsSync(path.join(clientRoot, "__spa-fallback.html")));
assert.equal(
  fs.existsSync(path.join(repositoryRoot, "build-framework", "server")),
  false
);

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

assert.equal(
  generatedIndexFiles.length,
  expectedRoutes.length,
  "Framework output contains an unexpected number of static route artifacts."
);

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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
