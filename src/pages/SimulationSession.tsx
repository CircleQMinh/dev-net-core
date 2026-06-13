import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import GraphicEqOutlinedIcon from "@mui/icons-material/GraphicEqOutlined";
import KeyboardOutlinedIcon from "@mui/icons-material/KeyboardOutlined";

import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QuestionLevelBadge } from "../components/practice/QuestionLevelBadge";
import { useAppDispatch, useAppSelector } from "../lib/redux/hooks/hooks";
import { selectSimulationCurrentSession } from "../lib/redux/selectors/simulationSelectors";
import {
  clearSimulationSession,
  completeSimulationSession,
  getSimulationElapsedTimeInSeconds,
  saveSimulationAnswer,
  setSimulationCurrentQuestionIndex,
  setSimulationElapsedTime,
} from "../lib/redux/slices/simulationSlice";

// const quickJumpItems = [
//   { number: "01", label: "Intro & Background", score: "8.2 / 10", status: "complete" },
//   { number: "02", label: "Dotnet Architecture", score: "7.5 / 10", status: "complete" },
//   { number: "03", label: "Data Structures", score: "9.0 / 10", status: "complete" },
//   { number: "04", label: "Task vs ValueTask", status: "active" },
//   { number: "05", label: "Garbage Collection", status: "locked" },
//   { number: "06", label: "Microservices", status: "locked" },
// ] as const;

export default function SimulationSession() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const session = useAppSelector(selectSimulationCurrentSession);
  const questions = session?.questions ?? [];
  const currentQuestionIndex = session?.currentQuestionIndex ?? 0;
  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const currentQuestionNumber = currentQuestion ? currentQuestionIndex + 1 : 0;
  const savedCurrentResponse = currentQuestion
    ? session?.answersByQuestionId[currentQuestion.id] ?? ""
    : "";
  const [responseDraft, setResponseDraft] = useState({
    questionId: currentQuestion?.id ?? "",
    value: savedCurrentResponse,
  });
  const response =
    responseDraft.questionId === currentQuestion?.id
      ? responseDraft.value
      : savedCurrentResponse;
  const [answerError, setAnswerError] = useState("");
  const responseWordCount = useMemo(
    () => response.trim().split(/\s+/).filter(Boolean).length,
    [response]
  );
  const isFirstQuestion = currentQuestionIndex === 0;
  const isLastQuestion =
    totalQuestions > 0 && currentQuestionIndex === totalQuestions - 1;
  const elapsedTimeInSeconds = session
    ? getSimulationElapsedTimeInSeconds(session)
    : 0;
  const timerSessionId = session?.sessionId;
  const timerStartedAt = session?.startedAt;
  const timerStep = session?.step;

  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => {
      window.scrollTo({
        behavior: "auto",
        left: 0,
        top: 0,
      });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [sessionId]);

  useEffect(() => {
    if (!session) {
      navigate("/simulation", { replace: true });
      return;
    }

    if (session.sessionId !== sessionId) {
      navigate(`/simulation/session/${session.sessionId}`, { replace: true });
      return;
    }

    if (session.step === "result") {
      navigate(`/simulation/result/${session.sessionId}`, { replace: true });
      return;
    }

    if (session.questions.length === 0) {
      dispatch(clearSimulationSession());
      navigate("/simulation/setup", { replace: true });
    }
  }, [dispatch, navigate, session, sessionId]);

  useEffect(() => {
    if (
      !timerStartedAt ||
      timerStep !== "session" ||
      timerSessionId !== sessionId
    ) {
      return;
    }

    const updateElapsedTime = () => {
      dispatch(
        setSimulationElapsedTime(
          calculateElapsedTimeFromStartedAt(timerStartedAt)
        )
      );
    };

    updateElapsedTime();
    const timerId = window.setInterval(updateElapsedTime, 1000);

    return () => window.clearInterval(timerId);
  }, [
    dispatch,
    sessionId,
    timerSessionId,
    timerStartedAt,
    timerStep,
  ]);

  const saveCurrentResponse = () => {
    if (!currentQuestion) {
      return "";
    }

    const normalizedResponse = response.trim();

    dispatch(
      saveSimulationAnswer({
        answer: normalizedResponse,
        questionId: currentQuestion.id,
      })
    );

    return normalizedResponse;
  };

  const showQuestionAtIndex = (questionIndex: number) => {
    const nextQuestion = questions[questionIndex];

    if (!nextQuestion || !session) {
      return;
    }

    setResponseDraft({
      questionId: nextQuestion.id,
      value: session.answersByQuestionId[nextQuestion.id] ?? "",
    });
    setAnswerError("");
    dispatch(setSimulationCurrentQuestionIndex(questionIndex));
  };

  const goToPreviousQuestion = () => {
    if (isFirstQuestion) {
      return;
    }

    saveCurrentResponse();
    showQuestionAtIndex(currentQuestionIndex - 1);
  };

  const finishSimulation = () => {
    if (!session) {
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
    navigate(`/simulation/result/${session.sessionId}`);
  };

  const goToNextQuestion = () => {
    const normalizedResponse = response.trim();

    if (!normalizedResponse) {
      setAnswerError("Enter an answer before continuing.");
      return;
    }

    saveCurrentResponse();

    if (isLastQuestion && session) {
      finishSimulation();
      return;
    }

    showQuestionAtIndex(currentQuestionIndex + 1);
  };

  const skipCurrentQuestion = () => {
    if (!currentQuestion) {
      return;
    }

    dispatch(
      saveSimulationAnswer({
        answer: "Skipped.",
        questionId: currentQuestion.id,
      })
    );

    if (isLastQuestion && session) {
      finishSimulation();
      return;
    }

    showQuestionAtIndex(currentQuestionIndex + 1);
  };

  return (
    <div className="theme-page theme-grid-pattern min-h-screen pt-20">
      <main className="mx-auto grid w-full max-w-[1440px] grid-cols-1 items-start gap-6 px-4 py-6 md:px-6 lg:grid-cols-12 lg:px-12 lg:py-12">
        <div className="flex flex-col gap-6 lg:col-span-8">
          <article className="theme-content-card relative overflow-hidden rounded-lg border-t-2 border-t-[var(--color-primary-container)] p-6 md:p-10">
            <span className="gleeple-heading absolute right-6 top-6 hidden rounded-sm bg-[var(--color-surface-container-highest)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] theme-muted sm:block">
              {currentQuestion?.topic ?? "Simulation"}
            </span>

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="gleeple-heading text-[12px] font-bold uppercase tracking-[0.08em] theme-accent">
                Question {formatQuestionNumber(currentQuestionNumber)} of{" "}
                {formatQuestionNumber(totalQuestions)}
              </span>
              {currentQuestion ? (
                <QuestionLevelBadge level={currentQuestion.level} />
              ) : null}
            </div>

            <h1 className="gleeple-heading mb-6 max-w-4xl text-2xl font-semibold leading-[1.3] theme-text md:text-[32px]">
              {currentQuestion?.question ?? "Loading simulation question..."}
            </h1>

            <div className="gleeple-heading flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-bold uppercase tracking-[0.05em] theme-subtle">
              <span className="flex items-center gap-1.5">
                <TimerOutlinedIcon sx={{ fontSize: 17 }} />
                Recommended: 4 min
              </span>
              <span className="flex items-center gap-1.5">
                <PsychologyOutlinedIcon sx={{ fontSize: 17 }} />
                Topic: {currentQuestion?.subTopic ?? "Preparing session"}
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
                <span className="theme-accent">
                  {formatElapsedTime(elapsedTimeInSeconds)}
                </span>
              </div>
            </div>

            <textarea
              aria-label="Interview response"
              aria-describedby={answerError ? "simulation-answer-error" : undefined}
              className={`gleeple-code theme-code-surface min-h-[240px] flex-1 resize-y rounded-lg p-5 text-sm leading-7 outline-none transition-colors placeholder:text-[var(--color-subtle-text)] focus:border-[var(--color-primary-container)] md:p-6 md:text-base ${
                answerError
                  ? "border-[var(--color-error)]"
                  : "border-[var(--color-card-border)]"
              }`}
              onBlur={saveCurrentResponse}
              onChange={(event) => {
                setResponseDraft({
                  questionId: currentQuestion?.id ?? "",
                  value: event.target.value,
                });

                if (answerError && event.target.value.trim()) {
                  setAnswerError("");
                }
              }}
              placeholder="Type your answer here..."
              spellCheck
              value={response}
            />
            {answerError ? (
              <p
                className="gleeple-code mt-3 text-[12px] text-[var(--color-error)]"
                id="simulation-answer-error"
                role="alert"
              >
                {answerError}
              </p>
            ) : null}
          </section>

          {/* <AnswerPanel
            expectedAnswerMarkdown={sampleAnswerMarkdown}
            isRevealed={isAnswerRevealed}
            keyPointsMarkdown={sampleKeyPointsMarkdown}
            onToggle={toggleAnswer}
          /> */}
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
                  {formatElapsedTime(elapsedTimeInSeconds)}
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
                <span className="gleeple-heading text-2xl font-semibold theme-text">
                  {currentQuestionNumber} / {totalQuestions}
                </span>
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

          <section className="theme-content-card rounded-lg p-5 md:p-6">
            <h2 className="gleeple-heading mb-4 text-[12px] font-bold uppercase tracking-[0.08em] theme-muted">
              How to continue
            </h2>
            <ol className="gleeple-code space-y-3 text-sm leading-6 theme-muted">
              <li>1. Read the current interview question.</li>
              <li>2. Type your response in Live Response.</li>
              <li>
                3. Select Next Question to save it, or Skip to continue without
                a response.
              </li>
              <li>4. Use Previous to review or edit earlier answers.</li>
            </ol>
            <p className="gleeple-code mt-4 border-t border-[var(--color-card-border)] pt-4 text-[12px] leading-5 theme-subtle">
              Your responses and skipped questions are saved with this
              simulation session.
            </p>
          </section>
        </aside>

        {/* bottom action bar */}
        <section className="theme-content-card sticky bottom-0 z-30 col-span-full flex w-full flex-col gap-3 rounded-lg p-3 shadow-[0_-12px_30px_color-mix(in_srgb,var(--color-background)_70%,transparent)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-4 md:p-5">
          <div className="flex w-full items-center sm:w-auto">
            <button
              aria-label="Previous question"
              className={`gleeple-heading flex min-h-12 w-full items-center justify-center gap-1 rounded-sm border border-[var(--color-card-border)] bg-[var(--color-surface-container-high)] px-4 py-3 text-[12px] font-bold uppercase theme-muted transition-colors sm:w-auto ${
                isFirstQuestion
                  ? "cursor-not-allowed opacity-45"
                  : "cursor-pointer hover:border-[var(--color-primary-container)] hover:text-[var(--color-primary-container)]"
              }`}
              disabled={isFirstQuestion}
              onClick={goToPreviousQuestion}
              type="button"
            >
              <ChevronLeftIcon sx={{ fontSize: 19 }} />
              Previous
            </button>
          </div>

          <div className="grid w-full grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-3 sm:flex sm:w-auto sm:items-center sm:justify-end">
            {/* <button
              type="button"
              onClick={toggleAnswer}
              className="gleeple-heading flex cursor-pointer items-center justify-center gap-2 rounded-sm border border-[color-mix(in_srgb,var(--color-primary-container)_40%,transparent)] px-5 py-3 text-[12px] font-bold uppercase theme-accent"
            >
              <VisibilityOutlinedIcon sx={{ fontSize: 20 }} />
              {isAnswerRevealed ? "Hide Sample Answer" : "Reveal Sample Answer"}
            </button> */}
            <button
              className="gleeple-heading flex min-h-12 w-full cursor-pointer items-center justify-center rounded-sm border border-[var(--color-card-border)] bg-[var(--color-surface-container-high)] px-5 py-3 text-[12px] font-bold uppercase theme-muted transition-colors hover:border-[var(--color-primary-container)] hover:text-[var(--color-primary-container)] sm:w-auto"
              onClick={skipCurrentQuestion}
              type="button"
            >
              Skip
            </button>
            <button
              className="gleeple-heading flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-sm bg-[var(--color-primary-container)] px-5 py-3 text-center text-[12px] font-bold uppercase text-[var(--color-on-primary-container)] shadow-[var(--shadow-accent-glow)] transition-all hover:brightness-110 active:scale-[0.98] sm:w-auto"
              onClick={goToNextQuestion}
              type="button"
            >
              {isLastQuestion ? "Finish Simulation" : "Next Question"}
              <ChevronRightIcon sx={{ fontSize: 20 }} />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function formatQuestionNumber(questionNumber: number) {
  return String(questionNumber).padStart(2, "0");
}

function formatElapsedTime(elapsedTimeInSeconds: number) {
  const hours = Math.floor(elapsedTimeInSeconds / 3600);
  const minutes = Math.floor((elapsedTimeInSeconds % 3600) / 60);
  const seconds = elapsedTimeInSeconds % 60;

  return hours > 0
    ? [hours, minutes, seconds]
        .map((value) => String(value).padStart(2, "0"))
        .join(":")
    : [minutes, seconds]
        .map((value) => String(value).padStart(2, "0"))
        .join(":");
}

function calculateElapsedTimeFromStartedAt(startedAt: string) {
  const startedAtTime = Date.parse(startedAt);

  if (!Number.isFinite(startedAtTime)) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - startedAtTime) / 1000));
}
