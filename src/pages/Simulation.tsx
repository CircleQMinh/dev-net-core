import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import MemoryOutlinedIcon from "@mui/icons-material/MemoryOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import StairsOutlinedIcon from "@mui/icons-material/StairsOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getAllCurriculumCategories,
  getCurriculumTopicsByCategory,
} from "../shared/function";
import { useAppDispatch, useAppSelector } from "../lib/redux/hooks/hooks";
import {
  selectSimulationCurrentSessionId,
  selectSimulationDifficultyLevel,
  selectSimulationSelectedCategoryIds,
  selectSimulationSelectedSubTopicIds,
  selectSimulationSelectedTopicIds,
  selectSimulationSessionLength,
  selectSimulationState,
  selectSimulationStep,
} from "../lib/redux/selectors/simulationSelectors";
import {
  setSimulationDifficultyLevel,
  setSimulationSessionLength,
  startSimulationSession,
  toggleSimulationCategory,
  toggleSimulationTopic,
  type SimulationDifficultyLevel,
  type SimulationSessionLength,
} from "../lib/redux/slices/simulationSlice";

type DifficultyOption = {
  description: string;
  level: string;
  mix: {
    easy: number;
    hard: number;
    medium: number;
    status: string;
  };
  title: string;
  value: SimulationDifficultyLevel;
};

type DomainOption = {
  active?: boolean;
  disabled?: boolean;
  id: string;
  icon: ReactNode;
  issue?: string;
  meta?: string;
  title: string;
};

type SessionLengthOption = {
  duration: SimulationSessionLength;
  label: string;
  recommended?: boolean;
};

const difficultyOptions: DifficultyOption[] = [
  {
    description:
      "The foundation builder. You possess basic skills but require regular guidance, supervision, and clear instructions. You are typically in your first 1 to 3 years in the role.",
    level: "Level 01",
    mix: { easy: 70, medium: 25, hard: 5, status: "EASY" },
    title: "Entry",
    value: "entry",
  },
  {
    description:
      " The independent practitioner. You can execute tasks and manage projects autonomously. You generally have 2 to 5 years of experience and need minimal supervision for routine work.",
    level: "Level 02",
    mix: { easy: 15, medium: 60, hard: 25, status: "BALANCED" },
    title: "Standard",
    value: "standard",
  },
  {
    description:
      " The architect and mentor. You have 5+ years of experience, a deep mastery of the field, and a proven track record of solving complex problems. Seniors shift focus to strategic planning, business alignment, and guiding junior and mid-level colleagues.",
    level: "Level 03",
    mix: { easy: 10, medium: 30, hard: 60, status: "HARD" },
    title: "Expert",
    value: "expert",
  },
];

const sessionLengthOptions: SessionLengthOption[] = [
  { duration: 15, label: "Short" },
  { duration: 30, label: "Standard", recommended: true },
  { duration: 60, label: "Full" },
];

function GlassPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`theme-content-card rounded-lg border border-[var(--color-card-border)] bg-[var(--color-glass)] backdrop-blur-xl ${className}`}
    >
      {children}
    </section>
  );
}

function PanelHeader({
  icon,
  label,
  meta,
}: {
  icon: ReactNode;
  label: string;
  meta?: string;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-[var(--color-card-border)] pb-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="gleeple-heading flex items-center gap-1.5 text-[12px] font-bold uppercase leading-none tracking-[0.05em] theme-muted">
        <span className="text-[var(--color-on-surface-variant)] [&_.MuiSvgIcon-root]:text-[16px]">
          {icon}
        </span>
        {label}
      </span>
      {meta ? (
        <span className="gleeple-code text-[10px] leading-none text-[var(--color-primary-container)] opacity-60">
          {meta}
        </span>
      ) : null}
    </div>
  );
}

function DifficultyCard({
  isActive,
  onSelect,
  option,
}: {
  isActive: boolean;
  onSelect: () => void;
  option: DifficultyOption;
}) {
  return (
    <button
      aria-pressed={isActive}
      className={`theme-content-card group relative min-h-[172px] cursor-pointer rounded border p-6 text-left transition-all ${
        isActive
          ? "border-[var(--color-primary-container)] shadow-[0_0_15px_color-mix(in_srgb,var(--color-primary-container)_22%,transparent)]"
          : "border-[var(--color-card-border)] hover:border-[color-mix(in_srgb,var(--color-primary-container)_50%,transparent)]"
      }`}
      onClick={onSelect}
      type="button"
    >
      <div
        className={`gleeple-heading mb-1 text-[12px] font-bold uppercase leading-none tracking-[0.05em] ${
          isActive ? "text-[var(--color-primary-container)]" : "theme-muted"
        }`}
      >
        {option.level}
      </div>
      <div className="gleeple-heading text-2xl font-semibold leading-[1.3] theme-text transition-colors group-hover:text-[var(--color-primary-container)]">
        {option.title}
      </div>
      <p className="gleeple-code mt-3 text-[11px] leading-relaxed theme-muted">
        {option.description}
      </p>
      <CheckCircleIcon
        className={`absolute right-2 top-2 text-[var(--color-primary-container)] transition-opacity ${
          isActive ? "opacity-100" : "opacity-0"
        }`}
        sx={{ fontSize: 22 }}
      />
    </button>
  );
}

function DifficultyMix({ option }: { option: DifficultyOption }) {
  const segments = [
    {
      color: "bg-[var(--color-tertiary)]",
      label: "Easy",
      value: option.mix.easy,
    },
    {
      color: "bg-[var(--color-primary-container)]",
      label: "Medium",
      value: option.mix.medium,
    },
    {
      color: "bg-[var(--color-secondary)]",
      label: "Hard",
      value: option.mix.hard,
    },
  ];

  return (
    <div className="mt-6 flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <span className="gleeple-heading text-[12px] font-bold uppercase leading-none tracking-[0.05em] theme-muted">
          Projected Mix
        </span>
        <span className="gleeple-code text-[10px] text-[var(--color-primary-container)]">
          {option.mix.status}
        </span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-container-high)]">
        {segments.map((segment) => (
          <div
            className={`h-full transition-all duration-500 ${segment.color}`}
            key={segment.label}
            style={{ width: `${segment.value}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-6">
        {segments.map((segment) => (
          <div className="flex items-center gap-1.5" key={segment.label}>
            <span className={`h-2 w-2 rounded-full ${segment.color}`} />
            <span className="gleeple-code text-[10px] theme-muted">
              {segment.label} ({segment.value}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DomainToggle({
  onToggle,
  option,
}: {
  onToggle: (id: string) => void;
  option: DomainOption;
}) {
  if (option.disabled) {
    return (
      <div className="theme-content-card flex flex-col gap-2 rounded border border-[color-mix(in_srgb,var(--color-error)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)] p-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3 opacity-50">
            <span className="shrink-0 text-[var(--color-error)] [&_.MuiSvgIcon-root]:text-[22px]">
              {option.icon}
            </span>
            <span className="min-w-0">
              <span className="gleeple-code block min-w-0 text-sm leading-5 theme-text">
                {option.title}
              </span>
              {option.meta ? (
                <span className="gleeple-heading mt-0.5 block text-[10px] font-bold uppercase tracking-[0.08em] theme-subtle">
                  {option.meta}
                </span>
              ) : null}
            </span>
          </div>
          <input
            className="h-4 w-4 shrink-0 rounded-sm accent-[var(--color-error)] opacity-50"
            disabled
            type="checkbox"
          />
        </div>
        {option.issue ? (
          <div className="gleeple-code flex items-center gap-1.5 text-[10px] leading-4 text-[var(--color-error)]">
            <ErrorOutlineIcon sx={{ fontSize: 14 }} />
            {option.issue}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <label
      className={`theme-content-card flex cursor-pointer items-center justify-between gap-4 rounded border p-3 transition-colors hover:bg-[var(--color-accent-hover)] ${
        option.active
          ? "border-l-2 border-l-[var(--color-primary-container)] bg-[var(--color-accent-soft)]"
          : "border-[var(--color-card-border)]"
      }`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={`shrink-0 [&_.MuiSvgIcon-root]:text-[22px] ${
            option.active
              ? "text-[var(--color-primary-container)]"
              : "theme-muted"
          }`}
        >
          {option.icon}
        </span>
        <span className="min-w-0">
          <span className="gleeple-code block min-w-0 text-sm leading-5 theme-text">
            {option.title}
          </span>
          {option.meta ? (
            <span className="gleeple-heading mt-0.5 block text-[10px] font-bold uppercase tracking-[0.08em] theme-subtle">
              {option.meta}
            </span>
          ) : null}
        </span>
      </span>
      <input
        checked={Boolean(option.active)}
        className="h-4 w-4 shrink-0 rounded-sm accent-[var(--color-primary-container)]"
        onChange={() => onToggle(option.id)}
        type="checkbox"
      />
    </label>
  );
}

function DomainColumn({
  emptyMessage,
  onToggle,
  options,
  title,
}: {
  emptyMessage?: string;
  onToggle: (id: string) => void;
  options: DomainOption[];
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="gleeple-heading pl-1 text-[10px] font-bold uppercase tracking-[0.18em] theme-muted">
        {title}
      </h3>
      <div className="flex flex-col gap-1">
        {options.length > 0 ? (
          options.map((option) => (
            <DomainToggle
              key={option.id}
              onToggle={onToggle}
              option={option}
            />
          ))
        ) : (
          <div className="theme-content-card rounded border border-dashed border-[var(--color-outline-variant)] p-4 text-sm leading-6 theme-muted">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Simulation() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const curriculumCategories = useMemo(() => getAllCurriculumCategories(), []);
  const currentSessionId = useAppSelector(selectSimulationCurrentSessionId);
  const difficultyLevel = useAppSelector(selectSimulationDifficultyLevel);
  const sessionLength = useAppSelector(selectSimulationSessionLength);
  const simulationState = useAppSelector(selectSimulationState);
  const simulationStep = useAppSelector(selectSimulationStep);
  const selectedCategoryIds = useAppSelector(
    selectSimulationSelectedCategoryIds
  );
  const selectedTopicIds = useAppSelector(selectSimulationSelectedTopicIds);
  const selectedSubTopicIds = useAppSelector(
    selectSimulationSelectedSubTopicIds
  );
  const [startError, setStartError] = useState("");
  const selectedOption = useMemo(
    () =>
      difficultyOptions.find((option) => option.value === difficultyLevel) ??
      difficultyOptions[1],
    [difficultyLevel]
  );
  const selectedCategoryIdSet = useMemo(
    () => new Set(selectedCategoryIds),
    [selectedCategoryIds]
  );
  const selectedTopicIdSet = useMemo(
    () => new Set(selectedTopicIds),
    [selectedTopicIds]
  );
  const selectedCategories = useMemo(
    () =>
      curriculumCategories.filter((category) =>
        selectedCategoryIdSet.has(category.id)
      ),
    [curriculumCategories, selectedCategoryIdSet]
  );
  const availableTopics = useMemo(
    () =>
      selectedCategories.flatMap((category) =>
        getCurriculumTopicsByCategory(category)
      ),
    [selectedCategories]
  );
  const categoryDomainOptions = useMemo<DomainOption[]>(
    () =>
      curriculumCategories.map((category) => ({
        active: selectedCategoryIdSet.has(category.id),
        icon: <MemoryOutlinedIcon />,
        id: category.id,
        meta: `${category.topicCount} topics / ${category.subtopicCount} subtopics`,
        title: category.title,
      })),
    [curriculumCategories, selectedCategoryIdSet]
  );
  const topicDomainOptions = useMemo<DomainOption[]>(
    () =>
      availableTopics.map((topic) => ({
        active: selectedTopicIdSet.has(topic.id),
        icon: <StorageOutlinedIcon />,
        id: topic.id,
        meta: `${topic.category} / ${topic.subtopicCount} subtopics`,
        title: topic.title,
      })),
    [availableTopics, selectedTopicIdSet]
  );
  const focusSelectionSummary = `SELECTED: ${selectedCategoryIds.length} CAT / ${selectedTopicIds.length} TOPIC / ${selectedSubTopicIds.length} SUBTOPIC`;
  const startSetupSession = () => {
    if (selectedSubTopicIds.length === 0) {
      setStartError("Select at least one topic before starting a simulation.");
      return;
    }

    setStartError("");

    const sessionId = createSimulationSessionId();
    const nextSimulationState = {
      ...simulationState,
      currentSessionId: sessionId,
      simulationStep: "session" as const,
    };

    dispatch(startSimulationSession({ sessionId }));
    console.log("Current simulation slice state", nextSimulationState);
  };

  useEffect(() => {
    if (simulationStep === "setup") {
      return;
    }

    const sessionId = currentSessionId ?? "current";
    const nextPath =
      simulationStep === "session"
        ? `/simulation/session/${sessionId}`
        : `/simulation/result/${sessionId}`;

    if (location.pathname !== nextPath) {
      navigate(nextPath, { replace: true });
    }
  }, [currentSessionId, location.pathname, navigate, simulationStep]);

  return (
    <div className="theme-page theme-grid-pattern min-h-screen px-6 pb-20 pt-28 md:px-12">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-12">
        <header className="flex flex-col gap-1">
          <div className="gleeple-heading text-[12px] font-bold uppercase leading-none tracking-[0.18em] text-[var(--color-primary-container)]">
            Initialization Phase
          </div>
          <h1 className="gleeple-heading text-[32px] font-semibold leading-tight theme-text">
            Simulation Setup
          </h1>
          <p className="max-w-2xl text-base leading-7 theme-muted">
            Configure the parameters of your technical assessment. Adjust
            difficulty, focus areas, and session duration for optimal
            performance measurement.
          </p>
        </header>

        <GlassPanel className="simulation-scan-panel relative flex flex-col gap-6 overflow-hidden p-6 md:p-12">
          <span className="simulation-scanline" />
          <PanelHeader
            icon={<StairsOutlinedIcon />}
            label="Select difficulty level"
            meta=""
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {difficultyOptions.map((option) => (
                <DifficultyCard
                isActive={difficultyLevel === option.value}
                key={option.value}
                onSelect={() =>
                  dispatch(setSimulationDifficultyLevel(option.value))
                }
                option={option}
              />
            ))}
          </div>
          <DifficultyMix option={selectedOption} />
        </GlassPanel>

        <GlassPanel className="flex flex-col gap-6 p-6 md:p-12">
          <PanelHeader
            icon={<CategoryOutlinedIcon />}
            label="Select focus topics"
            meta={focusSelectionSummary}
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <DomainColumn
              emptyMessage="No categories are available from the markdown content."
              onToggle={(categoryId) =>
                dispatch(toggleSimulationCategory(categoryId))
              }
              options={categoryDomainOptions}
              title="Categories"
            />
            <DomainColumn
              emptyMessage="Select at least one category to view topics."
              onToggle={(topicId) => dispatch(toggleSimulationTopic(topicId))}
              options={topicDomainOptions}
              title="Topics"
            />
          </div>
        </GlassPanel>

        <GlassPanel className="flex flex-col gap-6 p-6 md:p-12">
          <PanelHeader
            icon={<ScheduleOutlinedIcon />}
            label="Session Length"
          />
          <div className="flex flex-col gap-4 sm:flex-row">
            {sessionLengthOptions.map((option) => {
              const isSelected = sessionLength === option.duration;

              return (
                <button
                  aria-pressed={isSelected}
                  className={`gleeple-heading flex min-h-[72px] flex-1 cursor-pointer flex-col items-center justify-center border py-4 text-[12px] font-bold uppercase leading-none tracking-[0.05em] transition-all ${
                    isSelected
                      ? "border-[var(--color-primary-container)] bg-[var(--color-accent-soft)] text-[var(--color-primary-container)]"
                      : "theme-content-card border-[var(--color-card-border)] theme-muted hover:border-[color-mix(in_srgb,var(--color-primary-container)_40%,transparent)] hover:text-[var(--color-on-surface)]"
                  }`}
                  key={option.duration}
                  onClick={() =>
                    dispatch(setSimulationSessionLength(option.duration))
                  }
                  type="button"
                >
                  <span>
                    {option.label} ({option.duration}m)
                  </span>
                  {option.recommended ? (
                    <span className="mt-1 text-[9px] text-[var(--color-tertiary)] opacity-80">
                      Recommended
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </GlassPanel>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          {startError ? (
            <p className="gleeple-code text-[12px] text-[var(--color-error)]">
              {startError}
            </p>
          ) : null}
          <button
            className="gleeple-heading cursor-pointer rounded bg-[var(--color-primary-container)] px-8 py-4 text-[12px] font-bold uppercase leading-none tracking-[0.05em] text-[var(--color-on-primary-container)] shadow-[var(--shadow-accent-glow)] transition-all hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98]"
            onClick={startSetupSession}
            type="button"
          >
            Start simulation
          </button>
        </div>
      </div>
    </div>
  );
}

function createSimulationSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}`;
}
