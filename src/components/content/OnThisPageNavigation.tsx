import { useEffect, useMemo, useState } from "react";

export type QuickNavigationItem = {
  id: string;
  label: string;
  children?: QuickNavigationItem[];
};

type OnThisPageNavigationProps = {
  items?: QuickNavigationItem[];
  initialActiveId?: string;
};

const defaultItems: QuickNavigationItem[] = [
  { id: "overview", label: "Overview" },
  { id: "key-concepts", label: "Key Concepts" },
  { id: "service-lifetimes", label: "Service Lifetimes" },
  { id: "code-example", label: "Code Example" },
  { id: "simulation", label: "Simulation" },
  { id: "summary", label: "Summary" },
  { id: "interview-questions", label: "Interview Practice" },
];

export function OnThisPageNavigation({
  items = defaultItems,
  initialActiveId = "overview",
}: OnThisPageNavigationProps) {
  const resolvedInitialActiveId = useMemo(() => {
    return hasNavigationItem(items, initialActiveId)
      ? initialActiveId
      : getFirstNavigationItemId(items) ?? initialActiveId;
  }, [initialActiveId, items]);
  const [activeId, setActiveId] = useState(resolvedInitialActiveId);

  useEffect(() => {
    setActiveId(resolvedInitialActiveId);
  }, [resolvedInitialActiveId]);

  return (
    <nav aria-label="On this page" className="p-4">
      <h2 className="gleeple-heading mb-4 text-[10px] font-semibold uppercase tracking-widest theme-subtle">
        On This Page
      </h2>

      <div className="relative ml-2 space-y-4 border-l theme-ide-divider">
        {items.map((item) => (
          <NavigationItem
            activeId={activeId}
            depth={0}
            item={item}
            key={item.id}
            onActivate={setActiveId}
          />
        ))}
      </div>
    </nav>
  );
}

type NavigationItemProps = {
  activeId: string;
  depth: number;
  item: QuickNavigationItem;
  onActivate: (itemId: string) => void;
};

function NavigationItem({
  activeId,
  depth,
  item,
  onActivate,
}: NavigationItemProps) {
  const isActive = activeId === item.id;
  const children = item.children ?? [];

  return (
    <div>
      <div className={`relative ${getNavigationIndentClass(depth)}`}>
        {isActive ? (
          <span className="absolute bottom-0 left-[-1px] top-0 w-0.5 bg-[var(--color-primary-container)]" />
        ) : null}
        <a
          aria-current={isActive ? "location" : undefined}
          className={`gleeple-heading block font-semibold uppercase leading-4 tracking-[0.04em] transition-colors ${getNavigationTextSizeClass(
            depth
          )} ${
            isActive
              ? "theme-accent hover:text-[var(--color-primary-container)]"
              : "theme-subtle hover:text-[var(--color-on-surface-variant)]"
          }`}
          href={`#${item.id}`}
          onClick={() => onActivate(item.id)}
        >
          {item.label}
        </a>
      </div>

      {children.length > 0 ? (
        <div className="mt-3 space-y-3">
          {children.map((child) => (
            <NavigationItem
              activeId={activeId}
              depth={depth + 1}
              item={child}
              key={child.id}
              onActivate={onActivate}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function hasNavigationItem(
  items: QuickNavigationItem[],
  itemId: string
): boolean {
  return items.some(
    (item) =>
      item.id === itemId || hasNavigationItem(item.children ?? [], itemId)
  );
}

function getFirstNavigationItemId(
  items: QuickNavigationItem[]
): string | undefined {
  const [firstItem] = items;

  return firstItem?.id;
}

function getNavigationIndentClass(depth: number): string {
  if (depth === 0) {
    return "pl-4";
  }

  if (depth === 1) {
    return "pl-8";
  }

  return "pl-12";
}

function getNavigationTextSizeClass(depth: number): string {
  if (depth === 0) {
    return "text-xs";
  }

  if (depth === 1) {
    return "text-[11px]";
  }

  return "text-[10px]";
}
