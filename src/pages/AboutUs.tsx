const heroImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBcvKdy4ucRGLVyqynUvet_vvZhSMea9UMTxOfshnPprOVw2GabIHPl2TEZmnjNL-coxHzpSTYo9HOKL-4o0dP3s1LTEXSOHDJby3vh5f03_vn8-_rrLlOxWem1-ekHrAmsCfbLZ3tE9rBWcUoNgY8dbRp-N1k3q-JbX14X645NVB1CITpjn69LzjxmVhskW8L6x12Ac5VeC4pu8ecQQRATKWYJ5zxhMk-6UOkW95xjC0eIf9IWGAXUebkOCbds3IGyrCxWKjaz1_De";

export default function AboutUs() {
  return (
    <main className="theme-page overflow-hidden pt-24">
      <section className="relative flex min-h-[819px] flex-col items-center justify-center overflow-hidden px-6 py-20">
        <div className="theme-grid-pattern pointer-events-none absolute inset-0 z-0 opacity-30" />
        <div className="pointer-events-none absolute left-1/2 top-1/4 z-0 h-[400px] w-[min(800px,90vw)] -translate-x-1/2 rounded-full bg-[var(--color-accent-soft)] blur-[120px]" />

        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center gap-8 text-center">
          <div className="gleeple-heading theme-badge rounded-sm px-3 py-1.5 text-[12px] font-bold uppercase leading-none tracking-[0.05em]">
            Engineered for Excellence
          </div>

          <h1 className="gleeple-heading max-w-4xl text-[40px] font-bold leading-[1.1] theme-text md:text-[48px]">
            Built for Developers Preparing for{" "}
            <span className="theme-accent">Real Interviews</span>
          </h1>

          <p className="max-w-2xl text-[18px] leading-8 theme-muted">
            A high-fidelity environment designed to simulate the pressure,
            complexity, and rigor of top-tier technical assessments.
          </p>

          <div className="theme-glass-card mt-8 w-full max-w-5xl overflow-hidden rounded-lg border shadow-2xl">
            <div className="flex h-12 w-full items-center gap-2 border-b border-[var(--color-card-border)] bg-[var(--color-surface-container-highest)] px-4">
              <span className="h-3 w-3 rounded-full bg-[var(--color-error)]" />
              <span className="h-3 w-3 rounded-full bg-[var(--color-tertiary)]" />
              <span className="h-3 w-3 rounded-full bg-[var(--color-primary-container)]" />
              <span className="gleeple-code ml-4 min-w-0 truncate text-[14px] leading-5 theme-subtle">
                ~/dev_core/simulation_engine --run
              </span>
            </div>

            <img
              alt="Dark-mode developer dashboard interface"
              className="h-[320px] w-full object-cover opacity-80 md:h-[400px]"
              src={heroImage}
            />
          </div>
        </div>
      </section>

      <section className="relative border-y border-[var(--color-card-border)] bg-[var(--color-surface-container-lowest)] px-6 py-20">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
          <h2 className="gleeple-heading max-w-4xl text-[28px] font-semibold leading-tight theme-text md:text-[32px]">
            Our Mission:{" "}
            <span className="theme-text">
            Make interview preparation clear, structured, and practical.
            </span>
          </h2>

          <p className="max-w-2xl text-[18px] leading-8 theme-muted">
          We built this platform to help Fullstack .NET developers prepare with purpose. Learn the core concepts, practice questions by topic and level, compare your answers with expected responses, and use simulations to identify what to improve next.
          </p>
        </div>
      </section>
    </main>
  );
}
