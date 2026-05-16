import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import CloudQueueOutlinedIcon from "@mui/icons-material/CloudQueueOutlined";
import CodeOutlinedIcon from "@mui/icons-material/CodeOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import IntegrationInstructionsOutlinedIcon from "@mui/icons-material/IntegrationInstructionsOutlined";
import QueryStatsOutlinedIcon from "@mui/icons-material/QueryStatsOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import SettingsEthernetOutlinedIcon from "@mui/icons-material/SettingsEthernetOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import TerminalOutlinedIcon from "@mui/icons-material/TerminalOutlined";
import { Button } from "@mui/material";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

type AudienceCard = {
  title: string;
  description: string;
  icon: ReactNode;
};

type Pillar = {
  title: string;
  icon: ReactNode;
};

type Method = {
  title: string;
  description: string;
  icon: ReactNode;
};

type Value = {
  title: string;
  description: string;
};

const heroImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCyCblIudCUFoa57k4ffNniADLnVjLKG5x2WQQg9XUxWhZ6AujJsgkLMPEYSHj3Bx8_Eg4TX7sbHdrlXYVtjZg5wTs-to2PLqTc5cLsAWqR1BnJXf-bpgl8wXkeTnGsthsciN9erW--c-zww7UD9ZcVfJI8JGopq7v4Qefg9g9oSiXWiw1yixY2QZIBESMf8W-Rt3pDfdqj_pmtWZkaV1_3KngGF_ihtOEvLY7pXNGa15jkyd3rOJ4n5vIRkL-M93VqYGNmUX9rifqG";

const methodologyImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuA2dfcJspWIL9mJQ8Hz27sQ6I30TS7uYJ6uh4lwQB9opLpI77UOmV3cm1OsGERUa9moUnYnbLvDl6QFGgt2BbfSrCsIeQ6s6OmRlEk6-TTlqLx2f_Vdl-QJYa2zoGHe5e1Gmhkqob9fjx1cCF-CnlpKsnzfU3kuE0uLlyAjGbtPxo-ci6P00e0lHdk_BFh7558LwU7IX9gDJSyPH80kQdBXDFrS1ejh-OuiomltGA18A4QuhFHIeOXlNCuvWz4r4lDoHbayI7BMO4mS";

const audiences: AudienceCard[] = [
  {
    title: "Software Engineers",
    description:
      "Senior talent looking to sharpen architectural knowledge and master platform-specific nuances in Azure and .NET.",
    icon: <TerminalOutlinedIcon fontSize="large" />,
  },
  {
    title: "Students & Juniors",
    description:
      "Accelerated entry into the professional ecosystem through industry-standard code patterns and direct problem-solving.",
    icon: <SchoolOutlinedIcon fontSize="large" />,
  },
  {
    title: "Mid-Level Developers",
    description:
      "Level up your career by mastering full-stack integration, SQL performance tuning, and scalable React architectures.",
    icon: <EngineeringOutlinedIcon fontSize="large" />,
  },
];

const pillars: Pillar[] = [
  { title: "System Design", icon: <AccountTreeOutlinedIcon /> },
  { title: "Azure Cloud", icon: <CloudQueueOutlinedIcon /> },
  { title: ".NET Core", icon: <SettingsEthernetOutlinedIcon /> },
  { title: "React UI", icon: <IntegrationInstructionsOutlinedIcon /> },
  { title: "SQL Optimization", icon: <StorageOutlinedIcon /> },
];

const methods: Method[] = [
  {
    title: "IDE-Style Interaction",
    description:
      "Live code environments that mirror your local dev setup. No more static text tutorials.",
    icon: <CodeOutlinedIcon />,
  },
  {
    title: "Visual Simulations",
    description:
      "Interactive system diagrams that allow you to toggle components and observe latency in real-time.",
    icon: <HubOutlinedIcon />,
  },
  {
    title: "Granular Tracking",
    description:
      "Identify specific knowledge gaps with our data-driven progress analytics.",
    icon: <QueryStatsOutlinedIcon />,
  },
];

const values: Value[] = [
  {
    title: "Clarity",
    description: "Concise, jargon-free technical explanations that stick.",
  },
  {
    title: "Practicality",
    description: "Focus on code that works in production, not just whiteboards.",
  },
  {
    title: "Consistency",
    description: "Unified teaching philosophy across all technical pillars.",
  },
  {
    title: "Progress",
    description:
      "Continuous curriculum updates for the evolving tech landscape.",
  },
];

export default function AboutUs() {
  return (
    <div className="theme-page overflow-hidden pt-24">
      <section className="relative mx-auto flex min-h-[716px] max-w-[1440px] items-center px-6 md:px-12">
        <div className="theme-grid-pattern pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative z-10 grid w-full items-center gap-12 md:grid-cols-2">
          <div className="space-y-6">
            <div className="theme-badge inline-block rounded-sm px-3 py-1 text-[12px] font-bold uppercase tracking-[0.08em]">
              V2.0 Core Architecture
            </div>
            <h1 className="gleeple-heading text-5xl font-bold uppercase leading-none theme-text md:text-[64px]">
              About{" "}
              <span className="text-[var(--color-primary-container)] [text-shadow:0_0_10px_color-mix(in_srgb,var(--color-primary-container)_50%,transparent)]">
                DEV_NET_CORE
              </span>
            </h1>
            <p className="max-w-xl text-lg leading-8 theme-muted">
              The definitive technical interview preparation platform for modern
              engineers. Engineered for performance, designed for clarity.
            </p>
          </div>

          <div className="group relative">
            <div className="absolute -inset-4 rounded-full bg-[var(--color-accent-soft)] blur-3xl" />
            <img
              alt="Core visualization"
              className="relative z-10 w-full rounded-xl border object-cover grayscale shadow-2xl transition-all duration-700 group-hover:grayscale-0"
              src={heroImage}
              style={{ borderColor: "var(--color-card-border)" }}
            />
          </div>
        </div>
      </section>

      <section className="bg-[var(--color-surface-container-lowest)] px-6 py-20 md:px-12">
        <div className="mx-auto max-w-4xl space-y-3 text-center">
          <span className="gleeple-heading text-[12px] font-bold uppercase tracking-[0.18em] theme-accent">
            The Mission
          </span>
          <h2 className="gleeple-heading text-3xl font-semibold uppercase theme-text">
            Reengineering Interview Prep
          </h2>
          <div className="mx-auto my-6 h-1 w-12 bg-[var(--color-primary-container)]" />
          <p className="text-lg leading-8 theme-muted">
            We provide structured, IDE-inspired learning paths to build
            real-world engineering confidence. Our platform bridges the gap
            between theoretical computer science and the demanding practical
            realities of high-stakes system design and development.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-6 py-20 md:px-12">
        <div className="grid gap-6 md:grid-cols-3">
          {audiences.map((audience) => (
            <article
              className="theme-glass-card rounded-lg p-8"
              key={audience.title}
            >
              <div className="mb-4 theme-accent">{audience.icon}</div>
              <h3 className="gleeple-heading mb-4 text-2xl font-semibold uppercase theme-text">
                {audience.title}
              </h3>
              <p className="leading-7 theme-muted">{audience.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[var(--color-surface-container-low)] px-6 py-20 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <h2 className="gleeple-heading mb-12 text-center text-3xl font-semibold uppercase theme-text">
            Technical Pillars
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {pillars.map((pillar) => (
              <article
                className="theme-glass-card flex min-h-32 flex-col items-center justify-center space-y-4 rounded-lg p-6 text-center"
                key={pillar.title}
              >
                <div className="theme-feature-icon flex h-12 w-12 items-center justify-center rounded-lg">
                  {pillar.icon}
                </div>
                <span className="gleeple-heading text-[12px] font-bold uppercase tracking-[0.05em] theme-text">
                  {pillar.title}
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-6 py-20 md:px-12">
        <div className="grid items-center gap-20 md:grid-cols-2">
          <div className="space-y-8">
            <h2 className="gleeple-heading text-3xl font-semibold uppercase theme-text">
              Built For How Engineers Learn
            </h2>
            <div className="space-y-6">
              {methods.map((method) => (
                <div className="flex gap-4" key={method.title}>
                  <span className="pt-1 theme-accent">{method.icon}</span>
                  <div>
                    <h3 className="gleeple-heading mb-1 text-sm font-semibold uppercase theme-text">
                      {method.title}
                    </h3>
                    <p className="leading-7 theme-muted">
                      {method.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border bg-[var(--color-code-surface)] p-6 shadow-2xl">
            <div className="absolute left-0 top-0 h-1 w-full bg-[linear-gradient(90deg,transparent,var(--color-primary-container),transparent)]" />
            <img
              alt="Learning platform interface"
              className="w-full rounded border object-cover grayscale opacity-80"
              src={methodologyImage}
              style={{ borderColor: "var(--color-card-border)" }}
            />
          </div>
        </div>
      </section>

      <section className="border-y bg-[var(--color-surface-container-low)] px-6 py-20 md:px-12 theme-ide-divider">
        <div className="mx-auto grid max-w-[1440px] gap-8 md:grid-cols-4">
          {values.map((value) => (
            <article className="text-center" key={value.title}>
              <h3 className="gleeple-heading mb-2 text-lg font-semibold uppercase italic theme-text">
                {value.title}
              </h3>
              <p className="text-sm leading-6 theme-muted">
                {value.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-[1440px] px-6 py-20 text-center md:px-12">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-accent-soft)] blur-[120px]" />
        <div className="relative z-10 space-y-8">
          <h2 className="gleeple-heading text-5xl font-bold uppercase theme-text">
            Ready To Level Up?
          </h2>
          <div className="flex flex-col items-center justify-center gap-6 md:flex-row">
            <Button
              component={RouterLink}
              to="/content"
              variant="contained"
              sx={{ px: 5, py: 1.5 }}
            >
              Explore Curriculum
            </Button>
            <Button
              component={RouterLink}
              to="/content#dotnet"
              variant="outlined"
              sx={{ px: 5, py: 1.5 }}
            >
              Start Preparing
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
