import { useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import {
  createAppStore,
  type AppPreloadedState,
  type AppStore,
} from "./lib/redux/createAppStore";
import { AppThemeModeProvider } from "./theme/ThemeModeProvider";
import type { AppThemeMode } from "./theme/themeMode";

type AppProvidersProps = {
  children: ReactNode;
  initialThemeMode?: AppThemeMode;
  preloadedState?: AppPreloadedState;
  store?: AppStore;
};

export function AppProviders({
  children,
  initialThemeMode = "dark",
  preloadedState,
  store,
}: AppProvidersProps) {
  const [appStore] = useState(() => store ?? createAppStore(preloadedState));

  return (
    <Provider store={appStore}>
      <AppThemeModeProvider initialMode={initialThemeMode}>
        {children}
      </AppThemeModeProvider>
    </Provider>
  );
}
