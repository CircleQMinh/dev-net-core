import { createAppStore } from "./createAppStore";
import {
  loadBrowserPreloadedState,
  startBrowserStorePersistence,
} from "./persistence";

export const browserStore = createAppStore(loadBrowserPreloadedState());

startBrowserStorePersistence(browserStore);
