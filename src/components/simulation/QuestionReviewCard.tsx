import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SimulationQuestionEvaluation } from "../../lib/redux/slices/simulationSlice";
import type { SimulationQuestion } from "../../shared/GenerateSimulationQuestions";

export type QuestionReviewCardProps = {
  answer?: string;
  evaluation?: SimulationQuestionEvaluation;
  isExpanded: boolean;
  number: number;
  onEvaluationChange: (evaluation: SimulationQuestionEvaluation) => void;
  onSelect: () => void;
  question: SimulationQuestion;
};

const evaluationOptions: Array<{
  label: string;
  selectedClass: string;
  value: SimulationQuestionEvaluation;
}> = [
  {
    label: "Didn't Know",
    selectedClass:
      "border-[var(--color-error)] bg-[color-mix(in_srgb,var(--color-error)_18%,transparent)] text-[var(--color-error)]",
    value: "did-not-know",
  },
  {
    label: "Partially Answered",
    selectedClass:
      "border-[var(--color-secondary)] bg-[color-mix(in_srgb,var(--color-secondary)_18%,transparent)] text-[var(--color-secondary)]",
    value: "partially-answered",
  },
  {
    label: "Answered Well",
    selectedClass:
      "border-[var(--color-tertiary)] bg-[color-mix(in_srgb,var(--color-tertiary)_18%,transparent)] text-[var(--color-tertiary)]",
    value: "answered-well",
  },
];

const evaluationLabels: Record<SimulationQuestionEvaluation, string> = {
  "did-not-know": "Didn't Know",
  "partially-answered": "Partially Answered",
  "answered-well": "Answered Well",
};

export function QuestionReviewCard({
  answer,
  evaluation,
  isExpanded,
  number,
  onEvaluationChange,
  onSelect,
  question,
}: QuestionReviewCardProps) {
  const keyPoints = extractKeyPoints(question.keyPointsMarkdown);

  return (
    <article
      className={`theme-content-card overflow-hidden rounded-lg transition-colors ${
        isExpanded
          ? "border-l-4 border-l-[var(--color-primary-container)]"
          : "theme-content-card-interactive"
      }`}
    >
      <button
        aria-expanded={isExpanded}
        className={`flex w-full cursor-pointer items-start justify-between gap-4 p-5 text-left md:items-center md:p-6 ${
          isExpanded
            ? "border-b border-[var(--color-card-border)] bg-[color-mix(in_srgb,var(--color-surface-container-low)_50%,transparent)]"
            : ""
        }`}
        onClick={onSelect}
        type="button"
      >
        <span className="flex min-w-0 items-start gap-4">
          <span
            className={`gleeple-heading flex h-10 w-10 shrink-0 items-center justify-center rounded text-sm font-bold ${
              isExpanded
                ? "bg-[var(--color-accent-soft)] text-[var(--color-primary-container)]"
                : "bg-[var(--color-surface-container-highest)] theme-muted"
            }`}
          >
            {number}
          </span>
          <span className="min-w-0">
            <span
              className={`gleeple-heading block text-lg font-semibold leading-7 transition-colors md:text-xl ${
                isExpanded
                  ? "theme-text"
                  : "theme-text group-hover:text-[var(--color-primary-container)]"
              }`}
            >
              {question.question}
            </span>
            <span className="mt-2 flex flex-wrap gap-2">
              <span className="gleeple-heading rounded bg-[var(--color-surface-container-high)] px-2 py-1 text-[10px] font-bold uppercase theme-muted">
                {question.subTopic || question.topic}
              </span>
              <span
                className={`gleeple-heading rounded px-2 py-1 text-[10px] font-bold uppercase ${
                  isExpanded
                    ? "bg-[var(--color-accent-soft)] text-[var(--color-primary-container)]"
                    : evaluation
                      ? "bg-[var(--color-surface-container-high)] text-[var(--color-tertiary)]"
                      : "bg-[var(--color-surface-container-high)] theme-muted"
                }`}
              >
                {isExpanded
                  ? "Evaluating Now"
                  : evaluation
                    ? evaluationLabels[evaluation]
                    : "Pending Evaluation"}
              </span>
            </span>
          </span>
        </span>
        <ChevronRightIcon
          className={`mt-2 shrink-0 transition-transform theme-muted md:mt-0 ${
            isExpanded ? "rotate-90" : ""
          }`}
        />
      </button>

      {isExpanded ? (
        <div className="space-y-8 bg-[color-mix(in_srgb,var(--color-surface-container-lowest)_30%,transparent)] p-5 md:p-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <AnswerBlock
              content={answer?.trim() || "No response was saved for this question."}
              label="Your Answer"
              variant="user"
            />
            <AnswerBlock
              content={
                question.expectedAnswerMarkdown.trim() ||
                "No reference answer is available."
              }
              label="Expected Answer"
              variant="expected"
            />
          </div>

          <section className="space-y-5">
            <h3 className="gleeple-heading border-b border-[var(--color-card-border)] pb-3 text-base font-semibold theme-text">
              Key Points Analysis
            </h3>
            {keyPoints.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {keyPoints.map((keyPoint, index) => (
                  <div className="flex items-start gap-3" key={`${index}-${keyPoint}`}>
                    {isKeyPointMarked(
                      evaluation,
                      index,
                      keyPoints.length
                    ) ? (
                      <CheckCircleOutlineIcon
                        className="mt-0.5 shrink-0 text-[var(--color-tertiary)]"
                        sx={{ fontSize: 19 }}
                      />
                    ) : (
                      <RadioButtonUncheckedIcon
                        className="mt-0.5 shrink-0 theme-muted"
                        sx={{ fontSize: 19 }}
                      />
                    )}
                    <InlineMarkdown markdown={keyPoint} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="theme-muted">
                No key points are available for this question.
              </p>
            )}
          </section>

          <section className="flex flex-col items-start justify-between gap-4 border-t border-[var(--color-card-border)] pt-7 sm:flex-row sm:items-center">
            <span className="gleeple-heading text-[11px] font-bold uppercase theme-muted">
              Rate your performance on this question:
            </span>
            <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3">
              {evaluationOptions.map((option) => {
                const isSelected = evaluation === option.value;

                return (
                  <button
                    aria-pressed={isSelected}
                    className={`gleeple-heading min-h-11 cursor-pointer rounded border px-4 py-2 text-[11px] font-bold uppercase transition-colors ${
                      isSelected
                        ? option.selectedClass
                        : "border-[var(--color-card-border)] bg-[var(--color-surface-container-high)] theme-muted hover:border-[var(--color-primary-container)] hover:text-[var(--color-primary-container)]"
                    }`}
                    key={option.value}
                    onClick={() => onEvaluationChange(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </article>
  );
}

function AnswerBlock({
  content,
  label,
  variant,
}: {
  content: string;
  label: string;
  variant: "user" | "expected";
}) {
  const isExpected = variant === "expected";

  return (
    <section className="space-y-3">
      <h3
        className={`gleeple-heading text-[11px] font-bold uppercase ${
          isExpected ? "text-[var(--color-primary-container)]" : "theme-muted"
        }`}
      >
        {label}
      </h3>
      <div
        className={`content-scrollbar min-h-32 overflow-x-auto rounded-lg border p-5 leading-7 ${
          isExpected
            ? "border-[color-mix(in_srgb,var(--color-primary-container)_20%,transparent)] bg-[var(--color-surface-container-high)] italic theme-text"
            : "whitespace-pre-wrap border-[var(--color-card-border)] bg-[var(--color-surface-container)] theme-muted"
        }`}
      >
        {isExpected ? <ReviewMarkdown markdown={content} /> : content}
      </div>
    </section>
  );
}

function ReviewMarkdown({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown
      components={{
        code: ({ children }) => (
          <code className="rounded bg-[var(--color-surface-container-lowest)] px-1.5 py-0.5 not-italic text-[var(--color-secondary)]">
            {children}
          </code>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal space-y-2 pl-5">{children}</ol>
        ),
        p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
        pre: ({ children }) => (
          <pre className="content-scrollbar overflow-x-auto rounded bg-[var(--color-surface-container-lowest)] p-4 not-italic">
            {children}
          </pre>
        ),
        ul: ({ children }) => (
          <ul className="list-disc space-y-2 pl-5">{children}</ul>
        ),
      }}
      remarkPlugins={[remarkGfm]}
    >
      {markdown}
    </ReactMarkdown>
  );
}

function InlineMarkdown({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown
      components={{
        code: ({ children }) => (
          <code className="rounded bg-[var(--color-surface-container-high)] px-1 py-0.5 text-[var(--color-secondary)]">
            {children}
          </code>
        ),
        p: ({ children }) => (
          <span className="leading-6 theme-text">{children}</span>
        ),
      }}
      remarkPlugins={[remarkGfm]}
    >
      {markdown}
    </ReactMarkdown>
  );
}

function extractKeyPoints(markdown: string) {
  const listItems = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*+]\s+/.test(line))
    .map((line) => line.replace(/^[-*+]\s+/, "").trim())
    .filter(Boolean);

  if (listItems.length > 0) {
    return listItems;
  }

  return markdown.trim() ? [markdown.trim()] : [];
}

function isKeyPointMarked(
  evaluation: SimulationQuestionEvaluation | undefined,
  keyPointIndex: number,
  keyPointCount: number
) {
  if (evaluation === "answered-well") {
    return true;
  }

  if (evaluation === "partially-answered") {
    return keyPointIndex < Math.ceil(keyPointCount / 2);
  }

  return false;
}
