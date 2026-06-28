import { curriculumManifest } from "../../contents/curriculumManifest.generated";
import welcomeMarkdown from "../../contents/resources/welcome.md?raw";
import { findCurriculumSubTopicById } from "./CurriculumTreeView";
import type { ContentRouteData } from "./contentRouteData";

const curriculumEntriesById = new Map(
  curriculumManifest.map((entry) => [entry.id, entry])
);

export async function loadClientContentRouteData(
  topicId?: string
): Promise<ContentRouteData> {
  if (!topicId) {
    return {
      kind: "welcome",
      markdown: welcomeMarkdown,
    };
  }

  const entry = curriculumEntriesById.get(topicId);
  const topic = findCurriculumSubTopicById(topicId);

  if (!entry || !topic) {
    return {
      kind: "not-found",
      topicId,
    };
  }

  return {
    kind: "topic",
    markdown: await topic.loadContent(),
    topic: {
      canonicalPath: entry.canonicalPath,
      category: entry.category,
      contentPath: entry.contentPath,
      id: entry.id,
      questionCount: entry.questionCount,
      seoDescription: entry.seoDescription,
      seoTitle: entry.seoTitle,
      subtopic: entry.subtopic,
      title: entry.title,
      topic: entry.topic,
    },
  };
}
