import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { AppProviders } from "../../../../src/AppProviders";
import Content from "../../../../src/pages/Content";
import { loadTopic } from "../lib/content.server";

export function loader({ params }: LoaderFunctionArgs) {
  return loadTopic(params.topicId ?? "");
}

export default function ReadinessContent() {
  const { entry, markdown } = useLoaderData<typeof loader>();

  return (
    <AppProviders>
      <Content
        initialRouteData={{
          kind: "topic",
          markdown,
          topic: entry,
        }}
      />
    </AppProviders>
  );
}
