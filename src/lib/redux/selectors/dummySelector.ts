import type { RootState } from '../createAppStore';

export const selectDummyItems = (state: RootState) => state.dumnmy.items
