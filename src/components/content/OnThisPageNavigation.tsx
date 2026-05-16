import { useState } from "react";

export type QuickNavigationItem = {
  id: string;
  label: string;
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
  { id: "interview-questions", label: "Interview Questions" },
  { id: "summary", label: "Summary" },
];

export function OnThisPageNavigation({
  items = defaultItems,
  initialActiveId = "overview",
}: OnThisPageNavigationProps) {
  const [activeId, setActiveId] = useState(initialActiveId);

  return (
    <nav className="p-4" aria-label="On this page">
      <h2 className="gleeple-heading mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] theme-subtle">
        On This Page
      </h2>

      <div className="relative ml-2 space-y-4 border-l theme-ide-divider">
        {items.map((item) => {
          const isActive = activeId === item.id;

          return (
            <div className="relative pl-4" key={item.id}>
              {isActive ? (
                <span className="absolute bottom-0 left-[-1px] top-0 w-0.5 bg-[var(--color-primary-container)]" />
              ) : null}
              <a
                className={`gleeple-heading block text-xs font-semibold transition-colors ${
                  isActive
                    ? "theme-accent"
                    : "theme-subtle hover:text-[var(--color-on-surface-variant)]"
                }`}
                href={`#${item.id}`}
                onClick={() => setActiveId(item.id)}
              >
                {item.label}
              </a>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
