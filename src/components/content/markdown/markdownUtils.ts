import { isValidElement } from "react";
import type { ReactNode } from "react";

export type MarkdownHeadingNode = {
  id: string;
  title: string;
  children: MarkdownHeadingNode[];
};

type ParsedMarkdownHeading = {
  id: string;
  level: number;
  title: string;
};

type MarkdownSectionRange = {
  startLine: number;
  endLine: number;
  headingLevel: number;
};

export type CommonInterviewQuestion = {
  id: string;
  level: string;
  label: string;
  question: string;
  markdown: string;
  expectedAnswerMarkdown: string;
  keyPointsMarkdown: string;
};

const COMMON_INTERVIEW_QUESTIONS_HEADING = "Common Interview Questions";

export function mergeClassNames(
  ...classNames: Array<string | false | null | undefined>
) {
  return classNames.filter(Boolean).join(" ");
}

export function getMarkdownHeadings(
  markdown: string,
  level: number = 1
): MarkdownHeadingNode {
  const maxDepth = Math.max(1, Math.min(6, Math.trunc(level)));
  const root: MarkdownHeadingNode = {
    id: "root",
    title: "Root",
    children: [],
  };
  const parsedHeadings = parseMarkdownHeadings(removeCommentFromMD(markdown));
  const baseLevel = Math.min(...parsedHeadings.map((heading) => heading.level));

  if (!Number.isFinite(baseLevel)) {
    return root;
  }

  const maxHeadingLevel = baseLevel + maxDepth - 1;
  const stack: Array<{ level: number; node: MarkdownHeadingNode }> = [
    { level: baseLevel - 1, node: root },
  ];

  parsedHeadings.forEach((heading) => {
    if (heading.level < baseLevel || heading.level > maxHeadingLevel) {
      return;
    }

    while (stack.length > 1 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }

    const node: MarkdownHeadingNode = {
      id: heading.id,
      title: heading.title,
      children: [],
    };

    stack[stack.length - 1].node.children.push(node);
    stack.push({ level: heading.level, node });
  });

  return root;
}

export function removeCommentFromMD(markdown: string): string {
  return markdown.replace(/<!--[\s\S]*?-->/g, "");
}

export function removeCommonInterviewQuestionsSection(markdown: string): string {
  const sectionRange = findMarkdownSectionRange(
    markdown,
    COMMON_INTERVIEW_QUESTIONS_HEADING
  );

  if (!sectionRange) {
    return markdown;
  }

  const { eol, lines } = splitMarkdownLines(markdown);
  const beforeSection = lines.slice(0, sectionRange.startLine).join(eol).trimEnd();
  const afterSection = lines.slice(sectionRange.endLine).join(eol).trimStart();

  return [beforeSection, afterSection].filter(Boolean).join(`${eol}${eol}`);
}

export function extractCommonInterviewQuestionsSection(
  markdown: string,
  sectionLevel: string = ""
): string {
  const commonSectionRange = findMarkdownSectionRange(
    markdown,
    COMMON_INTERVIEW_QUESTIONS_HEADING
  );

  if (!commonSectionRange) {
    return "";
  }

  const { eol, lines } = splitMarkdownLines(markdown);
  const commonSection = lines
    .slice(commonSectionRange.startLine, commonSectionRange.endLine)
    .join(eol)
    .trim();

  if (!sectionLevel.trim()) {
    return commonSection;
  }

  const levelSectionRange = findMarkdownSectionRange(commonSection, sectionLevel);

  if (!levelSectionRange) {
    return "";
  }

  return splitMarkdownLines(commonSection)
    .lines.slice(levelSectionRange.startLine, levelSectionRange.endLine)
    .join(eol)
    .trim();
}

export function extractCommonInterviewQuestions(
  markdown: string,
  sectionLevel: string = ""
): CommonInterviewQuestion[] {
  const section = extractCommonInterviewQuestionsSection(markdown, sectionLevel);

  if (!section) {
    return [];
  }

  const { eol, lines } = splitMarkdownLines(section);
  const questions: CommonInterviewQuestion[] = [];
  let currentLevel = "";
  let isInCodeBlock = false;

  lines.forEach((line, index) => {
    if (/^\s{0,3}(```|~~~)/.test(line)) {
      isInCodeBlock = !isInCodeBlock;
      return;
    }

    if (isInCodeBlock) {
      return;
    }

    const heading = getMarkdownHeadingMatch(line);

    if (!heading) {
      return;
    }

    if (heading.level === 3) {
      currentLevel = heading.title;
      return;
    }

    if (heading.level !== 4) {
      return;
    }

    const nextQuestionIndex = findNextQuestionBoundary(lines, index + 1);
    const questionMarkdown = lines.slice(index, nextQuestionIndex).join(eol).trim();
    const parsedHeading = parseQuestionHeading(heading.title, currentLevel);
    const questionId =
      questionMarkdown.match(/<!--\s*question-id:([\w./:-]+)\s*-->/i)?.[1] ??
      createMarkdownHeadingId(heading.title);
    const questionLevel =
      questionMarkdown.match(/<!--\s*question-level:([\w -]+)\s*-->/i)?.[1] ??
      parsedHeading.level;

    questions.push({
      id: questionId.trim(),
      level: formatQuestionLevel(questionLevel),
      label: parsedHeading.label,
      question: parsedHeading.question,
      markdown: questionMarkdown,
      expectedAnswerMarkdown: extractMarkdownSectionBody(
        questionMarkdown,
        "Expected Answer"
      ),
      keyPointsMarkdown: extractMarkdownSectionBody(
        questionMarkdown,
        "Key Points to Mention"
      ),
    });
  });

  return questions;
}

function extractMarkdownSectionBody(markdown: string, headingTitle: string) {
  const sectionRange = findMarkdownSectionRange(markdown, headingTitle);

  if (!sectionRange) {
    return "";
  }

  const { eol, lines } = splitMarkdownLines(markdown);

  return removeCommentFromMD(
    lines
      .slice(sectionRange.startLine + 1, sectionRange.endLine)
      .join(eol)
      .trim()
  );
}

function parseMarkdownHeadings(markdown: string): ParsedMarkdownHeading[] {
  const headings: ParsedMarkdownHeading[] = [];
  let isInCodeBlock = false;

  markdown.split(/\r?\n/).forEach((line) => {
    if (/^\s{0,3}(```|~~~)/.test(line)) {
      isInCodeBlock = !isInCodeBlock;
      return;
    }

    if (isInCodeBlock || /^(?: {4}|\t)/.test(line)) {
      return;
    }

    const headingMatch = getMarkdownHeadingMatch(line);

    if (!headingMatch) {
      return;
    }

    headings.push({
      id: createMarkdownHeadingId(headingMatch.title),
      level: headingMatch.level,
      title: headingMatch.title,
    });
  });

  return headings;
}

function splitMarkdownLines(markdown: string) {
  return {
    eol: markdown.includes("\r\n") ? "\r\n" : "\n",
    lines: markdown.split(/\r?\n/),
  };
}

function findMarkdownSectionRange(
  markdown: string,
  headingTitle: string
): MarkdownSectionRange | undefined {
  const { lines } = splitMarkdownLines(markdown);
  const normalizedTargetTitle = normalizeMarkdownHeadingTitle(headingTitle);
  let sectionStartLine = -1;
  let sectionHeadingLevel = 0;
  let isInCodeBlock = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (/^\s{0,3}(```|~~~)/.test(line)) {
      isInCodeBlock = !isInCodeBlock;
      continue;
    }

    if (isInCodeBlock || /^(?: {4}|\t)/.test(line)) {
      continue;
    }

    const heading = getMarkdownHeadingMatch(line);

    if (!heading) {
      continue;
    }

    if (sectionStartLine === -1) {
      if (normalizeMarkdownHeadingTitle(heading.title) === normalizedTargetTitle) {
        sectionStartLine = index;
        sectionHeadingLevel = heading.level;
      }

      continue;
    }

    if (heading.level <= sectionHeadingLevel) {
      return {
        startLine: sectionStartLine,
        endLine: index,
        headingLevel: sectionHeadingLevel,
      };
    }
  }

  if (sectionStartLine === -1) {
    return undefined;
  }

  return {
    startLine: sectionStartLine,
    endLine: lines.length,
    headingLevel: sectionHeadingLevel,
  };
}

function getMarkdownHeadingMatch(line: string) {
  const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);

  if (!headingMatch) {
    return undefined;
  }

  const title = formatMarkdownHeadingText(headingMatch[2]);

  if (!title) {
    return undefined;
  }

  return {
    level: headingMatch[1].length,
    title,
  };
}

function normalizeMarkdownHeadingTitle(title: string) {
  return formatMarkdownHeadingText(title).toLowerCase();
}

function findNextQuestionBoundary(lines: string[], startIndex: number) {
  let isInCodeBlock = false;

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];

    if (/^\s{0,3}(```|~~~)/.test(line)) {
      isInCodeBlock = !isInCodeBlock;
      continue;
    }

    if (isInCodeBlock) {
      continue;
    }

    const heading = getMarkdownHeadingMatch(line);

    if (heading && heading.level <= 4) {
      return index;
    }
  }

  return lines.length;
}

function parseQuestionHeading(title: string, fallbackLevel: string) {
  const headingMatch = title.match(
    /^(?:(beginner|intermediate|advanced)\s+)?(q\d+)\s*:\s*(.+)$/i
  );

  if (!headingMatch) {
    return {
      level: fallbackLevel,
      label: "",
      question: title,
    };
  }

  return {
    level: headingMatch[1] ?? fallbackLevel,
    label: headingMatch[2].toUpperCase(),
    question: headingMatch[3].trim(),
  };
}

function formatQuestionLevel(level: string) {
  const normalizedLevel = level.trim().toLowerCase();

  if (!normalizedLevel) {
    return "General";
  }

  return `${normalizedLevel.charAt(0).toUpperCase()}${normalizedLevel.slice(1)}`;
}

export function createMarkdownHeadingId(text: string) {
  return (
    formatMarkdownHeadingText(text)
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section"
  );
}

function formatMarkdownHeadingText(text: string) {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim();
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
