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

export function AppThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AppThemeMode>("dark");
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
