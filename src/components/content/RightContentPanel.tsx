import RestartAltOutlinedIcon from "@mui/icons-material/RestartAltOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import { Button } from "@mui/material";

const recommendedImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCOK71GBw9SdfFI3yjmMNgPlQGrJv1x5jsucNgPY5pGTIeBbVmV_XsPin4hLetk7Q7Xfnzl6Aq-eTSG5ildIucWNGDQ6M-n5BW55hCyfGIsYMcqUZyVLsy9mgY-CO2wbEOc6A_w9FkODmwC39foe-pmniX-gVuMQqufO29tMjpU_VsrdRP8lEkNFMHO3Zr7nh2gui21sd5yBV57ddspxMODk-evYknC-zepgIfkbqlW4rJvikVTfIG0Bo33gX5t4DT1DKJ1mpvKXTZU";

const avatars = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuALy4QDNM22b0oybsLG_qlnog-qZVij01CFM0o4CCOqDHNrs2yRXO4wZOOqJLqCPnR-QPbU3kim8Y-QEinEfEkA7CQM__uXlSUUVNYi0q5GH0eotkD5FLgo2LsJ4CwqPI-Y10ww_waBUvoeIu7UQQUYZJogHe2dPdrhbFog_9RyPipMwm9Dpd_U3CF19AiI4W0Hz-5OvWsrg5L2uD5ssslxWbdizVZAzoiT29H4vqGcPWcKlJ5jqjqTpsv0ZFLSgV9oGGloV3Wy-Srx",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBUWA0erDEYI8L08pfJ3_DDfUaEzgaBlEx_G5wd02yZgvTdc6btyodRYkeyHOSBjmVr0Fvgnic3rBlSdo9cO03JkK8_0a_W0dPQJBY7q8INbnKFTvpC3p-uA7zGKMq1UidIEyw10gyvJugzHGc5FhCBDA9AkH4HXTJW0OaSGV-84ZUgBdLa1hKOPO77ONDYf0nLSi0kFgs8rjyYFa7Cg_JWoBM1k3p2bdwNWX9PvFDULqyEb81HPpJJ2Us7-zwsEuPtTvoA1dbNDJnt",
];

export function RightContentPanel() {
  return (
    <aside className="hidden w-80 shrink-0 flex-col space-y-12 border-l p-6 theme-ide-pane theme-ide-divider xl:flex">
      <section className="space-y-4">
        <h2 className="gleeple-heading text-xs font-semibold uppercase tracking-[0.18em] theme-subtle">
          Topic Progress
        </h2>
        <div className="theme-progress-track h-1.5 overflow-hidden rounded-full">
          <div className="theme-progress-fill h-full w-[65%]" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="gleeple-code text-sm theme-text">
            Topic Progress: 65%
          </span>
          <Button
            size="small"
            startIcon={<RestartAltOutlinedIcon sx={{ fontSize: 14 }} />}
            sx={{
              borderColor: "var(--color-card-border)",
              color: "var(--color-subtle-text)",
              fontSize: 10,
              minWidth: 0,
              px: 1,
              py: 0.5,
            }}
            variant="outlined"
          >
            Reset
          </Button>
        </div>
      </section>

      <section className="theme-content-card rounded-lg border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] p-4">
        <div className="mb-3 flex items-center gap-3">
          <TimerOutlinedIcon className="theme-accent" sx={{ fontSize: 20 }} />
          <span className="gleeple-heading text-xs font-semibold uppercase theme-text">
            Estimated Time
          </span>
        </div>
        <div className="gleeple-heading text-2xl font-semibold uppercase theme-accent">
          15 Mins
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="gleeple-heading text-xs font-semibold uppercase tracking-[0.18em] theme-subtle">
          Next Recommended
        </h2>
        <button
          className="theme-content-card theme-content-card-interactive w-full cursor-pointer overflow-hidden rounded-lg text-left"
          type="button"
        >
          <div className="relative h-24 overflow-hidden bg-[var(--color-surface-container-high)]">
            <img
              alt="Futuristic digital microchip glowing with cyan circuitry."
              className="h-full w-full object-cover opacity-45 transition-transform duration-500 hover:scale-105"
              src={recommendedImage}
            />
            <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--color-background),transparent)]" />
          </div>
          <div className="p-4">
            <h3 className="gleeple-heading mb-2 text-sm font-semibold theme-text">
              Interface Segregation Principle
            </h3>
            <div className="flex items-center gap-2">
              <span className="gleeple-heading text-[10px] font-semibold uppercase theme-subtle">
                SOLID Principles
              </span>
              <span className="h-1 w-1 rounded-full bg-[var(--color-outline-variant)]" />
              <span className="gleeple-heading text-[10px] font-semibold uppercase theme-subtle">
                12 Mins
              </span>
            </div>
          </div>
        </button>
      </section>

      <section className="border-t pt-12 theme-ide-divider">
        <div className="mb-4 flex -space-x-2">
          {avatars.map((avatar, index) => (
            <div
              className="h-8 w-8 overflow-hidden rounded-full border bg-[var(--color-surface-container-high)]"
              key={avatar}
              style={{ borderColor: "var(--color-background)" }}
            >
              <img
                alt={`Engineer avatar ${index + 1}`}
                className="h-full w-full object-cover"
                src={avatar}
              />
            </div>
          ))}
          <div
            className="gleeple-heading flex h-8 w-8 items-center justify-center rounded-full border bg-[var(--color-surface-container-high)] text-[10px] font-bold theme-muted"
            style={{ borderColor: "var(--color-background)" }}
          >
            +12k
          </div>
        </div>
        <p className="text-[11px] theme-subtle">
          Engineers completed this module today
        </p>
      </section>
    </aside>
  );
}
