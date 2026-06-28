import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import {
  appThemeTokens,
  applyThemeVariables,
  buildMuiTheme,
  persistThemeMode,
  readBootstrappedThemeMode,
  ThemeModeContext,
  type AppThemeMode,
} from "./themeMode";

type AppThemeModeProviderProps = {
  children: ReactNode;
  initialMode?: AppThemeMode;
};

export function AppThemeModeProvider({
  children,
  initialMode = "dark",
}: AppThemeModeProviderProps) {
  const [mode, setModeState] = useState<AppThemeMode>(initialMode);
  const hasReadBootstrappedMode = useRef(false);
  const tokens = appThemeTokens[mode];

  useLayoutEffect(() => {
    if (!hasReadBootstrappedMode.current) {
      hasReadBootstrappedMode.current = true;
      const bootstrappedMode = readBootstrappedThemeMode(initialMode);

      if (bootstrappedMode !== mode) {
        // The bootstrap is an external pre-hydration input. Reconcile it in a
        // layout effect so server markup hydrates as dark before the saved
        // choice is applied, while still updating before the browser paints.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setModeState(bootstrappedMode);
        return;
      }
    }

    applyThemeVariables(tokens);
  }, [initialMode, mode, tokens]);

  const setMode = useCallback((nextMode: AppThemeMode) => {
    persistThemeMode(nextMode);
    setModeState(nextMode);
  }, []);

  const muiTheme = useMemo(() => buildMuiTheme(mode, tokens), [mode, tokens]);

  const value = useMemo(
    () => ({
      mode,
      tokens,
      setMode,
      toggleMode: () => setMode(mode === "dark" ? "light" : "dark"),
    }),
    [mode, setMode, tokens]
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}
