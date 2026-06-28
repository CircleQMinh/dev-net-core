# DEV_NET_CORE SEO Plan Handoff

Last updated: 2026-06-28

This document summarizes the SEO planning and implementation conversation so a
new AI agent can continue without access to the original chat.

## Start Here

Read these files before making changes:

1. `AGENTS.md`
2. `docs/plans/dev-net-core-seo-improvement-plan.md`
3. `docs/spikes/react-router-7-ssg-spike.md`
4. `docs/architecture/framework-routing-dual-build.md`
5. `docs/plans/structured-data-rules.md`

The detailed SEO plan is currently untracked in Git:

```txt
docs/plans/dev-net-core-seo-improvement-plan.md
```

Do not delete, overwrite, stage, or commit that file unless the user explicitly
asks. It contains the refined plan and remains the main planning reference.

## Project and Hosting Context

- Product: DEV_NET_CORE, a technical interview preparation website.
- Production URL: `https://www.dev-net-core.com/`
- Repository: `https://github.com/CircleQMinh/dev-net-core`
- Stack: React 19, TypeScript, Vite, React Router 7.18, Redux Toolkit, MUI,
  Tailwind CSS, and Markdown curriculum content.
- Current host: GitHub Pages.
- Domain/DNS: custom domain managed through Cloudflare.
- Cloudflare is not the application host unless a later migration explicitly
  moves the site to Cloudflare Pages.
- The apex/root domain has already been deployed and validated.
- Runtime SSR is not required or planned while GitHub Pages remains the host.
- Vite `base: "/"` is correct for the current custom root domain.

## Final Decisions

These decisions supersede earlier alternatives discussed in the conversation.

### Canonical URLs

- Canonical public URLs use trailing slashes.
- Examples:
  - `/content/`
  - `/content/async-and-await-semantics-in-csharp/`
  - `/roadmap/`
  - `/about-us/`
- Non-trailing variants may work for user convenience, but must not be used in:
  - sitemap URLs
  - canonical tags
  - Open Graph URLs
  - structured data URLs
  - generated internal SEO links
- Non-trailing client redirects do not prove that GitHub Pages returns the
  correct production status. Hosting behavior must be validated separately.

### Sitemap Eligibility

Every sitemap URL must be:

- absolute
- canonical
- trailing-slash
- indexable
- direct-loadable
- backed by a static/pre-rendered artifact
- returning `200 OK`
- not redirected
- not blocked by `robots.txt`
- not marked `noindex`
- unique in the sitemap
- populated with route-specific source HTML metadata and visible source content

`Sitemap = Yes` means:

```txt
indexable + canonical + static/pre-rendered + production validated
```

A route must not be included merely because the React SPA can catch it through
`404.html`.

### Indexability

Primary SEO assets:

- `/`
- `/content/`
- `/content/:topicId/`
- `/roadmap/`
- `/about-us/`
- `/privacy/`
- `/terms/`

Noindex and excluded from the sitemap by default:

- `/practice/`
- `/practice/:topicId/`
- `/simulation/setup/`
- `/simulation/session/:sessionId`
- `/simulation/result/:sessionId`
- `/bug-report/`
- invalid routes

Optional only if intentionally improved and made search-worthy:

- `/simulation/`
- `/changelog/`

The main searchable page for a topic is `/content/:topicId/`. Practice pages
remain useful application routes but should stay noindex unless they gain
substantial, unique search-oriented content.

### Invalid Routes

- Invalid content and practice topic IDs render a clear Not Found state.
- They must include `noindex`.
- They must not redirect to the first valid topic.
- A real HTTP `404` is preferred where hosting allows it.
- If GitHub Pages serves a `200` SPA fallback, the rendered page must still show
  Not Found and `noindex`.
- The final `404.html` must be a dedicated Not Found + `noindex` document, not a
  blind copy of the homepage.

### Robots and Noindex

- Do not block noindex pages in `robots.txt`.
- Crawlers must be able to fetch a page to see its `noindex` directive.
- Use `robots.txt` for crawl control and `noindex` for search-result exclusion.
- Current `public/robots.txt` only contains:

```txt
User-agent: *
Allow: /
```

- It does not yet advertise a sitemap because the final production sitemap has
  not been generated or deployed.

### Metadata Source of Truth

The intended pipeline is:

```txt
Markdown frontmatter
  -> generated curriculum/SEO manifests
  -> shared metadata builder
  -> React route metadata
  -> pre-rendered source HTML
  -> sitemap
```

Supported content SEO fields:

```yaml
seoTitle: Async and Await in C# Interview Questions
seoDescription: Learn async and await in C# for technical interviews...
canonicalPath: /content/async-await/
```

Rules:

- Custom frontmatter metadata is preferred.
- Generated fallbacks are allowed during transition.
- Do not manually maintain `lastmod`.
- Omit `<lastmod>` unless an automated source can keep it accurate.
- Do not use `<priority>` or `<changefreq>`.
- The current build reports 220 fallback titles and 220 fallback descriptions
  across 221 curriculum entries. Metadata rollout remains pending/optional.

The implementation does not use `react-helmet-async`. The SPA uses a custom
`Seo` component, while the framework candidate uses React Router route `meta`
exports. Both consume the same plain `.mjs` metadata builder.

### Social Metadata

- Default image:
  `public/og/default-og-image.png`
- Public URL:
  `https://www.dev-net-core.com/og/default-og-image.png`
- Dimensions: `1200x630`
- Format: PNG
- Every page should use the default image unless a custom image is later added.
- Open Graph and Twitter/X image URLs must be absolute and available without
  JavaScript.

### Structured Data

- Structured data must match visible content.
- Do not invent author, publisher, rating, review, FAQ, or date facts.
- Homepage uses `WebSite` JSON-LD.
- Valid content pages use `Article` JSON-LD.
- Noindex and invalid pages do not receive structured data.
- The shared metadata builder owns canonical, Open Graph, Twitter/X, and
  JSON-LD data to prevent drift.

### Content Quality

If `/practice/:topicId/` is noindex, the matching `/content/:topicId/` page must
fully satisfy search intent. Indexable content pages should contain:

- a clear H1
- a strong opening explanation
- core concepts
- practical examples
- trade-offs
- common mistakes
- best practices
- interview questions and expected answers
- related internal links

A subtopic is currently considered ready when its Markdown file exists. No
separate per-topic readiness flag is required.

## Chosen Rendering Architecture

React Router framework-mode static generation was chosen after a spike.

Configuration:

- React Router packages pinned to `7.18.0`
- `ssr: false`
- `routeDiscovery: { mode: "initial" }`
- `future.v8_trailingSlashAwareDataRequests: true`
- pre-render paths come from:
  - `shared/seo/seoRoutes.mjs`
  - `shared/content/curriculumSeoManifest.generated.json`

This remains static build-time rendering. There is no production Node server.

### Dual-Build Cutover

The repository intentionally has two build paths:

```txt
npm run build
  -> dist/
  -> current deployable Vite SPA

npm run build:framework
  -> build-framework/client/
  -> React Router framework migration candidate
```

The GitHub Pages workflow still publishes `dist/`. Do not switch it to
`build-framework/client/` until fallback handling, sitemap output, production
validation, and the full cutover gate are complete.

React Router creates `__spa-fallback.html` for app-only routes. GitHub Pages
expects `404.html`, so a finalization step is still required. The fallback is
never valid static output for a sitemap URL.

## Current Route Output

The framework candidate pre-renders:

- `/`
- `/content/`
- all 221 valid `/content/:topicId/` routes
- `/roadmap/`
- `/about-us/`
- `/privacy/`
- `/terms/`

Current generated candidate measurements:

```txt
Static route HTML artifacts: 227
HTML files including __spa-fallback.html: 228
Content route data files: 222
Total client output: about 67.55 MiB
Largest HTML file: about 444.74 KiB
Largest route data file: about 89.68 KiB
Observed framework build time: about 11-15 seconds
```

Markdown is present in source HTML and route data, so duplicated content size is
a known budget concern.

## Implemented Work

| Work | Commit |
|---|---|
| Fix `/content` On This Page scroll tracking | `b965497` |
| Update `AGENTS.md` with SEO context | `680d8b7` |
| Basic robots/default metadata/social image foundation | `6d21ec2` |
| Extend curriculum manifest with SEO fields and Node-readable JSON | `cadab8d` |
| Add machine-readable SEO route config | `282f0a6` |
| Add shared dependency-free metadata builder and tests | `62b9d90` |
| Add route-aware SPA SEO component | `5597626` |
| Fix invalid topic Not Found behavior | `3df4213` |
| Add structured data rules note | `7e1d21d` |
| Add `WebSite` and `Article` JSON-LD | `ff6fc9b` |
| Convert important internal navigation to crawlable links | `4c677fa` |
| Add explicit trailing-slash route normalization | `6e7eb9c` |
| Complete React Router SSG spike | `7a5047a` |
| Make providers, Redux, theme, and content render-safe | `6b24b34` |
| Add production-shaped dual-build framework routing candidate | `55221be` |

## Important Implementation Files

### Existing SPA

- `src/main.tsx`
- `src/App.tsx`
- `src/components/seo/Seo.tsx`
- `src/pages/Content.tsx`
- `vite.config.ts`

This path remains production-deployable.

### Framework Candidate

- `app/root.tsx`
- `app/routes.ts`
- `app/routes/main-layout.tsx`
- `app/routes/page.tsx`
- `app/routes/content.tsx`
- `app/entry.server.tsx`
- `app/seo/routeMetadata.tsx`
- `react-router.config.ts`
- `vite.framework.config.ts`
- `tsconfig.framework.json`

### Shared SEO and Route Data

- `shared/seo/seoRoutes.mjs`
- `shared/seo/buildSeoMetadata.mjs`
- `shared/content/curriculumSeoManifest.generated.json`
- `shared/content/loadContentRouteData.mjs`
- `src/components/content/loadClientContentRouteData.ts`
- `src/components/content/contentRouteData.ts`
- `src/routing/canonicalPath.ts`

The Node content loader:

- reads the JSON SEO manifest
- reads Markdown with Node `fs`
- does not use `import.meta.glob`
- validates that content paths stay under `src/contents/v1`
- returns serializable welcome/topic/not-found route data

The browser loader remains available for SPA fallback and client navigation.

### Redux and Hydration

- `src/lib/redux/createAppStore.ts` creates isolated stores.
- `src/lib/redux/store.ts` owns the current browser singleton.
- `src/lib/redux/persistence.ts` isolates localStorage loading/subscriptions.
- `src/AppProviders.tsx` can create a fresh store and restore browser persistence
  after hydration.
- Pre-rendered content receives the same initial Markdown/metadata used during
  hydration.
- URL route data wins over stale persisted selected-topic state.

### Validation and Preview

- `scripts/validate-framework-build.mjs`
- `scripts/preview-framework.mjs`
- `docs/architecture/framework-routing-dual-build.md`

`validate:framework` checks:

- all expected static route artifacts exist
- every content route has matching `.data`
- source HTML contains visible H1 content
- source HTML does not contain `Loading content...`
- title, description, canonical, robots, Open Graph URL, and image exist
- structured data exists where expected
- app-only routes were not emitted as static sitemap pages
- the temporary server build was removed
- the old `dist/index.html` SPA artifact still exists

On a clean checkout, run `npm run build` before `npm run validate:framework`,
because the validator intentionally checks that the rollback SPA artifact still
exists.

## Current Commands

```bash
npm run generate:curriculum
npm run lint
npm run test:seo
npm run test:content-route-data
npm run build
npm run build:framework
npm run validate:framework
npm run preview
npm run preview:framework
```

Recommended complete local gate:

```bash
npm run lint
npm run test:seo
npm run test:content-route-data
npm run build
npm run build:framework
npm run validate:framework
```

## Validation Already Completed

The latest implementation passed:

- ESLint
- TypeScript/Vite SPA build
- React Router framework build
- 9 shared SEO tests
- 4 content route-data tests
- validation of 227 static framework route artifacts
- direct pre-rendered content loads
- client navigation between generated content routes
- direct SPA fallback load for `/practice/`
- direct SPA fallback load for `/simulation/setup/`
- invalid topic Not Found behavior
- generic invalid route Not Found behavior
- `noindex` and no canonical on invalid routes
- trailing-slash client normalization
- post-hydration Redux progress restoration
- zero React hydration warnings
- zero MUI/Emotion hydration warnings
- zero browser console errors in the final Playwright pass

Existing non-blocking warnings:

- 220 fallback SEO titles/descriptions remain.
- The SPA main bundle remains larger than Vite's 500 KiB warning threshold.
- Candidate output size is substantial because Markdown is duplicated between
  HTML and route data.

## Work Not Yet Completed

Do not assume the SEO rollout is production-complete.

### 1. Static Theme Bootstrap

`Task 11A1` remains pending.

Current pre-render defaults are stable in dark mode, but there is no tiny
pre-paint bootstrap that reads a saved/system theme and sets HTML theme
attributes before React hydrates. Implement and verify it without introducing
hydration mismatch or a flash of the wrong theme.

### 2. Reconcile the Plan with Framework Output

The plan still contains older custom postbuild wording involving `dist`,
`dist-server`, and a custom `renderRoute` API. The chosen implementation now
uses React Router framework SSG.

Preserve the underlying ownership rules, but adapt later tasks to:

- treat `build-framework/client/` as the candidate public output
- let React Router own route rendering and `.data` generation
- keep custom finalization responsible only for sitemap, dedicated `404.html`,
  validation, and GitHub Pages output preparation
- avoid reintroducing a parallel custom SSR renderer

### 3. Define and Review Output Budgets

Formal limits are still needed for:

- total public output size
- maximum per-route HTML size
- maximum route-data size
- route count
- build duration

Use the current measurements as the baseline. Decide whether duplicated
Markdown/frontmatter can be reduced before cutover.

### 4. Generate the Final Sitemap

No production `sitemap.xml` exists yet.

The finalizer should:

- merge sitemap-enabled static routes with content `canonicalPath` entries
- write an absolute trailing-slash sitemap
- include only pre-rendered and validated routes
- omit `lastmod`, `priority`, and `changefreq`
- fail if any sitemap URL lacks a matching static artifact
- write to the final candidate public output, not `public/sitemap.xml`

The older plan names this script `scripts/seo-postbuild.mjs`. Under the chosen
framework architecture, a clearer role is an SEO/framework output finalizer.

### 5. Generate a Dedicated GitHub Pages `404.html`

The current workflow still runs:

```bash
cp dist/index.html dist/404.html
```

That conflicts with the final SEO decision. The cutover must produce a dedicated
Not Found + `noindex` document while retaining SPA fallback behavior for valid
app-only routes. Do not count `404.html` as valid output for sitemap routes.

### 6. GitHub Actions Dual-Build/Cutover

The workflow currently runs only `npm run build` and deploys `dist/`.

Before switching:

1. Build the existing SPA rollback artifact.
2. Build the framework candidate.
3. Run framework/static SEO validation.
4. Generate sitemap and dedicated fallback output.
5. Confirm only public client output is uploaded.
6. Keep the old deployment path easy to restore.
7. Change the published directory only after the complete route matrix passes.

Do not deploy `build-framework/server`; React Router removes it under
`ssr:false` anyway.

### 7. Production Validation

After cutover, test the Cloudflare-managed custom domain on GitHub Pages.

For every sitemap URL, verify:

- direct request returns `200 OK`
- no redirect
- canonical trailing slash
- no `noindex`
- not blocked by robots
- source HTML contains unique metadata and visible content
- Open Graph URL matches the page
- URL appears exactly once in the sitemap

Use both header and source checks, for example:

```bash
curl -I https://www.dev-net-core.com/content/classes-structs-records/
curl -L https://www.dev-net-core.com/content/classes-structs-records/
```

### 8. Search Console and Bing

Do not submit the sitemap until:

1. Technical foundation is complete.
2. Pre-render/static output is deployed.
3. Production URL validation passes.

Then:

- submit to Google Search Console
- inspect representative URLs
- submit to Bing Webmaster Tools
- monitor indexing and search performance

### Optional Follow-Ups

- Gradually replace fallback metadata with custom frontmatter.
- Add scheduled Codex production SEO validation after manual validation proves
  the checks.
- Improve content quality and related-topic linking based on search data.
- Consider custom per-topic Open Graph images later.

## Recommended Next Implementation Order

1. Implement and validate the static theme bootstrap.
2. Record formal framework output-size/build-time budgets.
3. Add framework output finalization for sitemap and dedicated `404.html`.
4. Extend local validation to parse the generated sitemap and validate the
   dedicated fallback.
5. Audit `.github/workflows/main.yml` and add a non-deploying candidate build
   gate first.
6. Run the complete local route matrix again.
7. Perform the explicit GitHub Pages cutover in a separate commit.
8. Validate production with headers, source HTML, and browser hydration.
9. Submit the sitemap only after the production gate passes.

## Safety Rules for the Next Agent

- Read the current files before editing.
- Preserve the existing SPA build until the cutover is explicitly approved.
- Do not change the deployment workflow casually.
- Do not add runtime SSR or a Node production server.
- Do not add `react-helmet-async`; it is not part of the chosen architecture.
- Do not include practice, simulation flow, utility, session, or invalid routes
  in the sitemap.
- Do not block noindex pages in robots.
- Do not use non-trailing canonical URLs.
- Do not manually add `lastmod`.
- Do not let a generic `404.html` fallback satisfy a sitemap artifact check.
- Preserve generated Vite/React Router asset references.
- Preserve Markdown question markers and curriculum extraction behavior.
- Preserve Redux/localStorage progress and simulation persistence.
- Treat source HTML metadata and hydrated metadata drift as a bug.
- Run both SPA and framework build gates after routing/provider changes.

## Git State at Handoff

Latest implementation commit:

```txt
55221be feat: add dual-build framework routing candidate
```

Expected working-tree exception:

```txt
?? docs/plans/dev-net-core-seo-improvement-plan.md
```

The handoff document itself will be a new change after that commit. Verify
`git status` before committing and keep the untracked SEO plan outside the
commit unless explicitly requested.
