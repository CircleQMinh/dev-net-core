import type { HTMLAttributes } from "react";
import { mergeClassNames } from "./markdownUtils";

export type ContentHThreeProps = HTMLAttributes<HTMLHeadingElement>;

export function ContentHThree({
  className,
  children,
  ...props
}: ContentHThreeProps) {
  return (
    <h3
      className={mergeClassNames(
        "gleeple-heading text-2xl font-semibold leading-snug theme-text",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}
