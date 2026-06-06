import { configureStore } from '@reduxjs/toolkit';
import { dumnmyApi } from './api/dummyApi';
import {dummyReducer } from './slices/dummySilce'
import {
  contentReducer,
  saveContentProgressToLocalStorage,
} from './slices/contentSlice';
import {
  clearSimulationSessionState,
  saveSimulationSessionState,
  simulationReducer,
} from './slices/simulationSlice';

export const store = configureStore({
  reducer: {
    content: contentReducer,
    dumnmy: dummyReducer,
    simulation: simulationReducer,
    [dumnmyApi.reducerPath]: dumnmyApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(dumnmyApi.middleware),
});

let previousContentProgress = store.getState().content.progress;
let previousSimulationSession = store.getState().simulation.currentSession;

store.subscribe(() => {
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

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
