# DEV_NET_CORE Codex Instructions

This file gives Codex enough project context to continue working on DEV_NET_CORE without relying on prior chat history.

## Project Identity

DEV_NET_CORE is a React-based interview preparation website for software engineers.

* Website: https://www.dev-net-core.com/
* Repository: https://github.com/CircleQMinh/dev-net-core
* Main goal: provide structured, realistic, and practical interview preparation for modern software engineers.
* Product focus: learning content, topic-based interview practice, and simulation-style mock interview sessions.
* Tone: professional, developer-focused, practical, clear, and premium SaaS/product-like.
* Avoid: trivial puzzle content, gamified distractions, vague motivational copy, or generic learning-platform language.

## Core Product Description

DEV_NET_CORE helps developers prepare for technical interviews by combining:

1. Structured curriculum content
2. Extractable interview questions
3. Topic-based practice sessions
4. Simulation-style mock interview sessions
5. Progress tracking and review flows

The project should feel like a serious technical preparation tool for software engineers, especially developers working with .NET, React, TypeScript, SQL, Azure, security, and system design topics.

## Tech Stack

The project uses:

* React
* TypeScript
* Vite
* React Router
* Redux Toolkit
* React Redux
* Material UI
* Tailwind CSS
* React Markdown
* remark-gfm
* rehype-highlight
* Markdown-based curriculum content
* Generated curriculum manifest

## Common Commands

Use these commands when working on the project:

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run lint
```

```bash
npm run preview
```

Framework migration candidate commands:

```bash
npm run build:framework
npm run finalize:framework
npm run validate:framework
npm run preview:framework
```

Important: `npm run dev` and `npm run build` both generate the curriculum manifest first through the configured pre-scripts. If curriculum content or question markers are changed, make sure the generated manifest still works.

The project currently uses a dual-build cutover. `npm run build` writes the
deployable SPA to `dist/`. `npm run build:framework` writes the React Router
static/pre-render candidate to `build-framework/client/`.
`npm run finalize:framework` writes the candidate sitemap, candidate
`robots.txt`, and dedicated `404.html` into that client output. Do not switch
the GitHub Pages deployment artifact until the framework route matrix, fallback
handling, and production URLs pass their dedicated cutover validation.

GitHub Actions intentionally separates validation from deployment:

* `.github/workflows/framework-candidate.yml` runs the dual-build validation
  gate for pull requests and pushes to `main`, but has read-only permissions and
  does not upload or deploy a Pages artifact. Its `Validate framework candidate`
  job is required on `main` through strict/up-to-date branch protection.
* `.github/workflows/main.yml` is manual-only, runs the same validation gate,
  and continues to deploy the existing `dist/` SPA from `main`.
* Branch protection does not require review approvals and still permits
  administrator bypass. Do not change that policy or switch the deployed
  directory to `build-framework/client/` without explicit approval.

## Important Project Areas

### Main Routes

The application includes these important routes:

* `/`
* `/home`
* `/content`
* `/content/:topicId`
* `/practice`
* `/practice/:topicId`
* `/simulation`
* `/simulation/setup`
* `/simulation/session/:sessionId`
* `/simulation/result/:sessionId`
* `/about-us`
* `/roadmap`
* `/changelog`
* `/bug-report`
* `/privacy`
* `/terms`

Do not break existing route behavior unless explicitly requested.

Canonical public SEO URLs should use trailing slashes, for example `/content/`, `/content/:topicId/`, `/roadmap/`, `/about-us/`, `/privacy/`, and `/terms/`. Non-trailing variants may continue to work for user convenience, but they should not be used in sitemap URLs, canonical tags, Open Graph URLs, structured data URLs, or internal generated SEO links.

### Content System

The curriculum is Markdown-driven.

Important content folders and files:

* `src/contents/v1/**/*.md`
* `src/contents/resources/welcome.md`
* `src/contents/curriculumManifest.generated`
* `scripts/generate-curriculum-manifest.mjs`
* `src/components/content/CurriculumTreeView.tsx`
* `src/components/content/curriculumOrder.ts`
* `src/components/content/markdown`
* `src/components/content/markdown/markdownUtils.ts`

The curriculum tree is generated from Markdown files and uses the generated curriculum manifest. The app expects content to be structured consistently.

### Curriculum Categories

The current curriculum categories are:

1. `.NET`
2. `Design & Architecture`
3. `SQL`
4. `React`
5. `Azure`

Keep this order unless the user explicitly requests a different structure.

### Important Topic Areas

The project includes or is expected to include interview preparation content for topics such as:

* C# language foundations
* Modern C# patterns
* Async programming, tasks, cancellation, and concurrency
* Dependency injection, configuration, middleware, and logging
* ASP.NET Core API design and implementation
* Authentication, authorization, and web security
* Entity Framework
* Testing strategy and integration testing
* Performance, scalability, and caching
* Software design principles
* Clean Architecture
* Domain modeling and DDD
* API design and integration contracts
* Web application security threat modeling
* Distributed systems patterns
* SQL modeling, querying, indexing, transactions, tuning, and recovery
* JavaScript fundamentals
* TypeScript for React
* React components, hooks, routing, forms, API clients, auth, performance, testing, accessibility, and debugging
* Azure hosting, Functions, identity, networking, storage, messaging, monitoring, delivery, scaling, and cost control

## Markdown Content Rules

Each curriculum Markdown file should use frontmatter similar to:

```md
---
id: topic-slug
topic: Topic Name
subtopic: Subtopic Name
category: Category Name
---
```

Each content file should generally include only these main sections:

```md
# Topic Name

## Overview

## Core Concepts

## Common Interview Questions
```

### Overview Section

The Overview should explain:

* What the topic is
* Why it matters
* Where it is used
* Why it is important for interviews

### Core Concepts Section

The Core Concepts section should explain the important ideas needed for interviews.

Include, where useful:

* Definitions
* Key terminology
* How it works
* Practical examples
* Code examples
* Real-world usage
* Trade-offs
* Common mistakes
* Best practices
* Comparisons with related concepts

Break this section into clear subsections.

### Common Interview Questions Section

This section must be structured so the React app can extract questions reliably.

Use predictable heading levels and hidden Markdown markers.

Expected structure:

```md
## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->

### Beginner

<!-- question:start:topic-slug-beginner-q01 -->
<!-- question-id:topic-slug-beginner-q01 -->

#### Question 1

Question text here.

#### Expected Answer

Detailed answer here.

#### Key Points

- Key point 1
- Key point 2
- Key point 3

<!-- question:end:topic-slug-beginner-q01 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->

### Intermediate

<!-- question:start:topic-slug-intermediate-q01 -->
<!-- question-id:topic-slug-intermediate-q01 -->

#### Question 1

Question text here.

#### Expected Answer

Detailed answer here.

#### Key Points

- Key point 1
- Key point 2
- Key point 3

<!-- question:end:topic-slug-intermediate-q01 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->

### Advanced

<!-- question:start:topic-slug-advanced-q01 -->
<!-- question-id:topic-slug-advanced-q01 -->

#### Question 1

Question text here.

#### Expected Answer

Detailed answer here.

#### Key Points

- Key point 1
- Key point 2
- Key point 3

<!-- question:end:topic-slug-advanced-q01 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
```

Question IDs must be stable, predictable, lowercase, and slug-based.

Do not remove these hidden markers unless intentionally updating the parser as well.

## Content Page Behavior

The Content page is responsible for displaying Markdown curriculum content.

Important behavior:

* `/content` without a topic displays the welcome Markdown file.
* When showing the welcome file:

  * The curriculum tree should not display a selected item.
  * The progress section should be hidden.
  * The "On This Page" section should not show "Interview Practice".
* `/content/:topicId` displays the selected curriculum topic.
* Invalid topic IDs should render a clear Not Found state with `noindex`, not redirect to the first available topic.
* The left panel contains the curriculum navigation.
* The main area renders Markdown content.
* The right panel contains "On This Page", topic progress, and interview practice navigation when applicable.
* The Common Interview Questions section may be removed from the content navigation view so that question content is not duplicated in the wrong place.

## Practice Feature Rules

The Practice section turns Markdown interview questions into topic-based practice sessions.

Important behavior:

* `/practice` shows a topic grid.
* `/practice/:topicId` shows questions for a specific topic.
* Questions are ordered:

  1. Beginner
  2. Intermediate
  3. Advanced
  4. Uncategorized fallback
* Each question can show:

  * Question text
  * Difficulty badge
  * Expected answer
  * Key points
* Use the shared `AnswerPanel` component when displaying expected answers.
* Progress should track completed questions.
* Progress should show:

  * Current question number
  * Completed count
  * Total count
  * Percentage
* Progress is stored in Redux/localStorage through the content progress state.
* Do not break existing progress persistence.

## Simulation Feature Rules

The Simulation feature is a mock interview-style flow.

Important routes:

* `/simulation`
* `/simulation/setup`
* `/simulation/session/:sessionId`
* `/simulation/result/:sessionId`

### Simulation Setup

The setup page lets the user configure a mock interview session.

Important behavior:

* User selects difficulty level.
* User selects focus areas from categories, topics, and subtopics.
* User chooses number of questions.
* Starting a session creates a new persisted simulation session.
* If an old session exists, clear or replace it when starting a new one.
* The setup page should load existing session state when appropriate.

Difficulty levels currently map conceptually to:

* Entry: mostly beginner/easy questions
* Standard: mostly intermediate/balanced questions
* Expert: mostly advanced/hard questions

Use these approximate mixes:

* Entry: 70% easy, 25% medium, 5% hard
* Standard: 15% easy, 60% medium, 25% hard
* Expert: 10% easy, 30% medium, 60% hard

### Simulation Question Generation

Simulation questions should be generated from selected curriculum topics/subtopics.

Rules:

* Use selected categories/topics/subtopics as the pool.
* Respect global question count.
* Randomize selection while still honoring the projected difficulty mix.
* Avoid selecting more questions than are available.
* Handle insufficient questions gracefully.
* Prefer stable, understandable logic over clever randomization.

### Simulation Session

The session page should show one question at a time.

Important behavior:

* User answers in a text area.
* User cannot continue without entering an answer.
* Next saves the current answer and advances.
* Previous allows review of earlier answers.
* Starting a session should scroll to the top so the current question is visible.
* The sticky bottom action bar should remain usable.
* Do not show the expected answer during the answering phase unless explicitly requested.

### Simulation Result

The result page reviews the completed session.

Important behavior:

* Show session metadata.
* Show each question.
* Show the user's answer.
* Show expected answer and key points.
* Let the user self-evaluate each answer.
* Quick navigation should scroll to the selected question and keep it in view.
* Evaluate buttons should scroll to the relevant question and keep it in view.
* Only one review card should be expanded at a time.
* After all questions are evaluated, show a summary.
* Summary should include focus areas based on weak self-ratings.
* The result summary should span the full width.
* The "Focus Areas" section should appear with the result summary.
* A "Finish session" button should clear current session state and redirect to `/simulation`.

## Redux and State Rules

Redux Toolkit is used for shared app state.

Important areas:

* `src/lib/redux/hooks/hooks`
* `src/lib/redux/selectors`
* `src/lib/redux/slices/contentSlice`
* `src/lib/redux/slices/simulationSlice`

Use existing hooks:

* `useAppDispatch`
* `useAppSelector`

Do not use raw `useDispatch` or `useSelector` unless the project convention changes.

Persisted state should remain backward-compatible when possible. If changing stored state shape, add safe fallback logic.

## Styling Rules

The project uses a custom visual style with Tailwind utility classes, theme CSS variables, and Material UI components/icons.

General styling guidance:

* Preserve the existing premium dark/product feel.
* Prefer existing theme classes over introducing unrelated styles.
* Common classes include:

  * `theme-page`
  * `theme-content-card`
  * `theme-muted`
  * `theme-text`
  * `theme-accent`
  * `theme-progress-track`
  * `theme-progress-fill`
  * `gleeple-heading`
  * `gleeple-code`
* Use MUI icons where they fit the existing design.
* Do not redesign the whole app unless explicitly requested.
* Avoid changing header/footer/sidebar behavior when the user asks to focus only on page content.

## UX Rules

Keep the app clear and practical.

Important UX principles:

* The user should always know where they are in the curriculum.
* Long names should not break tree view layouts.
* Scroll behavior matters, especially on practice and simulation pages.
* Buttons should have clear labels.
* Disabled states should be obvious.
* Avoid clutter.
* Preserve strong visual hierarchy.
* Use concise, technical, useful copy.

## Content Writing Style

When creating or editing learning content:

* Write for software engineers preparing for interviews.
* Be practical and precise.
* Include real-world examples.
* Explain trade-offs.
* Include common mistakes.
* Include best practices.
* Do not write shallow definitions only.
* Do not overuse buzzwords.
* Do not make the content sound like marketing copy.
* Make answers interview-ready: clear, structured, and easy to say aloud.

## Prompt Drafting Preference

When the user asks for a prompt, provide:

1. A short version
2. A full version

The user prefers both versions for prompt optimization work.

## Code Change Rules

Before changing code:

1. Inspect the relevant files.
2. Understand the current structure.
3. Make the smallest safe change that satisfies the request.
4. Preserve existing route behavior.
5. Preserve existing state behavior.
6. Preserve Markdown extraction rules.
7. Avoid unrelated refactors.
8. Avoid renaming public IDs, slugs, routes, or question markers unless required.
9. Run validation commands when possible.
10. Create a local Git commit after each completed implementation step.
11. Ask the user for permission before pushing or reverting changes.

After changing code, report:

* Files changed
* What changed
* How it was validated
* Any assumptions
* Any remaining risks or follow-up items

## Validation Checklist

When a task affects code, run as many of these as possible:

```bash
npm run lint
```

```bash
npm run build
```

When a task affects Markdown curriculum content, ensure:

* Frontmatter is valid.
* Required sections exist.
* Question markers are balanced.
* Question IDs are unique and stable.
* Generated curriculum manifest still works.
* Practice and simulation can still extract questions.

When a task affects routing, check:

* Direct route load
* Refresh behavior
* Invalid route fallback
* Navigation links
* GitHub Pages or production base path compatibility

## SEO and Pre-rendering Rules

Follow the SEO plan in `docs/plans/dev-net-core-seo-improvement-plan.md` when working on metadata, routing, sitemap output, pre-rendering, or production deployment behavior.

Important SEO route rules:

* `/content/:topicId/` is the primary searchable landing page for each curriculum topic.
* `/practice/:topicId/`, `/simulation/*`, `/bug-report/`, and utility/user-flow routes are `noindex` and excluded from the sitemap by default.
* `/practice/:topicId/` should stay out of the sitemap unless it is later redesigned as a standalone searchable page with unique visible content.
* `/simulation/` and `/changelog/` are optional sitemap routes only if they have enough unique visible source HTML content and are intended to rank.
* Invalid content or practice topic IDs should render Not Found + `noindex`; do not redirect them to another valid topic.
* Do not block `noindex` pages in `robots.txt`; crawlers must be able to read the `noindex` directive.

Sitemap and static output rules:

* Every sitemap URL must be absolute, canonical, trailing-slash, indexable, direct-loadable, and production validated.
* A sitemap URL must return `200 OK` on direct production load and must not redirect.
* A sitemap URL must have route-specific source HTML metadata and visible source HTML content.
* A sitemap URL must have matching static/pre-rendered output and must not depend on the GitHub Pages `404.html` SPA fallback.
* Do not include routes in `sitemap.xml` until their production static/pre-rendered output is validated.
* Submit the sitemap to Google Search Console only after the production validation gate passes.
* A generated public `404.html` must be a dedicated Not Found + `noindex` document, not a blind copy of the homepage.

Build and metadata ownership rules:

* Markdown frontmatter and the generated curriculum/SEO manifests are the source of truth for content metadata.
* Shared SEO metadata should drive sitemap generation, pre-rendered HTML, React route metadata, Open Graph tags, Twitter/X tags, and JSON-LD.
* Framework finalization must preserve React Router/Vite-generated hashed assets. Deploy only the final public client output and never a private server/static build.

## GitHub Pages and Domain Notes

The production website is:

```txt
https://www.dev-net-core.com/
```

The repository is:

```txt
https://github.com/CircleQMinh/dev-net-core
```

Be careful with Vite base path and routing behavior. The project has previously used GitHub Pages deployment considerations, including custom domain handling.

Do not change deployment-related configuration unless the user explicitly asks.

## Important Safety Rules for This Project

Do not:

* Remove curriculum markers without updating parser logic.
* Break Markdown-based question extraction.
* Break localStorage-backed progress/session persistence.
* Replace the design system with unrelated styling.
* Introduce a backend unless explicitly requested.
* Add paid services unless explicitly requested.
* Add analytics, ads, or tracking code unless explicitly requested.
* Commit secrets, API keys, tokens, or private URLs.
* Invent content sources or claim a feature exists if it is not implemented.

## How to Handle Ambiguity

If the user request is clear enough, proceed with reasonable assumptions and document them.

If the request is too ambiguous to safely implement, ask one focused clarification question.

Prefer progress over blocking, but do not make broad destructive changes without confirmation.

## Expected Response Format After Work

When completing a task, respond with:

```md
## Summary

- What was changed
- Why it was changed

## Files Changed

- `path/to/file`

## Validation

- Commands run
- Result

## Notes

- Assumptions
- Risks
- Follow-up suggestions
```

Keep the response concise unless the user asks for a detailed explanation.

## Project Mission Reminder

DEV_NET_CORE exists to help developers prepare for interviews with clarity, structure, and realistic practice.

Keep the product focused on:

* Technical depth
* Practical explanations
* Interview readiness
* Clean learning flow
* Realistic practice
* Developer trust
