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

export const DEFAULT_CUSTOM_QUESTIONS_PER_CATEGORY = 10;

export const simulationQuestionCounts = {
  short: 5,
  standard: 10,
} as const;

export type SimulationStep = "setup" | "session" | "result";
export type SimulationDifficultyLevel = "entry" | "standard" | "expert";
export type SimulationQuestionCountMode = "short" | "standard" | "custom";
export type SimulationQuestionEvaluation =
  | "did-not-know"
  | "partially-answered"
  | "answered-well";

export type SimulationSessionState = {
  answersByQuestionId: Record<string, string>;
  completedAt?: string;
  completedQuestionIds: string[];
  createdAt: string;
  currentEvaluationQuestionId?: string;
  currentQuestionIndex: number;
  customQuestionsPerCategory: number;
  difficultyLevel: SimulationDifficultyLevel;
  elapsedTimeInSeconds: number;
  evaluationsByQuestionId: Record<string, SimulationQuestionEvaluation>;
  questionCountMode: SimulationQuestionCountMode;
  questionIds: string[];
  questions: SimulationQuestion[];
  questionsPerCategory: number;
  selectedCategoryIds: string[];
  selectedSubTopicIds: string[];
  selectedTopicIds: string[];
  sessionId: string;
  startedAt: string;
  step: SimulationStep;
  updatedAt: string;
};

export type SimulationState = {
  currentSession?: SimulationSessionState;
  currentSessionId?: string;
  customQuestionsPerCategory: number;
  difficultyLevel: SimulationDifficultyLevel;
  questionCountMode: SimulationQuestionCountMode;
  questionsPerCategory: number;
  selectedCategoryIds: string[];
  selectedTopicIds: string[];
  selectedSubTopicIds: string[];
  simulationStep: SimulationStep;
};

type UpdateSimulationSessionPayload = Partial<
  Omit<SimulationSessionState, "sessionId" | "createdAt">
>;

type SaveSimulationAnswerPayload = {
  answer: string;
  questionId: string;
};

type CompleteSimulationSessionPayload = {
  completedAt: string;
  elapsedTimeInSeconds: number;
};

type SaveSimulationQuestionEvaluationPayload = {
  evaluation: SimulationQuestionEvaluation;
  questionId: string;
};

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
    completeSimulationSession(
      state,
      action: PayloadAction<CompleteSimulationSessionPayload>
    ) {
      const session = state.currentSession;

      if (
        !session ||
        !normalizeDateString(action.payload.completedAt) ||
        !isValidElapsedTime(action.payload.elapsedTimeInSeconds)
      ) {
        return;
      }

      session.completedAt = action.payload.completedAt;
      session.elapsedTimeInSeconds = action.payload.elapsedTimeInSeconds;
      session.step = "result";
      session.updatedAt = action.payload.completedAt;
      session.currentEvaluationQuestionId =
        getNextEvaluationQuestionId(session) ?? session.questionIds[0];
      state.simulationStep = "result";
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
    saveSimulationAnswer(
      state,
      action: PayloadAction<SaveSimulationAnswerPayload>
    ) {
      const session = state.currentSession;

      if (
        !session ||
        !session.questionIds.includes(action.payload.questionId)
      ) {
        return;
      }

      const normalizedAnswer = action.payload.answer.trim();

      if (normalizedAnswer) {
        session.answersByQuestionId[action.payload.questionId] =
          normalizedAnswer;
        session.completedQuestionIds = addValues(
          session.completedQuestionIds,
          [action.payload.questionId]
        );
      } else {
        delete session.answersByQuestionId[action.payload.questionId];
        session.completedQuestionIds = removeValues(
          session.completedQuestionIds,
          [action.payload.questionId]
        );
      }

      session.updatedAt = new Date().toISOString();
    },
    saveSimulationQuestionEvaluation(
      state,
      action: PayloadAction<SaveSimulationQuestionEvaluationPayload>
    ) {
      const session = state.currentSession;

      if (
        !session ||
        !session.questionIds.includes(action.payload.questionId)
      ) {
        return;
      }

      const isEvaluationComplete =
        session.questionIds.length > 0 &&
        session.questionIds.every(
          (questionId) =>
            session.evaluationsByQuestionId[questionId] !== undefined
        );

      if (isEvaluationComplete) {
        return;
      }

      session.evaluationsByQuestionId[action.payload.questionId] =
        action.payload.evaluation;
      const evaluatedQuestionIndex = session.questionIds.indexOf(
        action.payload.questionId
      );
      session.currentEvaluationQuestionId =
        session.questionIds[evaluatedQuestionIndex + 1];
      session.updatedAt = new Date().toISOString();
    },
    setCustomQuestionsPerCategory(state, action: PayloadAction<number>) {
      if (!isValidQuestionCount(action.payload)) {
        return;
      }

      state.customQuestionsPerCategory = action.payload;
      state.questionsPerCategory = action.payload;
      state.questionCountMode = "custom";
    },
    setQuestionsPerCategory(state, action: PayloadAction<number>) {
      if (!isValidQuestionCount(action.payload)) {
        return;
      }

      state.questionsPerCategory = action.payload;

      if (state.questionCountMode === "custom") {
        state.customQuestionsPerCategory = action.payload;
      }
    },
    setSimulationCurrentQuestionIndex(
      state,
      action: PayloadAction<number>
    ) {
      const session = state.currentSession;

      if (
        !session ||
        !Number.isInteger(action.payload) ||
        action.payload < 0 ||
        action.payload >= session.questions.length
      ) {
        return;
      }

      session.currentQuestionIndex = action.payload;
      session.updatedAt = new Date().toISOString();
    },
    setSimulationCurrentEvaluationQuestion(
      state,
      action: PayloadAction<string>
    ) {
      const session = state.currentSession;

      if (!session || !session.questionIds.includes(action.payload)) {
        return;
      }

      session.currentEvaluationQuestionId = action.payload;
      session.updatedAt = new Date().toISOString();
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
      state.questionsPerCategory =
        action.payload === "custom"
          ? state.customQuestionsPerCategory
          : simulationQuestionCounts[action.payload];
    },
    setSimulationElapsedTime(state, action: PayloadAction<number>) {
      const session = state.currentSession;

      if (
        !session ||
        session.step !== "session" ||
        !isValidElapsedTime(action.payload)
      ) {
        return;
      }

      session.elapsedTimeInSeconds = action.payload;
      session.updatedAt = new Date().toISOString();
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
  completeSimulationSession,
  createSimulationSession,
  loadSimulationSession,
  resetSimulationState,
  saveSimulationAnswer,
  saveSimulationQuestionEvaluation,
  setCustomQuestionsPerCategory,
  setQuestionsPerCategory,
  setSimulationCurrentEvaluationQuestion,
  setSimulationCurrentQuestionIndex,
  setSimulationDifficultyLevel,
  setSimulationElapsedTime,
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

export function getSimulationElapsedTimeInSeconds(
  session: Pick<
    SimulationSessionState,
    "completedAt" | "elapsedTimeInSeconds" | "startedAt"
  >,
  currentTime = Date.now()
) {
  const startedAtTime = Date.parse(session.startedAt);
  const endedAtTime = session.completedAt
    ? Date.parse(session.completedAt)
    : currentTime;

  if (
    !Number.isFinite(startedAtTime) ||
    !Number.isFinite(endedAtTime) ||
    endedAtTime < startedAtTime
  ) {
    return session.elapsedTimeInSeconds;
  }

  return Math.max(
    session.elapsedTimeInSeconds,
    Math.floor((endedAtTime - startedAtTime) / 1000)
  );
}

function applySessionToState(
  state: SimulationState,
  session: SimulationSessionState
) {
  state.currentSession = session;
  state.currentSessionId = session.sessionId;
  state.customQuestionsPerCategory = session.customQuestionsPerCategory;
  state.difficultyLevel = session.difficultyLevel;
  state.questionCountMode = session.questionCountMode;
  state.questionsPerCategory = session.questionsPerCategory;
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
      customQuestionsPerCategory: savedSession.customQuestionsPerCategory,
      difficultyLevel: savedSession.difficultyLevel,
      questionCountMode: savedSession.questionCountMode,
      questionsPerCategory: savedSession.questionsPerCategory,
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
    customQuestionsPerCategory: DEFAULT_CUSTOM_QUESTIONS_PER_CATEGORY,
    difficultyLevel: "standard",
    questionCountMode: "standard",
    questionsPerCategory: simulationQuestionCounts.standard,
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
  const questionsPerCategory = normalizeQuestionCount(
    value.questionsPerCategory ?? value.questionsPerTopic
  );
  const selectedCategoryIds = normalizeStringArray(value.selectedCategoryIds);
  const selectedTopicIds = normalizeStringArray(value.selectedTopicIds);
  const selectedSubTopicIds = normalizeStringArray(value.selectedSubTopicIds);
  const createdAt = normalizeDateString(value.createdAt);
  const updatedAt = normalizeDateString(value.updatedAt);
  const startedAt =
    normalizeDateString(value.startedAt) ?? createdAt;

  if (
    !sessionId ||
    !step ||
    step === "setup" ||
    !difficultyLevel ||
    questionsPerCategory === undefined ||
    selectedCategoryIds.length === 0 ||
    selectedTopicIds.length === 0 ||
    selectedSubTopicIds.length === 0 ||
    !createdAt ||
    !updatedAt ||
    !startedAt ||
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
    inferQuestionCountMode(questionsPerCategory);
  const customQuestionsPerCategory =
    normalizeQuestionCount(
      value.customQuestionsPerCategory ?? value.customQuestionsPerTopic
    ) ??
    (questionCountMode === "custom"
      ? questionsPerCategory
      : DEFAULT_CUSTOM_QUESTIONS_PER_CATEGORY);
  const currentQuestionIndex = normalizeQuestionIndex(
    value.currentQuestionIndex
  );
  const storedQuestionIds = normalizeStringArray(value.questionIds);
  const questions = normalizeSimulationQuestions(value.questions);
  const generatedQuestionIdsForAnswers =
    questions?.map((question) => question.id) ?? [];
  const answersByQuestionId = normalizeSimulationAnswers(
    value.answersByQuestionId,
    generatedQuestionIdsForAnswers
  );
  const completedQuestionIds = normalizeStringArray(
    value.completedQuestionIds
  );

  if (
    currentQuestionIndex === undefined ||
    questions === undefined ||
    answersByQuestionId === undefined ||
    !areSessionQuestionsValid(
      questions,
      selectedCategoryIds,
      selectedTopicIds,
      selectedSubTopicIds,
      questionsPerCategory
    ) ||
    (questionCountMode !== "custom" &&
      questionsPerCategory !== simulationQuestionCounts[questionCountMode])
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
  const evaluationsByQuestionId = normalizeSimulationEvaluations(
    value.evaluationsByQuestionId,
    questionIds
  );
  const storedCurrentEvaluationQuestionId = normalizeNonEmptyString(
    value.currentEvaluationQuestionId
  );
  const currentEvaluationQuestionId =
    storedCurrentEvaluationQuestionId &&
    questionIds.includes(storedCurrentEvaluationQuestionId)
      ? storedCurrentEvaluationQuestionId
      : getFirstUnevaluatedQuestionId(questionIds, evaluationsByQuestionId);
  const completedAt =
    step === "result"
      ? normalizeDateString(value.completedAt) ?? updatedAt
      : undefined;
  const elapsedTimeInSeconds =
    normalizeElapsedTime(value.elapsedTimeInSeconds) ??
    calculateElapsedTimeFromDates(
      startedAt,
      completedAt ?? updatedAt
    );

  if (
    (questions.length > 0 && currentQuestionIndex >= questions.length) ||
    completedQuestionIds.some(
      (questionId) => !questionIds.includes(questionId)
    )
  ) {
    return undefined;
  }

  return {
    answersByQuestionId,
    completedAt,
    completedQuestionIds,
    createdAt,
    currentEvaluationQuestionId,
    currentQuestionIndex,
    customQuestionsPerCategory,
    difficultyLevel,
    elapsedTimeInSeconds,
    evaluationsByQuestionId,
    questionCountMode,
    questionIds,
    questions,
    questionsPerCategory,
    selectedCategoryIds,
    selectedSubTopicIds,
    selectedTopicIds,
    sessionId,
    startedAt,
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
  questionsPerCategory: number
): SimulationQuestionCountMode {
  if (questionsPerCategory === simulationQuestionCounts.short) {
    return "short";
  }

  if (questionsPerCategory === simulationQuestionCounts.standard) {
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

function normalizeSimulationAnswers(
  value: unknown,
  questionIds: string[]
): Record<string, string> | undefined {
  if (value === undefined) {
    return {};
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const validQuestionIds = new Set(questionIds);
  const answers: Record<string, string> = {};

  for (const [questionId, answer] of Object.entries(value)) {
    if (
      !validQuestionIds.has(questionId) ||
      typeof answer !== "string" ||
      !answer.trim()
    ) {
      return undefined;
    }

    answers[questionId] = answer.trim();
  }

  return answers;
}

function normalizeSimulationEvaluations(
  value: unknown,
  questionIds: string[]
): Record<string, SimulationQuestionEvaluation> {
  if (!isRecord(value)) {
    return {};
  }

  const validQuestionIds = new Set(questionIds);
  const evaluations: Record<string, SimulationQuestionEvaluation> = {};

  for (const [questionId, evaluation] of Object.entries(value)) {
    if (
      validQuestionIds.has(questionId) &&
      isSimulationQuestionEvaluation(evaluation)
    ) {
      evaluations[questionId] = evaluation;
    }
  }

  return evaluations;
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

function normalizeElapsedTime(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);

  return isValidElapsedTime(numericValue) ? numericValue : undefined;
}

function isValidQuestionCount(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}

function isValidElapsedTime(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isSimulationQuestionEvaluation(
  value: unknown
): value is SimulationQuestionEvaluation {
  return (
    value === "did-not-know" ||
    value === "partially-answered" ||
    value === "answered-well"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function calculateElapsedTimeFromDates(startedAt: string, endedAt: string) {
  const startedAtTime = Date.parse(startedAt);
  const endedAtTime = Date.parse(endedAt);

  if (
    !Number.isFinite(startedAtTime) ||
    !Number.isFinite(endedAtTime) ||
    endedAtTime < startedAtTime
  ) {
    return 0;
  }

  return Math.floor((endedAtTime - startedAtTime) / 1000);
}

function getFirstUnevaluatedQuestionId(
  questionIds: string[],
  evaluationsByQuestionId: Record<string, SimulationQuestionEvaluation>
) {
  return questionIds.find(
    (questionId) => evaluationsByQuestionId[questionId] === undefined
  );
}

function getNextEvaluationQuestionId(session: SimulationSessionState) {
  return getFirstUnevaluatedQuestionId(
    session.questionIds,
    session.evaluationsByQuestionId
  );
}

function areStringArraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function areSessionQuestionsValid(
  questions: SimulationQuestion[],
  selectedCategoryIds: string[],
  selectedTopicIds: string[],
  selectedSubTopicIds: string[],
  questionsPerCategory: number
) {
  const categoryIdsByTitle = new Map(
    getAllCurriculumCategories().map((category) => [
      category.title,
      category.id,
    ])
  );
  const selectedCategoryIdSet = new Set(selectedCategoryIds);
  const selectedTopicIdSet = new Set(selectedTopicIds);
  const selectedSubTopicIdSet = new Set(selectedSubTopicIds);
  const questionCountByCategoryId = new Map<string, number>();

  for (const question of questions) {
    const categoryId = categoryIdsByTitle.get(question.category);

    if (
      !categoryId ||
      !selectedCategoryIdSet.has(categoryId) ||
      !selectedTopicIdSet.has(question.topicId) ||
      !selectedSubTopicIdSet.has(question.subTopicId)
    ) {
      return false;
    }

    const categoryQuestionCount =
      (questionCountByCategoryId.get(categoryId) ?? 0) + 1;

    if (categoryQuestionCount > questionsPerCategory) {
      return false;
    }

    questionCountByCategoryId.set(categoryId, categoryQuestionCount);
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
