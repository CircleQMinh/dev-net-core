import BugReportOutlinedIcon from "@mui/icons-material/BugReportOutlined";
import CodeOutlinedIcon from "@mui/icons-material/CodeOutlined";
import TerminalOutlinedIcon from "@mui/icons-material/TerminalOutlined";
import { Box, IconButton, Link, Stack, Typography } from "@mui/material";
import { useAppThemeMode } from "../theme/themeMode";

const FOOTER_LINKS = [
  "Github",
  "Changelog",
  "Bug report",
  "Terms",
  "Privacy",
];

const FOOTER_ICONS = [
  { label: "Terminal", icon: <TerminalOutlinedIcon /> },
  { label: "Code", icon: <CodeOutlinedIcon /> },
  { label: "Bug report", icon: <BugReportOutlinedIcon /> },
];

export function AppFooter() {
  const { tokens } = useAppThemeMode();

  return (
    <Box
      component="footer"
      sx={{
        alignItems: "center",
        backgroundColor: tokens.footerBackground,
        borderTop: `1px solid ${tokens.cardBorder}`,
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        gap: 2,
        justifyContent: "space-between",
        maxWidth: "1440px",
        mx: "auto",
        px: 3,
        py: 6,
        width: "100%",
      }}
    >
      <Box sx={{ textAlign: { xs: "center", md: "left" } }}>
        <Typography
          sx={{
            color: tokens.onSurface,
            fontFamily: '"Space Grotesk", "Inter", sans-serif',
            fontSize: 18,
            fontWeight: 700,
            lineHeight: 1.2,
            mb: 1,
            textTransform: "uppercase",
          }}
        >
          DEV_CORE ARCHITECTURE
        </Typography>
        <Typography
          sx={{
            color: tokens.outline,
            fontFamily: '"Space Grotesk", "Inter", sans-serif',
            fontSize: 10,
            fontWeight: 300,
            letterSpacing: "0.14em",
            lineHeight: 1.4,
            textTransform: "uppercase",
          }}
        >
          © 2024 DEV_NET_CORE & MINH VU. ALL RIGHTS RESERVED.
        </Typography>
      </Box>

      <Stack
        component="nav"
        direction="row"
        flexWrap="wrap"
        gap={{ xs: 2, md: 4 }}
        justifyContent="center"
      >
        {FOOTER_LINKS.map((link) => (
          <Link
            href="#"
            key={link}
            underline="none"
            sx={{
              color: tokens.outline,
              fontFamily: '"Space Grotesk", "Inter", sans-serif',
              fontSize: 10,
              fontWeight: 300,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              transition: "color 180ms ease",
              "&:hover": {
                color: tokens.primaryContainer,
              },
            }}
          >
            {link}
          </Link>
        ))}
      </Stack>

      <Stack direction="row" gap={1.5}>
        {FOOTER_ICONS.map(({ label, icon }) => (
          <IconButton
            aria-label={label}
            key={label}
            sx={{
              color: tokens.outline,
              height: 28,
              p: 0,
              transition: "color 180ms ease, transform 120ms ease",
              width: 28,
              "& .MuiSvgIcon-root": {
                fontSize: 18,
              },
              "&:hover": {
                backgroundColor: "transparent",
                color: tokens.primaryContainer,
                transform: "translateY(-1px)",
              },
            }}
          >
            {icon}
          </IconButton>
        ))}
      </Stack>
    </Box>
  );
}
