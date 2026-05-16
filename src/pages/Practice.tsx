import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckIcon from "@mui/icons-material/Check";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import HelpCenterOutlinedIcon from "@mui/icons-material/HelpCenterOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import { Button } from "@mui/material";
import { useState } from "react";

type PracticeTag = {
  label: string;
  className: string;
};

const currentQuestion = 3;
const totalQuestions = 20;
const completion = Math.round((currentQuestion / totalQuestions) * 100);

const tags: PracticeTag[] = [
  {
    label: ".NET Core",
    className:
      "border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] text-[var(--color-primary)]",
  },
  {
    label: "Intermediate",
    className:
      "border-[color-mix(in_srgb,var(--color-secondary)_28%,transparent)] bg-[color-mix(in_srgb,var(--color-secondary)_10%,transparent)] text-[var(--color-secondary)]",
  },
];

function PracticeProgress() {
  return (
    <section className="theme-content-card rounded-lg p-4">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <span className="gleeple-heading text-2xl font-semibold text-[var(--color-primary)]">
            Question {currentQuestion}
          </span>
          <span className="text-base theme-muted">of {totalQuestions}</span>
        </div>
        <span className="gleeple-heading text-[12px] font-bold uppercase tracking-[0.08em] theme-accent">
          {completion}% Complete
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

function PracticeNavigation() {
  return (
    <div className="flex items-center justify-between px-2">
      <button
        className="group flex cursor-pointer items-center gap-2 theme-muted transition-colors hover:text-[var(--color-on-surface)]"
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
        className="group flex cursor-pointer items-center gap-2 theme-muted transition-colors hover:text-[var(--color-on-surface)]"
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

function QuestionCard() {
  return (
    <section className="theme-content-card overflow-hidden rounded-xl border-t-2 border-t-[color-mix(in_srgb,var(--color-secondary)_40%,transparent)]">
      <div className="p-8">
        <div className="mb-6 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              className={`gleeple-heading rounded border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${tag.className}`}
              key={tag.label}
            >
              {tag.label}
            </span>
          ))}
          <span className="gleeple-heading flex items-center gap-1 rounded border border-[color-mix(in_srgb,var(--color-tertiary)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-tertiary)_10%,transparent)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-tertiary)]">
            <ScheduleOutlinedIcon sx={{ fontSize: 13 }} />
            5 Min Est.
          </span>
        </div>

        <h2 className="gleeple-heading text-2xl font-semibold leading-tight theme-text md:text-3xl">
          What is Dependency Injection in .NET, and why is it useful?
        </h2>
      </div>
    </section>
  );
}

function AnswerPanel() {
  const [showAnswer, setShowAnswer] = useState(false);

  return (
    <section className="theme-content-card rounded-xl border-2 border-dashed border-[var(--color-outline-variant)] p-8">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-container-high)] theme-subtle">
          <LockOutlinedIcon sx={{ fontSize: 28 }} />
        </div>

        {showAnswer ? (
          <p className="text-base leading-8 theme-muted md:text-lg">
            Dependency Injection is a pattern where dependencies are provided to
            a class from the outside instead of being constructed inside it. In
            .NET, the built-in container manages service creation, lifetimes,
            and resolution so code stays testable, loosely coupled, and easier
            to replace.
          </p>
        ) : (
          <p className="text-base leading-8 theme-muted md:text-lg">
            Think through your answer first, then reveal the suggested response.
          </p>
        )}

        <Button
          onClick={() => setShowAnswer((current) => !current)}
          sx={{ borderRadius: 999, px: 6, py: 1.5 }}
          variant="contained"
        >
          {showAnswer ? "Hide Answer" : "Show Answer"}
        </Button>
      </div>
    </section>
  );
}

function QuestionList() {
  return (
    <section className="theme-content-card overflow-hidden rounded-xl">
      <div className="flex items-center justify-between border-b bg-[var(--color-surface-container)] p-4 theme-ide-divider">
        <h2 className="gleeple-heading text-[12px] font-bold uppercase tracking-[0.08em] theme-text">
          Question List
        </h2>
        <span className="text-[10px] theme-muted">
          {currentQuestion}/{totalQuestions}
        </span>
      </div>

      <div className="content-scrollbar max-h-[calc(100vh-250px)] overflow-y-auto p-4">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: totalQuestions }, (_, index) => {
            const number = index + 1;
            const completed = number < currentQuestion;
            const active = number === currentQuestion;

            return (
              <button
                className={`aspect-square rounded text-base transition-all ${
                  completed
                    ? "border border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] text-[var(--color-primary)] hover:bg-[var(--color-accent-hover)]"
                    : active
                      ? "border-2 border-[var(--color-primary-container)] bg-[var(--color-surface-container-high)] font-bold text-[var(--color-primary-container)] shadow-[var(--shadow-accent-glow)]"
                      : "border border-[var(--color-outline-variant)] theme-muted hover:border-[var(--color-outline)]"
                }`}
                key={number}
                type="button"
              >
                {completed ? <CheckIcon sx={{ fontSize: 16 }} /> : number}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t bg-[var(--color-surface-container-low)] p-4 theme-ide-divider">
        <Button
          fullWidth
          startIcon={<FlagOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={{
            backgroundColor: "var(--color-chip-background)",
            color: "var(--color-on-surface-variant)",
            "&:hover": {
              backgroundColor: "var(--color-accent-hover)",
              color: "var(--color-on-surface)",
            },
          }}
          variant="text"
        >
          Flag Question
        </Button>
      </div>
    </section>
  );
}

function HintCard() {
  return (
    <button
      className="theme-content-card theme-content-card-interactive flex w-full cursor-pointer items-center gap-4 rounded-xl p-4 text-left"
      type="button"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-[color-mix(in_srgb,var(--color-secondary)_20%,transparent)] text-[var(--color-secondary)] transition-transform group-hover:scale-110">
        <HelpCenterOutlinedIcon />
      </span>
      <span>
        <span className="gleeple-heading block text-sm font-bold uppercase tracking-[0.08em] theme-text">
          Need A Hint?
        </span>
        <span className="text-[10px] theme-muted">
          Reduces potential score by 10%
        </span>
      </span>
    </button>
  );
}

export default function Practice() {
  return (
    <div className="theme-page mx-auto grid min-h-screen max-w-[1440px] grid-cols-12 gap-6 px-6 pb-20 pt-24">
      <main className="col-span-12 flex flex-col gap-4 lg:col-span-9">
        <header className="mb-4">
          <div className="mb-1 flex items-center gap-2">
            <span className="gleeple-heading text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--color-primary)]">
              DEV_NET_CORE
            </span>
            <span className="h-1 w-1 rounded-full bg-[var(--color-outline-variant)]" />
            <span className="gleeple-heading text-[12px] font-bold uppercase tracking-[0.08em] theme-muted">
              Mock Interview Session
            </span>
          </div>
          <h1 className="gleeple-heading mb-2 text-5xl font-bold leading-tight theme-text md:text-6xl">
            Dependency Injection
          </h1>
          <p className="max-w-2xl text-lg leading-8 theme-muted">
            Practice interview questions one at a time and reveal answers when
            you are ready. This simulation focus on senior-level .NET
            architecture principles.
          </p>
        </header>

        <PracticeProgress />
        <PracticeNavigation />
        <QuestionCard />
        <AnswerPanel />
      </main>

      <aside className="col-span-12 lg:col-span-3">
        <div className="space-y-6 lg:sticky lg:top-24">
          <QuestionList />
          <HintCard />
        </div>
      </aside>
    </div>
  );
}
