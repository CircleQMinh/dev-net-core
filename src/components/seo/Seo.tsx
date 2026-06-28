import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  buildSeoMetadata,
  type SeoMetadata,
  type SeoStructuredData,
} from "../../../shared/seo/buildSeoMetadata.mjs";
import { curriculumManifest } from "../../contents/curriculumManifest.generated";

const STRUCTURED_DATA_SELECTOR =
  'script[type="application/ld+json"][data-dev-net-core-seo="structured-data"]';

const curriculumEntriesById = new Map(
  curriculumManifest.map((entry) => [entry.id, entry])
);

export function Seo() {
  const { pathname } = useLocation();
  const metadata = useMemo(
    () =>
      buildSeoMetadata({
        contentEntry: findCurriculumEntry(pathname),
        pathname,
      }),
    [pathname]
  );

  useEffect(() => {
    applySeoMetadata(metadata);
  }, [metadata]);

  return null;
}

function findCurriculumEntry(pathname: string) {
  const topicId = pathname.match(
    /^\/(?:content|practice)\/([a-z0-9][a-z0-9-]*)\/?$/
  )?.[1];

  return topicId ? curriculumEntriesById.get(topicId) : undefined;
}

function applySeoMetadata(metadata: SeoMetadata) {
  document.title = metadata.title;

  upsertMetaByName("description", metadata.description);
  upsertMetaByName("robots", metadata.robots);

  upsertMetaByProperty("og:title", metadata.openGraph.title);
  upsertMetaByProperty("og:description", metadata.openGraph.description);
  upsertMetaByProperty("og:type", metadata.openGraph.type);
  upsertMetaByProperty("og:image", metadata.openGraph.image);
  upsertMetaByProperty(
    "og:image:width",
    String(metadata.openGraph.imageWidth)
  );
  upsertMetaByProperty(
    "og:image:height",
    String(metadata.openGraph.imageHeight)
  );
  upsertMetaByProperty("og:image:alt", metadata.openGraph.imageAlt);

  upsertMetaByName("twitter:card", metadata.twitter.card);
  upsertMetaByName("twitter:title", metadata.twitter.title);
  upsertMetaByName("twitter:description", metadata.twitter.description);
  upsertMetaByName("twitter:image", metadata.twitter.image);

  if (metadata.canonicalUrl) {
    upsertCanonical(metadata.canonicalUrl);
  } else {
    removeHeadElements('link[rel="canonical"]');
  }

  if (metadata.openGraph.url) {
    upsertMetaByProperty("og:url", metadata.openGraph.url);
  } else {
    removeHeadElements('meta[property="og:url"]');
  }

  if (metadata.structuredData) {
    upsertStructuredData(metadata.structuredData);
  } else {
    removeHeadElements(STRUCTURED_DATA_SELECTOR);
  }
}

function upsertMetaByName(name: string, content: string) {
  upsertHeadElement("meta", `meta[name="${name}"]`, {
    content,
    name,
  });
}

function upsertMetaByProperty(property: string, content: string) {
  upsertHeadElement("meta", `meta[property="${property}"]`, {
    content,
    property,
  });
}

function upsertCanonical(href: string) {
  upsertHeadElement("link", 'link[rel="canonical"]', {
    href,
    rel: "canonical",
  });
}

function upsertStructuredData(structuredData: SeoStructuredData) {
  const existingElement =
    document.head.querySelector<HTMLScriptElement>(
      STRUCTURED_DATA_SELECTOR
    );
  const element = existingElement ?? document.createElement("script");

  element.type = "application/ld+json";
  element.dataset.devNetCoreSeo = "structured-data";
  element.textContent = JSON.stringify(structuredData);

  if (!existingElement) {
    document.head.append(element);
  }
}

function upsertHeadElement(
  tagName: "link" | "meta",
  selector: string,
  attributes: Record<string, string>
) {
  const existingElement = document.head.querySelector<HTMLElement>(selector);
  const element = existingElement ?? document.createElement(tagName);

  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, value);
  });
  element.setAttribute("data-dev-net-core-seo", "true");

  if (!existingElement) {
    document.head.append(element);
  }
}

function removeHeadElements(selector: string) {
  document.head.querySelectorAll(selector).forEach((element) => {
    element.remove();
  });
}
