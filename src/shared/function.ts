import {
  collectSubTopicNodes,
  generatedCurriculumTree,
  type CurriculumSubTopicNode,
  type CurriculumTreeNode,
} from "../components/content/CurriculumTreeView";

export type CurriculumCategorySummary = {
  id: string;
  title: string;
  topicCount: number;
  subtopicCount: number;
};

export type CurriculumTopicSummary = {
  id: string;
  title: string;
  category: string;
  subtopicCount: number;
};

export type CurriculumCategoryInput =
  | CurriculumCategorySummary
  | Pick<CurriculumTopicSummary, "category">
  | Pick<CurriculumSubTopicNode, "category">
  | string;

export type CurriculumTopicInput =
  | CurriculumTopicSummary
  | Pick<CurriculumSubTopicNode, "category" | "topic">;

export function getAllCurriculumCategories(
  nodes: CurriculumTreeNode[] = generatedCurriculumTree
): CurriculumCategorySummary[] {
  const categoriesByTitle = new Map<
    string,
    CurriculumCategorySummary & { topicKeys: Set<string> }
  >();

  collectSubTopicNodes(nodes).forEach((subtopic) => {
    const existingCategory = categoriesByTitle.get(subtopic.category);
    const topicKey = getTopicKey(subtopic.category, subtopic.topic);

    if (existingCategory) {
      existingCategory.topicKeys.add(topicKey);
      categoriesByTitle.set(subtopic.category, {
        ...existingCategory,
        topicCount: existingCategory.topicKeys.size,
        subtopicCount: existingCategory.subtopicCount + 1,
      });
      return;
    }

    categoriesByTitle.set(subtopic.category, {
      id: toCategoryId(subtopic.category),
      title: subtopic.category,
      topicCount: 1,
      subtopicCount: 1,
      topicKeys: new Set([topicKey]),
    });
  });

  return Array.from(categoriesByTitle.values()).map(
    ({ topicKeys, ...category }) => {
      void topicKeys;

      return category;
    }
  );
}

export function getAllCurriculumTopics(
  nodes: CurriculumTreeNode[] = generatedCurriculumTree
): CurriculumTopicSummary[] {
  const topicsByKey = new Map<string, CurriculumTopicSummary>();

  collectSubTopicNodes(nodes).forEach((subtopic) => {
    const key = getTopicKey(subtopic.category, subtopic.topic);
    const existingTopic = topicsByKey.get(key);

    if (existingTopic) {
      topicsByKey.set(key, {
        ...existingTopic,
        subtopicCount: existingTopic.subtopicCount + 1,
      });
      return;
    }

    topicsByKey.set(key, {
      id: toTopicId(subtopic.category, subtopic.topic),
      title: subtopic.topic,
      category: subtopic.category,
      subtopicCount: 1,
    });
  });

  return Array.from(topicsByKey.values());
}

export function getCurriculumTopicsByCategory(
  category: CurriculumCategoryInput,
  nodes: CurriculumTreeNode[] = generatedCurriculumTree
): CurriculumTopicSummary[] {
  const categoryTitle = getCategoryTitle(category);

  return getAllCurriculumTopics(nodes).filter(
    (topic) => topic.category === categoryTitle
  );
}

export function getCurriculumSubTopicsByTopic(
  topic: CurriculumTopicInput,
  nodes: CurriculumTreeNode[] = generatedCurriculumTree
): CurriculumSubTopicNode[] {
  const topicTitle = "title" in topic ? topic.title : topic.topic;

  return collectSubTopicNodes(nodes).filter(
    (subtopic) =>
      subtopic.category === topic.category && subtopic.topic === topicTitle
  );
}

function getCategoryTitle(category: CurriculumCategoryInput) {
  if (typeof category === "string") {
    return category;
  }

  if ("title" in category) {
    return category.title;
  }

  return category.category;
}

function getTopicKey(category: string, topic: string) {
  return `${category}::${topic}`;
}

function toCategoryId(category: string) {
  return (
    category
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "category"
  );
}

function toTopicId(category: string, topic: string) {
  return (
    getTopicKey(category, topic)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "topic"
  );
}
