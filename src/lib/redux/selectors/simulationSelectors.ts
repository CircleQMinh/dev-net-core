import type { RootState } from "../store";

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

export const selectSimulationQuestionsPerTopic = (state: RootState) =>
  state.simulation.questionsPerTopic;

export const selectSimulationCustomQuestionsPerTopic = (state: RootState) =>
  state.simulation.customQuestionsPerTopic;

export const selectSimulationCurrentSessionId = (state: RootState) =>
  state.simulation.currentSessionId;

export const selectSimulationCurrentSession = (state: RootState) =>
  state.simulation.currentSession;
