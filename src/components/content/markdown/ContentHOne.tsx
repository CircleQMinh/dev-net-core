import type { HTMLAttributes } from "react";
import { mergeClassNames } from "./markdownUtils";

export type ContentHOneProps = HTMLAttributes<HTMLHeadingElement>;

export function ContentHOne({ className, children, ...props }: ContentHOneProps) {
  return (
    <h1
      className={mergeClassNames(
        "gleeple-heading text-4xl font-bold leading-tight tracking-normal theme-text md:text-5xl",
        className
      )}
      {...props}
    >
      {children}
    </h1>
  );
}
