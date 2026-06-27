import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { Config } from "@react-router/dev/config";

type SeoManifest = {
  entries: Array<{
    canonicalPath: string;
  }>;
};

const manifestPath = fileURLToPath(
  new URL("./shared/content/curriculumSeoManifest.generated.json", import.meta.url)
);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as SeoManifest;
const topicPath = manifest.entries[0]?.canonicalPath;

if (!topicPath) {
  throw new Error("The curriculum SEO manifest must contain at least one topic.");
}

export default {
  appDirectory: "spikes/react-router-7-ssg/app",
  buildDirectory: "spikes/react-router-7-ssg/build",
  future: {
    v8_trailingSlashAwareDataRequests: true,
  },
  prerender: ["/", "/content/", topicPath],
  routeDiscovery: { mode: "initial" },
  ssr: false,
} satisfies Config;
