import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ContactSupportOutlinedIcon from "@mui/icons-material/ContactSupportOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import IntegrationInstructionsOutlinedIcon from "@mui/icons-material/IntegrationInstructionsOutlined";
import { Button } from "@mui/material";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { Link as RouterLink } from "react-router-dom";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import {
  getCurriculumSubTopicNavigation,
  type CurriculumSubTopicNode,
} from "./CurriculumTreeView";
import {
  createMarkdownHeadingId,
  ContentCodeBlock,
  ContentHOne,
  ContentHThree,
  ContentHTwo,
  ContentImage,
  ContentLink,
  ContentParagraph,
  extractCommonInterviewQuestions,
  removeCommonInterviewQuestionsSection,
  removeCommentFromMD,
  type CommonInterviewQuestion,
} from "./markdown";
import { extractTextFromChildren } from "./markdown/markdownUtils";

type LearningTab = {
  label: string;
  icon: ReactNode;
  active?: boolean;
};

type ServiceLifetime = {
  title: string;
  description: string;
  textClass: string;
  dotClass: string;
};

type CodeRow = {
  line: number;
  content?: ReactNode;
};

type InterviewQuestion = {
  level: string;
  category: string;
  question: string;
  accentClass: string;
  badgeClass: string;
};

type PracticeLevel = "Beginner" | "Intermediate" | "Advanced";

type PracticeLevelSummary = {
  level: PracticeLevel;
  questionCount: number;
};

type MainContentProps = {
  topic?: CurriculumSubTopicNode;
  markdown?: string;
};

const practiceLevels: PracticeLevel[] = [
  "Beginner",
  "Intermediate",
  "Advanced",
];

const tabs: LearningTab[] = [
  {
    label: "Explanation",
    icon: <ArticleOutlinedIcon sx={{ fontSize: 16 }} />,
    active: true,
  },
  // {
  //   label: "Example",
  //   icon: <CodeOutlinedIcon sx={{ fontSize: 16 }} />,
  // },
  // {
  //   label: "Simulation",
  //   icon: <PlayCircleOutlineIcon sx={{ fontSize: 16 }} />,
  // },
  // {
  //   label: "Docs",
  //   icon: <MenuBookOutlinedIcon sx={{ fontSize: 16 }} />,
  // },
];

const serviceLifetimes: ServiceLifetime[] = [
  {
    title: "Singleton",
    description: "Created once for the application's lifetime.",
    textClass: "text-[var(--color-primary-container)]",
    dotClass: "bg-[var(--color-primary-container)]",
  },
  {
    title: "Scoped",
    description: "Created once per client request connection.",
    textClass: "text-[var(--color-secondary)]",
    dotClass: "bg-[var(--color-secondary)]",
  },
  {
    title: "Transient",
    description: "Created every time they are requested.",
    textClass: "text-[var(--color-tertiary)]",
    dotClass: "bg-[var(--color-tertiary)]",
  },
];

const codeRows: CodeRow[] = [
  {
    line: 1,
    content: (
      <span className="theme-muted">
        var builder = WebApplication.CreateBuilder(args);
      </span>
    ),
  },
  { line: 2 },
  {
    line: 3,
    content: (
      <span className="theme-muted">
        // Register services with different lifetimes
      </span>
    ),
  },
  {
    line: 4,
    content: (
      <>
        <span className="theme-text">{"builder.Services.AddSingleton<"}</span>
        <span className="text-[var(--color-primary-container)]">
          IMySingleton
        </span>
        <span className="theme-text">{">, MySingleton>();"}</span>
      </>
    ),
  },
  {
    line: 5,
    content: (
      <>
        <span className="theme-text">{"builder.Services.AddScoped<"}</span>
        <span className="text-[var(--color-secondary)]">IMyScoped</span>
        <span className="theme-text">{">, MyScoped>();"}</span>
      </>
    ),
  },
  {
    line: 6,
    content: (
      <>
        <span className="theme-text">{"builder.Services.AddTransient<"}</span>
        <span className="text-[var(--color-tertiary)]">IMyTransient</span>
        <span className="theme-text">{">, MyTransient>();"}</span>
      </>
    ),
  },
  { line: 7 },
  {
    line: 8,
    content: <span className="theme-muted">var app = builder.Build();</span>,
  },
];

const interviewQuestions: InterviewQuestion[] = [
  {
    level: "Medium",
    category: "Architectural Design",
    question:
      "Explain the difference between Scoped and Transient service lifetimes?",
    accentClass: "border-l-[var(--color-secondary)]",
    badgeClass:
      "border-[color-mix(in_srgb,var(--color-secondary)_28%,transparent)] bg-[color-mix(in_srgb,var(--color-secondary)_12%,transparent)] text-[var(--color-secondary)]",
  },
  {
    level: "Hard",
    category: "Memory Management",
    question:
      "How does the DI container handle IDisposable objects for each lifetime?",
    accentClass: "border-l-[var(--color-tertiary)]",
    badgeClass:
      "border-[color-mix(in_srgb,var(--color-tertiary)_28%,transparent)] bg-[color-mix(in_srgb,var(--color-tertiary)_12%,transparent)] text-[var(--color-tertiary)]",
  },
];

function removeMarkdownNodeProp<TProps extends { node?: unknown }>(
  props: TProps
) {
  const { node, ...propsWithoutNode } = props;
  void node;

  return propsWithoutNode;
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <ContentHOne id={createMarkdownHeadingId(extractTextFromChildren(children))}>
      {children}
    </ContentHOne>
  ),
  h2: ({ children }) => (
    <ContentHTwo id={createMarkdownHeadingId(extractTextFromChildren(children))}>
      {children}
    </ContentHTwo>
  ),
  h3: ({ children }) => (
    <ContentHThree
      id={createMarkdownHeadingId(extractTextFromChildren(children))}
    >
      {children}
    </ContentHThree>
  ),
  p: ({ children }) => <ContentParagraph>{children}</ContentParagraph>,
  a: ({ href, children }) => (
    <ContentLink href={href}>{children}</ContentLink>
  ),
  img: ({ alt, src, title }) => (
    <ContentImage alt={alt ?? ""} caption={title} src={src} />
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
  table: ({ children }) => (
    <div className="content-scrollbar overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm theme-text">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b theme-ide-divider">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-4 py-3 font-semibold theme-text">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b px-4 py-3 align-top theme-ide-divider theme-muted">
      {children}
    </td>
  ),
  ul: ({ children }) => (
    <ul className="list-disc space-y-3 pl-6 theme-muted">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-3 pl-6 theme-muted">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-base leading-8 md:text-[17px]">{children}</li>
  ),
};

function SelectedTopicContent({
  markdown,
  topic,
}: {
  markdown: string;
  topic: CurriculumSubTopicNode;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { nextSubTopic, previousSubTopic } =
    getCurriculumSubTopicNavigation(topic.id);
  const interviewQuestions = extractCommonInterviewQuestions(markdown);
  const displayMarkdown = removeCommentFromMD(
    removeCommonInterviewQuestionsSection(markdown)
  );

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: -400 });
    window.scrollTo(0, 0)
  }, [topic.id]);

  return (
    <section className="flex min-w-0 flex-1 flex-col theme-ide-surface" >
      <div className="flex h-12 items-center overflow-x-auto border-b theme-ide-divider bg-[var(--color-surface-container-lowest)]"  ref={scrollContainerRef}>
        {tabs.map((tab) => (
          <button
            className={`gleeple-heading flex h-full shrink-0 cursor-pointer items-center gap-2 border-r px-6 text-xs font-semibold uppercase transition-colors theme-ide-divider ${
              tab.active
                ? "border-t-2 border-t-[var(--color-primary-container)] bg-[var(--color-background)] theme-accent"
                : "theme-subtle theme-ide-hover"
            }`}
            key={tab.label}
            type="button"
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className="content-scrollbar flex-1 space-y-10 overflow-y-auto p-6"
       
      >
        <header className="space-y-4" id="overview">
          <div className="flex flex-wrap items-center gap-2">
            <span className="theme-badge rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]">
              {topic.category}
            </span>
            <span className="gleeple-heading text-[10px] font-semibold uppercase theme-subtle">
              {topic.topic}
            </span>
          </div>

          <ContentHOne>{topic.subtopic}</ContentHOne>
        </header>

        {displayMarkdown.trim() ? (
          <article className="space-y-8">
            <ReactMarkdown
              components={markdownComponents}
              rehypePlugins={[rehypeHighlight]}
              remarkPlugins={[remarkGfm]}
            >
              {displayMarkdown}
            </ReactMarkdown>
          </article>
        ) : (
          <article className="theme-content-card rounded-lg p-6">
            <ContentParagraph>
              Content for this topic has not been added yet.
            </ContentParagraph>
          </article>
        )}

        <InterviewQuestionsSection
          questions={interviewQuestions}
          topicId={topic.id}
        />

        <TopicNavigation
          nextTopic={nextSubTopic}
          previousTopic={previousSubTopic}
        />
      </div>
    </section>
  );
}

function InterviewQuestionsSection({
  questions,
  topicId,
}: {
  questions: CommonInterviewQuestion[];
  topicId: string;
}) {
  const practicePath = `/practice/${topicId}/`;
  const summaries = getPracticeLevelSummaries(questions);

  return (
    <section className="space-y-6" id="interview-questions">
      <h2 className="gleeple-heading flex items-center gap-2 text-2xl font-semibold theme-text">
        <ContactSupportOutlinedIcon className="theme-accent" />
        Interview Practice
      </h2>

      <div className="grid grid-cols-1 gap-4">
        {summaries.map((item) => {
          const classes = getInterviewQuestionLevelClasses(item.level);
          const questionLabel =
            item.questionCount === 1 ? "question" : "questions";

          return (
            <RouterLink
              className={`theme-content-card theme-content-card-interactive flex items-center justify-between rounded-lg border-l-4 p-5 text-left no-underline ${classes.accentClass}`}
              key={item.level}
              state={{ practiceLevel: item.level.toLowerCase() }}
              to={practicePath}
            >
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`gleeple-heading rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase ${classes.badgeClass}`}
                  >
                    {item.level}
                  </span>
                  <span className="text-xs theme-subtle">
                    {item.questionCount} {questionLabel}
                  </span>
                </div>
                <h3 className="text-lg font-medium leading-7 theme-text">
                  {item.level} Interview Practice
                </h3>
                <p className="text-sm leading-6 theme-muted">
                  Practice the {item.level.toLowerCase()} questions for this
                  topic.
                </p>
              </div>
              <ChevronRightIcon className="ml-4 shrink-0 theme-subtle" />
            </RouterLink>
          );
        })}
      </div>
    </section>
  );
}

function getPracticeLevelSummaries(
  questions: CommonInterviewQuestion[]
): PracticeLevelSummary[] {
  return practiceLevels.map((level) => ({
    level,
    questionCount: questions.filter((question) => question.level === level)
      .length,
  }));
}

function getInterviewQuestionLevelClasses(level: string) {
  const normalizedLevel = level.toLowerCase();

  if (normalizedLevel === "advanced") {
    return {
      accentClass: "border-l-[var(--color-tertiary)]",
      badgeClass:
        "border-[color-mix(in_srgb,var(--color-tertiary)_28%,transparent)] bg-[color-mix(in_srgb,var(--color-tertiary)_12%,transparent)] text-[var(--color-tertiary)]",
    };
  }

  if (normalizedLevel === "intermediate") {
    return {
      accentClass: "border-l-[var(--color-secondary)]",
      badgeClass:
        "border-[color-mix(in_srgb,var(--color-secondary)_28%,transparent)] bg-[color-mix(in_srgb,var(--color-secondary)_12%,transparent)] text-[var(--color-secondary)]",
    };
  }

  return {
    accentClass: "border-l-[var(--color-primary-container)]",
    badgeClass:
      "border-[color-mix(in_srgb,var(--color-primary-container)_28%,transparent)] bg-[color-mix(in_srgb,var(--color-primary-container)_12%,transparent)] text-[var(--color-primary-container)]",
  };
}

function TopicNavigation({
  nextTopic,
  previousTopic,
}: {
  nextTopic?: CurriculumSubTopicNode;
  previousTopic?: CurriculumSubTopicNode;
}) {
  return (
    <section className="border-t pt-12 theme-ide-divider" id="summary">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between">
        <Button
          className="!justify-start !px-6 !py-3"
          component={previousTopic ? RouterLink : "button"}
          disabled={!previousTopic}
          startIcon={<ChevronLeftIcon />}
          sx={{
            borderColor: "var(--color-card-border)",
            color: "var(--color-on-surface)",
            minWidth: 184,
          }}
          to={previousTopic ? `/content/${previousTopic.id}/` : undefined}
          type={previousTopic ? undefined : "button"}
          variant="outlined"
        >
          <span className="flex flex-col items-start">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-subtle-text)]">
              Previous
            </span>
            <span className="text-sm font-bold uppercase">
              {previousTopic?.subtopic ?? "None"}
            </span>
          </span>
        </Button>

        <Button
          className="!justify-end !px-8 !py-3"
          component={nextTopic ? RouterLink : "button"}
          disabled={!nextTopic}
          endIcon={<ChevronRightIcon />}
          sx={{ flexGrow: 1 }}
          to={nextTopic ? `/content/${nextTopic.id}/` : undefined}
          type={nextTopic ? undefined : "button"}
          variant="contained"
        >
          <span className="flex flex-col items-end">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">
              Next Up
            </span>
            <span className="text-sm font-bold uppercase">
              {nextTopic?.subtopic ?? "Complete"}
            </span>
          </span>
        </Button>
      </div>
    </section>
  );
}

export function MainContent({ topic, markdown }: MainContentProps) {
  if (topic) {
    return <SelectedTopicContent markdown={markdown ?? ""} topic={topic} />;
  }

  return <DraftedContentDisplay />;
}

function DraftedContentDisplay() {
  return (
    <section className="flex min-w-0 flex-1 flex-col theme-ide-surface">
      <div className="flex h-12 items-center overflow-x-auto border-b theme-ide-divider bg-[var(--color-surface-container-lowest)]">
        {tabs.map((tab) => (
          <button
            className={`gleeple-heading flex h-full shrink-0 cursor-pointer items-center gap-2 border-r px-6 text-xs font-semibold uppercase transition-colors theme-ide-divider ${
              tab.active
                ? "border-t-2 border-t-[var(--color-primary-container)] bg-[var(--color-background)] theme-accent"
                : "theme-subtle theme-ide-hover"
            }`}
            key={tab.label}
            type="button"
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="content-scrollbar flex-1 space-y-12 overflow-y-auto p-6">
        <header id="overview">
          <div className="mb-2 flex items-center gap-2">
            <span className="theme-badge rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]">
              Advanced
            </span>
            <span className="gleeple-heading text-[10px] font-semibold uppercase theme-subtle">
              Est. Time: 15 Mins
            </span>
          </div>

          <h1 className="gleeple-heading mb-4 flex flex-wrap items-center gap-3 text-4xl font-semibold leading-tight text-[var(--color-primary)]">
            Dependency Injection in .NET
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10 shadow-[0_0_15px_rgba(34,197,94,0.2)]">
              <CheckCircleOutlineIcon
                className="text-emerald-400"
                sx={{ fontSize: 22 }}
              />
            </span>
          </h1>

          <p className="max-w-2xl text-lg leading-8 theme-muted">
            A design pattern used to implement IoC (Inversion of Control),
            allowing for better modularity, testing, and maintenance of .NET
            applications.
          </p>
        </header>

        <div
          className="grid grid-cols-1 gap-6 md:grid-cols-2"
          id="key-concepts"
        >
          <article className="theme-content-card theme-content-card-interactive rounded-lg p-6">
            <div className="theme-feature-icon mb-4 flex h-10 w-10 items-center justify-center rounded-sm">
              <AccountTreeOutlinedIcon />
            </div>
            <h2 className="gleeple-heading mb-3 text-2xl font-semibold theme-text">
              What is DI?
            </h2>
            <p className="mb-4 leading-7 theme-muted">
              Dependency Injection is a technique where an object receives other
              objects that it depends on. These other objects are called
              dependencies.
            </p>
            <div className="rounded-sm border-l-2 border-l-[var(--color-primary-container)] bg-[var(--color-surface-container)] p-4">
              <p className="gleeple-code text-xs italic text-[var(--color-primary-container)]">
                "Don't call us, we'll call you." - The Hollywood Principle
              </p>
            </div>
          </article>

          <article
            className="theme-content-card theme-content-card-interactive rounded-lg p-6"
            id="service-lifetimes"
          >
            <h2 className="gleeple-heading mb-6 text-2xl font-semibold theme-text">
              Service Lifetimes
            </h2>
            <div className="space-y-4">
              {serviceLifetimes.map((item) => (
                <div className="flex items-start gap-4" key={item.title}>
                  <span
                    className={`mt-2 h-2 w-2 shrink-0 rounded-full ${item.dotClass}`}
                  />
                  <div>
                    <h3
                      className={`gleeple-heading text-sm font-semibold uppercase ${item.textClass}`}
                    >
                      {item.title}
                    </h3>
                    <p className="text-xs theme-muted">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>

        <article
          className="theme-content-card overflow-hidden rounded-lg"
          id="code-example"
        >
          <div className="theme-editor-header flex items-center justify-between border-b px-4 py-2 theme-ide-divider">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500/60" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/60" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/60" />
              <span className="gleeple-code ml-4 text-xs theme-muted">
                Program.cs
              </span>
            </div>
            <button
              aria-label="Copy code"
              className="cursor-pointer theme-muted transition-colors hover:text-[var(--color-on-surface)]"
              type="button"
            >
              <ContentCopyOutlinedIcon sx={{ fontSize: 16 }} />
            </button>
          </div>

          <div className="content-scrollbar overflow-x-auto bg-[var(--color-code-surface)] p-6">
            <div className="gleeple-code min-w-[520px] text-sm leading-7">
              {codeRows.map((row) => (
                <div className="flex min-h-7" key={row.line}>
                  <span className="w-8 shrink-0 text-[var(--color-subtle-text)]">
                    {row.line}
                  </span>
                  <span>{row.content}</span>
                </div>
              ))}
            </div>
          </div>
        </article>

        <section className="space-y-6" id="simulation">
          <h2 className="gleeple-heading flex items-center gap-2 text-2xl font-semibold theme-text">
            <IntegrationInstructionsOutlinedIcon className="theme-accent" />
            Simulation
          </h2>
          <div className="theme-content-card rounded-lg p-5">
            <p className="leading-7 theme-muted">
              Trace the runtime path: request enters the container, scoped
              services are created for the request, transient services are
              resolved for each dependent object, and singleton services are
              reused from the application root.
            </p>
          </div>
        </section>

        <section className="space-y-6" id="interview-questions">
          <h2 className="gleeple-heading flex items-center gap-2 text-2xl font-semibold theme-text">
            <ContactSupportOutlinedIcon className="theme-accent" />
            Interview Practice
          </h2>

          <div className="grid grid-cols-1 gap-4">
            {interviewQuestions.map((item) => (
              <button
                className={`theme-content-card theme-content-card-interactive flex cursor-pointer items-center justify-between rounded-lg border-l-4 p-5 text-left ${item.accentClass}`}
                key={item.question}
                type="button"
              >
                <span className="space-y-2">
                  <span className="flex flex-wrap items-center gap-3">
                    <span
                      className={`gleeple-heading rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase ${item.badgeClass}`}
                    >
                      {item.level}
                    </span>
                    <span className="text-xs theme-subtle">
                      {item.category}
                    </span>
                  </span>
                  <span className="block text-lg font-medium theme-text">
                    {item.question}
                  </span>
                </span>
                <ChevronRightIcon className="ml-4 shrink-0 theme-subtle transition-transform" />
              </button>
            ))}
          </div>
        </section>

        <section
          className="border-t pt-12 theme-ide-divider"
          id="summary"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between">
            <Button
              className="!justify-start !px-6 !py-3"
              startIcon={<ChevronLeftIcon />}
              sx={{
                borderColor: "var(--color-card-border)",
                color: "var(--color-on-surface)",
                minWidth: 184,
              }}
              variant="outlined"
            >
              <span className="flex flex-col items-start">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-subtle-text)]">
                  Previous
                </span>
                <span className="text-sm font-bold uppercase">
                  Async / Await
                </span>
              </span>
            </Button>

            <Button
              className="!justify-end !px-8 !py-3"
              endIcon={<ChevronRightIcon />}
              sx={{ flexGrow: 1 }}
              variant="contained"
            >
              <span className="flex flex-col items-end">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">
                  Next Up
                </span>
                <span className="text-sm font-bold uppercase">
                  Service Lifetimes
                </span>
              </span>
            </Button>
          </div>
        </section>
      </div>
    </section>
  );
}
