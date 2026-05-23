import { useMemo } from "react";
import {
  CurriculumTreeView,
  type CurriculumSubTopicNode,
} from "./CurriculumTreeView";
import {
  OnThisPageNavigation,
  type QuickNavigationItem,
} from "./OnThisPageNavigation";
import {
  getMarkdownHeadings,
  type MarkdownHeadingNode,
} from "./markdown";

type LeftContentPanelProps = {
  activeTopicId?: string;
  markdown: string;
  onTopicSelect: (topic: CurriculumSubTopicNode) => void;
};

const INTERVIEW_PRACTICE_NAVIGATION_ITEM: QuickNavigationItem = {
  id: "interview-questions",
  label: "Interview Practice",
};

export function LeftContentPanel({
  activeTopicId,
  markdown,
  onTopicSelect,
}: LeftContentPanelProps) {
  const navigationItems = useMemo<QuickNavigationItem[]>(() => {
    const items = toQuickNavigationItems(getMarkdownHeadings(markdown, 2));

    return appendInterviewPracticeNavigationItem(items);
  }, [markdown]);

  return (
    <aside className="sticky top-[80px] hidden h-[calc(100vh-80px)] w-[300px] shrink-0 flex-col overflow-hidden border-r theme-ide-pane theme-ide-divider lg:flex">
      <div className="content-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
        <CurriculumTreeView
          activeTopicId={activeTopicId}
          onTopicSelect={onTopicSelect}
        />
        <OnThisPageNavigation items={navigationItems} />
      </div>
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
