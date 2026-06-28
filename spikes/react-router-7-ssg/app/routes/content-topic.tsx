import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router";
import { loadTopic } from "../lib/content.server";

export function loader({ params }: LoaderFunctionArgs) {
  return loadTopic(params.topicId ?? "");
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [{ title: "Page Not Found | DEV_NET_CORE" }];
  }

  return [
    { title: data.metadata.title },
    { name: "description", content: data.metadata.description },
    { tagName: "link", rel: "canonical", href: data.metadata.canonicalUrl },
    { property: "og:title", content: data.metadata.openGraph.title },
    {
      property: "og:description",
      content: data.metadata.openGraph.description,
    },
    { property: "og:url", content: data.metadata.openGraph.url },
    { property: "og:image", content: data.metadata.openGraph.image },
  ];
};

export default function ContentTopic() {
  const { entry, markdown, metadata } = useLoaderData<typeof loader>();

  return (
    <main>
      <Link to="/content/">Curriculum</Link>
      <h1>{entry.subtopic}</h1>
      <pre data-route-markdown>{markdown}</pre>
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(metadata.structuredData),
        }}
        type="application/ld+json"
      />
    </main>
  );
}
