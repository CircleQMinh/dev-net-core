export type ParsedMarkdown = {
  frontmatter: Record<string, string>;
  content: string;
};

export function parseMarkdown(raw: string): ParsedMarkdown {
  // Normalize Windows CRLF -> LF so all parsing is consistent
  const text = raw.replace(/\r\n/g, "\n");

  // Match YAML-like frontmatter at the very top
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);

  if (!match) {
    return { frontmatter: {}, content: text.trim() };
  }

  const frontmatterBlock = match[1];
  const content = text.slice(match[0].length).trim();

  const frontmatter: Record<string, string> = {};

  for (const line of frontmatterBlock.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;

    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();

    frontmatter[key] = value;
  }

  return { frontmatter, content };
}
