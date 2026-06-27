import type { AppPreloadedState, AppStore } from "./createAppStore";
import {
  createInitialContentState,
  loadContentProgressFromLocalStorage,
  saveContentProgressToLocalStorage,
  setContentProgress,
} from "./slices/contentSlice";
import {
  clearSimulationSessionState,
  createInitialSimulationState,
  loadSimulationSession,
  loadSimulationSessionState,
  saveSimulationSessionState,
} from "./slices/simulationSlice";

export function loadBrowserPreloadedState(): AppPreloadedState | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return {
    content: createInitialContentState(loadContentProgressFromLocalStorage()),
    simulation: createInitialSimulationState(loadSimulationSessionState()),
  };
}

export function startBrowserStorePersistence(store: AppStore) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  let previousContentProgress = store.getState().content.progress;
  let previousSimulationSession =
    store.getState().simulation.currentSession;

  return store.subscribe(() => {
    const nextContentProgress = store.getState().content.progress;
    const nextSimulationSession = store.getState().simulation.currentSession;

    if (nextContentProgress !== previousContentProgress) {
      previousContentProgress = nextContentProgress;
      saveContentProgressToLocalStorage(nextContentProgress);
    }

    if (nextSimulationSession !== previousSimulationSession) {
      previousSimulationSession = nextSimulationSession;

      if (nextSimulationSession) {
        saveSimulationSessionState(nextSimulationSession);
      } else {
        clearSimulationSessionState();
      }
    }
  });
}

export function hydrateBrowserStoreFromPersistence(store: AppStore) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  store.dispatch(setContentProgress(loadContentProgressFromLocalStorage()));

  const savedSession = loadSimulationSessionState();

  if (savedSession) {
    store.dispatch(loadSimulationSession(savedSession));
  }

  return startBrowserStorePersistence(store);
}
