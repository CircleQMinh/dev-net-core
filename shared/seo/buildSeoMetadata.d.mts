export type SeoContentEntry = Readonly<{
  canonicalPath: string;
  id: string;
  seoDescription: string;
  seoTitle: string;
  subtopic?: string;
  title?: string;
}>;

export type OpenGraphMetadata = Readonly<{
  description: string;
  image: string;
  imageAlt: string;
  imageHeight: number;
  imageWidth: number;
  title: string;
  type: "website";
  url: string | null;
}>;

export type TwitterMetadata = Readonly<{
  card: "summary_large_image";
  description: string;
  image: string;
  title: string;
}>;

export type SeoMetadata = Readonly<{
  canonicalPath: string | null;
  canonicalUrl: string | null;
  description: string;
  index: boolean;
  openGraph: OpenGraphMetadata;
  robots: "index,follow" | "noindex,follow";
  title: string;
  twitter: TwitterMetadata;
}>;

export type BuildSeoMetadataInput = Readonly<{
  contentEntry?: SeoContentEntry;
  pathname: string;
}>;

export const SEO_SITE_NAME: "DEV_NET_CORE";
export const SEO_SITE_ORIGIN: "https://www.dev-net-core.com";
export const DEFAULT_OG_IMAGE_URL: string;
export const DEFAULT_OG_IMAGE_WIDTH: 1200;
export const DEFAULT_OG_IMAGE_HEIGHT: 630;
export const DEFAULT_OG_IMAGE_ALT: string;

export function buildSeoMetadata(
  input: BuildSeoMetadataInput
): SeoMetadata;
