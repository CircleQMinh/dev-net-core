import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  DEFAULT_OG_IMAGE_URL,
  buildSeoMetadata,
} from "./buildSeoMetadata.mjs";
import {
  staticSeoRoutes,
  validateStaticSeoRoutes,
} from "./seoRoutes.mjs";

const seoManifest = JSON.parse(
  fs.readFileSync(
    new URL("../content/curriculumSeoManifest.generated.json", import.meta.url),
    "utf8"
  )
);
const asyncAwaitEntry = seoManifest.entries.find(
  (entry) => entry.id === "async-and-await-semantics-in-csharp"
);

test("builds self-canonical metadata for an indexable static route", () => {
  const metadata = buildSeoMetadata({ pathname: "/content/" });

  assert.equal(metadata.index, true);
  assert.equal(metadata.robots, "index,follow");
  assert.equal(
    metadata.canonicalUrl,
    "https://www.dev-net-core.com/content/"
  );
  assert.equal(metadata.openGraph.url, metadata.canonicalUrl);
  assert.equal(metadata.openGraph.image, DEFAULT_OG_IMAGE_URL);
  assert.equal(metadata.twitter.image, DEFAULT_OG_IMAGE_URL);
  assert.equal(metadata.structuredData, null);
});

test("builds WebSite structured data for the canonical homepage", () => {
  const metadata = buildSeoMetadata({ pathname: "/" });

  assert.deepEqual(metadata.structuredData, {
    "@context": "https://schema.org",
    "@type": "WebSite",
    description: metadata.description,
    name: "DEV_NET_CORE",
    url: "https://www.dev-net-core.com/",
  });
});

test("canonicalizes the home alias while keeping it out of the index", () => {
  const metadata = buildSeoMetadata({ pathname: "/home" });

  assert.equal(metadata.index, false);
  assert.equal(metadata.robots, "noindex,follow");
  assert.equal(metadata.canonicalUrl, "https://www.dev-net-core.com/");
  assert.equal(
    metadata.title,
    "DEV_NET_CORE | Developer Interview Preparation"
  );
  assert.equal(metadata.structuredData, null);
});

test("uses curriculum metadata for a valid content route", () => {
  assert.ok(asyncAwaitEntry);

  const metadata = buildSeoMetadata({
    contentEntry: asyncAwaitEntry,
    pathname: "/content/async-and-await-semantics-in-csharp",
  });

  assert.equal(metadata.index, true);
  assert.equal(metadata.title, asyncAwaitEntry.seoTitle);
  assert.equal(metadata.description, asyncAwaitEntry.seoDescription);
  assert.equal(
    metadata.canonicalPath,
    "/content/async-and-await-semantics-in-csharp/"
  );
  assert.deepEqual(metadata.structuredData, {
    "@context": "https://schema.org",
    "@type": "Article",
    description: asyncAwaitEntry.seoDescription,
    headline: asyncAwaitEntry.seoTitle,
    url:
      "https://www.dev-net-core.com/content/" +
      "async-and-await-semantics-in-csharp/",
  });
});

test("keeps a valid practice topic noindex and self-canonical", () => {
  assert.ok(asyncAwaitEntry);

  const metadata = buildSeoMetadata({
    contentEntry: asyncAwaitEntry,
    pathname: "/practice/async-and-await-semantics-in-csharp/",
  });

  assert.equal(metadata.index, false);
  assert.equal(metadata.robots, "noindex,follow");
  assert.equal(
    metadata.canonicalUrl,
    "https://www.dev-net-core.com/practice/async-and-await-semantics-in-csharp/"
  );
  assert.match(metadata.title, /^Practice Async and Await Semantics/);
  assert.equal(metadata.structuredData, null);
});

test("keeps session-specific simulation routes noindex without canonicals", () => {
  const metadata = buildSeoMetadata({
    pathname: "/simulation/session/01234567-89ab-cdef-0123-456789abcdef",
  });

  assert.equal(metadata.index, false);
  assert.equal(metadata.canonicalPath, null);
  assert.equal(metadata.canonicalUrl, null);
  assert.equal(metadata.openGraph.url, null);
  assert.equal(metadata.title, "Mock Interview Session | DEV_NET_CORE");
});

test("treats an invalid content topic as not found", () => {
  const metadata = buildSeoMetadata({
    pathname: "/content/not-a-real-topic/",
  });

  assert.equal(metadata.index, false);
  assert.equal(metadata.canonicalPath, null);
  assert.equal(metadata.canonicalUrl, null);
  assert.equal(metadata.title, "Page Not Found | DEV_NET_CORE");
  assert.equal(metadata.structuredData, null);
});

test("treats an invalid practice topic as not found", () => {
  const metadata = buildSeoMetadata({
    pathname: "/practice/not-a-real-topic/",
  });

  assert.equal(metadata.index, false);
  assert.equal(metadata.canonicalPath, null);
  assert.equal(metadata.canonicalUrl, null);
  assert.equal(metadata.title, "Page Not Found | DEV_NET_CORE");
});

test("rejects malformed static route configurations", () => {
  assert.throws(() =>
    validateStaticSeoRoutes([
      {
        canonicalPath: "/unsafe/",
        index: false,
        path: "/unsafe/",
        prerender: false,
        seoDescription: "",
        seoTitle: "Unsafe",
        sitemap: true,
      },
    ])
  );

  assert.equal(staticSeoRoutes.length, 12);
});
