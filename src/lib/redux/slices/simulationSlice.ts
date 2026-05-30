import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  getAllCurriculumCategories,
  getAllCurriculumTopics,
  getCurriculumSubTopicsByTopic,
  getCurriculumTopicsByCategory,
} from "../../../shared/function";

export type SimulationStep = "setup" | "session" | "result";
export type SimulationDifficultyLevel = "entry" | "standard" | "expert";
export type SimulationSessionLength = 15 | 30 | 60;

export type SimulationState = {
  currentSessionId?: string;
  difficultyLevel: SimulationDifficultyLevel;
  sessionLength: SimulationSessionLength;
  selectedCategoryIds: string[];
  selectedTopicIds: string[];
  selectedSubTopicIds: string[];
  simulationStep: SimulationStep;
};

type StartSimulationSessionPayload = {
  sessionId: string;
};

const initialState: SimulationState = createInitialSimulationState();

const simulationSlice = createSlice({
  name: "simulation",
  initialState,
  reducers: {
    resetSimulationState: () => createInitialSimulationState(),
    setSimulationDifficultyLevel(
      state,
      action: PayloadAction<SimulationDifficultyLevel>
    ) {
      state.difficultyLevel = action.payload;
    },
    setSimulationSessionLength(
      state,
      action: PayloadAction<SimulationSessionLength>
    ) {
      state.sessionLength = action.payload;
    },
    setSimulationStep(state, action: PayloadAction<SimulationStep>) {
      state.simulationStep = action.payload;
    },
    startSimulationSession(
      state,
      action: PayloadAction<StartSimulationSessionPayload>
    ) {
      if (state.selectedSubTopicIds.length === 0) {
        return;
      }

      state.currentSessionId = action.payload.sessionId;
      state.simulationStep = "session";
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
  },
});

export const {
  resetSimulationState,
  setSimulationDifficultyLevel,
  setSimulationSessionLength,
  setSimulationStep,
  startSimulationSession,
  toggleSimulationCategory,
  toggleSimulationTopic,
} = simulationSlice.actions;

export const simulationReducer = simulationSlice.reducer;

function createInitialSimulationState(): SimulationState {
  const firstCategory = getAllCurriculumCategories()[0];

  if (!firstCategory) {
    return {
      currentSessionId: undefined,
      difficultyLevel: "standard",
      sessionLength: 30,
      selectedCategoryIds: [],
      selectedTopicIds: [],
      selectedSubTopicIds: [],
      simulationStep: "setup",
    };
  }

  const topics = getCurriculumTopicsByCategory(firstCategory);

  return {
    currentSessionId: undefined,
    difficultyLevel: "standard",
    sessionLength: 30,
    selectedCategoryIds: [firstCategory.id],
    selectedTopicIds: topics.map((topic) => topic.id),
    selectedSubTopicIds: getSubTopicIdsForTopics(topics),
    simulationStep: "setup",
  };
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
