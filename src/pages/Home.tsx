import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import CloudQueueOutlinedIcon from "@mui/icons-material/CloudQueueOutlined";
import CodeOutlinedIcon from "@mui/icons-material/CodeOutlined";
import ExploreOutlinedIcon from "@mui/icons-material/ExploreOutlined";
import IntegrationInstructionsOutlinedIcon from "@mui/icons-material/IntegrationInstructionsOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import QuizOutlinedIcon from "@mui/icons-material/QuizOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import SyncOutlinedIcon from "@mui/icons-material/SyncOutlined";
import TerminalOutlinedIcon from "@mui/icons-material/TerminalOutlined";
import { Box, Button, Container, Stack } from "@mui/material";
import type { ReactNode } from "react";

type LearningPath = {
  title: string;
  description: string;
  icon: ReactNode;
  tags?: string[];
  level?: string;
  className: string;
};

type Feature = {
  title: string;
  description: string;
  icon: ReactNode;
};

type Drill = {
  eyebrow: string;
  title: string;
  answer: string;
  code?: string;
};

type RoadmapStep = {
  id: string;
  title: string;
  description: string;
};

const learningPaths: LearningPath[] = [
  {
    title: "System Design & Architecture",
    description:
      "Scalability, Load Balancing, Microservices, and High-Availability patterns for modern cloud infrastructure.",
    icon: <AccountTreeOutlinedIcon fontSize="large" />,
    tags: ["CAP THEOREM", "SHARDING", "CACHING"],
    level: "ADVANCED",
    className: "md:col-span-2 lg:col-span-8 lg:min-h-[240px]",
  },
  {
    title: "Azure Cloud",
    description:
      "Master App Services, Functions, CosmosDB, and Azure Active Directory integrations.",
    icon: <CloudQueueOutlinedIcon fontSize="medium" />,
    className: "lg:col-span-4 lg:min-h-[240px]",
  },
  {
    title: ".NET Core",
    description:
      "Deep dive into Middleware, Dependency Injection, Entity Framework, and WebAPI performance tuning.",
    icon: <TerminalOutlinedIcon fontSize="medium" />,
    className: "lg:col-span-4 lg:min-h-[217px]",
  },
  {
    title: "React & Frontend",
    description:
      "Advanced hooks, state management patterns, virtual DOM optimization, and component lifecycles.",
    icon: <IntegrationInstructionsOutlinedIcon fontSize="medium" />,
    className: "lg:col-span-4 lg:min-h-[217px]",
  },
  {
    title: "SQL & Database",
    description:
      "Query optimization, indexing strategies, ACID properties, and relational database normalization.",
    icon: <StorageOutlinedIcon fontSize="medium" />,
    className: "lg:col-span-4 lg:min-h-[217px]",
  },
];

const platformFeatures: Feature[] = [
  {
    title: "Structured Learning",
    description:
      "Sequential modules designed by principal engineers to take you from foundational concepts to architectural mastery.",
    icon: <MenuBookOutlinedIcon fontSize="small" />,
  },
  {
    title: "Curated Questions",
    description:
      "A database of 2000+ real-world interview questions from top-tier tech companies like Microsoft, Google, and Amazon.",
    icon: <QuizOutlinedIcon fontSize="small" />,
  },
  {
    title: "Practical Examples",
    description:
      "Forge theory. Learn through hands-on code snippets, architectural diagrams, and performance benchmarks.",
    icon: <CodeOutlinedIcon fontSize="small" />,
  },
  {
    title: "Easy Navigation",
    description:
      "An IDE-inspired interface that lets you switch between topics, simulations, and documentation seamlessly.",
    icon: <ExploreOutlinedIcon fontSize="small" />,
  },
  {
    title: "Continuous Updates",
    description:
      "The tech landscape changes weekly. Our curriculum is updated constantly to reflect current industry standards.",
    icon: <SyncOutlinedIcon fontSize="small" />,
  },
  {
    title: "Focus Performance",
    description:
      "Zero-distraction UI designed for long-form technical study and maximum knowledge retention.",
    icon: <BoltOutlinedIcon fontSize="small" />,
  },
];

const drills: Drill[] = [
  {
    eyebrow: "#0042 / DESIGN PATTERNS",
    title: "Explain Dependency Injection.",
    answer:
      "Dependency Injection is a design pattern in which an object receives other objects that it depends on...",
    code: "services.AddScoped<IMyService, MyService>();",
  },
  {
    eyebrow: "#0189 / NETWORKING",
    title: "What is DNS?",
    answer:
      "Domain Name System translates human-readable domain names into IP addresses, functioning like the phonebook of the Internet...",
  },
  {
    eyebrow: "#0097 / DATABASES",
    title: "Clustered vs Non-clustered index.",
    answer:
      "Clustered indices determine the physical order of data in the table, while non-clustered indices are separate structures...",
  },
];

const roadmapSteps: RoadmapStep[] = [
  {
    id: "01",
    title: "Select Path",
    description: "Pick from 5 specialized tracks based on your career goals.",
  },
  {
    id: "02",
    title: "Study Concepts",
    description: "Consume granular modules with zero fluff and maximum depth.",
  },
  {
    id: "03",
    title: "Practice Scenarios",
    description: "Test yourself with simulation labs and complex edge cases.",
  },
  {
    id: "04",
    title: "Expert Review",
    description: "Receive detailed feedback based on industry best practices.",
  },
];

function PageSection({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Container
      component="section"
      disableGutters
      maxWidth={false}
      className={`relative w-full max-w-[1440px] px-6 ${className}`}
    >
      {children}
    </Container>
  );
}

function CyberButton({
  children,
  intent = "primary",
}: {
  children: ReactNode;
  intent?: "primary" | "secondary";
}) {
  const isPrimary = intent === "primary";

  return (
    <Button
      disableElevation
      disableRipple
      className="gleeple-heading h-[54px] px-8 text-center"
      sx={{
        borderRadius: 0,
        border: isPrimary
          ? "1px solid transparent"
          : "1px solid var(--color-accent-border)",
        backgroundColor: isPrimary
          ? "var(--color-primary-container)"
          : "transparent",
        boxShadow: isPrimary ? "var(--shadow-accent-glow)" : "none",
        color: isPrimary
          ? "var(--color-on-primary-container)"
          : "var(--color-primary-container)",
        fontSize: 14,
        fontWeight: 700,
        lineHeight: "20px",
        minWidth: 0,
        textTransform: "uppercase",
        "&:hover": {
          backgroundColor: isPrimary
            ? "var(--color-primary-container)"
            : "var(--color-accent-hover)",
          borderColor: isPrimary
            ? "transparent"
            : "var(--color-card-hover-border)",
          boxShadow: "var(--shadow-accent-glow)",
          filter: isPrimary ? "brightness(1.08)" : "none",
        },
      }}
    >
      {children}
    </Button>
  );
}

function SectionHeading({
  title,
  subtitle,
  centered = false,
}: {
  title: string;
  subtitle?: string;
  centered?: boolean;
}) {
  return (
    <div
      className={
        centered
          ? "flex w-full flex-col items-center text-center"
          : "flex w-full flex-col items-start"
      }
    >
      <h2 className="gleeple-heading theme-text text-[28px] font-bold leading-[1.2] md:text-[32px]">
        {title}
      </h2>
      {subtitle ? (
        <p className="theme-muted mt-1 max-w-[420px] text-[16px] leading-6">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function CodePreview() {
  return (
    <Box className="relative flex flex-1 flex-col items-start lg:min-w-0">
      <div
        className="absolute inset-0 opacity-20 blur-xl"
        style={{
          background:
            "linear-gradient(135deg, var(--color-accent-soft), transparent 48%), radial-gradient(circle at 70% 20%, var(--color-accent-border), transparent 28%)",
        }}
      />
      <div className="theme-code-panel relative w-full p-5 md:p-[25px]">
        <div className="mb-4 flex w-full items-center gap-2 border-b border-[var(--color-card-border)] pb-[9px]">
          <span className="h-3 w-3 rounded-full bg-[var(--color-error)]" />
          <span className="h-3 w-3 rounded-full bg-[var(--color-warning)]" />
          <span className="h-3 w-3 rounded-full bg-[var(--color-primary-container)] opacity-50" />
          <span className="gleeple-code theme-subtle pl-4 text-[12px] leading-4">
            interview_sim_v2.cs
          </span>
        </div>

        <pre className="gleeple-code overflow-x-auto whitespace-pre-wrap text-[13px] leading-[22px] text-[var(--color-secondary)] md:text-[14px] md:leading-[22.75px]">
          <code>
            <span>public async Task </span>
            <span className="theme-text">ProcessRequest</span>
            <span className="text-[var(--color-primary-container)]">(</span>
            <span className="text-[var(--color-tertiary)]">IRequest</span>
            <span className="text-[var(--color-primary-container)]"> req) {"{"}</span>
            {"\n"}
            <span className="text-[var(--color-primary-container)]">{"  "}</span>
            <span className="theme-subtle">// Initialize high-concurrency pipe</span>
            {"\n"}
            <span className="text-[var(--color-primary-container)]">{"  "}</span>
            <span>var</span>
            <span className="text-[var(--color-primary-container)]"> pipe = </span>
            <span>new</span>
            <span className="theme-text"> AnalysisPipeline</span>
            <span className="text-[var(--color-primary-container)]">();</span>
            {"\n\n"}
            <span className="text-[var(--color-primary-container)]">{"  "}</span>
            <span className="text-[var(--color-primary-container)]">await</span>
            <span className="text-[var(--color-primary-container)]"> pipe.ExecuteAsync(req)</span>
            {"\n"}
            <span className="text-[var(--color-primary-container)]">{"    "}.WithPrecision(</span>
            <span className="text-[var(--color-tertiary)]">PrecisionLevel.Expert</span>
            <span className="text-[var(--color-primary-container)]">)</span>
            {"\n"}
            <span className="text-[var(--color-primary-container)]">{"    "}.OnComplete(res =&gt; </span>
            <span className="theme-text">NavigateToPath</span>
            <span className="text-[var(--color-primary-container)]">(res.OptimalPath));</span>
            {"\n"}
            <span className="text-[var(--color-primary-container)]">{"}"}</span>
          </code>
        </pre>
      </div>
    </Box>
  );
}

function LearningPathCard({ path }: { path: LearningPath }) {
  const isFeatured = Boolean(path.tags?.length);

  return (
    <Box
      className={`theme-glass-card group flex flex-col justify-between p-[25px] ${path.className}`}
    >
      <Stack spacing={2} className="relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="theme-accent flex h-9 w-9 items-center justify-center">
            {path.icon}
          </div>
          {path.level ? (
            <div className="gleeple-heading theme-badge px-[9px] py-[5px] text-[10px] leading-[15px]">
              {path.level}
            </div>
          ) : null}
        </div>

        <div>
          <h3 className="gleeple-heading theme-text text-[22px] font-bold leading-[1.3] md:text-[24px]">
            {path.title}
          </h3>
          <p
            className={`theme-muted mt-2 max-w-[448px] text-[16px] leading-6 ${
              isFeatured ? "lg:max-w-[448px]" : ""
            }`}
          >
            {path.description}
          </p>
        </div>
      </Stack>

      {path.tags ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {path.tags.map((tag) => (
            <span
              className="gleeple-heading theme-chip px-2 py-1 text-[10px] leading-[15px]"
              key={tag}
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </Box>
  );
}

function FeatureBlock({ feature }: { feature: Feature }) {
  return (
    <div className="flex flex-col items-start">
      <div className="theme-feature-icon mb-5 flex h-8 w-8 items-center justify-center">
        {feature.icon}
      </div>
      <h3 className="gleeple-heading theme-text text-[16px] leading-6">
        {feature.title}
      </h3>
      <p className="theme-muted mt-2 max-w-[350px] text-[14px] leading-5">
        {feature.description}
      </p>
    </div>
  );
}

function DrillCard({ drill }: { drill: Drill }) {
  return (
    <Box className="theme-glass-card flex min-h-[223px] flex-col gap-2 border-l-4 border-l-[var(--color-primary-container)] px-[25px] py-[25px] pl-7">
      <p className="gleeple-heading theme-subtle text-[10px] leading-[15px]">
        {drill.eyebrow}
      </p>
      <h3 className="gleeple-heading theme-text text-[18px] leading-7">
        {drill.title}
      </h3>
      <div className="theme-code-surface mt-2 flex flex-1 flex-col gap-2 px-4 py-4 md:pt-6">
        <p className="gleeple-code theme-muted text-[12px] leading-4">
          {drill.answer}
        </p>
        {drill.code ? (
          <p className="gleeple-code theme-accent break-words text-[12px] leading-4">
            {drill.code}
          </p>
        ) : null}
      </div>
    </Box>
  );
}

function RoadmapStepCard({ step }: { step: RoadmapStep }) {
  return (
    <div className="relative z-10 flex flex-col items-center text-center">
      <div className="theme-roadmap-node flex h-16 w-16 items-center justify-center rounded-lg p-0.5">
        <span className="theme-text text-[16px] font-semibold leading-6">
          {step.id}
        </span>
      </div>
      <h3 className="gleeple-heading theme-text mt-6 text-[16px] leading-6">
        {step.title}
      </h3>
      <p className="theme-muted mt-2 max-w-[278px] text-[14px] leading-5">
        {step.description}
      </p>
    </div>
  );
}

export default function Home() {
  return (
    <Box className="theme-page min-h-screen overflow-hidden">
      <Box className="flex flex-col items-center gap-20 pb-20 pt-24 md:pt-32">
        <PageSection className="overflow-hidden">
          <div
            className="theme-grid-pattern pointer-events-none absolute inset-0 opacity-30"
          />

          <Box className="relative flex w-full flex-col items-center justify-center gap-12 py-8 md:py-12 lg:flex-row">
            <Stack className="flex-1 lg:min-w-0" spacing={2}>
              <div className="gleeple-heading theme-badge w-fit px-[13px] py-[5px] text-[10px] leading-[15px]">
                VERSION 4.0 STABLE BUILD
              </div>

              <div className="max-w-[672px] pt-2">
                <h1 className="gleeple-heading theme-text text-[36px] font-bold leading-[1.1] md:text-[48px]">
                  Master the Technical
                  <br />
                  Interview with{" "}
                  <span className="theme-accent">Precision.</span>
                </h1>
              </div>

              <p className="theme-muted max-w-[576px] text-[18px] leading-[28.8px]">
                A structured, high-performance platform for engineers to master
                System Design, Azure, .NET, React, and SQL through deep
                technical drills and expert architectural insights.
              </p>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                className="pt-2"
              >
                <CyberButton>Start Learning Now</CyberButton>
                <CyberButton intent="secondary">Explore Categories</CyberButton>
              </Stack>
            </Stack>

            <CodePreview />
          </Box>
        </PageSection>

        <PageSection className="flex flex-col gap-12">
          <div className="border-l-4 border-[var(--color-primary-container)] pl-5">
            <SectionHeading title="Specialized Learning Paths" />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12">
            {learningPaths.map((path) => (
              <LearningPathCard key={path.title} path={path} />
            ))}
          </div>
        </PageSection>

        <Box component="section" className="theme-feature-band w-full py-14">
          <Container
            disableGutters
            maxWidth={false}
            className="grid w-full max-w-[1440px] grid-cols-1 gap-x-14 gap-y-12 px-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {platformFeatures.map((feature) => (
              <FeatureBlock feature={feature} key={feature.title} />
            ))}
          </Container>
        </Box>

        <PageSection className="flex flex-col gap-12">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <SectionHeading
              title="Live Drills"
              subtitle="Common technical assessment benchmarks"
            />
            <Button
              endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
              className="gleeple-heading"
              sx={{
                borderRadius: 0,
                color: "var(--color-primary-container)",
                fontSize: 12,
                lineHeight: "16px",
                minWidth: "max-content",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                "&:hover": { backgroundColor: "var(--color-accent-hover)" },
              }}
            >
              View All Questions
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {drills.map((drill) => (
              <DrillCard drill={drill} key={drill.title} />
            ))}
          </div>
        </PageSection>

        <PageSection className="flex flex-col gap-16">
          <SectionHeading title="The Engineering Roadmap" centered />

          <div className="relative">
            <div
              className="absolute left-0 right-0 top-8 hidden h-0.5 lg:block"
              style={{
                background:
                  "linear-gradient(to right, transparent, var(--color-accent-border), transparent)",
              }}
            />
            <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
              {roadmapSteps.map((step) => (
                <RoadmapStepCard key={step.id} step={step} />
              ))}
            </div>
          </div>
        </PageSection>

        <PageSection className="max-w-[1232px]">
          <Box className="theme-glass-card relative flex w-full flex-col items-center overflow-hidden px-6 py-12 text-center md:px-12 md:py-12">
            <div className="absolute right-[-128px] top-[-128px] h-64 w-64 rounded-lg bg-[var(--color-accent-soft)] blur-[32px]" />
            <h2 className="gleeple-heading theme-text relative text-[32px] font-bold leading-[1.2] md:text-[40px]">
              Ready to Level Up Your Career?
            </h2>
            <p className="theme-muted relative mt-6 max-w-[672px] text-[16px] leading-6">
              Join 15,000+ senior engineers who have optimized their technical
              interview performance with our platform.
            </p>
            <div className="relative mt-6">
              <CyberButton>Get Started</CyberButton>
            </div>
          </Box>
        </PageSection>
      </Box>
    </Box>
  );
}
