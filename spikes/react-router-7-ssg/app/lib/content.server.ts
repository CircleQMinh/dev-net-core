import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSeoMetadata } from "../../../../shared/seo/buildSeoMetadata.mjs";

type SeoEntry = {
  canonicalPath: string;
  contentPath: string;
  id: string;
  seoDescription: string;
  seoTitle: string;
  subtopic: string;
};

type SeoManifest = {
  entries: SeoEntry[];
};

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const manifestPath = path.join(
  repositoryRoot,
  "shared/content/curriculumSeoManifest.generated.json"
);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as SeoManifest;

export function loadTopic(topicId: string) {
  const entry = manifest.entries.find((item) => item.id === topicId);

  if (!entry) {
    throw new Response("Not Found", { status: 404 });
  }

  const source = fs.readFileSync(
    path.join(repositoryRoot, entry.contentPath),
    "utf8"
  );

  return {
    entry,
    markdown: stripFrontmatter(source),
    metadata: buildSeoMetadata({
      contentEntry: entry,
      pathname: entry.canonicalPath,
    }),
  };
}

export function getFirstTopicPath() {
  const canonicalPath = manifest.entries[0]?.canonicalPath;

  if (!canonicalPath) {
    throw new Error("The curriculum SEO manifest must contain at least one topic.");
  }

  return canonicalPath;
}

function stripFrontmatter(markdown: string) {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
}
