import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckIcon from "@mui/icons-material/Check";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import RocketLaunchOutlinedIcon from "@mui/icons-material/RocketLaunchOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import { Button } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import {
  collectSubTopicNodes,
  findCurriculumSubTopicById,
  generatedCurriculumTree,
  getCurriculumSubTopicNavigation,
  type CurriculumSubTopicNode,
} from "../components/content/CurriculumTreeView";
import {
  extractCommonInterviewQuestions,
  type CommonInterviewQuestion,
} from "../components/content/markdown";
import { AnswerPanel } from "../components/practice/AnswerPanel";
import { QuestionLevelBadge } from "../components/practice/QuestionLevelBadge";
import { useAppDispatch, useAppSelector } from "../lib/redux/hooks/hooks";
import { selectContentProgress } from "../lib/redux/selectors/contentSelectors";
import {
  getContentSubTopicProgressPercentage,
  setQuestionCompletion,
  setSubTopicProgress,
  type ContentSubTopicProgress,
} from "../lib/redux/slices/contentSlice";

const practiceLevels = ["Beginner", "Intermediate", "Advanced"];
const emptyCompletedQuestions: number[] = [];

type PracticeSessionProps = {
  questions: CommonInterviewQuestion[];
  topic: CurriculumSubTopicNode;
};

type PracticeTopicCard = {
  completedQuestionCount: number;
  progress: ContentSubTopicProgress;
  progressPercentage: number;
  primaryLevel: string;
  questionCount: number;
  questionLevelCounts: CurriculumSubTopicNode["questionLevelCounts"];
  topic: CurriculumSubTopicNode;
};

function getOrderedPracticeQuestions(markdown: string) {
  const questions = extractCommonInterviewQuestions(markdown);
  const orderedQuestions = practiceLevels.flatMap((level) =>
    questions.filter((question) => question.level === level)
  );
  const uncategorizedQuestions = questions.filter(
    (question) => !practiceLevels.includes(question.level)
  );

  return [...orderedQuestions, ...uncategorizedQuestions];
}

function getQuestionIndex(
  questions: CommonInterviewQuestion[],
  selectedQuestionId?: string
) {
  const selectedIndex = questions.findIndex(
    (question) => question.id === selectedQuestionId
  );

  return selectedIndex === -1 ? 0 : selectedIndex;
}

function getTopicPracticeProgress(
  progressState: ReturnType<typeof selectContentProgress>,
  topic: CurriculumSubTopicNode,
  questionCount: number
): ContentSubTopicProgress {
  const storedProgress =
    progressState[topic.category]?.[topic.topic]?.[topic.subtopic];

  return {
    totalQuestion: questionCount,
    completedQuestion: storedProgress?.completedQuestion ?? emptyCompletedQuestions,
  };
}

function getCompletedQuestionCount(progress: ContentSubTopicProgress) {
  return Math.min(progress.completedQuestion.length, progress.totalQuestion);
}

function getPrimaryQuestionLevel(
  levelCounts: CurriculumSubTopicNode["questionLevelCounts"]
) {
  if (levelCounts.some((levelCount) => levelCount.level === "Advanced")) {
    return "Advanced";
  }

  if (levelCounts.some((levelCount) => levelCount.level === "Intermediate")) {
    return "Intermediate";
  }

  if (levelCounts.some((levelCount) => levelCount.level === "Beginner")) {
    return "Beginner";
  }

  return levelCounts[0]?.level ?? "Practice";
}

function getCategoryBadgeClass(category: string) {
  if (category === "React") {
    return "border-[color-mix(in_srgb,var(--color-secondary)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-secondary)_10%,transparent)] text-[var(--color-secondary)]";
  }

  if (category === "SQL") {
    return "border-[color-mix(in_srgb,var(--color-tertiary)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-tertiary)_10%,transparent)] text-[var(--color-tertiary)]";
  }

  if (category === "Azure") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-500";
  }

  if (category === "Design & Architecture") {
    return "border-[var(--color-outline-variant)] bg-[color-mix(in_srgb,var(--color-outline-variant)_20%,transparent)] theme-text";
  }

  return "border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] text-[var(--color-primary)]";
}

function getQuestionLevelCounts(
  levelCounts: CurriculumSubTopicNode["questionLevelCounts"]
) {
  return practiceLevels
    .map((level) => ({
      level,
      count: levelCounts.find((levelCount) => levelCount.level === level)?.count ?? 0,
    }))
    .filter((item) => item.count > 0);
}

function buildPracticeTopicCards(
  progressState: ReturnType<typeof selectContentProgress>
): PracticeTopicCard[] {
  return collectSubTopicNodes(generatedCurriculumTree).map((topic) => {
    const progress = getTopicPracticeProgress(
      progressState,
      topic,
      topic.questionCount
    );
    const progressPercentage = getContentSubTopicProgressPercentage(progress);

    return {
      completedQuestionCount: getCompletedQuestionCount(progress),
      primaryLevel: getPrimaryQuestionLevel(topic.questionLevelCounts),
      progress,
      progressPercentage,
      questionCount: topic.questionCount,
      questionLevelCounts: topic.questionLevelCounts,
      topic,
    };
  });
}

function PracticeProgress({
  currentQuestion,
  progress,
}: {
  currentQuestion: number;
  progress: ContentSubTopicProgress;
}) {
  const completion = getContentSubTopicProgressPercentage(progress);
  const totalQuestions = progress.totalQuestion;
  const completedQuestionCount = Math.min(
    progress.completedQuestion.length,
    totalQuestions
  );

  return (
    <section className="theme-content-card rounded-lg p-4">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <span className="gleeple-heading text-2xl font-semibold text-[var(--color-primary)]">
            Question {currentQuestion}
          </span>
        </div>
        <span className="gleeple-heading text-[12px] font-bold uppercase tracking-[0.08em] theme-accent">
          {completedQuestionCount} of {totalQuestions} completed ({completion}%)
        </span>
      </div>

      <div className="theme-progress-track h-1 overflow-hidden rounded-full">
        <div
          className="theme-progress-fill h-full transition-all duration-500"
          style={{ width: `${completion}%` }}
        />
      </div>
    </section>
  );
}

function PracticeNavigation({
  activeIndex,
  onNext,
  onPrevious,
  totalQuestions,
}: {
  activeIndex: number;
  onNext: () => void;
  onPrevious: () => void;
  totalQuestions: number;
}) {
  return (
    <div className="flex items-center justify-between px-2">
      <button
        className="group flex cursor-pointer items-center gap-2 theme-muted transition-colors hover:text-[var(--color-on-surface)] disabled:cursor-not-allowed disabled:opacity-40"
        disabled={activeIndex === 0}
        onClick={onPrevious}
        type="button"
      >
        <ArrowBackIcon
          className="transition-transform group-hover:-translate-x-1"
          sx={{ fontSize: 18 }}
        />
        <span className="gleeple-heading text-sm font-semibold uppercase tracking-[0.08em]">
          Previous
        </span>
      </button>

      <button
        className="group flex cursor-pointer items-center gap-2 theme-muted transition-colors hover:text-[var(--color-on-surface)] disabled:cursor-not-allowed disabled:opacity-40"
        disabled={activeIndex >= totalQuestions - 1}
        onClick={onNext}
        type="button"
      >
        <span className="gleeple-heading text-sm font-semibold uppercase tracking-[0.08em]">
          Next
        </span>
        <ArrowForwardIcon
          className="transition-transform group-hover:translate-x-1"
          sx={{ fontSize: 18 }}
        />
      </button>
    </div>
  );
}

function QuestionCard({
  question,
  topic,
}: {
  question: CommonInterviewQuestion;
  topic: CurriculumSubTopicNode;
}) {
  return (
    <section className="theme-content-card overflow-hidden rounded-xl border-t-2 border-t-[color-mix(in_srgb,var(--color-secondary)_40%,transparent)]">
      <div className="space-y-6 p-8">
        <div className="flex flex-wrap gap-2">
          <span className="gleeple-heading rounded border border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-primary)]">
            {topic.category}
          </span>
          <QuestionLevelBadge level={question.level} />
          {question.label ? (
            <span className="gleeple-heading rounded border border-[var(--color-outline-variant)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] theme-muted">
              {question.label}
            </span>
          ) : null}
          <span className="gleeple-heading flex items-center gap-1 rounded border border-[color-mix(in_srgb,var(--color-tertiary)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-tertiary)_10%,transparent)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-tertiary)]">
            <ScheduleOutlinedIcon sx={{ fontSize: 13 }} />
            5 Min Est.
          </span>
        </div>

        <h2 className="gleeple-heading text-2xl font-semibold leading-tight theme-text md:text-3xl">
          {question.question}
        </h2>

        <div className="rounded-lg border p-4 theme-ide-divider">
          <span className="gleeple-heading block text-[10px] font-bold uppercase tracking-[0.18em] theme-subtle">
            Related Content
          </span>
          <RouterLink
            className="mt-2 block text-sm font-semibold no-underline theme-accent hover:text-[var(--color-primary)]"
            to={`/content/${topic.id}/`}
          >
            {topic.topic} / {topic.subtopic}
          </RouterLink>
        </div>
      </div>
    </section>
  );
}

function QuestionList({
  activeQuestionId,
  completedQuestionNumbers,
  onSelectQuestion,
  questions,
}: {
  activeQuestionId: string;
  completedQuestionNumbers: number[];
  onSelectQuestion: (questionId: string) => void;
  questions: CommonInterviewQuestion[];
}) {
  const completedQuestionNumberSet = useMemo(
    () => new Set(completedQuestionNumbers),
    [completedQuestionNumbers]
  );

  return (
    <section className="theme-content-card overflow-hidden rounded-xl">
      <div className="flex items-center justify-between border-b bg-[var(--color-surface-container)] p-4 theme-ide-divider">
        <h2 className="gleeple-heading text-[12px] font-bold uppercase tracking-[0.08em] theme-text">
          Question List
        </h2>
        <span className="text-[10px] theme-muted">
          {questions.length} total
        </span>
      </div>

      <div className="content-scrollbar max-h-[calc(100vh-250px)] overflow-y-auto p-4">
        <div className="space-y-2">
          {questions.map((question, index) => {
            const isActive = question.id === activeQuestionId;
            const isCompleted = completedQuestionNumberSet.has(index + 1);

            return (
              <button
                className={`flex w-full cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                  isActive
                    ? "border-[var(--color-primary-container)] bg-[var(--color-accent-soft)]"
                    : "border-[var(--color-outline-variant)] hover:border-[var(--color-outline)] hover:bg-[var(--color-accent-hover)]"
                }`}
                key={question.id}
                onClick={() => onSelectQuestion(question.id)}
                type="button"
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold ${
                    isCompleted
                      ? "bg-emerald-500/15 text-emerald-500"
                      : isActive
                      ? "bg-[var(--color-primary-container)] text-[var(--color-on-primary)]"
                      : "bg-[var(--color-surface-container-high)] theme-muted"
                  }`}
                >
                  {isCompleted ? (
                    <CheckIcon sx={{ fontSize: 14 }} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <QuestionLevelBadge level={question.level} />
                    {question.label ? (
                      <span className="gleeple-heading text-[10px] font-bold uppercase tracking-[0.12em] theme-subtle">
                        {question.label}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-sm font-medium leading-5 theme-text">
                    {question.question}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ResetPracticeProgressButton({ onReset }: { onReset: () => void }) {
  return (
    <Button
      fullWidth
      onClick={onReset}
      startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />}
      sx={{
        borderColor: "var(--color-card-border)",
        color: "var(--color-on-surface)",
        justifyContent: "flex-start",
        px: 2,
        py: 1.25,
      }}
      variant="outlined"
    >
      Reset Progress
    </Button>
  );
}

function EmptyPracticeState({
  message = "Choose a topic from the content page to start an interview practice session.",
  onGoBack,
}: {
  message?: string;
  onGoBack: () => void;
}) {
  return (
    <div className="theme-page mx-auto flex min-h-screen max-w-[1440px] items-center justify-center px-6 pb-20 pt-24">
      <section className="theme-content-card max-w-xl rounded-xl p-8 text-center">
        <h1 className="gleeple-heading text-3xl font-semibold theme-text">
          No practice questions selected
        </h1>
        <p className="mx-auto mt-4 max-w-md leading-7 theme-muted">
          {message}
        </p>
        <Button
          onClick={onGoBack}
          startIcon={<ArrowBackIcon />}
          sx={{ mt: 4 }}
          variant="contained"
        >
          Go back
        </Button>
      </section>
    </div>
  );
}

function PracticeLoadingState() {
  return (
    <div className="theme-page mx-auto flex min-h-screen max-w-[1440px] items-center justify-center px-6 pb-20 pt-24">
      <p className="gleeple-heading text-sm font-semibold uppercase tracking-[0.18em] theme-muted">
        Loading practice questions...
      </p>
    </div>
  );
}

function PracticeIndexPage() {
  const progressState = useAppSelector(selectContentProgress);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const practiceTopics = useMemo(
    () => buildPracticeTopicCards(progressState),
    [progressState]
  );
  const categories = useMemo(
    () =>
      Array.from(
        new Set(practiceTopics.map((item) => item.topic.category))
      ).sort((left, right) => left.localeCompare(right)),
    [practiceTopics]
  );
  const filteredPracticeTopics = useMemo(() => {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    return practiceTopics.filter((item) => {
      const matchesCategory =
        categoryFilter === "All" || item.topic.category === categoryFilter;
      const searchableText = [
        item.topic.category,
        item.topic.topic,
        item.topic.subtopic,
      ]
        .join(" ")
        .toLowerCase();

      return matchesCategory && searchableText.includes(normalizedSearchQuery);
    });
  }, [categoryFilter, practiceTopics, searchQuery]);
  const totalQuestions = practiceTopics.reduce(
    (total, item) => total + item.questionCount,
    0
  );
  const completedQuestionCount = practiceTopics.reduce(
    (total, item) => total + item.completedQuestionCount,
    0
  );
  const completedSessionCount = practiceTopics.filter(
    (item) => item.questionCount > 0 && item.progressPercentage === 100
  ).length;
  const overallMastery =
    totalQuestions === 0
      ? 0
      : Math.round((completedQuestionCount / totalQuestions) * 100);

  return (
    <main className="theme-page theme-grid-pattern min-h-screen px-6 pb-20 pt-24">
      <div className="mx-auto max-w-[1440px]">
        <PracticeIndexHero
          completedSessionCount={completedSessionCount}
          overallMastery={overallMastery}
          totalQuestions={totalQuestions}
          totalTopics={practiceTopics.length}
        />
        <PracticeIndexToolbar
          categories={categories}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          onSearchQueryChange={setSearchQuery}
          searchQuery={searchQuery}
        />
        <TopicGrid topics={filteredPracticeTopics} />
        <PracticeIndexCta firstTopic={practiceTopics[0]?.topic} />
      </div>
    </main>
  );
}

function PracticeIndexHero({
  completedSessionCount,
  overallMastery,
  totalQuestions,
  totalTopics,
}: {
  completedSessionCount: number;
  overallMastery: number;
  totalQuestions: number;
  totalTopics: number;
}) {
  return (
    <section className="mb-20">
      <div className="max-w-3xl">
        <h1 className="gleeple-heading mb-3 text-5xl font-bold leading-tight theme-text">
          Interview Practice
        </h1>
        <p className="max-w-2xl text-lg leading-8 theme-muted">
          Select a technical topic and practice answering common interview questions to sharpen your skills and boost your confidence.

        </p>
      </div>

      <div className="mt-12 grid grid-cols-2 gap-2 rounded-xl border bg-[var(--color-surface-container-low)] p-6 theme-ide-divider md:grid-cols-4">
        <PracticeStat label="Available Content" value={`${totalTopics} Topics`} />
        <PracticeStat label="Question Bank" value={`${totalQuestions} Questions`} />
        <PracticeStat
          label="Sessions Completed"
          value={`${completedSessionCount} Sessions`}
        />
        <div className="flex flex-col px-2">
          <span className="gleeple-heading text-[12px] font-bold uppercase tracking-[0.08em] theme-muted">
            Overall Mastery
          </span>
          <div className="mt-1 flex items-center gap-2">
            <span className="gleeple-heading text-2xl font-semibold theme-accent">
              {overallMastery}%
            </span>
            <div className="theme-progress-track h-1 flex-1 overflow-hidden rounded-full">
              <div
                className="theme-progress-fill h-full"
                style={{ width: `${overallMastery}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PracticeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col border-r px-2 theme-ide-divider last:border-r-0">
      <span className="gleeple-heading text-[12px] font-bold uppercase tracking-[0.08em] theme-muted">
        {label}
      </span>
      <span className="gleeple-heading mt-1 text-2xl font-semibold theme-text">
        {value}
      </span>
    </div>
  );
}

function PracticeIndexToolbar({
  categories,
  categoryFilter,
  onCategoryFilterChange,
  onSearchQueryChange,
  searchQuery,
}: {
  categories: string[];
  categoryFilter: string;
  onCategoryFilterChange: (category: string) => void;
  onSearchQueryChange: (query: string) => void;
  searchQuery: string;
}) {
  return (
    <section className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
      <div className="group relative w-full md:w-96">
        <SearchOutlinedIcon
          className="absolute left-3 top-1/2 -translate-y-1/2 theme-muted transition-colors group-focus-within:text-[var(--color-primary-container)]"
          sx={{ fontSize: 20 }}
        />
        <input
          className="w-full rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-highest)] px-12 py-3 theme-text outline-none transition-colors placeholder:text-[var(--color-subtle-text)] focus:border-[var(--color-primary-container)]"
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search topics or technologies..."
          type="text"
          value={searchQuery}
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {["All", ...categories].map((category) => {
          const isActive = categoryFilter === category;

          return (
            <button
              className={`gleeple-heading cursor-pointer rounded-full border px-5 py-2 text-[12px] font-bold uppercase tracking-[0.08em] transition-colors ${
                isActive
                  ? "border-[var(--color-primary-container)] bg-[var(--color-primary-container)] text-[var(--color-on-primary)]"
                  : "border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] theme-muted hover:border-[var(--color-primary-container)] hover:text-[var(--color-on-surface)]"
              }`}
              key={category}
              onClick={() => onCategoryFilterChange(category)}
              type="button"
            >
              {category}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TopicGrid({ topics }: { topics: PracticeTopicCard[] }) {
  if (topics.length === 0) {
    return (
      <section className="theme-content-card rounded-xl p-8 text-center">
        <h2 className="gleeple-heading text-2xl font-semibold theme-text">
          No matching practice topics
        </h2>
        <p className="mt-2 theme-muted">
          Try a different search term or category filter.
        </p>
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {topics.map((item) => (
        <PracticeTopicCardLink item={item} key={item.topic.id} />
      ))}
    </section>
  );
}

function PracticeTopicCardLink({ item }: { item: PracticeTopicCard }) {
  const isCompleted =
    item.questionCount > 0 && item.progressPercentage === 100;
  const buttonLabel = isCompleted
    ? "Review"
    : item.completedQuestionCount > 0
      ? "Continue"
      : "Start Practice";
  const levelCounts = getQuestionLevelCounts(item.questionLevelCounts);

  return (
    <RouterLink
      className={`theme-content-card theme-content-card-interactive group flex min-h-[360px] flex-col rounded-xl p-6 transition-transform hover:-translate-y-1 ${
        isCompleted ? "opacity-75" : ""
      }`}
      to={`/practice/${item.topic.id}/`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <span
          className={`gleeple-heading rounded border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${getCategoryBadgeClass(
            item.topic.category
          )}`}
        >
          {item.topic.category}
        </span>

      </div>

      <div className="mb-5 min-h-0">
        <h3 className="gleeple-heading text-2xl font-semibold leading-tight theme-text transition-colors group-hover:text-[var(--color-primary-container)]">
          {item.topic.subtopic}
        </h3>
        <p className="mt-2 text-sm leading-6 theme-muted">
          {item.topic.topic}
        </p>
      </div>

      <div className="mb-5 flex items-center gap-2">
        <div className="flex gap-1">
          {practiceLevels.map((level) => (
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                item.questionLevelCounts.some(
                  (levelCount) => levelCount.level === level
                )
                  ? "bg-[var(--color-primary-container)]"
                  : "bg-[var(--color-outline-variant)] opacity-50"
              }`}
              key={level}
            />
          ))}
        </div>
        <span className="gleeple-heading text-[12px] font-bold uppercase tracking-[0.08em] theme-muted">
          {item.questionCount} Questions
        </span>
      </div>

      {/* <div className="mb-6 space-y-3">
        {item.questions.slice(0, 3).map((question) => (
          <div className="border-l-2 border-[var(--color-outline-variant)] pl-3" key={question.id}>
            <QuestionLevelBadge level={question.level} />
            <p className="mt-1 line-clamp-2 text-sm leading-6 theme-muted">
              {question.question}
            </p>
          </div>
        ))}
        {item.questions.length === 0 ? (
          <p className="text-sm leading-6 theme-muted">
            No interview questions are available for this subtopic yet.
          </p>
        ) : null}
      </div> */}

      {levelCounts.length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {levelCounts.map((levelCount) => (
            <QuestionLevelBadge
              displayText={`${levelCount.count} ${levelCount.level}`}
              key={levelCount.level}
              level={levelCount.level}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-auto">
        <div className="mb-2 flex justify-between gap-3">
          <span className="gleeple-heading text-[12px] font-bold uppercase tracking-[0.08em] theme-muted">
            Progress: {item.progressPercentage}% ({item.completedQuestionCount}/
            {item.questionCount})
          </span>
          {isCompleted ? (
            <span className="gleeple-heading flex items-center gap-1 text-[12px] font-bold uppercase tracking-[0.08em] text-emerald-500">
              <CheckIcon sx={{ fontSize: 14 }} />
              Completed
            </span>
          ) : null}
        </div>
        <div className="theme-progress-track mb-5 h-1 overflow-hidden rounded-full">
          <div
            className={`h-full ${
              isCompleted
                ? "bg-emerald-500"
                : "theme-progress-fill"
            }`}
            style={{ width: `${item.progressPercentage}%` }}
          />
        </div>
        <span
          className={`gleeple-heading block w-full border py-3 text-center text-[12px] font-bold uppercase tracking-[0.08em] transition-colors ${
            isCompleted
              ? "border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] theme-muted"
              : item.completedQuestionCount > 0
                ? "border-[var(--color-primary-container)] bg-[var(--color-surface-container-highest)] text-[var(--color-primary-container)]"
                : "border-[var(--color-primary-container)] bg-[var(--color-primary-container)] text-[var(--color-on-primary)]"
          }`}
        >
          {buttonLabel}
        </span>
      </div>
    </RouterLink>
  );
}

function PracticeIndexCta({ firstTopic }: { firstTopic?: CurriculumSubTopicNode }) {
  return (
    <section className="theme-content-card relative mt-20 overflow-hidden rounded-2xl p-12">
      <div className="absolute inset-0 bg-[var(--color-primary-container)] opacity-5" />
      <div className="relative z-10 flex flex-col items-center justify-between gap-8 md:flex-row">
        <div className="max-w-2xl text-center md:text-left">
          <h2 className="gleeple-heading text-3xl font-semibold theme-text">
            Ready for a real interview simulation?
          </h2>
          <p className="mt-2 leading-7 theme-muted">
            Choose a subtopic and work through a focused interview sequence with
            answer reveal, key points, and persisted progress.
          </p>
        </div>
        {firstTopic ? (
          <Button
            component={RouterLink}
            endIcon={<RocketLaunchOutlinedIcon />}
            sx={{ px: 5, py: 1.5 }}
            to={`/simulation`}
            variant="contained"
          >
            Start simulation
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function TopicNavigation({
  nextTopic,
  onNavigate,
  previousTopic,
}: {
  nextTopic?: CurriculumSubTopicNode;
  onNavigate?: () => void;
  previousTopic?: CurriculumSubTopicNode;
}) {
  return (
    <section className="border-t pt-12 theme-ide-divider">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between">
        <Button
          className="!justify-start !px-6 !py-3"
          component={previousTopic ? RouterLink : "button"}
          disabled={!previousTopic}
          onClick={previousTopic ? onNavigate : undefined}
          startIcon={<ChevronLeftIcon />}
          sx={{
            borderColor: "var(--color-card-border)",
            color: "var(--color-on-surface)",
            minWidth: 184,
          }}
          to={previousTopic ? `/practice/${previousTopic.id}/` : undefined}
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
          onClick={nextTopic ? onNavigate : undefined}
          sx={{ flexGrow: 1 }}
          to={nextTopic ? `/practice/${nextTopic.id}/` : undefined}
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

function PracticeSession({ questions, topic }: PracticeSessionProps) {
  const dispatch = useAppDispatch();
  const progressState = useAppSelector(selectContentProgress);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>();
  const [revealedQuestionId, setRevealedQuestionId] = useState<string>();
  const activeIndex = getQuestionIndex(questions, selectedQuestionId);
  const activeQuestion = questions[activeIndex];
  const { nextSubTopic, previousSubTopic } =
    getCurriculumSubTopicNavigation(topic.id);
  const subtopicProgress =
    progressState[topic.category]?.[topic.topic]?.[topic.subtopic];
  const completedQuestion =
    subtopicProgress?.completedQuestion ?? emptyCompletedQuestions;
  const progress: ContentSubTopicProgress = {
    totalQuestion: subtopicProgress?.totalQuestion ?? questions.length,
    completedQuestion,
  };

  useEffect(() => {
    if (subtopicProgress?.totalQuestion === questions.length) {
      return;
    }

    dispatch(
      setSubTopicProgress({
        category: topic.category,
        topic: topic.topic,
        subtopic: topic.subtopic,
        totalQuestion: questions.length,
        completedQuestion,
      })
    );
  }, [
    completedQuestion,
    dispatch,
    questions.length,
    subtopicProgress?.totalQuestion,
    topic.category,
    topic.subtopic,
    topic.topic,
  ]);

  const markQuestionCompleted = (questionIndex: number) => {
    if (!questions[questionIndex]) {
      return;
    }

    dispatch(
      setQuestionCompletion({
        category: topic.category,
        topic: topic.topic,
        subtopic: topic.subtopic,
        totalQuestion: questions.length,
        questionNumber: questionIndex + 1,
        completed: true,
      })
    );
  };

  const resetCurrentSubTopicProgress = () => {
    dispatch(
      setSubTopicProgress({
        category: topic.category,
        topic: topic.topic,
        subtopic: topic.subtopic,
        totalQuestion: questions.length,
        completedQuestion: [],
      })
    );
    setRevealedQuestionId(undefined);
  };

  const selectQuestion = (questionId: string) => {
    if (questionId !== activeQuestion.id) {
      markQuestionCompleted(activeIndex);
    }

    setSelectedQuestionId(questionId);
    setRevealedQuestionId(undefined);
  };

  const selectQuestionAtIndex = (questionIndex: number) => {
    const nextQuestion = questions[questionIndex];

    if (nextQuestion) {
      selectQuestion(nextQuestion.id);
    }
  };

  const toggleAnswer = () => {
    markQuestionCompleted(activeIndex);
    setRevealedQuestionId((currentQuestionId) =>
      currentQuestionId === activeQuestion.id ? undefined : activeQuestion.id
    );
  };

  return (
    <div className="theme-page mx-auto grid min-h-screen max-w-[1440px] grid-cols-12 gap-6 px-6 pb-20 pt-24">
      <main className="col-span-12 flex flex-col gap-4 lg:col-span-8 xl:col-span-9">
        <header className="mb-4">
          <div className="mb-1 flex items-center gap-2">
            <span className="gleeple-heading text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--color-primary)]">
              DEV_NET_CORE
            </span>
            <span className="h-1 w-1 rounded-full bg-[var(--color-outline-variant)]" />
            <span className="gleeple-heading text-[12px] font-bold uppercase tracking-[0.08em] theme-muted">
              Interview Practice Session
            </span>
          </div>
          <h1 className="gleeple-heading mb-2 text-5xl font-bold leading-tight theme-text md:text-6xl">
            {topic.subtopic}
          </h1>
          <p className="max-w-2xl text-lg leading-8 theme-muted">
            Practice interview questions from beginner through advanced levels,
            then reveal the expected answer when you are ready.
          </p>
        </header>

        <PracticeProgress
          currentQuestion={activeIndex + 1}
          progress={progress}
        />
        <PracticeNavigation
          activeIndex={activeIndex}
          onNext={() => selectQuestionAtIndex(activeIndex + 1)}
          onPrevious={() => selectQuestionAtIndex(activeIndex - 1)}
          totalQuestions={questions.length}
        />
        <QuestionCard question={activeQuestion} topic={topic} />
        <AnswerPanel
          expectedAnswerMarkdown={activeQuestion.expectedAnswerMarkdown}
          isRevealed={revealedQuestionId === activeQuestion.id}
          keyPointsMarkdown={activeQuestion.keyPointsMarkdown}
          onToggle={toggleAnswer}
        />
        <TopicNavigation
          nextTopic={nextSubTopic}
          onNavigate={() => markQuestionCompleted(activeIndex)}
          previousTopic={previousSubTopic}
        />
      </main>

      <aside className="col-span-12 lg:col-span-4 xl:col-span-3">
        <div className="space-y-6 lg:sticky lg:top-24">
       
          <QuestionList
            activeQuestionId={activeQuestion.id}
            completedQuestionNumbers={progress.completedQuestion}
            onSelectQuestion={selectQuestion}
            questions={questions}
          />
             <ResetPracticeProgressButton onReset={resetCurrentSubTopicProgress} />
        </div>
      </aside>
    </div>
  );
}

export default function Practice() {
  const { topicId } = useParams<{ topicId?: string }>();
  const navigate = useNavigate();
  const topic = topicId ? findCurriculumSubTopicById(topicId) : undefined;
  const [loadedPractice, setLoadedPractice] = useState<{
    error: string;
    questions: CommonInterviewQuestion[];
    topicId?: string;
  }>({
    error: "",
    questions: [],
  });
  const topicPractice =
    topic && loadedPractice.topicId === topic.id ? loadedPractice : undefined;

  useEffect(() => {
    let isCancelled = false;

    if (!topic) {
      return;
    }

    topic
      .loadContent()
      .then((markdown) => {
        if (!isCancelled) {
          setLoadedPractice({
            error: "",
            questions: getOrderedPracticeQuestions(markdown),
            topicId: topic.id,
          });
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setLoadedPractice({
            error: "Unable to load practice questions for this topic.",
            questions: [],
            topicId: topic.id,
          });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [topic]);

  if (!topicId) {
    return <PracticeIndexPage />;
  }

  if (!topic) {
    return <EmptyPracticeState onGoBack={() => navigate(-1)} />;
  }

  if (!topicPractice) {
    return <PracticeLoadingState />;
  }

  if (topicPractice.error || topicPractice.questions.length === 0) {
    return (
      <EmptyPracticeState
        message={topicPractice.error || undefined}
        onGoBack={() => navigate(-1)}
      />
    );
  }

  return (
    <PracticeSession
      key={topic.id}
      questions={topicPractice.questions}
      topic={topic}
    />
  );
}
