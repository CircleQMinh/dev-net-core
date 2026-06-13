import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import { useCallback, useEffect, useRef } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { QuestionReviewCard } from "../components/simulation/QuestionReviewCard";
import { useAppDispatch, useAppSelector } from "../lib/redux/hooks/hooks";
import { selectSimulationCurrentSession } from "../lib/redux/selectors/simulationSelectors";
import {
  clearSimulationSession,
  clearSimulationSessionState,
  completeSimulationSession,
  getSimulationElapsedTimeInSeconds,
  saveSimulationQuestionEvaluation,
  saveSimulationSessionState,
  setSimulationCurrentEvaluationQuestion,
  type SimulationDifficultyLevel,
  type SimulationQuestionEvaluation,
} from "../lib/redux/slices/simulationSlice";

const difficultyLabels: Record<SimulationDifficultyLevel, string> = {
  entry: "Entry",
  standard: "Standard",
  expert: "Expert",
};

const evaluationSummaryLabels: Record<
  SimulationQuestionEvaluation,
  string
> = {
  "did-not-know": "Didn't Know",
  "partially-answered": "Partial",
  "answered-well": "Answered Well",
};

export default function SimulationResult() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const currentSession = useAppSelector(selectSimulationCurrentSession);
  const questionCardRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingScrollQuestionIdRef = useRef<string | undefined>(undefined);
  const session =
    currentSession?.sessionId === sessionId ? currentSession : undefined;
  const activeQuestionId = session?.currentEvaluationQuestionId;

  const scrollToQuestionCard = useCallback((questionId: string) => {
    const questionCard = questionCardRefs.current.get(questionId);

    if (!questionCard) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    questionCard.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, []);

  useEffect(() => {
    if (!session || session.step === "result") {
      return;
    }

    const completedAt = new Date().toISOString();

    dispatch(
      completeSimulationSession({
        completedAt,
        elapsedTimeInSeconds: getSimulationElapsedTimeInSeconds(
          session,
          Date.parse(completedAt)
        ),
      })
    );
  }, [dispatch, session]);

  useEffect(() => {
    const pendingQuestionId = pendingScrollQuestionIdRef.current;

    if (!pendingQuestionId || pendingQuestionId !== activeQuestionId) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      scrollToQuestionCard(pendingQuestionId);
      pendingScrollQuestionIdRef.current = undefined;
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [activeQuestionId, scrollToQuestionCard]);

  if (!session || session.questions.length === 0) {
    return <Navigate replace to="/simulation" />;
  }

  const totalQuestions = session.questions.length;
  const answeredQuestionCount = Object.values(
    session.answersByQuestionId
  ).filter((answer) => answer.trim() && answer.trim() !== "Skipped.").length;
  const evaluationCount = Object.keys(
    session.evaluationsByQuestionId
  ).length;
  const remainingEvaluationCount = Math.max(
    totalQuestions - evaluationCount,
    0
  );
  const evaluationProgress =
    totalQuestions > 0
      ? Math.round((evaluationCount / totalQuestions) * 100)
      : 0;
  const categoryLabels = getUniqueValues(
    session.questions.map((question) => question.category)
  );
  const topicLabels = getUniqueValues(
    session.questions.map((question) => question.topic)
  );
  const subTopicLabels = getUniqueValues(
    session.questions.map((question) => question.subTopic)
  );
  const elapsedTime = formatElapsedTime(
    getSimulationElapsedTimeInSeconds(session)
  );
  const isEvaluationComplete =
    totalQuestions > 0 && evaluationCount === totalQuestions;

  const selectQuestionForReview = (questionId: string) => {
    pendingScrollQuestionIdRef.current = questionId;
    dispatch(setSimulationCurrentEvaluationQuestion(questionId));

    if (questionId === activeQuestionId) {
      window.requestAnimationFrame(() => {
        scrollToQuestionCard(questionId);
        pendingScrollQuestionIdRef.current = undefined;
      });
    }
  };

  const evaluateQuestion = (
    questionId: string,
    questionIndex: number,
    evaluation: SimulationQuestionEvaluation
  ) => {
    const nextQuestion = session.questions[questionIndex + 1];

    pendingScrollQuestionIdRef.current = nextQuestion?.id;
    dispatch(
      saveSimulationQuestionEvaluation({
        evaluation,
        questionId,
      })
    );
  };

  const finishSession = () => {
    clearSimulationSessionState();
    dispatch(clearSimulationSession());
    navigate("/simulation", { replace: true });
  };

  return (
    <div className="theme-page theme-grid-pattern min-h-screen pt-20">
      <main className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-6 lg:px-12 lg:py-12">
        <header className="mb-6 flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="gleeple-heading text-4xl font-bold leading-tight theme-text md:text-5xl">
              Review Your Simulation
            </h1>
            <span
              className={`gleeple-heading rounded-full border px-3 py-1 text-[11px] font-bold uppercase ${
                isEvaluationComplete
                  ? "border-[color-mix(in_srgb,var(--color-tertiary)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-tertiary)_10%,transparent)] text-[var(--color-tertiary)]"
                  : "animate-pulse border-[color-mix(in_srgb,var(--color-secondary)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-secondary)_10%,transparent)] text-[var(--color-secondary)]"
              }`}
            >
              {isEvaluationComplete ? "Review Complete" : "Review Pending"}
            </span>
          </div>
          <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2">
            <button
              className="gleeple-heading flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-surface-container-high)] px-5 py-3 text-[12px] font-bold uppercase theme-text transition-colors hover:bg-[var(--color-surface-container-highest)]"
              onClick={() => saveSimulationSessionState(session)}
              type="button"
            >
              <SaveOutlinedIcon sx={{ fontSize: 19 }} />
              Save Session
            </button>
            <button
              className="gleeple-heading flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--color-primary-container)] px-5 py-3 text-[12px] font-bold uppercase text-[var(--color-on-primary-container)] shadow-[var(--shadow-accent-glow)] transition-all hover:brightness-110 active:scale-[0.98]"
              onClick={finishSession}
              type="button"
            >
              <CheckCircleOutlineIcon sx={{ fontSize: 19 }} />
              Finish Session
            </button>
          </div>
        </header>

        <section className="theme-content-card mb-6 rounded-lg p-5 md:p-6">
          <h2 className="gleeple-heading mb-5 border-b border-[var(--color-card-border)] pb-3 text-[11px] font-bold uppercase theme-muted">
            Session Data
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3">
            <div className="md:pr-6">
              <SessionDataRow
                label="Level"
                value={difficultyLabels[session.difficultyLevel]}
                valueClass="text-[var(--color-primary-container)]"
              />
              <SessionDataRow
                label="Questions"
                value={`${totalQuestions} Total`}
              />
              <SessionDataRow
                label="Duration"
                value={elapsedTime}
                valueClass="text-[var(--color-secondary)]"
              />
            </div>
            <div className="border-t border-[var(--color-card-border)] md:border-l md:border-t-0 md:px-6">
              <SessionDataRow
                label="Categories"
                value={formatSelectionSummary(categoryLabels, "category")}
              />
              <SessionDataRow
                label="Topics"
                value={formatSelectionSummary(topicLabels, "topic")}
              />
              <SessionDataRow
                label="Subtopics"
                value={formatSelectionSummary(subTopicLabels, "subtopic")}
              />
            </div>
            <div className="border-t border-[var(--color-card-border)] md:border-l md:border-t-0 md:pl-6">
              <SessionDataRow
                label="Answered"
                value={`${answeredQuestionCount} Answered`}
              />
              <SessionDataRow
                label="Evaluated"
                value={`${evaluationCount} Evaluated`}
              />
              <SessionDataRow
                label="Completed"
                value={
                  session.completedAt
                    ? formatSessionDate(session.completedAt)
                    : "In progress"
                }
              />
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-9">
            <section className="space-y-6">
              {session.questions.map((question, questionIndex) => {
                return (
                  <div
                    className="scroll-mt-28"
                    key={question.id}
                    ref={(element) => {
                      if (element) {
                        questionCardRefs.current.set(question.id, element);
                      } else {
                        questionCardRefs.current.delete(question.id);
                      }
                    }}
                  >
                    <QuestionReviewCard
                      answer={session.answersByQuestionId[question.id]}
                      evaluation={
                        session.evaluationsByQuestionId[question.id]
                      }
                      isExpanded={question.id === activeQuestionId}
                      number={questionIndex + 1}
                      onEvaluationChange={(evaluation) =>
                        evaluateQuestion(
                          question.id,
                          questionIndex,
                          evaluation
                        )
                      }
                      onSelect={() =>
                        selectQuestionForReview(question.id)
                      }
                      question={question}
                    />
                  </div>
                );
              })}
            </section>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:col-span-3">
            <SidebarSection title="Evaluation Progress">
              <div className="space-y-4">
                <div className="flex items-end justify-between gap-4">
                  <span className="gleeple-heading text-2xl font-semibold theme-text">
                    {evaluationCount}
                    <span className="ml-1 text-sm font-normal theme-muted">
                      /{totalQuestions}
                    </span>
                  </span>
                  <span className="gleeple-heading text-[11px] font-bold uppercase text-[var(--color-primary-container)]">
                    {evaluationProgress}% Complete
                  </span>
                </div>
                <div className="theme-progress-track h-2 overflow-hidden rounded-full">
                  <div
                    className="theme-progress-fill h-full transition-[width] duration-300"
                    style={{ width: `${evaluationProgress}%` }}
                  />
                </div>
                <p className="text-sm italic theme-muted">
                  {remainingEvaluationCount > 0
                    ? `Evaluate ${remainingEvaluationCount} more to see analytics.`
                    : "All questions have been evaluated."}
                </p>
              </div>
            </SidebarSection>

            <SidebarSection title="Quick Navigation">
              <div className="grid grid-cols-5 gap-3">
                {session.questions.map((question, questionIndex) => {
                  const isActive = question.id === activeQuestionId;
                  const isEvaluated =
                    session.evaluationsByQuestionId[question.id] !== undefined;

                  return (
                    <button
                      aria-label={`Review question ${questionIndex + 1}`}
                      aria-pressed={isActive}
                      className={getQuickNavigationClass(
                        isActive,
                        isEvaluated
                      )}
                      key={question.id}
                      onClick={() => selectQuestionForReview(question.id)}
                      type="button"
                    >
                      {questionIndex + 1}
                    </button>
                  );
                })}
              </div>
            </SidebarSection>

          </aside>
        </div>

        <ResultSummary
          evaluations={session.evaluationsByQuestionId}
          focusAreas={subTopicLabels}
          remainingEvaluationCount={remainingEvaluationCount}
          totalQuestions={totalQuestions}
        />
      </main>
    </div>
  );
}

function ResultSummary({
  evaluations,
  focusAreas,
  remainingEvaluationCount,
  totalQuestions,
}: {
  evaluations: Record<string, SimulationQuestionEvaluation>;
  focusAreas: string[];
  remainingEvaluationCount: number;
  totalQuestions: number;
}) {
  const counts = Object.values(evaluations).reduce(
    (summary, evaluation) => {
      summary[evaluation] += 1;
      return summary;
    },
    {
      "did-not-know": 0,
      "partially-answered": 0,
      "answered-well": 0,
    } satisfies Record<SimulationQuestionEvaluation, number>
  );

  return (
    <section className="theme-content-card mt-6 rounded-lg p-6 md:p-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.34fr)] lg:gap-10">
        {remainingEvaluationCount > 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-outline-variant)] px-6 py-12 text-center">
            <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-surface-container-highest)] theme-muted">
              <LockOutlinedIcon sx={{ fontSize: 34 }} />
            </span>
            <h2 className="gleeple-heading mb-2 text-3xl font-semibold theme-text">
              Result Summary Locked
            </h2>
            <p className="max-w-lg leading-7 theme-muted">
              Evaluate all questions to unlock your result summary and skill-gap
              overview.
            </p>
            <span className="gleeple-heading mt-6 rounded-full bg-[var(--color-surface-container-highest)] px-5 py-2 text-[11px] font-bold uppercase text-[var(--color-primary-container)]">
              {remainingEvaluationCount} questions left
            </span>
          </div>
        ) : (
          <div>
            <h2 className="gleeple-heading mb-6 text-3xl font-semibold theme-text">
              Result Summary
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <SummaryMetric
                label="Total Questions"
                value={totalQuestions}
              />
              {(Object.keys(
                evaluationSummaryLabels
              ) as SimulationQuestionEvaluation[]).map((evaluation) => (
                <SummaryMetric
                  key={evaluation}
                  label={evaluationSummaryLabels[evaluation]}
                  value={counts[evaluation]}
                />
              ))}
            </div>
          </div>
        )}

        <FocusAreas focusAreas={focusAreas} />
      </div>
    </section>
  );
}

function FocusAreas({ focusAreas }: { focusAreas: string[] }) {
  return (
    <div className="border-t border-[var(--color-card-border)] pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
      <h2 className="gleeple-heading mb-5 border-b border-[var(--color-card-border)] pb-3 text-[11px] font-bold uppercase theme-muted">
        Focus Areas
      </h2>
      <div className="flex flex-wrap gap-2">
        {focusAreas.slice(0, 8).map((focusArea) => (
          <span
            className="gleeple-heading rounded bg-[var(--color-surface-container-high)] px-2 py-1 text-[10px] font-bold uppercase theme-muted"
            key={focusArea}
          >
            {focusArea}
          </span>
        ))}
        {focusAreas.length > 8 ? (
          <span className="gleeple-heading rounded bg-[var(--color-accent-soft)] px-2 py-1 text-[10px] font-bold uppercase text-[var(--color-primary-container)]">
            +{focusAreas.length - 8} more
          </span>
        ) : null}
        {focusAreas.length === 0 ? (
          <p className="text-sm theme-muted">
            No focus areas are available for this session.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SidebarSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="theme-content-card rounded-lg p-5 md:p-6">
      <h2 className="gleeple-heading mb-5 border-b border-[var(--color-card-border)] pb-3 text-[11px] font-bold uppercase theme-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SessionDataRow({
  label,
  value,
  valueClass = "theme-text",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 border-b border-[var(--color-card-border)] py-3 last:border-b-0">
      <span className="text-sm theme-muted">{label}</span>
      <span
        className={`gleeple-heading text-right text-[11px] font-bold uppercase ${valueClass}`}
      >
        {value}
      </span>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded border border-[var(--color-card-border)] bg-[var(--color-surface-container-high)] p-4">
      <p className="gleeple-heading mb-2 text-[10px] font-bold uppercase theme-muted">
        {label}
      </p>
      <p className="gleeple-heading text-3xl font-semibold theme-text">
        {value}
      </p>
    </div>
  );
}

function getQuickNavigationClass(
  isActive: boolean,
  isEvaluated: boolean
) {
  const baseClass =
    "gleeple-heading flex aspect-square cursor-pointer items-center justify-center rounded border text-xs font-bold transition-colors";

  if (isActive) {
    return `${baseClass} border-[var(--color-primary-container)] bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)] shadow-[var(--shadow-accent-glow)]`;
  }

  if (isEvaluated) {
    return `${baseClass} border-[color-mix(in_srgb,var(--color-primary-container)_40%,transparent)] bg-[var(--color-accent-soft)] text-[var(--color-primary-container)] hover:border-[var(--color-primary-container)]`;
  }

  return `${baseClass} border-[var(--color-card-border)] bg-[var(--color-surface-container-high)] theme-muted hover:border-[var(--color-primary-container)] hover:text-[var(--color-primary-container)]`;
}

function getUniqueValues(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  );
}

function formatSelectionSummary(
  values: string[],
  singularLabel: "category" | "topic" | "subtopic"
) {
  if (values.length === 0) {
    return "Not available";
  }

  if (values.length === 1) {
    return values[0];
  }

  const pluralLabels = {
    category: "Categories",
    topic: "Topics",
    subtopic: "Subtopics",
  } satisfies Record<typeof singularLabel, string>;

  return `${values.length} ${pluralLabels[singularLabel]}`;
}

function formatSessionDate(date: string) {
  const timestamp = Date.parse(date);

  if (!Number.isFinite(timestamp)) {
    return "date unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function formatElapsedTime(elapsedTimeInSeconds: number) {
  const hours = Math.floor(elapsedTimeInSeconds / 3600);
  const minutes = Math.floor((elapsedTimeInSeconds % 3600) / 60);
  const seconds = elapsedTimeInSeconds % 60;
  const segments =
    hours > 0 ? [hours, minutes, seconds] : [minutes, seconds];

  return segments
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}
