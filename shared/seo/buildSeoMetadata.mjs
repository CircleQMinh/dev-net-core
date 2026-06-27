import { getStaticSeoRoute } from "./seoRoutes.mjs";

export const SEO_SITE_NAME = "DEV_NET_CORE";
export const SEO_SITE_ORIGIN = "https://www.dev-net-core.com";
export const DEFAULT_OG_IMAGE_URL =
  `${SEO_SITE_ORIGIN}/og/default-og-image.png`;
export const DEFAULT_OG_IMAGE_WIDTH = 1200;
export const DEFAULT_OG_IMAGE_HEIGHT = 630;
export const DEFAULT_OG_IMAGE_ALT =
  "DEV_NET_CORE developer interview preparation";

const NOT_FOUND_TITLE = `Page Not Found | ${SEO_SITE_NAME}`;
const NOT_FOUND_DESCRIPTION =
  "The requested DEV_NET_CORE page could not be found.";

export function buildSeoMetadata(input = {}) {
  const pathname =
    input && typeof input === "object" ? input.pathname : undefined;
  const contentEntry =
    input && typeof input === "object" ? input.contentEntry : undefined;
  const normalizedPath = normalizePathname(pathname);

  if (!normalizedPath) {
    return buildNotFoundMetadata();
  }

  const staticRoute = getStaticSeoRoute(normalizedPath);

  if (staticRoute) {
    return createMetadata({
      canonicalPath: staticRoute.canonicalPath,
      description: staticRoute.seoDescription,
      index: staticRoute.index,
      title: staticRoute.seoTitle,
    });
  }

  const contentMatch = normalizedPath.match(
    /^\/content\/([a-z0-9][a-z0-9-]*)\/$/
  );

  if (contentMatch) {
    return buildContentMetadata(
      normalizedPath,
      contentMatch[1],
      contentEntry
    );
  }

  const practiceMatch = normalizedPath.match(
    /^\/practice\/([a-z0-9][a-z0-9-]*)\/$/
  );

  if (practiceMatch) {
    return buildPracticeMetadata(
      normalizedPath,
      practiceMatch[1],
      contentEntry
    );
  }

  if (
    /^\/simulation\/session\/[a-z0-9-]+\/$/.test(normalizedPath)
  ) {
    return createMetadata({
      canonicalPath: null,
      description:
        "Complete a private DEV_NET_CORE mock interview session one question at a time.",
      index: false,
      title: `Mock Interview Session | ${SEO_SITE_NAME}`,
    });
  }

  if (/^\/simulation\/result\/[a-z0-9-]+\/$/.test(normalizedPath)) {
    return createMetadata({
      canonicalPath: null,
      description:
        "Review answers, expected responses, and self-evaluation results from a DEV_NET_CORE mock interview session.",
      index: false,
      title: `Mock Interview Results | ${SEO_SITE_NAME}`,
    });
  }

  return buildNotFoundMetadata();
}

function buildContentMetadata(normalizedPath, topicId, contentEntry) {
  if (
    !isValidContentEntry(contentEntry) ||
    (contentEntry.id !== topicId &&
      contentEntry.canonicalPath !== normalizedPath)
  ) {
    return buildNotFoundMetadata();
  }

  return createMetadata({
    canonicalPath: contentEntry.canonicalPath,
    description: contentEntry.seoDescription,
    index: true,
    title: contentEntry.seoTitle,
  });
}

function buildPracticeMetadata(normalizedPath, topicId, contentEntry) {
  if (!isValidContentEntry(contentEntry) || contentEntry.id !== topicId) {
    return buildNotFoundMetadata();
  }

  const topicName =
    nonEmptyString(contentEntry.subtopic) ||
    nonEmptyString(contentEntry.title) ||
    topicId;

  return createMetadata({
    canonicalPath: normalizedPath,
    description:
      `Practice ${topicName} interview questions with expected answers, ` +
      "key points, and topic progress tracking.",
    index: false,
    title: `Practice ${topicName} Interview Questions | ${SEO_SITE_NAME}`,
  });
}

function buildNotFoundMetadata() {
  return createMetadata({
    canonicalPath: null,
    description: NOT_FOUND_DESCRIPTION,
    index: false,
    title: NOT_FOUND_TITLE,
  });
}

function createMetadata({ canonicalPath, description, index, title }) {
  const canonicalUrl = canonicalPath
    ? `${SEO_SITE_ORIGIN}${canonicalPath}`
    : null;
  const openGraph = Object.freeze({
    description,
    image: DEFAULT_OG_IMAGE_URL,
    imageAlt: DEFAULT_OG_IMAGE_ALT,
    imageHeight: DEFAULT_OG_IMAGE_HEIGHT,
    imageWidth: DEFAULT_OG_IMAGE_WIDTH,
    title,
    type: "website",
    url: canonicalUrl,
  });
  const twitter = Object.freeze({
    card: "summary_large_image",
    description,
    image: DEFAULT_OG_IMAGE_URL,
    title,
  });

  return Object.freeze({
    canonicalPath,
    canonicalUrl,
    description,
    index,
    openGraph,
    robots: index ? "index,follow" : "noindex,follow",
    title,
    twitter,
  });
}

function isValidContentEntry(contentEntry) {
  return (
    contentEntry &&
    typeof contentEntry === "object" &&
    Boolean(nonEmptyString(contentEntry.id)) &&
    Boolean(nonEmptyString(contentEntry.seoTitle)) &&
    Boolean(nonEmptyString(contentEntry.seoDescription)) &&
    typeof contentEntry.canonicalPath === "string" &&
    /^\/content\/[a-z0-9][a-z0-9-]*\/$/.test(
      contentEntry.canonicalPath
    )
  );
}

function normalizePathname(pathname) {
  if (typeof pathname !== "string") {
    return undefined;
  }

  const trimmedPath = pathname.trim();

  if (
    !trimmedPath.startsWith("/") ||
    trimmedPath.includes("?") ||
    trimmedPath.includes("#") ||
    trimmedPath.includes("\\") ||
    trimmedPath.includes("//")
  ) {
    return undefined;
  }

  if (trimmedPath === "/") {
    return "/";
  }

  return trimmedPath.endsWith("/") ? trimmedPath : `${trimmedPath}/`;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
