import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

import { Box, Link, Typography } from '@mui/material';

type Props = {
  markdown: string;
};

/**
 * Markdown renderer that maps elements to MUI components.
 * Supports:
 * - headings -> Typography
 * - paragraphs -> Typography
 * - links -> MUI Link
 * - images -> responsive img
 * - code blocks -> <pre><code> with syntax highlighting (rehype-highlight)
 */
export const KnowledgeMarkdown: React.FC<Props> = ({ markdown }) => {
  return (
    <Box
      sx={{
        '& img': {
          maxWidth: '100%',
          height: 'auto',
          borderRadius: 1,
          display: 'block',
          marginTop: 1,
          marginBottom: 1,
        },
        '& pre': {
          overflow: 'auto',
          padding: 2,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper',
        },
        '& code': {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: '0.9em',
        },
        '& blockquote': {
          borderLeft: '4px solid',
          borderColor: 'divider',
          margin: 0,
          paddingLeft: 2,
          color: 'text.secondary',
        },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          h1: ({ children }) => <Typography variant="h4" sx={{ mt: 2, mb: 1 }}>{children}</Typography>,
          h2: ({ children }) => <Typography variant="h5" sx={{ mt: 2, mb: 1 }}>{children}</Typography>,
          h3: ({ children }) => <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>{children}</Typography>,
          p: ({ children }) => <Typography variant="body1" sx={{ mb: 1.25 }}>{children}</Typography>,
          a: ({ href, children }) => (
            <Link href={href} target="_blank" rel="noreferrer">
              {children}
            </Link>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </Box>
  );
};