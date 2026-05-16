import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import type { AnchorHTMLAttributes } from "react";
import { mergeClassNames } from "./markdownUtils";

export type ContentLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  showExternalIcon?: boolean;
};

function isExternalLink(href?: string) {
  return Boolean(href && /^https?:\/\//i.test(href));
}

export function ContentLink({
  className,
  children,
  href,
  rel,
  showExternalIcon = false,
  target,
  ...props
}: ContentLinkProps) {
  const external = isExternalLink(href);
  const resolvedTarget = target ?? (external ? "_blank" : undefined);
  const resolvedRel =
    rel ?? (resolvedTarget === "_blank" ? "noreferrer noopener" : undefined);

  return (
    <a
      className={mergeClassNames(
        "inline-flex items-center gap-1 font-medium text-[var(--color-primary-container)] underline-offset-4 transition-all duration-200 hover:gap-2 hover:text-[var(--color-primary)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-container)] focus:ring-offset-2 focus:ring-offset-[var(--color-background)]",
        className
      )}
      href={href}
      rel={resolvedRel}
      target={resolvedTarget}
      {...props}
    >
      {children}
      {showExternalIcon && external ? (
        <OpenInNewOutlinedIcon sx={{ fontSize: 14 }} />
      ) : null}
    </a>
  );
}
