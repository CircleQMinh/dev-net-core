import type { MetaDescriptor } from "react-router";
import type {
  SeoMetadata,
  SeoStructuredData,
} from "../../shared/seo/buildSeoMetadata.mjs";

export function createMetaDescriptors(
  metadata: SeoMetadata
): MetaDescriptor[] {
  const descriptors: MetaDescriptor[] = [
    { title: metadata.title },
    { name: "description", content: metadata.description },
    { name: "robots", content: metadata.robots },
    { property: "og:title", content: metadata.openGraph.title },
    {
      property: "og:description",
      content: metadata.openGraph.description,
    },
    { property: "og:type", content: metadata.openGraph.type },
    { property: "og:image", content: metadata.openGraph.image },
    {
      property: "og:image:width",
      content: String(metadata.openGraph.imageWidth),
    },
    {
      property: "og:image:height",
      content: String(metadata.openGraph.imageHeight),
    },
    {
      property: "og:image:alt",
      content: metadata.openGraph.imageAlt,
    },
    { name: "twitter:card", content: metadata.twitter.card },
    { name: "twitter:title", content: metadata.twitter.title },
    {
      name: "twitter:description",
      content: metadata.twitter.description,
    },
    { name: "twitter:image", content: metadata.twitter.image },
  ];

  if (metadata.canonicalUrl) {
    descriptors.push({
      tagName: "link",
      rel: "canonical",
      href: metadata.canonicalUrl,
    });
  }

  if (metadata.openGraph.url) {
    descriptors.push({
      property: "og:url",
      content: metadata.openGraph.url,
    });
  }

  return descriptors;
}

export function StructuredData({
  value,
}: {
  value: SeoStructuredData | null;
}) {
  if (!value) {
    return null;
  }

  return (
    <script
      data-dev-net-core-seo="structured-data"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(value) }}
      type="application/ld+json"
    />
  );
}
