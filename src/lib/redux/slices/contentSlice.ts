import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type ContentSubTopicProgress = {
  totalQuestion: number;
  completedQuestion: number[];
};

export type ContentProgressState = Record<
  string,
  Record<string, Record<string, ContentSubTopicProgress>>
>;

export interface ContentState {
  selectedTopicId?: string;
  progress: ContentProgressState;
}

type SetSubTopicProgressPayload = {
  category: string;
  topic: string;
  subtopic: string;
  totalQuestion: number;
  completedQuestion: number[];
};

type SetQuestionCompletionPayload = {
  category: string;
  topic: string;
  subtopic: string;
  totalQuestion: number;
  questionNumber: number;
  completed: boolean;
};

export const CONTENT_PROGRESS_STORAGE_KEY = "dev-net-core:content-progress";

const initialState: ContentState = createInitialState();

const contentSlice = createSlice({
  name: "content",
  initialState,
  reducers: {
    setSelectedTopicId(state, action: PayloadAction<string | undefined>) {
      state.selectedTopicId = action.payload;
    },
    setContentProgress(state, action: PayloadAction<ContentProgressState>) {
      state.progress = normalizeContentProgress(action.payload);
    },
    setSubTopicProgress(state, action: PayloadAction<SetSubTopicProgressPayload>) {
      const category = action.payload.category.trim();
      const topic = action.payload.topic.trim();
      const subtopic = action.payload.subtopic.trim();

      if (!category || !topic || !subtopic) {
        return;
      }

      state.progress[category] ??= {};
      state.progress[category][topic] ??= {};
      state.progress[category][topic][subtopic] = normalizeSubTopicProgress(
        action.payload
      );
    },
    setQuestionCompletion(
      state,
      action: PayloadAction<SetQuestionCompletionPayload>
    ) {
      const category = action.payload.category.trim();
      const topic = action.payload.topic.trim();
      const subtopic = action.payload.subtopic.trim();
      const questionNumber = normalizeQuestionNumber(
        action.payload.questionNumber
      );

      if (!category || !topic || !subtopic || questionNumber === undefined) {
        return;
      }

      state.progress[category] ??= {};
      state.progress[category][topic] ??= {};

      const currentProgress =
        state.progress[category][topic][subtopic] ??
        normalizeSubTopicProgress({
          totalQuestion: action.payload.totalQuestion,
          completedQuestion: [],
        });
      const completedQuestion = action.payload.completed
        ? [...currentProgress.completedQuestion, questionNumber]
        : currentProgress.completedQuestion.filter(
            (completedQuestionNumber) =>
              completedQuestionNumber !== questionNumber
          );

      state.progress[category][topic][subtopic] = normalizeSubTopicProgress({
        totalQuestion: action.payload.totalQuestion,
        completedQuestion,
      });
    },
    resetContentState: () => createInitialState(),
  },
});

export const {
  resetContentState,
  setContentProgress,
  setQuestionCompletion,
  setSelectedTopicId,
  setSubTopicProgress,
} = contentSlice.actions;

export const contentReducer = contentSlice.reducer;

function createInitialState(): ContentState {
  return {
    selectedTopicId: undefined,
    progress: loadContentProgressFromLocalStorage(),
  };
}

export function loadContentProgressFromLocalStorage(): ContentProgressState {
  const storage = getLocalStorage();

  if (!storage) {
    return {};
  }

  try {
    const storedProgress = storage.getItem(CONTENT_PROGRESS_STORAGE_KEY);

    if (!storedProgress) {
      return {};
    }

    return normalizeContentProgress(JSON.parse(storedProgress));
  } catch {
    return {};
  }
}

export function saveContentProgressToLocalStorage(
  progress: ContentProgressState
) {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      CONTENT_PROGRESS_STORAGE_KEY,
      JSON.stringify(normalizeContentProgress(progress))
    );
  } catch {
    // Storage can be unavailable or full; Redux remains the runtime source of truth.
  }
}

function normalizeContentProgress(value: unknown): ContentProgressState {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<ContentProgressState>(
    (normalizedCategories, [category, topics]) => {
      if (!isRecord(topics)) {
        return normalizedCategories;
      }

      const normalizedTopics = Object.entries(topics).reduce<
        Record<string, Record<string, ContentSubTopicProgress>>
      >((topicProgress, [topic, subtopics]) => {
        if (!isRecord(subtopics)) {
          return topicProgress;
        }

        const normalizedSubtopics = Object.entries(subtopics).reduce<
          Record<string, ContentSubTopicProgress>
        >((subtopicProgress, [subtopic, progress]) => {
          const progressValue = normalizeSubTopicProgress(progress);

          if (
            progressValue.totalQuestion > 0 ||
            progressValue.completedQuestion.length > 0
          ) {
            subtopicProgress[subtopic] = progressValue;
          }

          return subtopicProgress;
        }, {});

        if (Object.keys(normalizedSubtopics).length > 0) {
          topicProgress[topic] = normalizedSubtopics;
        }

        return topicProgress;
      }, {});

      if (Object.keys(normalizedTopics).length > 0) {
        normalizedCategories[category] = normalizedTopics;
      }

      return normalizedCategories;
    },
    {}
  );
}

export function getContentSubTopicProgressPercentage(
  progress?: ContentSubTopicProgress
) {
  if (!progress || progress.totalQuestion <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.round(
      (progress.completedQuestion.length / progress.totalQuestion) * 100
    )
  );
}

function normalizeSubTopicProgress(value: unknown): ContentSubTopicProgress {
  if (typeof value === "number") {
    const progressValue = normalizePercentValue(value);

    return {
      totalQuestion: 100,
      completedQuestion: createCompletedQuestionNumbers(progressValue),
    };
  }

  if (!isRecord(value)) {
    return {
      totalQuestion: 0,
      completedQuestion: [],
    };
  }

  return {
    totalQuestion: normalizeTotalQuestion(value.totalQuestion),
    completedQuestion: normalizeCompletedQuestion(value.completedQuestion),
  };
}

function normalizeTotalQuestion(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.round(numericValue));
}

function normalizeCompletedQuestion(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.flatMap((questionNumber) => {
        const normalizedQuestionNumber = normalizeQuestionNumber(questionNumber);

        return normalizedQuestionNumber === undefined
          ? []
          : [normalizedQuestionNumber];
      })
    )
  ).sort((left, right) => left - right);
}

function normalizeQuestionNumber(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return undefined;
  }

  return Math.round(numericValue);
}

function normalizePercentValue(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(numericValue)));
}

function createCompletedQuestionNumbers(progressValue: number) {
  return Array.from({ length: progressValue }, (_, index) => index + 1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
