import { createContext, useContext } from "react";
import { createTheme, type PaletteMode } from "@mui/material";

export type AppThemeMode = "dark" | "light";

export type AppThemeTokens = {
  mode: AppThemeMode;
  background: string;
  onBackground: string;
  surface: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  tertiary: string;
  error: string;
  glass: string;
  headerBackground: string;
  footerBackground: string;
  cardBorder: string;
  accentBorder: string;
  accentGlow: string;
  accentSoft: string;
  accentHover: string;
  cardHoverBorder: string;
  cardHoverGlow: string;
  chipBackground: string;
  chipText: string;
  codeSurface: string;
  featureBand: string;
  gridLine: string;
  panelGlow: string;
  subtleText: string;
  warning: string;
};

export const appThemeTokens: Record<AppThemeMode, AppThemeTokens> = {
  dark: {
    mode: "dark",
    background: "#111318",
    onBackground: "#e2e2e8",
    surface: "#111318",
    surfaceContainerLowest: "#0c0e12",
    surfaceContainerLow: "#1a1c20",
    surfaceContainer: "#1e2024",
    surfaceContainerHigh: "#282a2e",
    onSurface: "#e2e2e8",
    onSurfaceVariant: "#b9cacb",
    outline: "#849495",
    outlineVariant: "#3b494b",
    primary: "#dbfcff",
    onPrimary: "#00363a",
    primaryContainer: "#00f0ff",
    onPrimaryContainer: "#006970",
    secondary: "#d8b9ff",
    tertiary: "#d1fff5",
    error: "#ffb4ab",
    glass: "rgba(18, 23, 33, 0.8)",
    headerBackground: "rgba(10, 12, 16, 0.8)",
    footerBackground: "#0a0c10",
    cardBorder: "rgba(255, 255, 255, 0.1)",
    accentBorder: "rgba(0, 240, 255, 0.2)",
    accentGlow: "0 0 20px rgba(0, 240, 255, 0.3)",
    accentSoft: "rgba(0, 240, 255, 0.1)",
    accentHover: "rgba(0, 240, 255, 0.08)",
    cardHoverBorder: "rgba(0, 240, 255, 0.45)",
    cardHoverGlow: "0 0 15px rgba(0, 240, 255, 0.1)",
    chipBackground: "rgba(255, 255, 255, 0.05)",
    chipText: "#94a3b8",
    codeSurface: "#0c0e12",
    featureBand: "rgba(26, 28, 32, 0.5)",
    gridLine: "rgba(0, 240, 255, 0.05)",
    panelGlow: "0 0 20px rgba(0, 240, 255, 0.3)",
    subtleText: "#64748b",
    warning: "rgba(234, 179, 8, 0.5)",
  },
  light: {
    mode: "light",
    background: "#f9f9ff",
    onBackground: "#1a1c20",
    surface: "#f9f9ff",
    surfaceContainerLowest: "#ffffff",
    surfaceContainerLow: "#f3f3f9",
    surfaceContainer: "#ededf3",
    surfaceContainerHigh: "#e8e8ee",
    onSurface: "#1a1c20",
    onSurfaceVariant: "#3b494b",
    outline: "#6a7a7b",
    outlineVariant: "#b9cacb",
    primary: "#006970",
    onPrimary: "#ffffff",
    primaryContainer: "#00f0ff",
    onPrimaryContainer: "#006970",
    secondary: "#7b24dc",
    tertiary: "#006b5f",
    error: "#ba1a1a",
    glass: "rgba(255, 255, 255, 0.72)",
    headerBackground: "rgba(255, 255, 255, 0.78)",
    footerBackground: "#ffffff",
    cardBorder: "rgba(106, 122, 123, 0.24)",
    accentBorder: "rgba(0, 240, 255, 0.3)",
    accentGlow: "0 0 20px rgba(0, 240, 255, 0.18)",
    accentSoft: "rgba(0, 240, 255, 0.15)",
    accentHover: "rgba(0, 240, 255, 0.14)",
    cardHoverBorder: "rgba(0, 105, 112, 0.4)",
    cardHoverGlow: "0 0 18px rgba(0, 240, 255, 0.14)",
    chipBackground: "rgba(0, 105, 112, 0.08)",
    chipText: "#3b494b",
    codeSurface: "#ffffff",
    featureBand: "rgba(243, 243, 249, 0.75)",
    gridLine: "rgba(0, 105, 112, 0.06)",
    panelGlow: "0 0 20px rgba(0, 240, 255, 0.16)",
    subtleText: "#6a7a7b",
    warning: "rgba(202, 138, 4, 0.55)",
  },
};

export type ThemeModeContextValue = {
  mode: AppThemeMode;
  tokens: AppThemeTokens;
  toggleMode: () => void;
  setMode: (mode: AppThemeMode) => void;
};

export const ThemeModeContext = createContext<
  ThemeModeContextValue | undefined
>(undefined);

export function applyThemeVariables(tokens: AppThemeTokens) {
  const root = document.documentElement;

  root.dataset.theme = tokens.mode;
  root.classList.toggle("dark", tokens.mode === "dark");
  root.classList.toggle("light", tokens.mode === "light");

  root.style.setProperty("--color-background", tokens.background);
  root.style.setProperty("--color-on-background", tokens.onBackground);
  root.style.setProperty("--color-surface", tokens.surface);
  root.style.setProperty(
    "--color-surface-container-lowest",
    tokens.surfaceContainerLowest
  );
  root.style.setProperty(
    "--color-surface-container-low",
    tokens.surfaceContainerLow
  );
  root.style.setProperty("--color-surface-container", tokens.surfaceContainer);
  root.style.setProperty(
    "--color-surface-container-high",
    tokens.surfaceContainerHigh
  );
  root.style.setProperty("--color-on-surface", tokens.onSurface);
  root.style.setProperty(
    "--color-on-surface-variant",
    tokens.onSurfaceVariant
  );
  root.style.setProperty("--color-outline", tokens.outline);
  root.style.setProperty("--color-outline-variant", tokens.outlineVariant);
  root.style.setProperty("--color-primary", tokens.primary);
  root.style.setProperty("--color-on-primary", tokens.onPrimary);
  root.style.setProperty("--color-primary-container", tokens.primaryContainer);
  root.style.setProperty(
    "--color-on-primary-container",
    tokens.onPrimaryContainer
  );
  root.style.setProperty("--color-secondary", tokens.secondary);
  root.style.setProperty("--color-tertiary", tokens.tertiary);
  root.style.setProperty("--color-error", tokens.error);
  root.style.setProperty("--color-glass", tokens.glass);
  root.style.setProperty("--color-card-border", tokens.cardBorder);
  root.style.setProperty("--color-accent-border", tokens.accentBorder);
  root.style.setProperty("--color-accent-soft", tokens.accentSoft);
  root.style.setProperty("--color-accent-hover", tokens.accentHover);
  root.style.setProperty("--color-card-hover-border", tokens.cardHoverBorder);
  root.style.setProperty("--color-chip-background", tokens.chipBackground);
  root.style.setProperty("--color-chip-text", tokens.chipText);
  root.style.setProperty("--color-code-surface", tokens.codeSurface);
  root.style.setProperty("--color-feature-band", tokens.featureBand);
  root.style.setProperty("--color-grid-line", tokens.gridLine);
  root.style.setProperty("--color-subtle-text", tokens.subtleText);
  root.style.setProperty("--color-warning", tokens.warning);
  root.style.setProperty("--shadow-accent-glow", tokens.accentGlow);
  root.style.setProperty("--shadow-card-hover", tokens.cardHoverGlow);
  root.style.setProperty("--shadow-panel-glow", tokens.panelGlow);
}

export function buildMuiTheme(mode: PaletteMode, tokens: AppThemeTokens) {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: tokens.primaryContainer,
        contrastText: tokens.onPrimaryContainer,
      },
      secondary: {
        main: tokens.secondary,
      },
      error: {
        main: tokens.error,
      },
      background: {
        default: tokens.background,
        paper: tokens.surfaceContainer,
      },
      text: {
        primary: tokens.onSurface,
        secondary: tokens.onSurfaceVariant,
      },
      divider: tokens.outlineVariant,
    },
    typography: {
      fontFamily:
        '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      h1: {
        fontFamily: '"Space Grotesk", "Inter", sans-serif',
        fontWeight: 700,
        letterSpacing: "-0.02em",
      },
      h2: {
        fontFamily: '"Space Grotesk", "Inter", sans-serif',
        fontWeight: 600,
      },
      h3: {
        fontFamily: '"Space Grotesk", "Inter", sans-serif',
        fontWeight: 600,
      },
      button: {
        fontFamily: '"Space Grotesk", "Inter", sans-serif',
        fontWeight: 700,
        letterSpacing: "0.05em",
      },
    },
    shape: {
      borderRadius: 4,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: tokens.background,
            color: tokens.onBackground,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 2,
            transition:
              "background-color 180ms ease, border-color 180ms ease, color 180ms ease, box-shadow 180ms ease, filter 180ms ease",
          },
          contained: {
            backgroundColor: tokens.primaryContainer,
            boxShadow: tokens.accentGlow,
            color: tokens.onPrimaryContainer,
            "&:hover": {
              backgroundColor: tokens.primaryContainer,
              boxShadow: tokens.accentGlow,
              filter: "brightness(1.08)",
            },
          },
          outlined: {
            borderColor: tokens.accentBorder,
            color: tokens.primaryContainer,
            "&:hover": {
              backgroundColor: tokens.accentHover,
              borderColor: tokens.cardHoverBorder,
            },
          },
          text: {
            color: tokens.primaryContainer,
            "&:hover": {
              backgroundColor: tokens.accentHover,
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backdropFilter: "blur(16px)",
            backgroundImage: "none",
            backgroundColor: tokens.glass,
            border: `1px solid ${tokens.cardBorder}`,
            boxShadow: "none",
            color: tokens.onSurface,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: tokens.surfaceContainer,
            color: tokens.onSurface,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: tokens.surfaceContainerLowest,
            color: tokens.onSurface,
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: tokens.outlineVariant,
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: tokens.cardHoverBorder,
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: tokens.primaryContainer,
              boxShadow: `0 0 0 1px ${tokens.primaryContainer}`,
            },
          },
          input: {
            color: tokens.onSurface,
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: tokens.onSurfaceVariant,
            "&.Mui-focused": {
              color: tokens.primaryContainer,
            },
          },
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            color: tokens.onSurfaceVariant,
          },
        },
      },
      MuiCheckbox: {
        styleOverrides: {
          root: {
            color: tokens.outline,
            "&.Mui-checked": {
              color: tokens.primaryContainer,
            },
          },
        },
      },
    },
  });
}

export function useAppThemeMode() {
  const context = useContext(ThemeModeContext);

  if (!context) {
    throw new Error("useAppThemeMode must be used within AppThemeModeProvider");
  }

  return context;
}
