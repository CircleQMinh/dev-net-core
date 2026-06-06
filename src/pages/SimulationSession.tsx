
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import GraphicEqOutlinedIcon from "@mui/icons-material/GraphicEqOutlined";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import KeyboardOutlinedIcon from "@mui/icons-material/KeyboardOutlined";

import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { useMemo, useState } from "react";
import { AnswerPanel } from "../components/practice/AnswerPanel";

const progressSteps = [
  { number: 1, label: "Intro", status: "complete" },
  { number: 2, label: "Experience", status: "complete" },
  { number: 3, label: "Coding", status: "complete" },
  { number: 4, label: "Deep Dive", status: "active" },
  { number: 5, label: "System Design", status: "upcoming" },
] as const;

// const quickJumpItems = [
//   { number: "01", label: "Intro & Background", score: "8.2 / 10", status: "complete" },
//   { number: "02", label: "Dotnet Architecture", score: "7.5 / 10", status: "complete" },
//   { number: "03", label: "Data Structures", score: "9.0 / 10", status: "complete" },
//   { number: "04", label: "Task vs ValueTask", status: "active" },
//   { number: "05", label: "Garbage Collection", status: "locked" },
//   { number: "06", label: "Microservices", status: "locked" },
// ] as const;

const sampleAnswerMarkdown = `
\`Task\` is a reference type and is the default choice for asynchronous APIs. It represents an operation that may complete later and can be awaited multiple times.

\`ValueTask\` is a value type that can directly contain a result or wrap an asynchronous operation. It can avoid allocating a \`Task\` when an operation frequently completes synchronously, such as a cache hit.

Prefer \`Task\` unless profiling shows that allocations in a hot path matter. Use \`ValueTask\` only when synchronous completion is common and callers can follow its usage constraints.
`;

const sampleKeyPointsMarkdown = `
- Use \`Task\` as the general-purpose default.
- Consider \`ValueTask\` for performance-sensitive paths that often complete synchronously.
- A \`ValueTask\` should normally be awaited only once.
- Measure the allocation benefit before accepting the additional complexity.
`;

export default function SimulationSession() {
  const [response, setResponse] = useState("");
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const responseWordCount = useMemo(
    () => response.trim().split(/\s+/).filter(Boolean).length,
    [response]
  );

  const toggleAnswer = () => {
    setIsAnswerRevealed((isRevealed) => !isRevealed);
  };

  return (
    <div className="theme-page theme-grid-pattern min-h-screen pt-20">
      <main className="mx-auto grid w-full max-w-[1440px] grid-cols-1 items-start gap-6 px-4 py-6 md:px-6 lg:grid-cols-12 lg:px-12 lg:py-12">
        <section className="theme-content-card col-span-full overflow-x-auto rounded-lg p-5 md:p-6">
          <div className="mb-6 flex items-center justify-between gap-4 px-1 md:px-4">
            <h2 className="gleeple-heading text-[12px] font-bold uppercase tracking-[0.08em] theme-muted">
              Interview Progress
            </h2>
            <span className="gleeple-heading whitespace-nowrap text-[12px] font-bold uppercase tracking-[0.08em] theme-accent">
              4 / 8 Completed
            </span>
          </div>

          <div className="relative flex min-w-[320px] items-start justify-between sm:min-w-[620px] sm:px-4">
            <div className="absolute left-4 right-4 top-4 h-px bg-[var(--color-outline-variant)] opacity-40 sm:left-8 sm:right-8 sm:top-5" />
            {progressSteps.map((step) => {
              const isActive = step.status === "active";
              const isUpcoming = step.status === "upcoming";

              return (
                <div
                  key={step.number}
                  className={`relative z-10 flex w-14 flex-col items-center gap-2 sm:w-24 ${
                    isUpcoming ? "opacity-50" : ""
                  }`}
                >
                  <div
                    className={`gleeple-heading flex items-center justify-center rounded-full bg-[var(--color-background)] font-bold ${
                      isActive
                        ? "h-10 w-10 border-2 border-[var(--color-primary-container)] bg-[var(--color-accent-soft)] text-[var(--color-primary-container)] shadow-[var(--shadow-accent-glow)] sm:h-12 sm:w-12"
                        : "h-8 w-8 border border-[var(--color-primary-container)] text-[var(--color-primary-container)] shadow-[0_0_10px_color-mix(in_srgb,var(--color-primary-container)_30%,transparent)] sm:h-10 sm:w-10"
                    } ${
                      isUpcoming
                        ? "border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] shadow-none"
                        : ""
                    }`}
                  >
                    {step.number}
                  </div>
                  <span
                    className={`gleeple-heading text-center text-[8px] font-bold uppercase sm:text-[10px] ${
                      isActive ? "theme-accent" : "theme-muted"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <div className="flex flex-col gap-6 lg:col-span-8">
          <article className="theme-content-card relative overflow-hidden rounded-lg border-t-2 border-t-[var(--color-primary-container)] p-6 md:p-10">
            <span className="gleeple-heading absolute right-6 top-6 hidden rounded-sm bg-[var(--color-surface-container-highest)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] theme-muted sm:block">
              .NET Internals
            </span>

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="gleeple-heading text-[12px] font-bold uppercase tracking-[0.08em] theme-accent">
                Question 04
              </span>
              <span className="gleeple-heading flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--color-secondary)_25%,transparent)] bg-[color-mix(in_srgb,var(--color-secondary)_10%,transparent)] px-3 py-1 text-[10px] font-bold uppercase text-[var(--color-secondary)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-secondary)]" />
                Intermediate
              </span>
            </div>

            <h1 className="gleeple-heading mb-6 max-w-4xl text-2xl font-semibold leading-[1.3] theme-text md:text-[32px]">
              Explain the difference between{" "}
              <code className="gleeple-code text-[var(--color-secondary)]">Task</code> and{" "}
              <code className="gleeple-code text-[var(--color-secondary)]">ValueTask</code> in
              .NET. When would you prefer one over the other?
            </h1>

            <div className="gleeple-heading flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-bold uppercase tracking-[0.05em] theme-subtle">
              <span className="flex items-center gap-1.5">
                <TimerOutlinedIcon sx={{ fontSize: 17 }} />
                Recommended: 4 min
              </span>
              <span className="flex items-center gap-1.5">
                <PsychologyOutlinedIcon sx={{ fontSize: 17 }} />
                Topic: Async/Await
              </span>
            </div>
          </article>
          {/* Response section */}
          <section className="theme-content-card flex min-h-[320px] flex-col rounded-lg p-5 md:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="gleeple-heading flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] theme-muted">
                <KeyboardOutlinedIcon sx={{ fontSize: 19 }} />
                Live Response
              </h2>
              <div className="gleeple-code flex items-center gap-4 text-[12px]">
                <span className="theme-muted">Words: {responseWordCount}</span>
                <span className="theme-accent">04:32</span>
              </div>
            </div>

            <textarea
              aria-label="Interview response"
              className="gleeple-code theme-code-surface min-h-[240px] flex-1 resize-y rounded-lg p-5 text-sm leading-7 outline-none transition-colors placeholder:text-[var(--color-subtle-text)] focus:border-[var(--color-primary-container)] md:p-6 md:text-base"
              onChange={(event) => setResponse(event.target.value)}
              placeholder="Type your answer here..."
              spellCheck
              value={response}
            />
          </section>

          <AnswerPanel
            expectedAnswerMarkdown={sampleAnswerMarkdown}
            isRevealed={isAnswerRevealed}
            keyPointsMarkdown={sampleKeyPointsMarkdown}
            onToggle={toggleAnswer}
          />
        </div>

        <aside className="flex flex-col gap-6 lg:col-span-4">
          <section className="theme-content-card rounded-lg p-5 md:p-6">
            <h2 className="gleeple-heading mb-5 text-[12px] font-bold uppercase tracking-[0.08em] theme-muted">
              Session Health
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border border-[var(--color-card-border)] bg-[var(--color-surface-container-high)] p-3">
                <span className="gleeple-heading mb-1 block text-[10px] font-bold uppercase tracking-[0.05em] theme-muted">
                  Time Elapsed
                </span>
                <span className="gleeple-heading text-2xl font-semibold text-[var(--color-primary)]">
                  04:32
                </span>
              </div>
              {/* <div className="rounded border border-[var(--color-card-border)] bg-[var(--color-surface-container-high)] p-3">
                <span className="gleeple-heading mb-1 block text-[10px] font-bold uppercase tracking-[0.05em] theme-muted">
                  Avg. Score
                </span>
                <span className="gleeple-heading text-2xl font-semibold text-[var(--color-tertiary)]">
                  78%
                </span>
              </div> */}
              <div className="rounded border border-[var(--color-card-border)] bg-[var(--color-surface-container-high)] p-3">
                <span className="gleeple-heading mb-1 block text-[10px] font-bold uppercase tracking-[0.05em] theme-muted">
                  Questions
                </span>
                <span className="gleeple-heading text-2xl font-semibold theme-text">4 / 8</span>
              </div>
              {/* <div className="flex flex-col justify-center rounded border border-[var(--color-card-border)] bg-[var(--color-surface-container-high)] p-3">
                <span className="gleeple-heading mb-2 block text-[10px] font-bold uppercase tracking-[0.05em] theme-muted">
                  AI Confidence
                </span>
                <div className="theme-progress-track h-1.5 overflow-hidden rounded-full">
                  <div className="theme-progress-fill h-full w-[85%] rounded-full" />
                </div>
              </div> */}
            </div>
          </section>
{/*
          <section className="theme-content-card rounded-lg p-5 md:p-6">
            <h2 className="gleeple-heading mb-5 text-[12px] font-bold uppercase tracking-[0.08em] theme-muted">
              Quick Jump
            </h2>
            <div className="flex flex-col gap-2">
              {quickJumpItems.map((item) => {
                const isComplete = item.status === "complete";
                const isActive = item.status === "active";

                return (
                  <button
                    key={item.number}
                    type="button"
                    className={`group flex min-h-11 w-full cursor-default items-center justify-between gap-3 rounded border p-3 text-left transition-colors ${
                      isComplete
                        ? "border-[color-mix(in_srgb,var(--color-tertiary)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-tertiary)_10%,transparent)]"
                        : isActive
                          ? "border-[var(--color-primary-container)] bg-[var(--color-accent-soft)] shadow-[0_0_10px_color-mix(in_srgb,var(--color-primary-container)_10%,transparent)]"
                          : "border-[var(--color-card-border)] bg-[color-mix(in_srgb,var(--color-surface-container-high)_50%,transparent)] opacity-60"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      {isComplete ? (
                        <CheckCircleIcon
                          className="shrink-0 text-[var(--color-tertiary)]"
                          sx={{ fontSize: 20 }}
                        />
                      ) : isActive ? (
                        <PlayCircleOutlineIcon
                          className="shrink-0 text-[var(--color-primary-container)]"
                          sx={{ fontSize: 20 }}
                        />
                      ) : (
                        <LockOutlinedIcon
                          className="shrink-0 text-[var(--color-on-surface-variant)]"
                          sx={{ fontSize: 20 }}
                        />
                      )}
                      <span
                        className={`gleeple-heading truncate text-[11px] font-bold uppercase ${
                          isActive ? "theme-accent" : "theme-text"
                        }`}
                      >
                        {item.number}. {item.label}
                      </span>
                    </span>
                    {isComplete && "score" in item ? (
                      <span className="gleeple-code shrink-0 text-[10px] text-[var(--color-tertiary)] opacity-0 transition-opacity group-hover:opacity-100">
                        {item.score}
                      </span>
                    ) : null}
                    {isActive ? (
                      <span className="gleeple-code shrink-0 animate-pulse text-[10px] theme-accent">
                        Active
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section> */}

          <section className="theme-content-card group relative h-32 overflow-hidden rounded-lg">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCCxuTWCn2WMMl9soy808cxVJqI7-rQHZ7GtWFGEUMClv2YGi6ufkmnMIX2nq7dlv3p_mfyqp8jRtGg3tpuOSu9JvO5itTjeux8XJhNugDzMeB1ZVJaDEinN0QJ7wa_6o_d2m0CqRD8vjCa8Mbad4hEKSJHTqatm2IaQs84hW6cX8onOeXkniuoBn19OWbe9ByOztC6s0ebgxx0QpV7eekr3yjcQWVDd-eoQ2DY67FdjkR74QOqX5BTq3hKJXNnrhzWbbWMtFriW0fp"
              alt=""
              className="h-full w-full object-cover opacity-20 transition-opacity group-hover:opacity-40"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-[var(--color-background)] to-transparent p-6">
              <GraphicEqOutlinedIcon
                className="mb-2 text-[var(--color-primary-container)]"
                sx={{ fontSize: 24 }}
              />
              <span className="gleeple-heading mb-2 text-[10px] font-bold uppercase tracking-[0.18em] theme-accent">
                System Optimized
              </span>
              <span className="flex gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 animate-ping rounded-full bg-[var(--color-primary-container)]" />
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary-container)]" />
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary-container)]" />
              </span>
            </div>
          </section>
        </aside>

        {/* bottom action bar */}
        <section className="theme-content-card sticky bottom-0 z-30 col-span-full flex flex-col gap-4 rounded-lg p-4 shadow-[0_-12px_30px_color-mix(in_srgb,var(--color-background)_70%,transparent)] backdrop-blur-xl md:p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center justify-between gap-4 xl:justify-start">
            <button
              type="button"
              className="gleeple-heading flex cursor-default items-center gap-1 rounded-sm border border-[var(--color-card-border)] bg-[var(--color-surface-container-high)] px-4 py-3 text-[12px] font-bold uppercase theme-muted"
            >
              <ChevronLeftIcon sx={{ fontSize: 19 }} />
              Previous
            </button>
            <div className="hidden h-8 w-px bg-[var(--color-outline-variant)] opacity-40 sm:block" />
            <div className="hidden flex-col sm:flex">
              <span className="gleeple-heading text-[10px] font-bold uppercase theme-muted">
                Shortcut
              </span>
              <span className="gleeple-code text-[11px] text-[var(--color-primary)]">
                Cmd + [
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
            <button
              type="button"
              onClick={toggleAnswer}
              className="gleeple-heading flex cursor-pointer items-center justify-center gap-2 rounded-sm border border-[color-mix(in_srgb,var(--color-primary-container)_40%,transparent)] px-5 py-3 text-[12px] font-bold uppercase theme-accent"
            >
              <VisibilityOutlinedIcon sx={{ fontSize: 20 }} />
              {isAnswerRevealed ? "Hide Sample Answer" : "Reveal Sample Answer"}
            </button>
            <button
              type="button"
              className="gleeple-heading flex cursor-default items-center justify-center gap-2 rounded-sm bg-[var(--color-primary-container)] px-5 py-3 text-[12px] font-bold uppercase text-[var(--color-on-primary-container)] shadow-[var(--shadow-accent-glow)]"
            >
              Next Question
              <ChevronRightIcon sx={{ fontSize: 20 }} />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 xl:justify-end">
            <div className="flex flex-col text-left xl:text-right">
              <span className="gleeple-heading text-[10px] font-bold uppercase theme-muted">
                Ready to Submit
              </span>
              <span className="gleeple-code text-[11px] text-[var(--color-tertiary)]">
                Cmd + Enter
              </span>
            </div>
            <div className="h-8 w-px bg-[var(--color-outline-variant)] opacity-40" />
            <button
              type="button"
              aria-label="Help"
              className="flex h-10 w-10 cursor-default items-center justify-center rounded-full border border-[var(--color-card-border)] bg-[var(--color-surface-container-high)] theme-muted"
            >
              <HelpOutlineIcon sx={{ fontSize: 21 }} />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
