import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import {
  appThemeTokens,
  applyThemeVariables,
  buildMuiTheme,
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
  const [mode, setMode] = useState<AppThemeMode>(initialMode);
  const tokens = appThemeTokens[mode];

  useEffect(() => {
    applyThemeVariables(tokens);
  }, [tokens]);

  const muiTheme = useMemo(() => buildMuiTheme(mode, tokens), [mode, tokens]);

  const value = useMemo(
    () => ({
      mode,
      tokens,
      setMode,
      toggleMode: () =>
        setMode((current) => (current === "dark" ? "light" : "dark")),
    }),
    [mode, tokens]
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
