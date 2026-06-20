import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import { Box, Button, IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import { useState } from "react";
import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAppThemeMode } from "../theme/themeMode";

const NAV_ITEMS = {
  "Learning": "/content#dotnet",
  "Practice": "/practice",
  "Simulation": "/simulation",
  "Roadmap": "/roadmap",
  "About Us": "/about-us",
};

export function AppHeader() {
  const navigate = useNavigate();
  const { mode, tokens, toggleMode } = useAppThemeMode();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const openMenu = (event: MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const closeMenu = () => {
    setMenuAnchor(null);
  };

  const scrollToPageTop = () => {
    requestAnimationFrame(() => {
      window.scrollTo({ left: 0, top: 0 });
      requestAnimationFrame(() => window.scrollTo({ left: 0, top: 0 }));
    });
  };

  const navigateFromHeader = (path: string) => {
    closeMenu();
    navigate(path);
    scrollToPageTop();
  };

  const goHome = () => {
    navigateFromHeader("/");
  };

  return (
    <Box
      component="header"
      sx={{
        alignItems: "center",
        backdropFilter: "blur(16px)",
        backgroundColor: tokens.headerBackground,
        borderBottom: `1px solid ${tokens.cardBorder}`,
        boxShadow:
          mode === "dark"
            ? "0 0 20px rgba(0, 240, 255, 0.05)"
            : "0 10px 30px rgba(0, 105, 112, 0.08)",
        display: "flex",
        gap: 3,
        justifyContent: "space-between",
        left: "50%",
        maxWidth: "1440px",
        px: 3,
        py: 2,
        position: "fixed",
        top: 0,
        transform: "translateX(-50%)",
        width: "100%",
        zIndex: (theme) => theme.zIndex.appBar,
      }}
    >
      <Button
        disableRipple
        onClick={goHome}
        sx={{
          color: tokens.onSurface,
          fontFamily: '"Space Grotesk", "Inter", sans-serif',
          fontSize: 24,
          fontStyle: "italic",
          fontWeight: 900,
          letterSpacing: "-0.05em",
          lineHeight: 1,
          minWidth: 0,
          p: 0,
          textTransform: "uppercase",
          "&:hover": {
            backgroundColor: "transparent",
            color: tokens.primaryContainer,
          },
        }}
      >
        DEV_NET_CORE
      </Button>

      <Box
        component="nav"
        sx={{
          alignItems: "center",
          display: { xs: "none", md: "flex" },
          gap: 4,
        }}
      >
        {Object.entries(NAV_ITEMS).map(([label, path]) => (
          <Button
            disableRipple
            key={label}
            onClick={() => navigateFromHeader(path)}
            sx={{
              color: tokens.onSurfaceVariant,
              fontFamily: '"Space Grotesk", "Inter", sans-serif',
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: "-0.01em",
              minWidth: 0,
              p: 0,
              textTransform: "uppercase",
              transition: "color 180ms ease, transform 180ms ease",
              "&:hover": {
                backgroundColor: "transparent",
                color: tokens.onSurface,
                transform: "translateY(-1px)",
              },
            }}
            type="button"
          >
            {label}
          </Button>
        ))}
      </Box>

      <Box sx={{ alignItems: "center", display: "flex", gap: { xs: 1.5, md: 3 } }}>
        <Tooltip title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
          <IconButton
            aria-label="Toggle theme mode"
            onClick={toggleMode}
            sx={{
              color: tokens.onSurfaceVariant,
              height: 32,
              transition: "color 180ms ease, transform 120ms ease",
              width: 32,
              "&:hover": {
                backgroundColor: "transparent",
                color: tokens.onSurface,
              },
              "&:active": {
                transform: "scale(0.95)",
              },
            }}
          >
            {mode === "dark" ? (
              <LightModeOutlinedIcon sx={{ fontSize: 20 }} />
            ) : (
              <DarkModeOutlinedIcon sx={{ fontSize: 20 }} />
            )}
          </IconButton>
        </Tooltip>

        <Button
          disableElevation
          onClick={() => navigateFromHeader("/content")}
          sx={{
            backgroundColor: tokens.primaryContainer,
            borderRadius: "2px",
            boxShadow: tokens.accentGlow,
            color: tokens.onPrimaryContainer,
            display: { xs: "none", sm: "inline-flex" },
            fontFamily: '"Space Grotesk", "Inter", sans-serif',
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1,
            px: 3,
            py: 1,
            textTransform: "uppercase",
            transition: "filter 180ms ease, transform 120ms ease",
            "&:hover": {
              backgroundColor: tokens.primaryContainer,
              filter: "brightness(1.1)",
            },
            "&:active": {
              transform: "scale(0.95)",
            },
          }}
          type="button"
        >
          GET_STARTED
        </Button>

        <IconButton
          aria-label="Open navigation"
          onClick={openMenu}
          sx={{
            color: tokens.onSurfaceVariant,
            display: { xs: "inline-flex", md: "none" },
            "&:hover": {
              backgroundColor: tokens.accentBorder,
              color: tokens.onSurface,
            },
          }}
        >
          <MenuIcon />
        </IconButton>

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={closeMenu}
          PaperProps={{
            sx: {
              backdropFilter: "blur(16px)",
              backgroundColor: tokens.glass,
              border: `1px solid ${tokens.cardBorder}`,
              borderRadius: "4px",
              mt: 1.5,
              minWidth: 220,
            },
          }}
        >
          {Object.entries(NAV_ITEMS).map(([label, path]) => (
            <MenuItem
              key={label}
              onClick={() => navigateFromHeader(path)}
              sx={{
                color: tokens.onSurfaceVariant,
                fontFamily: '"Space Grotesk", "Inter", sans-serif',
                fontSize: 12,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                "&:hover": {
                  backgroundColor: tokens.accentBorder,
                  color: tokens.onSurface,
                },
              }}
            >
              {label}
            </MenuItem>
          ))}
          <MenuItem
            onClick={() => navigateFromHeader("/content")}
            sx={{
              color: tokens.primaryContainer,
              display: { xs: "flex", sm: "none" },
              fontFamily: '"Space Grotesk", "Inter", sans-serif',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            GET_STARTED
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}
