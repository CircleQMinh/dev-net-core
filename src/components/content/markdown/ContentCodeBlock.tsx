import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import TerminalOutlinedIcon from "@mui/icons-material/TerminalOutlined";
import { useState } from "react";
import { isValidElement } from "react";
import type { HTMLAttributes, ReactElement, ReactNode } from "react";
import {
  extractTextFromChildren,
  formatLanguageLabel,
  getLanguageFromClassName,
  mergeClassNames,
} from "./markdownUtils";

export type ContentCodeBlockProps = HTMLAttributes<HTMLPreElement> & {
  code?: string;
  fileName?: string;
  language?: string;
  showCopyButton?: boolean;
};

type CodeElementProps = {
  children?: ReactNode;
  className?: string;
};

function getCodeElement(children: ReactNode) {
  if (
    isValidElement<CodeElementProps>(children) &&
    typeof children.type === "string" &&
    children.type === "code"
  ) {
    return children as ReactElement<CodeElementProps>;
  }

  return null;
}

export function ContentCodeBlock({
  children,
  className,
  code,
  fileName,
  language,
  showCopyButton = true,
  ...props
}: ContentCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const codeElement = getCodeElement(children);
  const resolvedLanguage =
    language ??
    getLanguageFromClassName(className) ??
    getLanguageFromClassName(codeElement?.props.className);
  const label = fileName ?? formatLanguageLabel(resolvedLanguage);
  const content = code ?? extractTextFromChildren(codeElement ?? children);

  const copyCode = async () => {
    if (!content || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <figure className="space-y-4">
      <figcaption className="flex items-center justify-between px-1">
        <span className="flex items-center gap-3">
          <TerminalOutlinedIcon
            className="theme-accent"
            sx={{ fontSize: 18 }}
          />
          <span className="markdown-content-code text-sm uppercase tracking-[0.18em] theme-muted">
            {label}
          </span>
        </span>

        {showCopyButton ? (
          <button
            className="gleeple-heading flex cursor-pointer items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] theme-subtle transition-colors hover:text-[var(--color-primary-container)]"
            onClick={copyCode}
            type="button"
          >
            {copied ? (
              <CheckOutlinedIcon sx={{ fontSize: 15 }} />
            ) : (
              <ContentCopyOutlinedIcon sx={{ fontSize: 15 }} />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        ) : null}
      </figcaption>

      <div className="theme-content-card overflow-hidden rounded-lg shadow-2xl">
        <pre
          className={mergeClassNames(
            "content-scrollbar markdown-content-code overflow-x-auto bg-[var(--color-code-surface)] p-6 text-sm leading-7 selection:bg-[var(--color-accent-soft)]",
            className
          )}
          {...props}
        >
          {codeElement ? (
            codeElement
          ) : (
            <code className={resolvedLanguage ? `language-${resolvedLanguage}` : undefined}>
              {children ?? code}
            </code>
          )}
        </pre>
      </div>
    </figure>
  );
}
