/* eslint-disable @typescript-eslint/no-unused-vars */
import { parseMarkdown } from './function';
import type { KnowledgeItem } from './knowledgeBase';
const modules = import.meta.glob('../contents/knowledge/**/*.md', {
  as: 'raw',
  eager: true,
});

export const knowledgeItems = Object.entries(modules).map(([_, raw]) => {
  const { frontmatter, content } = parseMarkdown(raw as string);

  return {
    id: frontmatter.id,
    topic: frontmatter.topic,
    category: frontmatter.category,
    bodyMarkdown: content,
  } as KnowledgeItem;
});