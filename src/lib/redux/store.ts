import { configureStore } from '@reduxjs/toolkit';
import { dumnmyApi } from './api/dummyApi';
import {dummyReducer } from './slices/dummySilce'
import {
  contentReducer,
  saveContentProgressToLocalStorage,
} from './slices/contentSlice';
import { simulationReducer } from './slices/simulationSlice';

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

store.subscribe(() => {
  const nextContentProgress = store.getState().content.progress;

  if (nextContentProgress !== previousContentProgress) {
    previousContentProgress = nextContentProgress;
    saveContentProgressToLocalStorage(nextContentProgress);
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
