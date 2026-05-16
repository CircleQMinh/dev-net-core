import type { HTMLAttributes } from "react";
import { mergeClassNames } from "./markdownUtils";

export type ContentParagraphProps = HTMLAttributes<HTMLParagraphElement>;

export function ContentParagraph({
  className,
  children,
  ...props
}: ContentParagraphProps) {
  return (
    <p
      className={mergeClassNames(
        "markdown-content-paragraph text-base leading-8 theme-muted md:text-[17px]",
        className
      )}
      {...props}
    >
      {children}
    </p>
  );
}
