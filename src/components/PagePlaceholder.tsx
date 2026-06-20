import ArchitectureOutlinedIcon from "@mui/icons-material/ArchitectureOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CodeOutlinedIcon from "@mui/icons-material/CodeOutlined";
import TerminalOutlinedIcon from "@mui/icons-material/TerminalOutlined";
import { Link as RouterLink } from "react-router-dom";

type PagePlaceholderProps = {
  moduleName: string;
};

function scrollToPageTop() {
  requestAnimationFrame(() => {
    window.scrollTo({ left: 0, top: 0 });
    requestAnimationFrame(() => window.scrollTo({ left: 0, top: 0 }));
  });
}

export function PagePlaceholder({ moduleName }: PagePlaceholderProps) {
  return (
    <main className="theme-page relative flex min-h-[calc(100vh-88px)] items-center justify-center overflow-hidden px-6 py-24">
      <div className="theme-grid-pattern pointer-events-none absolute inset-0 opacity-40" />

      <section className="theme-glass-card group relative z-10 flex w-full max-w-[800px] flex-col items-center gap-12 overflow-hidden rounded-lg p-8 text-center shadow-[0_0_40px_rgba(0,0,0,0.35),inset_0_0_20px_rgba(0,219,233,0.02)] transition-colors duration-500 md:flex-row md:p-12 md:text-left">
        <div className="absolute left-0 right-0 top-0 h-0.5 bg-[linear-gradient(to_right,transparent,var(--color-primary-container),transparent)] opacity-50" />

        <div className="relative z-10 flex w-full flex-1 flex-col gap-6">
          <div className="mb-3 flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center justify-center gap-3 text-[var(--color-primary-fixed-dim,var(--color-primary-container))] sm:justify-start">
              <TerminalOutlinedIcon fontSize="small" />
              <span className="gleeple-heading text-[12px] font-bold uppercase leading-none">
                {moduleName} Under Construction
              </span>
            </div>

            <div className="placeholder-pulse-badge inline-flex items-center justify-center gap-2 rounded border border-[color-mix(in_srgb,var(--color-primary-container)_30%,transparent)] bg-[var(--color-accent-soft)] px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-[var(--color-primary-container)]" />
              <span className="gleeple-code text-[13px] leading-5 text-[var(--color-primary-container)]">
                In Progress
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h1 className="gleeple-heading text-[40px] font-bold leading-[1.1] theme-text md:text-[48px]">
              Innovation in Progress
            </h1>
            <h2 className="gleeple-heading text-[22px] font-medium leading-[1.3] text-[var(--color-primary-fixed-dim,var(--color-primary-container))] md:text-[24px]">
              This section is currently undergoing structural optimization.
            </h2>
            <p className="mt-3 max-w-[600px] text-[18px] leading-8 theme-muted">
              We're refining the experience to ensure it meets our rigorous
              architectural standards. The data pathways are being re-routed and
              the core engine compiled. Check back shortly or explore our
              existing stable modules.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-6 border-t border-[var(--color-card-border)] pt-6 sm:flex-row">
            <RouterLink
              style={{ color: "black" }}
              className="gleeple-heading flex items-center justify-center gap-3 rounded bg-[var(--color-primary-container)] px-12 py-3 text-[12px] font-bold uppercase leading-none text-[var(--color-on-primary-container)] shadow-[0_0_15px_rgba(0,240,255,0.2)] transition-all duration-300 hover:bg-[var(--color-primary)] hover:shadow-[0_0_25px_rgba(0,240,255,0.4)] active:scale-95"
              onClick={scrollToPageTop}
              to="/content"
            >
              <span>Explore Content</span>
              <ArrowForwardIcon sx={{ fontSize: 18 }} />
            </RouterLink>

            <RouterLink
              className="gleeple-heading flex items-center justify-center gap-3 rounded border border-[var(--color-primary-fixed-dim,var(--color-primary-container))] bg-transparent px-12 py-3 text-[12px] font-bold uppercase leading-none text-[var(--color-primary-fixed-dim,var(--color-primary-container))] transition-all duration-300 hover:bg-[var(--color-accent-hover)] active:scale-95"
              onClick={scrollToPageTop}
              to="/practice"
            >
              <CodeOutlinedIcon sx={{ fontSize: 18 }} />
              <span>Start Practice</span>
            </RouterLink>
          </div>
        </div>

        <div className="relative hidden h-[200px] w-[200px] shrink-0 items-center justify-center opacity-80 mix-blend-screen transition-opacity duration-700 group-hover:opacity-100 md:flex">
          <div className="placeholder-spin-slow absolute inset-0 rounded-full border border-[color-mix(in_srgb,var(--color-primary-container)_20%,transparent)]" />
          <div className="placeholder-spin-reverse absolute inset-4 rounded-full border-2 border-dashed border-[color-mix(in_srgb,var(--color-primary-fixed-dim,var(--color-primary-container))_30%,transparent)]" />
          <div className="placeholder-spin-medium absolute inset-8 rounded-full border border-[color-mix(in_srgb,var(--color-secondary-container,#6e06d0)_40%,transparent)]" />
          <ArchitectureOutlinedIcon
            className="relative z-10 text-[var(--color-primary-container)]"
            sx={{ fontSize: 64 }}
          />
        </div>
      </section>
    </main>
  );
}
