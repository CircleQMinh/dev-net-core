import { useEffect, useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import {
  createAppStore,
  type AppPreloadedState,
  type AppStore,
} from "./lib/redux/createAppStore";
import { AppThemeModeProvider } from "./theme/ThemeModeProvider";
import type { AppThemeMode } from "./theme/themeMode";
import { hydrateBrowserStoreFromPersistence } from "./lib/redux/persistence";

type AppProvidersProps = {
  children: ReactNode;
  hydrateBrowserPersistence?: boolean;
  initialThemeMode?: AppThemeMode;
  preloadedState?: AppPreloadedState;
  store?: AppStore;
};

export function AppProviders({
  children,
  hydrateBrowserPersistence = false,
  initialThemeMode = "dark",
  preloadedState,
  store,
}: AppProvidersProps) {
  const [appStore] = useState(() => store ?? createAppStore(preloadedState));

  useEffect(() => {
    if (!hydrateBrowserPersistence) {
      return;
    }

    return hydrateBrowserStoreFromPersistence(appStore);
  }, [appStore, hydrateBrowserPersistence]);

  return (
    <Provider store={appStore}>
      <AppThemeModeProvider initialMode={initialThemeMode}>
        {children}
      </AppThemeModeProvider>
    </Provider>
  );
}
