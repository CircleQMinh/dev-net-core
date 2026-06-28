import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { dumnmyApi } from "./api/dummyApi";
import { contentReducer } from "./slices/contentSlice";
import { dummyReducer } from "./slices/dummySilce";
import { simulationReducer } from "./slices/simulationSlice";

const rootReducer = combineReducers({
  content: contentReducer,
  dumnmy: dummyReducer,
  simulation: simulationReducer,
  [dumnmyApi.reducerPath]: dumnmyApi.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppPreloadedState = Partial<RootState>;

export function createAppStore(preloadedState?: AppPreloadedState) {
  return configureStore({
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(dumnmyApi.middleware),
    preloadedState,
    reducer: rootReducer,
  });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore["dispatch"];
