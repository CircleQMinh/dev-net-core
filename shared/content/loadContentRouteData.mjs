import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleRepositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const repositoryRoot = isRepositoryRoot(process.cwd())
  ? process.cwd()
  : moduleRepositoryRoot;
const contentRoot = path.join(repositoryRoot, "src", "contents", "v1");
const welcomePath = path.join(
  repositoryRoot,
  "src",
  "contents",
  "resources",
  "welcome.md"
);
const manifestPath = path.join(
  repositoryRoot,
  "shared",
  "content",
  "curriculumSeoManifest.generated.json"
);

let cachedManifest;

export function loadContentRouteData(topicId) {
  if (topicId === undefined || topicId === "") {
    return {
      kind: "welcome",
      markdown: fs.readFileSync(welcomePath, "utf8"),
    };
  }

  if (!isTopicId(topicId)) {
    return {
      kind: "not-found",
      topicId: String(topicId),
    };
  }

  const entry = getManifest().entries.find(
    (candidate) => candidate.id === topicId
  );

  if (!entry) {
    return {
      kind: "not-found",
      topicId,
    };
  }

  const contentPath = resolveCurriculumContentPath(entry.contentPath);

  return {
    kind: "topic",
    markdown: fs.readFileSync(contentPath, "utf8"),
    topic: {
      canonicalPath: entry.canonicalPath,
      category: entry.category,
      contentPath: entry.contentPath,
      id: entry.id,
      seoDescription: entry.seoDescription,
      seoTitle: entry.seoTitle,
      subtopic: entry.subtopic,
      title: entry.title,
      topic: entry.topic,
    },
  };
}

export function resolveCurriculumContentPath(contentPath) {
  if (typeof contentPath !== "string" || !contentPath.trim()) {
    throw new TypeError("Curriculum contentPath must be a non-empty string.");
  }

  const resolvedPath = path.resolve(repositoryRoot, contentPath);
  const relativePath = path.relative(contentRoot, resolvedPath);

  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath) ||
    path.extname(resolvedPath).toLowerCase() !== ".md"
  ) {
    throw new Error(
      `Curriculum content path must resolve to a Markdown file under ${contentRoot}.`
    );
  }

  const realContentRoot = fs.realpathSync(contentRoot);
  const realContentPath = fs.realpathSync(resolvedPath);
  const realRelativePath = path.relative(realContentRoot, realContentPath);

  if (
    realRelativePath.startsWith("..") ||
    path.isAbsolute(realRelativePath)
  ) {
    throw new Error("Curriculum content path resolves outside the content root.");
  }

  return realContentPath;
}

function getManifest() {
  if (!cachedManifest) {
    cachedManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  }

  return cachedManifest;
}

function isTopicId(value) {
  return (
    typeof value === "string" &&
    /^[a-z0-9][a-z0-9-]*$/.test(value)
  );
}

function isRepositoryRoot(candidatePath) {
  return (
    fs.existsSync(path.join(candidatePath, "package.json")) &&
    fs.existsSync(path.join(candidatePath, "shared", "content")) &&
    fs.existsSync(path.join(candidatePath, "src", "contents", "v1"))
  );
}
