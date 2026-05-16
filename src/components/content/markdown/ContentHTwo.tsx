import type { HTMLAttributes } from "react";
import { mergeClassNames } from "./markdownUtils";

export type ContentHTwoProps = HTMLAttributes<HTMLHeadingElement>;

export function ContentHTwo({ className, children, ...props }: ContentHTwoProps) {
  return (
    <h2
      className={mergeClassNames(
        "gleeple-heading border-l-4 border-l-[var(--color-primary-container)] py-1 pl-6 text-2xl font-semibold leading-snug theme-text md:text-3xl",
        className
      )}
      {...props}
    >
      {children}
    </h2>
  );
}
