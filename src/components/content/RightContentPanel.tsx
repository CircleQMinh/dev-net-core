import { useMemo } from "react";
import { ContentProgressSection } from "./ContentProgressSection";
import type { CurriculumSubTopicNode } from "./CurriculumTreeView";
import {
  OnThisPageNavigation,
  type QuickNavigationItem,
} from "./OnThisPageNavigation";
import {
  getMarkdownHeadings,
  type MarkdownHeadingNode,
} from "./markdown";

type RightContentPanelProps = {
  markdown: string;
  showInterviewPractice: boolean;
  topic?: CurriculumSubTopicNode;
};

const INTERVIEW_PRACTICE_NAVIGATION_ITEM: QuickNavigationItem = {
  id: "interview-questions",
  label: "Interview Practice",
};

export function RightContentPanel({
  markdown,
  showInterviewPractice,
  topic,
}: RightContentPanelProps) {
  const navigationItems = useMemo<QuickNavigationItem[]>(() => {
    const items = toQuickNavigationItems(getMarkdownHeadings(markdown, 2));

    return showInterviewPractice
      ? appendInterviewPracticeNavigationItem(items)
      : removeNavigationItemById(
          items,
          INTERVIEW_PRACTICE_NAVIGATION_ITEM.id
        );
  }, [markdown, showInterviewPractice]);

  return (
    <aside className="content-scrollbar sticky top-[80px] hidden h-[calc(100vh-80px)] w-72 shrink-0 flex-col overflow-y-auto border-l theme-ide-pane theme-ide-divider xl:flex">
      {topic ? (
        <div className="border-b p-6 theme-ide-divider">
          <ContentProgressSection topic={topic} />
        </div>
      ) : null}
      <OnThisPageNavigation items={navigationItems} />
    </aside>
  );
}

function toQuickNavigationItems(
  headingTree: MarkdownHeadingNode
): QuickNavigationItem[] {
  return headingTree.children.map((heading) => ({
    id: heading.id,
    label: heading.title,
    children:
      heading.children.length > 0
        ? toQuickNavigationItems(heading)
        : undefined,
  }));
}

function appendInterviewPracticeNavigationItem(
  items: QuickNavigationItem[]
): QuickNavigationItem[] {
  const itemsWithoutInterviewPractice = removeNavigationItemById(
    items,
    INTERVIEW_PRACTICE_NAVIGATION_ITEM.id
  );
  const itemsWithCoreConceptsSibling = appendNavigationItemAsSiblingOf(
    itemsWithoutInterviewPractice,
    "core-concepts",
    INTERVIEW_PRACTICE_NAVIGATION_ITEM
  );

  return (
    itemsWithCoreConceptsSibling ?? [
      ...itemsWithoutInterviewPractice,
      INTERVIEW_PRACTICE_NAVIGATION_ITEM,
    ]
  );
}

function removeNavigationItemById(
  items: QuickNavigationItem[],
  itemId: string
): QuickNavigationItem[] {
  return items
    .filter((item) => item.id !== itemId)
    .map((item) => ({
      ...item,
      children: item.children
        ? removeNavigationItemById(item.children, itemId)
        : undefined,
    }));
}

function appendNavigationItemAsSiblingOf(
  items: QuickNavigationItem[],
  siblingItemId: string,
  itemToAppend: QuickNavigationItem
): QuickNavigationItem[] | undefined {
  if (items.some((item) => item.id === siblingItemId)) {
    return [...items, itemToAppend];
  }

  for (const item of items) {
    if (!item.children) {
      continue;
    }

    const updatedChildren = appendNavigationItemAsSiblingOf(
      item.children,
      siblingItemId,
      itemToAppend
    );

    if (updatedChildren) {
      return items.map((currentItem) =>
        currentItem.id === item.id
          ? {
              ...currentItem,
              children: updatedChildren,
            }
          : currentItem
      );
    }
  }

  return undefined;
}
