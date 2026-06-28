import type {
  ClientLoaderFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "react-router";
import { useLoaderData } from "react-router";
import {
  buildSeoMetadata,
  type SeoContentEntry,
} from "../../shared/seo/buildSeoMetadata.mjs";
import { loadClientContentRouteData } from "../../src/components/content/loadClientContentRouteData";
import type { ContentRouteData } from "../../src/components/content/contentRouteData";
import Content from "../../src/pages/Content";
import { loadContentRouteData } from "../lib/contentRouteData.server";
import {
  createMetaDescriptors,
  StructuredData,
} from "../seo/routeMetadata";

export function loader({ params }: LoaderFunctionArgs) {
  return loadContentRouteData(params.topicId);
}

export async function clientLoader({
  params,
  serverLoader,
}: ClientLoaderFunctionArgs) {
  try {
    return (await serverLoader()) as ContentRouteData;
  } catch {
    return loadClientContentRouteData(params.topicId);
  }
}

export const meta: MetaFunction = ({ data, location }) => {
  const routeData = data as ContentRouteData | undefined;
  const contentEntry =
    routeData?.kind === "topic"
      ? (routeData.topic as SeoContentEntry)
      : undefined;

  return createMetaDescriptors(
    buildSeoMetadata({
      contentEntry,
      pathname: location.pathname,
    })
  );
};

export function HydrateFallback() {
  return (
    <div className="theme-page min-h-screen pt-24 text-center">
      Loading content...
    </div>
  );
}

export default function ContentRoute() {
  const routeData = useLoaderData<typeof loader>();
  const metadata = buildSeoMetadata({
    contentEntry:
      routeData.kind === "topic"
        ? (routeData.topic as SeoContentEntry)
        : undefined,
    pathname:
      routeData.kind === "topic"
        ? routeData.topic.canonicalPath
        : routeData.kind === "welcome"
          ? "/content/"
          : `/content/${routeData.topicId}/`,
  });

  return (
    <>
      <StructuredData value={metadata.structuredData} />
      <Content initialRouteData={routeData} />
    </>
  );
}
