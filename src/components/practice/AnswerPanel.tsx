import ContactSupportOutlinedIcon from "@mui/icons-material/ContactSupportOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { Button } from "@mui/material";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import {
  ContentCodeBlock,
  ContentLink,
} from "../content/markdown";

export type AnswerPanelProps = {
  expectedAnswerMarkdown: string;
  isRevealed: boolean;
  keyPointsMarkdown: string;
  onToggle: () => void;
};

function removeMarkdownNodeProp<TProps extends { node?: unknown }>(
  props: TProps
) {
  const { node, ...propsWithoutNode } = props;
  void node;

  return propsWithoutNode;
}

const answerMarkdownComponents: Components = {
  p: ({ children }) => (
    <p className="text-base leading-8 theme-muted md:text-[17px]">
      {children}
    </p>
  ),
  a: ({ href, children }) => (
    <ContentLink href={href}>{children}</ContentLink>
  ),
  pre: ({ children, ...props }) => (
    <ContentCodeBlock {...removeMarkdownNodeProp(props)}>
      {children}
    </ContentCodeBlock>
  ),
  code: ({ children, className, ...props }) => (
    <code className={className} {...removeMarkdownNodeProp(props)}>
      {children}
    </code>
  ),
  ul: ({ children }) => (
    <ul className="list-disc space-y-2 pl-6 theme-muted">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-2 pl-6 theme-muted">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-7">{children}</li>,
};

function AnswerMarkdown({ markdown }: { markdown: string }) {
  if (!markdown.trim()) {
    return <p className="leading-7 theme-muted">No answer content found.</p>;
  }

  return (
    <div className="space-y-4">
      <ReactMarkdown
        components={answerMarkdownComponents}
        rehypePlugins={[rehypeHighlight]}
        remarkPlugins={[remarkGfm]}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

export function AnswerPanel({
  expectedAnswerMarkdown,
  isRevealed,
  keyPointsMarkdown,
  onToggle,
}: AnswerPanelProps) {
  return (
    <section className="theme-content-card rounded-xl border-2 border-dashed border-[var(--color-outline-variant)] p-8">
      {!isRevealed ? (
        <div className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-container-high)] theme-subtle">
            <LockOutlinedIcon sx={{ fontSize: 28 }} />
          </div>
          <p className="text-base leading-8 theme-muted md:text-lg">
            Think through your answer first, then reveal the expected answer and
            key points.
          </p>
          <Button
            onClick={onToggle}
            sx={{ borderRadius: 999, px: 6, py: 1.5 }}
            variant="contained"
          >
            Show Answer
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="gleeple-heading flex items-center gap-2 text-2xl font-semibold theme-text">
                <ContactSupportOutlinedIcon className="theme-accent" />
                Answer Revelation Panel
              </h2>
              <p className="mt-2 text-sm theme-muted">
                Compare your response against the expected answer and key
                points.
              </p>
            </div>
            <Button onClick={onToggle} variant="outlined">
              Hide Answer
            </Button>
          </div>

          <section className="space-y-4">
            <h3 className="gleeple-heading text-lg font-semibold theme-text">
              Expected Answer
            </h3>
            <AnswerMarkdown markdown={expectedAnswerMarkdown} />
          </section>

          <section className="space-y-4">
            <h3 className="gleeple-heading text-lg font-semibold theme-text">
              Key Points to Mention
            </h3>
            <AnswerMarkdown markdown={keyPointsMarkdown} />
          </section>
        </div>
      )}
    </section>
  );
}
