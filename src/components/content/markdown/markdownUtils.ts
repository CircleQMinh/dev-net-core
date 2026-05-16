import { isValidElement } from "react";
import type { ReactNode } from "react";

export function mergeClassNames(
  ...classNames: Array<string | false | null | undefined>
) {
  return classNames.filter(Boolean).join(" ");
}

export function extractTextFromChildren(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(children)) {
    return extractTextFromChildren(children.props.children);
  }

  return "";
}

export function getLanguageFromClassName(className?: string) {
  return className?.match(/language-([\w-]+)/)?.[1];
}

export function formatLanguageLabel(language?: string) {
  if (!language) {
    return "Code";
  }

  const labels: Record<string, string> = {
    bash: "Bash",
    csharp: "C#",
    cs: "C#",
    css: "CSS",
    html: "HTML",
    javascript: "JavaScript",
    js: "JavaScript",
    json: "JSON",
    jsx: "JSX",
    powershell: "PowerShell",
    ps1: "PowerShell",
    shell: "Shell",
    sql: "SQL",
    ts: "TypeScript",
    tsx: "TSX",
    typescript: "TypeScript",
    xml: "XML",
    yaml: "YAML",
    yml: "YAML",
  };

  return labels[language.toLowerCase()] ?? language.toUpperCase();
}
