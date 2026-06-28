export type ContentRouteTopicData = {
  canonicalPath: string;
  category: string;
  contentPath: string;
  id: string;
  questionCount?: number;
  seoDescription: string;
  seoTitle: string;
  subtopic: string;
  title: string;
  topic: string;
};

export type ContentRouteData =
  | {
      kind: "not-found";
      topicId: string;
    }
  | {
      kind: "topic";
      markdown: string;
      topic: ContentRouteTopicData;
    }
  | {
      kind: "welcome";
      markdown: string;
    };

export function getMatchingContentRouteData(
  routeData: ContentRouteData | undefined,
  topicId: string | undefined
) {
  if (!routeData) {
    return undefined;
  }

  if (!topicId) {
    return routeData.kind === "welcome" ? routeData : undefined;
  }

  if (routeData.kind === "topic" && routeData.topic.id === topicId) {
    return routeData;
  }

  if (routeData.kind === "not-found" && routeData.topicId === topicId) {
    return routeData;
  }

  return undefined;
}
