import type { RootState } from "../createAppStore";

export const selectSimulationState = (state: RootState) => state.simulation;

export const selectSimulationSelectedCategoryIds = (state: RootState) =>
  state.simulation.selectedCategoryIds;

export const selectSimulationSelectedTopicIds = (state: RootState) =>
  state.simulation.selectedTopicIds;

export const selectSimulationSelectedSubTopicIds = (state: RootState) =>
  state.simulation.selectedSubTopicIds;

export const selectSimulationStep = (state: RootState) =>
  state.simulation.simulationStep;

export const selectSimulationDifficultyLevel = (state: RootState) =>
  state.simulation.difficultyLevel;

export const selectSimulationQuestionCountMode = (state: RootState) =>
  state.simulation.questionCountMode;

export const selectSimulationQuestionsPerCategory = (state: RootState) =>
  state.simulation.questionsPerCategory;

export const selectSimulationCustomQuestionsPerCategory = (state: RootState) =>
  state.simulation.customQuestionsPerCategory;

export const selectSimulationCurrentSessionId = (state: RootState) =>
  state.simulation.currentSessionId;

export const selectSimulationCurrentSession = (state: RootState) =>
  state.simulation.currentSession;
