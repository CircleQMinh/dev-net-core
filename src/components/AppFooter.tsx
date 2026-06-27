import { Box, Link, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useAppThemeMode } from "../theme/themeMode";

type FooterLink =
  | {
      label: string;
      href: string;
      external: true;
    }
  | {
      label: string;
      to: string;
      external: false;
    };

const FOOTER_LINKS: FooterLink[] = [
  {
    label: "Github",
    href: "https://github.com/CircleQMinh/dev-net-core",
    external: true,
  },
  { label: "Changelog", to: "/changelog/", external: false },
  { label: "Bug report", to: "/bug-report/", external: false },
  { label: "Terms", to: "/terms/", external: false },
  { label: "Privacy", to: "/privacy/", external: false },
];

function scrollToPageTop() {
  requestAnimationFrame(() => {
    window.scrollTo({ left: 0, top: 0 });
    requestAnimationFrame(() => window.scrollTo({ left: 0, top: 0 }));
  });
}

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
          DEV_NET_CORE 
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
          © 2026 DEV_NET_CORE & MINH VU. ALL RIGHTS RESERVED.
        </Typography>
      </Box>

      <Stack
        component="nav"
        direction="row"
        flexWrap="wrap"
        gap={{ xs: 2, md: 4 }}
        justifyContent="center"
      >
        {FOOTER_LINKS.map((link) =>
          link.external ? (
            <Link
              href={link.href}
              key={link.label}
              rel="noreferrer"
              target="_blank"
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
              {link.label}
            </Link>
          ) : (
            <Link
              component={RouterLink}
              key={link.label}
              onClick={scrollToPageTop}
              to={link.to}
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
              {link.label}
            </Link>
          )
        )}
      </Stack>
    </Box>
  );
}
