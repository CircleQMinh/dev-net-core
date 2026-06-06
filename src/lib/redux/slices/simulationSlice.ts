import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  getAllCurriculumCategories,
  getAllCurriculumTopics,
  getCurriculumSubTopicsByTopic,
  getCurriculumTopicsByCategory,
} from "../../../shared/function";
import type { SimulationQuestion } from "../../../shared/GenerateSimulationQuestions";

export const SIMULATION_SESSION_STORAGE_KEY =
  "dev-net-core-simulation-session";

export const DEFAULT_CUSTOM_QUESTIONS_PER_TOPIC = 10;

export const simulationQuestionCounts = {
  short: 5,
  standard: 10,
} as const;

export type SimulationStep = "setup" | "session" | "result";
export type SimulationDifficultyLevel = "entry" | "standard" | "expert";
export type SimulationQuestionCountMode = "short" | "standard" | "custom";

export type SimulationSessionState = {
  completedQuestionIds: string[];
  createdAt: string;
  currentQuestionIndex: number;
  customQuestionsPerTopic: number;
  difficultyLevel: SimulationDifficultyLevel;
  questionCountMode: SimulationQuestionCountMode;
  questionIds: string[];
  questions: SimulationQuestion[];
  questionsPerTopic: number;
  selectedCategoryIds: string[];
  selectedSubTopicIds: string[];
  selectedTopicIds: string[];
  sessionId: string;
  step: SimulationStep;
  updatedAt: string;
};

export type SimulationState = {
  currentSession?: SimulationSessionState;
  currentSessionId?: string;
  customQuestionsPerTopic: number;
  difficultyLevel: SimulationDifficultyLevel;
  questionCountMode: SimulationQuestionCountMode;
  questionsPerTopic: number;
  selectedCategoryIds: string[];
  selectedTopicIds: string[];
  selectedSubTopicIds: string[];
  simulationStep: SimulationStep;
};

type UpdateSimulationSessionPayload = Partial<
  Omit<SimulationSessionState, "sessionId" | "createdAt">
>;

const initialState: SimulationState = createInitialSimulationState();

const simulationSlice = createSlice({
  name: "simulation",
  initialState,
  reducers: {
    clearSimulationSession(state) {
      state.currentSession = undefined;
      state.currentSessionId = undefined;
      state.simulationStep = "setup";
    },
    createSimulationSession(
      state,
      action: PayloadAction<SimulationSessionState>
    ) {
      applySessionToState(state, action.payload);
    },
    loadSimulationSession(
      state,
      action: PayloadAction<SimulationSessionState>
    ) {
      applySessionToState(state, action.payload);
    },
    resetSimulationState: () => createInitialSimulationState(),
    setCustomQuestionsPerTopic(state, action: PayloadAction<number>) {
      if (!isValidQuestionCount(action.payload)) {
        return;
      }

      state.customQuestionsPerTopic = action.payload;
      state.questionsPerTopic = action.payload;
      state.questionCountMode = "custom";
    },
    setQuestionsPerTopic(state, action: PayloadAction<number>) {
      if (!isValidQuestionCount(action.payload)) {
        return;
      }

      state.questionsPerTopic = action.payload;

      if (state.questionCountMode === "custom") {
        state.customQuestionsPerTopic = action.payload;
      }
    },
    setSimulationDifficultyLevel(
      state,
      action: PayloadAction<SimulationDifficultyLevel>
    ) {
      state.difficultyLevel = action.payload;
    },
    setSimulationQuestionCountMode(
      state,
      action: PayloadAction<SimulationQuestionCountMode>
    ) {
      state.questionCountMode = action.payload;
      state.questionsPerTopic =
        action.payload === "custom"
          ? state.customQuestionsPerTopic
          : simulationQuestionCounts[action.payload];
    },
    setSimulationStep(state, action: PayloadAction<SimulationStep>) {
      state.simulationStep = action.payload;

      if (state.currentSession) {
        state.currentSession.step = action.payload;
        state.currentSession.updatedAt = new Date().toISOString();
      }
    },
    toggleSimulationCategory(state, action: PayloadAction<string>) {
      const category = getAllCurriculumCategories().find(
        (curriculumCategory) => curriculumCategory.id === action.payload
      );

      if (!category) {
        return;
      }

      const topics = getCurriculumTopicsByCategory(category);
      const topicIds = topics.map((topic) => topic.id);
      const subTopicIds = getSubTopicIdsForTopics(topics);

      if (state.selectedCategoryIds.includes(category.id)) {
        state.selectedCategoryIds = removeValues(
          state.selectedCategoryIds,
          [category.id]
        );
        state.selectedTopicIds = removeValues(state.selectedTopicIds, topicIds);
        state.selectedSubTopicIds = removeValues(
          state.selectedSubTopicIds,
          subTopicIds
        );
        return;
      }

      state.selectedCategoryIds = addValues(state.selectedCategoryIds, [
        category.id,
      ]);
      state.selectedTopicIds = addValues(state.selectedTopicIds, topicIds);
      state.selectedSubTopicIds = addValues(
        state.selectedSubTopicIds,
        subTopicIds
      );
    },
    toggleSimulationTopic(state, action: PayloadAction<string>) {
      const topic = getAllCurriculumTopics().find(
        (curriculumTopic) => curriculumTopic.id === action.payload
      );

      if (!topic) {
        return;
      }

      const subTopicIds = getCurriculumSubTopicsByTopic(topic).map(
        (subtopic) => subtopic.id
      );

      if (state.selectedTopicIds.includes(topic.id)) {
        state.selectedTopicIds = removeValues(state.selectedTopicIds, [
          topic.id,
        ]);
        state.selectedSubTopicIds = removeValues(
          state.selectedSubTopicIds,
          subTopicIds
        );
        return;
      }

      const topicCategory = getAllCurriculumCategories().find(
        (category) => category.title === topic.category
      );

      if (topicCategory) {
        state.selectedCategoryIds = addValues(state.selectedCategoryIds, [
          topicCategory.id,
        ]);
      }

      state.selectedTopicIds = addValues(state.selectedTopicIds, [topic.id]);
      state.selectedSubTopicIds = addValues(
        state.selectedSubTopicIds,
        subTopicIds
      );
    },
    updateSimulationSession(
      state,
      action: PayloadAction<UpdateSimulationSessionPayload>
    ) {
      if (!state.currentSession) {
        return;
      }

      const nextSession = {
        ...state.currentSession,
        ...action.payload,
        updatedAt: action.payload.updatedAt ?? new Date().toISOString(),
      };

      if (!isValidSimulationSessionState(nextSession)) {
        return;
      }

      applySessionToState(state, nextSession);
    },
  },
});

export const {
  clearSimulationSession,
  createSimulationSession,
  loadSimulationSession,
  resetSimulationState,
  setCustomQuestionsPerTopic,
  setQuestionsPerTopic,
  setSimulationDifficultyLevel,
  setSimulationQuestionCountMode,
  setSimulationStep,
  toggleSimulationCategory,
  toggleSimulationTopic,
  updateSimulationSession,
} = simulationSlice.actions;

export const simulationReducer = simulationSlice.reducer;

export function clearSimulationSessionState() {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(SIMULATION_SESSION_STORAGE_KEY);
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
}

export function loadSimulationSessionState() {
  const storage = getLocalStorage();

  if (!storage) {
    return undefined;
  }

  try {
    const serializedSession = storage.getItem(
      SIMULATION_SESSION_STORAGE_KEY
    );

    if (!serializedSession) {
      return undefined;
    }

    const session = parseSimulationSessionState(
      JSON.parse(serializedSession) as unknown
    );

    if (!session) {
      storage.removeItem(SIMULATION_SESSION_STORAGE_KEY);
      return undefined;
    }

    return session;
  } catch {
    clearSimulationSessionState();
    return undefined;
  }
}

export function saveSimulationSessionState(
  session: SimulationSessionState
) {
  if (!isValidSimulationSessionState(session)) {
    clearSimulationSessionState();
    return;
  }

  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      SIMULATION_SESSION_STORAGE_KEY,
      JSON.stringify(session)
    );
  } catch {
    // Session persistence should not prevent the simulation from running.
  }
}

export function isValidSimulationSessionState(
  value: unknown
): value is SimulationSessionState {
  return parseSimulationSessionState(value) !== undefined;
}

function applySessionToState(
  state: SimulationState,
  session: SimulationSessionState
) {
  state.currentSession = session;
  state.currentSessionId = session.sessionId;
  state.customQuestionsPerTopic = session.customQuestionsPerTopic;
  state.difficultyLevel = session.difficultyLevel;
  state.questionCountMode = session.questionCountMode;
  state.questionsPerTopic = session.questionsPerTopic;
  state.selectedCategoryIds = session.selectedCategoryIds;
  state.selectedTopicIds = session.selectedTopicIds;
  state.selectedSubTopicIds = session.selectedSubTopicIds;
  state.simulationStep = session.step;
}

function createInitialSimulationState(): SimulationState {
  const savedSession = loadSimulationSessionState();

  if (savedSession) {
    return {
      currentSession: savedSession,
      currentSessionId: savedSession.sessionId,
      customQuestionsPerTopic: savedSession.customQuestionsPerTopic,
      difficultyLevel: savedSession.difficultyLevel,
      questionCountMode: savedSession.questionCountMode,
      questionsPerTopic: savedSession.questionsPerTopic,
      selectedCategoryIds: savedSession.selectedCategoryIds,
      selectedTopicIds: savedSession.selectedTopicIds,
      selectedSubTopicIds: savedSession.selectedSubTopicIds,
      simulationStep: savedSession.step,
    };
  }

  const firstCategory = getAllCurriculumCategories()[0];
  const defaultState: SimulationState = {
    currentSession: undefined,
    currentSessionId: undefined,
    customQuestionsPerTopic: DEFAULT_CUSTOM_QUESTIONS_PER_TOPIC,
    difficultyLevel: "standard",
    questionCountMode: "standard",
    questionsPerTopic: simulationQuestionCounts.standard,
    selectedCategoryIds: [],
    selectedTopicIds: [],
    selectedSubTopicIds: [],
    simulationStep: "setup",
  };

  if (!firstCategory) {
    return defaultState;
  }

  const topics = getCurriculumTopicsByCategory(firstCategory);

  return {
    ...defaultState,
    selectedCategoryIds: [firstCategory.id],
    selectedTopicIds: topics.map((topic) => topic.id),
    selectedSubTopicIds: getSubTopicIdsForTopics(topics),
  };
}

function parseSimulationSessionState(
  value: unknown
): SimulationSessionState | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const sessionId = normalizeNonEmptyString(value.sessionId);
  const step = normalizeSessionStep(value.step);
  const difficultyLevel = normalizeDifficultyLevel(value.difficultyLevel);
  const questionsPerTopic = normalizeQuestionCount(value.questionsPerTopic);
  const selectedCategoryIds = normalizeStringArray(value.selectedCategoryIds);
  const selectedTopicIds = normalizeStringArray(value.selectedTopicIds);
  const selectedSubTopicIds = normalizeStringArray(value.selectedSubTopicIds);
  const createdAt = normalizeDateString(value.createdAt);
  const updatedAt = normalizeDateString(value.updatedAt);

  if (
    !sessionId ||
    !step ||
    step === "setup" ||
    !difficultyLevel ||
    questionsPerTopic === undefined ||
    selectedCategoryIds.length === 0 ||
    selectedTopicIds.length === 0 ||
    selectedSubTopicIds.length === 0 ||
    !createdAt ||
    !updatedAt ||
    !areCurriculumSelectionsValid(
      selectedCategoryIds,
      selectedTopicIds,
      selectedSubTopicIds
    )
  ) {
    return undefined;
  }

  const questionCountMode =
    normalizeQuestionCountMode(value.questionCountMode) ??
    inferQuestionCountMode(questionsPerTopic);
  const customQuestionsPerTopic =
    normalizeQuestionCount(value.customQuestionsPerTopic) ??
    (questionCountMode === "custom"
      ? questionsPerTopic
      : DEFAULT_CUSTOM_QUESTIONS_PER_TOPIC);
  const currentQuestionIndex = normalizeQuestionIndex(
    value.currentQuestionIndex
  );
  const storedQuestionIds = normalizeStringArray(value.questionIds);
  const questions = normalizeSimulationQuestions(value.questions);
  const completedQuestionIds = normalizeStringArray(
    value.completedQuestionIds
  );

  if (
    currentQuestionIndex === undefined ||
    questions === undefined ||
    !areSessionQuestionsValid(
      questions,
      selectedTopicIds,
      selectedSubTopicIds,
      questionsPerTopic
    ) ||
    (questionCountMode !== "custom" &&
      questionsPerTopic !== simulationQuestionCounts[questionCountMode])
  ) {
    return undefined;
  }

  const generatedQuestionIds = questions.map((question) => question.id);

  if (
    generatedQuestionIds.length > 0 &&
    storedQuestionIds.length > 0 &&
    !areStringArraysEqual(generatedQuestionIds, storedQuestionIds)
  ) {
    return undefined;
  }

  const questionIds =
    generatedQuestionIds.length > 0 ? generatedQuestionIds : storedQuestionIds;

  if (
    questions.length > 0 &&
    currentQuestionIndex >= questions.length
  ) {
    return undefined;
  }

  return {
    completedQuestionIds,
    createdAt,
    currentQuestionIndex,
    customQuestionsPerTopic,
    difficultyLevel,
    questionCountMode,
    questionIds,
    questions,
    questionsPerTopic,
    selectedCategoryIds,
    selectedSubTopicIds,
    selectedTopicIds,
    sessionId,
    step,
    updatedAt,
  };
}

function areCurriculumSelectionsValid(
  categoryIds: string[],
  topicIds: string[],
  subTopicIds: string[]
) {
  const validCategoryIds = new Set(
    getAllCurriculumCategories().map((category) => category.id)
  );
  const topics = getAllCurriculumTopics();
  const validTopicIds = new Set(topics.map((topic) => topic.id));
  const validSubTopicIds = new Set(getSubTopicIdsForTopics(topics));

  return (
    categoryIds.every((id) => validCategoryIds.has(id)) &&
    topicIds.every((id) => validTopicIds.has(id)) &&
    subTopicIds.every((id) => validSubTopicIds.has(id))
  );
}

function inferQuestionCountMode(
  questionsPerTopic: number
): SimulationQuestionCountMode {
  if (questionsPerTopic === simulationQuestionCounts.short) {
    return "short";
  }

  if (questionsPerTopic === simulationQuestionCounts.standard) {
    return "standard";
  }

  return "custom";
}

function normalizeQuestionCountMode(
  value: unknown
): SimulationQuestionCountMode | undefined {
  return value === "short" || value === "standard" || value === "custom"
    ? value
    : undefined;
}

function normalizeSessionStep(value: unknown): SimulationStep | undefined {
  return value === "setup" || value === "session" || value === "result"
    ? value
    : undefined;
}

function normalizeDifficultyLevel(
  value: unknown
): SimulationDifficultyLevel | undefined {
  return value === "entry" || value === "standard" || value === "expert"
    ? value
    : undefined;
}

function normalizeQuestionCount(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);

  return isValidQuestionCount(numericValue) ? numericValue : undefined;
}

function normalizeQuestionIndex(value: unknown) {
  if (value === undefined) {
    return 0;
  }

  const numericValue = typeof value === "number" ? value : Number(value);

  return Number.isInteger(numericValue) && numericValue >= 0
    ? numericValue
    : undefined;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0
      )
    )
  );
}

function normalizeSimulationQuestions(
  value: unknown
): SimulationQuestion[] | undefined {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const questions: SimulationQuestion[] = [];
  const questionIds = new Set<string>();

  for (const item of value) {
    if (!isRecord(item)) {
      return undefined;
    }

    const id = normalizeNonEmptyString(item.id);
    const sourceQuestionId = normalizeNonEmptyString(item.sourceQuestionId);
    const category = normalizeNonEmptyString(item.category);
    const topicId = normalizeNonEmptyString(item.topicId);
    const topic = normalizeNonEmptyString(item.topic);
    const subTopicId = normalizeNonEmptyString(item.subTopicId);
    const subTopic = normalizeNonEmptyString(item.subTopic);
    const level = normalizeNonEmptyString(item.level);
    const question = normalizeNonEmptyString(item.question);
    const label = normalizeString(item.label);
    const expectedAnswerMarkdown = normalizeString(
      item.expectedAnswerMarkdown
    );
    const keyPointsMarkdown = normalizeString(item.keyPointsMarkdown);

    if (
      !id ||
      questionIds.has(id) ||
      !sourceQuestionId ||
      !category ||
      !topicId ||
      !topic ||
      !subTopicId ||
      !subTopic ||
      !level ||
      !question ||
      label === undefined ||
      expectedAnswerMarkdown === undefined ||
      keyPointsMarkdown === undefined
    ) {
      return undefined;
    }

    questionIds.add(id);
    questions.push({
      category,
      expectedAnswerMarkdown,
      id,
      keyPointsMarkdown,
      label,
      level,
      question,
      sourceQuestionId,
      subTopic,
      subTopicId,
      topic,
      topicId,
    });
  }

  return questions;
}

function normalizeDateString(value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    return undefined;
  }

  return value;
}

function normalizeNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function isValidQuestionCount(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function areStringArraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function areSessionQuestionsValid(
  questions: SimulationQuestion[],
  selectedTopicIds: string[],
  selectedSubTopicIds: string[],
  questionsPerTopic: number
) {
  const selectedTopicIdSet = new Set(selectedTopicIds);
  const selectedSubTopicIdSet = new Set(selectedSubTopicIds);
  const questionCountByTopicId = new Map<string, number>();

  for (const question of questions) {
    if (
      !selectedTopicIdSet.has(question.topicId) ||
      !selectedSubTopicIdSet.has(question.subTopicId)
    ) {
      return false;
    }

    const topicQuestionCount =
      (questionCountByTopicId.get(question.topicId) ?? 0) + 1;

    if (topicQuestionCount > questionsPerTopic) {
      return false;
    }

    questionCountByTopicId.set(question.topicId, topicQuestionCount);
  }

  return true;
}

function getLocalStorage() {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function getSubTopicIdsForTopics(
  topics: ReturnType<typeof getAllCurriculumTopics>
) {
  return topics.flatMap((topic) =>
    getCurriculumSubTopicsByTopic(topic).map((subtopic) => subtopic.id)
  );
}

function addValues(currentValues: string[], valuesToAdd: string[]) {
  return Array.from(new Set([...currentValues, ...valuesToAdd]));
}

function removeValues(currentValues: string[], valuesToRemove: string[]) {
  const valuesToRemoveSet = new Set(valuesToRemove);

  return currentValues.filter((value) => !valuesToRemoveSet.has(value));
}
