import type { RootState } from "../createAppStore";

export const selectSelectedContentTopicId = (state: RootState) =>
  state.content.selectedTopicId;

export const selectContentProgress = (state: RootState) =>
  state.content.progress;
