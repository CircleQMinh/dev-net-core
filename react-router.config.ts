import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { Config } from "@react-router/dev/config";
import { staticSeoRoutes } from "./shared/seo/seoRoutes.mjs";

type SeoManifest = {
  entries: Array<{
    canonicalPath: string;
    id: string;
  }>;
};

const manifestPath = fileURLToPath(
  new URL("./shared/content/curriculumSeoManifest.generated.json", import.meta.url)
);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as SeoManifest;
const topicPaths = manifest.entries.map((entry) => entry.canonicalPath);
const staticSitemapPaths = staticSeoRoutes
  .filter((route) => route.sitemap)
  .map((route) => route.path);
const prerenderPaths = Array.from(
  new Set([...staticSitemapPaths, ...topicPaths])
);

if (topicPaths.length === 0) {
  throw new Error("The curriculum SEO manifest must contain at least one topic.");
}

export default {
  appDirectory: "app",
  buildDirectory: "build-framework",
  future: {
    v8_trailingSlashAwareDataRequests: true,
  },
  prerender: {
    concurrency: 4,
    paths: prerenderPaths,
  },
  routeDiscovery: { mode: "initial" },
  ssr: false,
} satisfies Config;
