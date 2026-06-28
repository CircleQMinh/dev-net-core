# DEV_NET_CORE SEO Improvement Plan

## Purpose

This plan documents the steps needed to improve SEO for DEV_NET_CORE so the website and its Markdown-based content can be discovered, crawled, indexed, and ranked by Google and other search engines.

Website:

```txt
https://www.dev-net-core.com/
```

Repository:

```txt
https://github.com/CircleQMinh/dev-net-core
```

Recommended repo location for this file:

```txt
docs/plans/seo-improvement-plan.md
```

## Current Context

DEV_NET_CORE is a React + TypeScript + Vite single-page application.

The website has valuable technical interview preparation content, especially under content routes such as:

```txt
/content/
/content/:topicId/
/practice/
/simulation/
/roadmap/
/about-us/
```

The project uses Markdown content and a generated curriculum manifest. This is good for SEO because each Markdown topic can become a searchable landing page if it has:

- A stable URL
- Real crawlable links
- Unique metadata
- A sitemap entry
- Search-friendly page content
- Ideally pre-rendered HTML

The most important SEO goal is to make each curriculum topic searchable as its own page.

Example search targets:

```txt
C# async await interview questions
Entity Framework change tracker interview questions
React useEffect interview questions
SQL isolation levels interview questions
ASP.NET Core middleware interview questions
Azure Functions interview questions
Clean Architecture .NET interview questions
```

## Goals

The SEO work should achieve these goals:

- Make the website discoverable by Google and other search engines.
- Make every important content page available as an indexable URL.
- Generate a sitemap from the curriculum content.
- Add `robots.txt`.
- Add unique metadata for important routes.
- Add canonical URLs.
- Add Open Graph metadata for sharing.
- Add structured data where useful.
- Improve Markdown content so each page has strong search intent.
- Add pre-rendered/static HTML for every sitemap-included route before submitting sitemap URLs.
- Set up Google Search Console and Bing Webmaster Tools after production validation passes.

## Non-Goals

This plan does not include:

- Adding paid SEO tools.
- Rebuilding the entire site in Next.js or Astro immediately.
- Adding a backend.
- Adding ads.
- Adding analytics beyond what is needed for SEO validation.
- Rewriting all curriculum content at once.

## High-Level Recommendation

Implement SEO in this order:

```txt
1. Add robots.txt
2. Extend the curriculum manifest for SEO fields and generate sitemap.xml from it
3. Add safe site-wide default metadata and a default social preview asset
4. Add dynamic SPA metadata with react-helmet-async as an interim improvement
5. Add crawlable internal links, canonical URLs, and explicit trailing-slash route support
6. Add a shared SEO route config and complete the pre-rendering architecture decision gate
7. Run the React Router 7 SSG spike before choosing the final pre-rendering approach
8. Complete the SSR/SSG readiness refactor
9. Add content route data loading and hydration seeding
10. Add pre-render/static generation for all sitemap-eligible routes
11. Validate production sitemap URLs and source HTML metadata
12. Submit the sitemap to Google Search Console and Bing Webmaster Tools
13. Monitor indexing and optionally add scheduled production validation
```

The highest-impact items are:

```txt
manifest-driven sitemap + real links + default metadata + shared route config + pre-rendering architecture gate + SSG-ready app structure + route data hydration + pre-rendered sitemap-eligible routes + production validation + Search Console
```

## Phase 1: Basic Crawlability

### 1. Add `robots.txt`

Create:

```txt
public/robots.txt
```

Content:

```txt
User-agent: *
Allow: /

Sitemap: https://www.dev-net-core.com/sitemap.xml
```

### Purpose

This tells crawlers that the site can be crawled and where to find the sitemap.

Important timing caveat: if `robots.txt` is deployed before the full production sitemap is ready, do not expose unvalidated URLs through the `Sitemap:` line yet. Either omit the `Sitemap:` line temporarily or expose only a limited sitemap containing URLs that already pass the production validation gate.

Because DEV_NET_CORE is already in production, treat sitemap exposure as a production change. A public `sitemap.xml` or `robots.txt` `Sitemap:` line can be discovered before Search Console submission, so expose only validated URLs until the full SEO postbuild output is ready.

### Acceptance Criteria

- `https://www.dev-net-core.com/robots.txt` is accessible.
- The file points to `https://www.dev-net-core.com/sitemap.xml` only when the sitemap URLs are ready for production discovery.
- No important assets, pages, or routes are blocked.

### Decision: `noindex` vs `robots.txt`

Do not block `noindex` pages in `robots.txt`.

Crawlers must be able to access the page in order to see the `noindex` meta tag or `X-Robots-Tag` header.

Use `robots.txt` only to control crawling of areas that should not be crawled. Use `noindex` to prevent specific pages from appearing in search results.

## Phase 2: Sitemap Generation

### 2. Generate `sitemap.xml`

Create a sitemap that includes important static routes and curriculum routes only after those routes have production-ready static/pre-rendered output.

Required sitemap-eligible routes for the first submission:

```txt
/
/content/
/content/:topicId/
/roadmap/
/about-us/
/privacy/
/terms/
```

Optional sitemap-eligible routes:

```txt
/changelog/
/simulation/
```

Do not include optional routes unless they have enough unique visible content, are intended to rank, and pass the same static/pre-rendered production validation as required routes.

The sitemap should be generated from the existing curriculum manifest so new Markdown topics are automatically included.

### Recommended Implementation

Add a script such as:

```txt
scripts/seo-postbuild.mjs
```

The script should:

1. Run after Vite has produced `dist`.
2. Load the Node-readable SEO manifest generated by the curriculum generation step.
3. Build a list of sitemap-eligible static routes.
4. Build content routes from each entry's `canonicalPath`, falling back to `/content/[id]/` during transition.
5. Generate static/pre-rendered HTML artifacts for every sitemap URL.
6. Inject metadata from the shared metadata builder.
7. Write the final production sitemap to `dist/sitemap.xml`.
8. Validate that every sitemap URL has a matching static artifact.
9. Do not include `/practice/:topicId/` routes in the first SEO sitemap pass.
10. Do not include `<lastmod>` unless a reliable automated source can provide an accurate value.
11. Do not output `<priority>` or `<changefreq>`.

### Decision: SEO Postbuild Output Ownership

Use a custom SEO `postbuild` script as the owner of pre-rendered HTML and sitemap output.

The script is responsible for:

- Building the list of sitemap-eligible routes.
- Generating static HTML artifacts for those routes.
- Injecting metadata from the shared metadata builder.
- Injecting safe serialized route data for hydrated pages.
- Writing `dist/sitemap.xml`.
- Validating that every sitemap URL has a matching static artifact.
- Ensuring no sitemap route depends on `404.html`.

Postbuild failure policy in strict mode:

- Fail the build if any sitemap URL is missing a static/pre-rendered artifact.
- Fail the build if any sitemap URL is missing route-specific title, description, canonical URL, Open Graph URL, or `og:image`.
- Fail the build if any sitemap URL has no visible source HTML content.
- Fail the build if any sitemap URL contains `noindex`.
- Fail the build if any sitemap URL can only be served through `dist/404.html`.
- Treat SEO postbuild errors as release-blocking, not warnings.

Staged postbuild activation:

- Use `SEO_POSTBUILD_MODE=off` only during early scaffolding when the script or route list does not exist yet.
- Use `SEO_POSTBUILD_MODE=warn` while manifest SEO fields, metadata, route config, and pre-rendering support are being built.
- Use `SEO_POSTBUILD_MODE=strict` after the pre-render proof of concept passes and before exposing a full production sitemap.
- Do not make strict SEO postbuild validation block unrelated early PRs before the SSG/pre-render proof of concept proves the route output and hydration path.
- Once the production sitemap includes sitemap-eligible routes, strict mode should be required in CI/deployment.

The deployment workflow may still create `dist/404.html` for SPA fallback, but that fallback is not considered valid static output for any sitemap URL.

During early local work, sitemap generation may be tested locally, but do not deploy a full production sitemap or a `robots.txt` `Sitemap:` line until every sitemap URL has validated static/pre-rendered output.

### Decision: Build Boundary for Vite, Curriculum Generation, and SEO Postbuild

Keep the build responsibilities separated:

```txt
Vite -> JavaScript/CSS bundling and hashed assets
Curriculum generation -> TypeScript app manifest + Node-readable SEO manifest
SEO postbuild -> static route HTML, metadata injection, route data injection, sitemap, and SEO validation
React -> hydration after the static page loads
```

Rules:

- Vite owns JavaScript and CSS bundling, hashed asset filenames, and the production `dist/index.html` app template.
- The curriculum generation step must output a Node-readable SEO manifest, such as JSON, in addition to the React/TypeScript curriculum manifest.
- The SEO manifest must include enough data to generate static route HTML, sitemap URLs, route metadata, and content route data.
- The SEO postbuild script must use `dist/index.html` as the base HTML template after Vite has built the app.
- The SEO postbuild script must preserve Vite-generated script, CSS, preload, modulepreload, and asset references.
- The SEO postbuild script owns static route HTML generation, metadata injection, route data injection, sitemap generation, and SEO validation.
- The SEO postbuild script must not depend on Vite-only imports, TypeScript runtime execution, `import.meta.glob`, or React app internals.
- The SEO postbuild script may import only the built server/static render entry as the React rendering boundary.
- The SEO postbuild script must not rely on the SPA `404.html` fallback as valid output for sitemap routes.
- The server/static render bundle should be a build artifact outside the public `dist` deploy output, such as `dist-server/entry-server.js`.

### Decision: HTML Template and Asset Preservation

The SEO postbuild script should read `dist/index.html` and use it as the base template for every generated static route.

Rules:

- Preserve Vite-generated hashed script and stylesheet references.
- Preserve modulepreload/preload links and public asset references.
- Replace or inject only the route-specific head tags, root app markup, and safe route data script.
- Do not manually guess hashed JS or CSS filenames.
- Validate generated nested routes load the same JS and CSS assets as the root app shell.
- Prefer explicit managed template slots over broad string replacement.
- If template slots are used, define stable markers for the SEO head block, root app markup, and serialized route data.
- If an HTML parser is used instead of markers, restrict mutation to the same three areas.
- Fail or warn according to `SEO_POSTBUILD_MODE` if the expected template markers or nodes are missing.
- Do not rewrite unrelated `head`, script, style, preload, modulepreload, favicon, manifest, or public asset tags.

Suggested managed slots:

```html
<!-- seo:head:start -->
<!-- seo:head:end -->

<div id="root"><!-- app:html --></div>

<!-- route-data:start -->
<!-- route-data:end -->
```

### Decision: Initial Head Metadata Ownership

Initial source HTML metadata should come from the shared metadata builder and be injected by `scripts/seo-postbuild.mjs`.

`react-helmet-async` may still mirror or update the same metadata after hydration, but it should not be the source of truth for pre-rendered HTML.

Rules:

- Initial HTML metadata is owned by SEO postbuild.
- Hydrated route metadata should match the same shared metadata builder output.
- Mismatches between source HTML metadata and hydrated React metadata are bugs.

### Decision: Server/Static Render Entry API

The server/static render entry should expose a small, explicit API for the SEO postbuild script.

Suggested API:

```ts
export async function renderRoute(input: {
  url: string;
  routeData?: unknown;
  preloadedState?: unknown;
}): Promise<{
  appHtml: string;
  statusCode?: number;
  diagnostics?: string[];
}>;
```

Rules:

- `src/entry-server.tsx` should be the React rendering boundary consumed by SEO postbuild.
- The built server/static render entry should render app markup only; it should not write files, generate sitemap URLs, or mutate `dist`.
- The SEO postbuild script should own file output, metadata injection, route-data injection, sitemap generation, and validation.
- The server/static render entry should receive the canonical URL path and any route data before rendering.
- The server/static render entry should create an isolated app instance per route render.
- Do not import the browser singleton Redux store into the server/static render entry.
- Do not depend on browser globals or process-wide mutable render state.
- Metadata may be calculated for React route components, but initial source HTML metadata is still injected by SEO postbuild from the shared metadata builder.

### Decision: Per-Render Store and Client-Only Persistence

Static rendering must not reuse the browser singleton Redux store across route renders.

Rules:

- Extract a store factory such as `createAppStore(preloadedState?)` from `src/lib/redux/store.ts`.
- The server/static render entry must create a fresh Redux store for every `renderRoute` call.
- The client entry may create the browser store once, but it should also support preloaded route data or preloaded state when present.
- Browser persistence subscriptions for Redux/localStorage should be attached only in the client entry or behind explicit browser guards.
- Do not run localStorage, sessionStorage, or storage-subscription side effects at module load in code imported by `entry-server`.
- Server/static rendering must never read from or write to localStorage.
- Route-derived data must win over persisted selected-topic state during hydration.

### Decision: Client Hydration Bootstrap

The client entry should choose hydration or fresh mounting based on the generated HTML it receives.

Rules:

- Read serialized route data before the first React render.
- If the root element already contains pre-rendered app markup, use `hydrateRoot`.
- If the root element is empty or contains only a generic non-pre-rendered shell, use `createRoot`.
- Pass initial route data or preloaded state into shared app providers before rendering.
- Ignore or clear serialized route data if it does not match the current URL.
- After hydration, normal client navigation can use existing route loading behavior.
- Hydration mismatches between generated source HTML and the first client render should be treated as bugs.

### Decision: Sitemap URL Discipline

Every sitemap URL must be:

- Absolute
- Canonical
- Indexable
- Direct-loadable
- Intended to appear in search results
- Returning `200 OK`
- Not redirected
- Not duplicated with another slash/non-slash format
- Not blocked by `robots.txt`
- Not marked `noindex`

Use only canonical URLs in the sitemap.

Example:

```xml
<loc>https://www.dev-net-core.com/content/async-await/</loc>
```

Do not use:

```xml
<loc>/content/async-await/</loc>
```

Do not include invalid routes, duplicate routes, utility-only routes, or pages that should not rank.

Submitting a sitemap helps discovery, but it does not guarantee that Google will crawl or index every URL.

### Decision: Static Output Rule for Sitemap URLs

Every route marked `Sitemap = Yes` must have a matching production static output or pre-rendered artifact.

A route must not be included in `sitemap.xml` if it only works because the React SPA catches the route after loading a generic app shell.

For every sitemap URL, production must provide:

- A direct-loadable URL
- `200 OK` status
- No redirect
- Canonical trailing-slash URL
- Route-specific source HTML metadata
- Route-specific or fallback Open Graph metadata in source HTML
- Visible page content in source HTML
- No `noindex`
- No `robots.txt` block

This rule applies to all sitemap routes, not only `/content/:topicId/`.

Examples of routes that need static/pre-rendered output if included in the sitemap:

- `/`
- `/content/`
- `/content/:topicId/`
- `/roadmap/`
- `/about-us/`
- `/privacy/`
- `/terms/`

Do not include a route in the sitemap until its production static output is validated.

| Route type | Sitemap? | Static/pre-render required? |
|---|---:|---:|
| `/` | Yes | Yes |
| `/content/` | Yes | Yes |
| `/content/:topicId/` | Yes | Yes |
| `/roadmap/` | Yes | Yes |
| `/about-us/` | Yes | Yes |
| `/privacy/` | Yes | Yes |
| `/terms/` | Yes | Yes |
| `/practice/` | No by default | No, unless later indexed |
| `/practice/:topicId/` | No by default | No, unless later indexed |
| `/simulation/setup/` | No | No |
| `/simulation/session/:sessionId/` | No | No |
| `/simulation/result/:sessionId/` | No | No |
| `/bug-report/` | No | No |
| Invalid routes | No | Prefer real 404 or noindex |

### Example Sitemap Shape

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.dev-net-core.com/</loc>
  </url>
  <url>
    <loc>https://www.dev-net-core.com/content/</loc>
  </url>
  <url>
    <loc>https://www.dev-net-core.com/roadmap/</loc>
  </url>
  <url>
    <loc>https://www.dev-net-core.com/about-us/</loc>
  </url>
  <url>
    <loc>https://www.dev-net-core.com/privacy/</loc>
  </url>
  <url>
    <loc>https://www.dev-net-core.com/terms/</loc>
  </url>
  <url>
    <loc>https://www.dev-net-core.com/content/classes-structs-records/</loc>
  </url>
</urlset>
```

### Package Script Update

Consider updating `package.json`:

```json
{
  "scripts": {
    "generate:curriculum": "node scripts/generate-curriculum-manifest.mjs",
    "generate:seo-manifest": "node scripts/generate-seo-manifest.mjs",
    "predev": "npm run generate:curriculum",
    "build:client": "tsc -b && vite build",
    "build:ssg": "vite build --ssr src/entry-server.tsx --outDir dist-server",
    "seo:postbuild": "node scripts/seo-postbuild.mjs",
    "fallback:404": "node scripts/seo-404.mjs",
    "seo:validate": "node scripts/validate-seo-build.mjs",
    "build": "npm run generate:curriculum && npm run generate:seo-manifest && npm run build:client && npm run build:ssg && npm run seo:postbuild && npm run fallback:404 && npm run seo:validate"
  }
}
```

Only change the scripts after checking the current `package.json`.

Do not make `predev` generate the production sitemap. Local development can rely on app routes; production sitemap output belongs to the SEO postbuild step.

If the main `build` script explicitly runs `generate:curriculum`, remove or adjust the existing `prebuild` script so curriculum generation does not run twice.

The exact `generate:seo-manifest` implementation can be folded into `generate:curriculum` as long as the generated ownership is clear, the build script does not duplicate work unnecessarily, and the SEO manifest is produced before sitemap/pre-render work begins.

If `fallback:404` remains separate from `seo:postbuild`, final SEO validation should run after `fallback:404` so the dedicated Not Found + `noindex` file is included in validation.

The exact script names may be adjusted during implementation, but the required production build order is:

1. Generate the curriculum manifest.
2. Generate the Node-readable SEO manifest, either as part of curriculum generation or as an explicit step.
3. Build the client assets.
4. Build the server/static render entry or framework-mode pre-render output.
5. Run the SEO postbuild script that writes route HTML artifacts and `dist/sitemap.xml`.
6. Generate or validate the dedicated `dist/404.html` Not Found + `noindex` fallback.
7. Run local SEO build validation when available.

Only `dist` should be deployed to GitHub Pages. Do not upload `dist-server` or other private server/static build outputs.

## Pre-rendering Architecture Decisions Before Implementation

Before implementing SEO pre-rendering, decide these items explicitly.

### Decision: Canonical URL Shape for Static Hosting

DEV_NET_CORE should keep trailing-slash URLs as the canonical static-output format.

Reason:

```txt
dist/content/topic/index.html -> https://www.dev-net-core.com/content/topic/
```

Rules:

- Sitemap URLs must use trailing-slash canonical URLs.
- Canonical tags, Open Graph URLs, Twitter/X URLs, structured data URLs, and internal generated links must use trailing-slash canonical URLs.
- Non-trailing URLs may continue to work for user convenience, but they are not the canonical SEO target.
- On GitHub Pages, do not assume non-trailing URLs can return true `301` redirects unless Cloudflare redirect rules are explicitly enabled and validated.
- If a non-trailing URL is kept as an accepted direct-load URL, production must prove that it returns `200 OK` directly without relying on a generic SPA fallback.
- Non-trailing URLs must not appear in `sitemap.xml`.

### Decision: Rendering Strategy Spike Before Implementation

Do not assume the custom SEO postbuild approach is the only possible path.

Run a spike to compare:

- React Router framework-mode SSG/pre-rendering.
- Custom Vite SSR/SSG build plus SEO postbuild generation.

React Router framework docs support static pre-rendering through `react-router.config.ts`, including `ssr: false` for static-file deployments and a `prerender()` list/function for generated paths. They also support build-time loaders during pre-rendering.

However, DEV_NET_CORE is currently a Vite SPA using `BrowserRouter`, `Routes`, and `createRoot`, so React Router framework-mode SSG may require a larger routing/build migration.

The spike must answer:

- Can DEV_NET_CORE migrate safely to React Router framework mode?
- Can it generate `/content/:topicId/` paths from the curriculum manifest?
- Can route loaders receive Markdown content and curriculum metadata at build time?
- Can the generated output deploy cleanly to GitHub Pages with the Cloudflare-managed custom domain?
- How much current routing, layout, provider, and navigation code must change?
- Does framework-mode SSG reduce or increase complexity compared with the custom SEO postbuild approach?

Proceed with framework-mode SSG only if the migration cost is acceptable. Otherwise, continue with the custom SEO postbuild approach already described in this plan.

References:

- `https://reactrouter.com/start/framework/rendering`
- `https://reactrouter.com/how-to/pre-rendering`

### Decision: JSON-LD Ownership

Structured data should be owned by the same metadata pipeline as title, description, canonical URL, Open Graph, and Twitter/X metadata.

Rule:

```txt
Markdown frontmatter -> generated manifest -> shared metadata builder -> sitemap + pre-render HTML + React route metadata
```

The shared metadata builder should produce:

- Canonical metadata
- Open Graph metadata
- Twitter/X metadata
- JSON-LD structured data

SEO postbuild should inject JSON-LD into source HTML for sitemap URLs. React may mirror the same JSON-LD after hydration, but React runtime output should not be the source of truth for structured data.

### Decision: Static Theme Bootstrap

Pre-rendered HTML should not flash the wrong theme before React hydrates.

Rules:

- Add a small before-paint theme bootstrap if needed.
- The bootstrap may read a safe theme preference from localStorage and/or system preference.
- It should set the root `data-theme`, `dark`/`light` class, and any critical theme variables needed before paint.
- Keep the script tiny and dependency-free.
- Do not let the bootstrap create markup that conflicts with React hydration.
- If localStorage is unavailable, default to the production default theme.

Example placement:

```html
<script>
  // Tiny before-paint theme bootstrap.
</script>
```

### Decision: Build Script Ownership

Keep production build steps explicit while the SEO pipeline is being stabilized.

Preferred conceptual steps:

```txt
generate:curriculum
generate:seo-manifest
build:client
build:ssg or framework prerender
seo:postbuild
fallback:404
seo:validate
```

Rules:

- Avoid hiding too much behind `prebuild` and `postbuild` until the flow is stable.
- If the main `build` script explicitly runs `generate:curriculum`, remove or adjust the existing `prebuild` script so generation does not run twice.
- `generate:seo-manifest` may be a separate command or part of `generate:curriculum`, but ownership must be clear.
- `fallback:404` must generate a dedicated Not Found + `noindex` document, not blindly copy `dist/index.html`.
- If `fallback:404` is separate from `seo:postbuild`, run final SEO validation after the fallback file exists.
- CI/GitHub Actions should use the same ordered build steps as local production validation.

### Decision: Pre-render Output Budgets

Define output and build-time budgets before scaling from the POC to every sitemap-eligible route.

Initial budgets to choose during the POC:

- Maximum total `dist` size.
- Maximum HTML file size per route.
- Maximum serialized route-data JSON size per route.
- Maximum number of pre-rendered routes in the first sitemap release.
- Maximum production build time.

Important risk:

If each content route includes full rendered HTML and also serializes full Markdown as route data, output size can grow quickly. Prefer the smallest route data needed for hydration, and measure the POC before generating every topic page.

### Acceptance Criteria

- `https://www.dev-net-core.com/sitemap.xml` is accessible.
- The sitemap includes all required sitemap-eligible routes that have validated static/pre-rendered production output.
- Every curriculum topic has a `/content/:topicId/` entry.
- `/practice/:topicId/` routes are intentionally excluded from the first SEO sitemap pass.
- Sitemap URLs are absolute canonical URLs, not relative paths.
- Sitemap URLs use the trailing-slash format.
- Sitemap URLs are indexable, direct-loadable, not redirected, not blocked by `robots.txt`, and not marked `noindex`.
- Every sitemap URL has route-specific source HTML metadata and visible page content in source HTML.
- Every sitemap-included content URL receives Markdown and curriculum metadata before pre-rendering.
- Every sitemap-included content URL hydrates with the same initial route data used during pre-rendering.
- No sitemap-included content URL renders `Loading content...` as its primary source HTML content.
- Sitemap generation uses manifest `canonicalPath` values for content pages.
- Sitemap and pre-render generation use the Node-readable SEO manifest, not the TypeScript app manifest.
- Generated route HTML is based on `dist/index.html` and preserves Vite-generated hashed asset references.
- Generated route HTML includes safe serialized route data only when needed for hydration.
- The private server/static render build output is not deployed to GitHub Pages.
- Sitemap generation omits `<lastmod>` unless a reliable automated source can provide an accurate value.
- Sitemap generation does not include `<priority>` or `<changefreq>`.
- SEO postbuild output does not break `npm run build`.
- Local development does not require production sitemap generation.

### Decision: Practice Topic Indexing

For the first SEO pass, do not pre-render or index `/practice/:topicId/` pages.

Use `/content/:topicId/` as the primary SEO landing page and source of truth for each curriculum topic. Treat `/practice/:topicId/` as an interactive app workflow route for users who want to practice after reading the topic content.

Initial indexing strategy:

```txt
Index and include in sitemap after static/pre-render validation:
/
/content/
/content/:topicId/
/roadmap/
/about-us/
/privacy/
/terms/

Optional index and sitemap only if intentionally designed to rank:
/changelog/
/simulation/

Do not include in sitemap initially:
/practice/
/practice/:topicId/
/simulation/*
/bug-report/

Add noindex initially:
/practice/:topicId/
/simulation/*
/bug-report/
```

Rules:

- `/content/:topicId/` pages should be the canonical searchable landing pages.
- `/practice/:topicId/` pages should be linked from their corresponding content pages for user flow.
- `/practice/:topicId/` pages should not be included in the sitemap until they are intentionally designed as standalone searchable Q&A landing pages.
- `/practice/:topicId/` pages should use `noindex` initially to avoid thin-content or duplicate-intent indexing risk.
- `/practice/` itself should not be included in the first sitemap pass unless it has enough visible source HTML content and is intended to rank as a practice landing page.
- `/simulation/` itself may remain indexable only if it has enough visible source HTML content and is intended to rank as a stable public tool landing route.
- `/simulation/*` session, result, or user-flow routes should use `noindex` and should not be included in the sitemap.

Only consider indexing `/practice/:topicId/` later if those pages become strong standalone pages with:

- Unique title and description
- Enough meaningful initial HTML content
- Clear question/answer content visible without relying only on interaction
- Distinct purpose from the corresponding content page
- Self-canonical URL
- Structured data only if it accurately matches the visible content and Google guidelines

## Phase 3: Crawlable Internal Links

### 3. Ensure Topic Links Use Real Anchors

Search engines discover links through real HTML anchor tags.

Ensure navigation to topic pages renders links with valid `href` values.

Good:

```tsx
<Link to="/content/classes-structs-records/">
  Classes, Structs, and Records
</Link>
```

Also good:

```tsx
<a href="/content/classes-structs-records/">
  Classes, Structs, and Records
</a>
```

Avoid:

```tsx
<button onClick={() => navigate("/content/classes-structs-records/")}>
  Classes, Structs, and Records
</button>
```

Buttons are fine for app interactions, but important SEO navigation should also be available through real links.

### Decision: Curriculum Link Semantics

Follow the crawlable-link plan with a targeted navigation semantics change, not a redesign.

Keep curriculum folder rows as `<button>` elements because expanding and collapsing categories such as `.NET`, `React`, `SQL`, and `Azure` is UI state.

Change only curriculum subtopic leaf rows from `<button>` to real React Router links.

Recommended shape:

```tsx
<RouterLink
  to={`/content/${node.id}/`}
  onClick={() => onSelectTopic(node)}
>
  ...
</RouterLink>
```

Use trailing-slash URLs to match the canonical URL decision:

```tsx
to={`/content/${node.id}/`}
```

Do not use:

```tsx
to={`/content/${node.id}`}
```

Preserve:

- Existing visual styling
- Active row styling
- Icons
- Progress display
- Indentation
- Expanded folder state
- Redux/internal selected topic behavior

This still works with the React SPA model and improves internal link semantics, accessibility, browser behavior, and consistency with sitemap/canonical URLs. However, crawlers will only see these generated links after JavaScript renders the app until pre-rendering/static generation is added later.

### Files to Inspect

Likely files:

```txt
src/components/content/CurriculumTreeView.tsx
src/components/content/LeftContentPanel.tsx
src/components/content/RightContentPanel.tsx
src/pages/Practice.tsx
src/pages/Content.tsx
```

### Acceptance Criteria

- Important content and practice pages are reachable through real links.
- Navigation still works normally in the React app.
- Existing UI behavior is preserved.
- Folder expand/collapse controls remain buttons.
- Curriculum subtopic rows render real links with trailing-slash `href` values.
- Existing non-trailing route support may remain temporarily for compatibility.

## Phase 4: Dynamic Metadata

### 4. Add SEO Metadata Support

Each important route should have a unique:

- `<title>`
- `<meta name="description">`
- `<link rel="canonical">`
- Open Graph title
- Open Graph description
- Open Graph URL
- Open Graph type
- Open Graph image
- Open Graph image width, height, and alt text
- X/Twitter Card metadata

Recommended package:

```bash
npm install react-helmet-async
```

Create a reusable component, for example:

```txt
src/components/seo/Seo.tsx
```

Example:

```tsx
import { Helmet } from "react-helmet-async";

const DEFAULT_OG_IMAGE_URL =
  "https://www.dev-net-core.com/og/default-og-image.png";
const DEFAULT_OG_IMAGE_ALT = "DEV_NET_CORE developer interview preparation";

type SeoProps = {
  title: string;
  description: string;
  canonicalPath: string;
  noindex?: boolean;
  ogImageAlt?: string;
  ogImageUrl?: string;
};

export function Seo({
  title,
  description,
  canonicalPath,
  noindex = false,
  ogImageAlt = DEFAULT_OG_IMAGE_ALT,
  ogImageUrl = DEFAULT_OG_IMAGE_URL,
}: SeoProps) {
  const canonicalUrl = `https://www.dev-net-core.com${canonicalPath}`;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {noindex ? <meta name="robots" content="noindex" /> : null}

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={ogImageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={ogImageAlt} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImageUrl} />
    </Helmet>
  );
}
```

Wrap the app with `HelmetProvider`.

## Important Note About Dynamic Metadata

Using `react-helmet-async` improves metadata after the React app runs, and it can help Google because Google is able to render JavaScript in many cases.

However, this does not guarantee that metadata exists in the initial HTML response.

This matters because many social preview crawlers, link unfurlers, and non-Google bots do not reliably execute JavaScript before reading Open Graph or X/Twitter Card tags.

Therefore:

- `react-helmet-async` is useful as an interim SPA metadata solution.
- It should not be considered a complete solution for social previews.
- Reliable per-page Open Graph previews require metadata to exist in the initial HTML.
- For DEV_NET_CORE, true per-topic SEO/social metadata should eventually be generated through pre-rendering, static HTML generation, SSR, or another build-time HTML generation strategy.

Recommended priority:

1. Add safe site-wide default metadata in `index.html`.
2. Use `react-helmet-async` for in-app route metadata as a short-term improvement.
3. Generate initial HTML metadata for `/content/:topicId/` pages through pre-rendering/static generation.

### Decision: Metadata-Only Static HTML Shell

A metadata-only static HTML shell is allowed as an interim improvement for default head tags and social previews.

This means the initial HTML may include route-specific or site-wide:

- `<title>`
- Meta description
- Canonical URL
- Open Graph tags
- X/Twitter Card tags

However, a metadata-only shell is not sufficient for sitemap inclusion.

Rules:

- A metadata-only shell may improve social preview reliability and basic head metadata before JavaScript runs.
- It should not be treated as validated static output for a sitemap URL.
- A sitemap URL must include visible route content in source HTML, not only metadata plus a generic React app shell.
- `/content/:topicId/` URLs should not be submitted in the production sitemap based only on metadata-only HTML.
- Metadata-only output can be used as a stepping stone while full SSG/pre-rendered content output is being implemented.

### Decision: Default Social Preview Asset

Create one default social preview image for DEV_NET_CORE.

Recommended file:

```txt
public/og/default-og-image.png
```

Recommended URL:

```txt
https://www.dev-net-core.com/og/default-og-image.png
```

Recommended dimensions:

```txt
1200x630
```

Recommended format:

```txt
PNG
```

Fallback behavior:

- Every page should have an `og:image`.
- If a page does not define a custom image, use the default image.
- Content pages may later define custom `ogImage` in frontmatter.
- The image URL must be absolute.
- The image must be publicly accessible.
- The image should not require JavaScript to load.
- The same image can be used for Twitter/X card metadata.

Required Open Graph fields should include:

```html
<meta property="og:title" content="..." />
<meta property="og:type" content="website" />
<meta property="og:url" content="..." />
<meta property="og:image" content="https://www.dev-net-core.com/og/default-og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="DEV_NET_CORE developer interview preparation" />
```

Optional Twitter/X fields:

```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="..." />
<meta name="twitter:description" content="..." />
<meta name="twitter:image" content="https://www.dev-net-core.com/og/default-og-image.png" />
```

Open Graph's required basic metadata includes `og:title`, `og:type`, `og:image`, and `og:url`. It also supports image width, height, type, and alt metadata.

Important caveat: for reliable social previews, the default `og:image` and site-wide fallback Open Graph tags should exist in the initial HTML. Route-specific React metadata is useful, but social preview crawlers may not execute JavaScript before reading tags.

### Decision: Metadata Source of Truth

SEO metadata should come from Markdown frontmatter where possible.

Required for indexable content pages after transition:

- `seoTitle`
- `seoDescription`

Generated or optional:

- `canonicalPath`

Fallbacks are allowed, but they should be treated as temporary.

Fallback example:

- `seoTitle`: `[subtopic] Interview Questions | DEV_NET_CORE`
- `seoDescription`: `Learn [subtopic] for technical interviews, including core concepts, practical examples, common mistakes, and interview questions.`
- `canonicalPath`: `/content/[id]/`
- `lastmod`: omitted

Generated descriptions such as `Learn [topic] for interviews...` are acceptable as a fallback, but every content page should not use the same repeated pattern when custom metadata is available.

Do not generate repetitive descriptions for all pages if custom metadata is available.

Example frontmatter:

```md
---
id: async-await
topic: C# Language Foundations
subtopic: Async/Await
category: .NET
seoTitle: Async and Await in C# Interview Questions
seoDescription: Learn async and await in C# for technical interviews, including Task, I/O-bound work, cancellation, exception handling, and common deadlock risks.
canonicalPath: /content/async-await/
---
```

Notes:

- `canonicalPath` should use the trailing-slash format defined in the canonical URL decision.
- `canonicalPath` can be derived from `id` by default and should only be overridden when needed.
- `lastmod` should not be maintained manually in Markdown frontmatter.

### Decision: Manifest SEO Field Support

The current curriculum manifest only supports the fields needed for curriculum navigation and question extraction.

Before generating high-quality sitemap and metadata output, extend the Markdown frontmatter parser and generated manifests to support SEO fields.

Required for indexable content pages after transition:

```yaml
seoTitle: Async and Await in C# Interview Questions
seoDescription: Learn async and await in C# for technical interviews, including Task, cancellation, exception handling, and common deadlock risks.
```

Generated or optional:

```yaml
canonicalPath: /content/async-await/
```

Implementation tasks:

1. Update Markdown frontmatter parsing.
2. Extend the React/TypeScript manifest entry type.
3. Generate a Node-readable SEO manifest such as `shared/content/curriculumSeoManifest.generated.json`.
4. Include `seoTitle`, `seoDescription`, generated-or-overridden `canonicalPath`, and content path data needed by the SEO postbuild script.
5. Add validation for:
   - Missing `seoTitle` after the transition period
   - Missing `seoDescription` after the transition period
   - Duplicate `canonicalPath`
   - `canonicalPath` not starting with `/content/`
   - `canonicalPath` not ending with `/`
   - `canonicalPath` not matching the selected trailing-slash canonical format
6. Update sitemap generation to use `canonicalPath`.
7. Omit `<lastmod>` unless a reliable automated source can generate it accurately.
8. Use fallback metadata only during transition.

Fallbacks:

- `seoTitle`: `[subtopic] Interview Questions | DEV_NET_CORE`
- `seoDescription`: `Learn [subtopic] for technical interviews, including core concepts, practical examples, common mistakes, and interview questions.`
- `canonicalPath`: `/content/[id]/`
- `lastmod`: omit

Do not generate `<priority>` or `<changefreq>` in the sitemap. Google ignores those fields. Do not manually maintain `<lastmod>` values; only include `<lastmod>` later if the build has a consistently accurate automated source.

### Decision: Node-Readable SEO Manifest

The curriculum generation step must output a Node-readable SEO manifest.

Suggested file:

```txt
shared/content/curriculumSeoManifest.generated.json
```

Purpose:

- Let `scripts/seo-postbuild.mjs` generate route HTML, metadata, and sitemap output without importing TypeScript files at runtime.
- Avoid dependence on Vite-only imports, `import.meta.glob`, React app internals, or TypeScript runtime execution.
- Keep content and SEO data stable across Node scripts and React hydration.

The SEO manifest should include enough data for:

- Static content route generation
- Sitemap URL generation
- Metadata generation
- Markdown file loading
- Route data generation
- Validation

Example shape:

```json
{
  "topics": [
    {
      "id": "async-await",
      "category": ".NET",
      "topic": "C# Language Foundations",
      "subtopic": "Async/Await",
      "contentPath": "/src/contents/v1/NET/async-await.md",
      "canonicalPath": "/content/async-await/",
      "seoTitle": "Async and Await in C# Interview Questions",
      "seoDescription": "Learn async and await in C# for technical interviews, including Task, cancellation, exception handling, and common deadlock risks."
    }
  ]
}
```

Rules:

- The JSON manifest is for Node SEO tooling.
- The TypeScript manifest is for the React application.
- Both outputs should be generated by the same curriculum generation step.
- The SEO postbuild script should consume the JSON manifest, not the TypeScript manifest.
- The JSON manifest should not include full Markdown content unless there is a specific reason; prefer storing content paths and reading Markdown during route-data generation.

### Decision: Content Path Mapping for Node SEO Tools

Manifest `contentPath` values are Vite/browser paths, such as:

```txt
/src/contents/v1/NET/async-await.md
```

Node SEO tooling must resolve these paths to filesystem paths safely.

Rules:

- Resolve manifest `contentPath` values relative to the project root.
- Only allow paths under `src/contents/v1`.
- Reject paths containing traversal attempts such as `..`.
- Reject paths outside the expected content root.
- Read Markdown with Node `fs`.
- Do not use `import.meta.glob` in SEO postbuild or route-data loading.

### Decision: Metadata Source-of-Truth Pipeline

Use one metadata pipeline for sitemap generation, pre-rendered HTML, and React route metadata:

```txt
Markdown frontmatter -> generated manifest -> sitemap -> pre-render HTML -> React route metadata
```

Rules:

- Markdown frontmatter is the authoring source for `seoTitle`, `seoDescription`, and optional `canonicalPath` overrides.
- The generated manifest is the application source of truth consumed by SEO scripts and React routes.
- Sitemap generation, pre-rendered source HTML, and `react-helmet-async` route metadata should use the same manifest-backed metadata builder.
- Use `shared/seo/buildSeoMetadata.mjs` as the shared metadata builder.
- Keep the shared metadata builder boring, pure, and dependency-free.
- Do not use React, Vite-only features, browser-only APIs, or TypeScript runtime loading in the shared metadata builder.
- Add a small type bridge such as `shared/seo/buildSeoMetadata.d.ts` if TypeScript imports from React code need explicit types.
- Validate that the React TypeScript build can import the shared `.mjs` module without weakening type checking.
- Do not duplicate route titles, descriptions, canonical URLs, or Open Graph URLs in separate hardcoded maps.
- If source HTML metadata and hydrated React metadata disagree, treat it as a bug.

### Decision: Content Route Data for Pre-rendering and Hydration

Pre-rendered content pages must receive Markdown and curriculum metadata as route data before rendering.

The client must hydrate with the same initial route data used during pre-rendering.

Purpose:

- Prevent `/content/:topicId/` pre-rendered HTML from containing only `Loading content...`.
- Ensure source HTML contains visible Markdown-derived article content before JavaScript runs.
- Keep pre-rendered markup and the first client render aligned to avoid hydration mismatch.
- Keep the URL route parameter as the source of truth for content pages.

Rules:

- The pre-render script must load the selected topic's Markdown and curriculum metadata before rendering the route.
- Content route data should include at least the topic, raw or body Markdown, SEO metadata, and canonical path.
- The server/static render entry should receive this route data before rendering `/content/:topicId/`.
- The server/static render entry should receive route data through the explicit `renderRoute` API.
- The generated HTML should safely serialize the same route data for the client.
- The client entry should read the serialized route data before hydration.
- The serialized route data should be written only through the managed route-data template slot.
- Serialized route data should include the minimum data needed for hydration.
- Strip frontmatter before serializing Markdown unless the client explicitly needs it.
- Escape serialized JSON so Markdown cannot break out of the script tag.
- Validate that serialized route data handles `<`, `>`, `&`, `</script>`, and Unicode line separator characters safely.
- `Content.tsx` should use preloaded route data when it matches the current URL topic ID.
- If preloaded route data is missing or does not match the current URL, the client can fall back to the existing client-side load path.
- Persisted Redux selected-topic state must not override the URL topic during hydration.
- Invalid topic IDs should render Not Found + `noindex`, not redirect to the first available topic.
- Sitemap-eligible content pages must never rely on effect-only Markdown loading for their source HTML.

Example route data shape:

```js
{
  topic: {
    id: "async-await",
    topic: "C# Language Foundations",
    subtopic: "Async/Await",
    category: ".NET"
  },
  markdown: "...",
  metadata: {
    title: "Async and Await in C# Interview Questions",
    description: "...",
    canonicalUrl: "https://www.dev-net-core.com/content/async-await/",
    ogUrl: "https://www.dev-net-core.com/content/async-await/"
  },
  canonicalPath: "/content/async-await/"
}
```

### Decision: Machine-Readable SEO Route Config

Create one machine-readable SEO route config used by sitemap generation, metadata generation, pre-rendering, and validation.

Suggested file:

```txt
shared/seo/seoRoutes.mjs
```

Purpose:

- Keep route indexability decisions in code, not only in the Markdown route matrix.
- Prevent sitemap, metadata, pre-render, and validation logic from drifting into separate hardcoded route lists.
- Give `scripts/seo-postbuild.mjs` one source for static sitemap-eligible routes.
- Give React route metadata one source for public route canonical/index/noindex behavior.

Example shape:

```js
export const staticSeoRoutes = [
  { path: "/", sitemap: true, index: true, prerender: true },
  { path: "/content/", sitemap: true, index: true, prerender: true },
  { path: "/roadmap/", sitemap: true, index: true, prerender: true },
  { path: "/about-us/", sitemap: true, index: true, prerender: true },
  { path: "/privacy/", sitemap: true, index: true, prerender: true },
  { path: "/terms/", sitemap: true, index: true, prerender: true },
  { path: "/bug-report/", sitemap: false, index: false, prerender: false },
];
```

Rules:

- The route config must match the route indexability matrix.
- Sitemap generation, pre-rendering, and local SEO validation should consume this config.
- Content topic routes should be generated from the curriculum manifest and then merged with this static route config.
- A route marked `sitemap: true` must also be canonical, indexable, pre-rendered/static, and production validated.
- App-only routes should remain out of the sitemap by default.

### Decision: Content Readiness

Do not add a separate `seoReady` or content-readiness flag for the first SEO pass.

For DEV_NET_CORE, a curriculum subtopic is considered ready for sitemap generation when it has a valid Markdown file in the curriculum source and passes manifest/frontmatter validation.

Rules:

- If a subtopic has a valid `.md` file, it is eligible for `/content/:topicId/`.
- The page still must pass metadata, sitemap, pre-render, and production validation before it is exposed in the production sitemap.
- Do not introduce a separate per-topic readiness flag unless content publishing needs become more complex later.

### Metadata Rules

Use these patterns:

Homepage:

```txt
Title: DEV_NET_CORE | Developer Interview Preparation
Description: Structured interview preparation for .NET, React, SQL, Azure, architecture, and modern software engineering topics.
Canonical: https://www.dev-net-core.com/
```

Content page:

```txt
Title: [Subtopic Name] Interview Questions | DEV_NET_CORE
Description: Learn [Subtopic Name] for technical interviews, including core concepts, practical examples, common mistakes, and interview questions.
Canonical: https://www.dev-net-core.com/content/[topicId]/
```

Practice page:

```txt
Title: Practice [Subtopic Name] Interview Questions | DEV_NET_CORE
Description: Practice [Subtopic Name] interview questions with expected answers, key points, and topic progress tracking.
Canonical: https://www.dev-net-core.com/practice/[topicId]/
```

Simulation page:

```txt
Title: Mock Interview Simulation | DEV_NET_CORE
Description: Practice a realistic technical interview session by selecting focus topics, difficulty level, and question count.
Canonical: https://www.dev-net-core.com/simulation/
```

### Acceptance Criteria

- Important pages have unique browser titles.
- Important pages have unique meta descriptions.
- Content pages use Markdown frontmatter metadata where available.
- The generated curriculum manifest exposes `seoTitle`, `seoDescription`, and `canonicalPath` for content pages.
- Manifest validation catches duplicate or malformed canonical paths.
- Generated metadata fallbacks are available but not treated as the final long-term content strategy.
- Invalid routes use `noindex`.
- Metadata does not break routing or rendering.

## Phase 5: Canonical URLs and Invalid Route Handling

### 5. Add Canonical URLs

Every indexable route should have one canonical URL.

Use:

```txt
https://www.dev-net-core.com
```

as the production domain.

Avoid duplicate canonical versions such as:

```txt
https://dev-net-core.com
https://www.dev-net-core.com
https://www.dev-net-core.com/content/topic
https://www.dev-net-core.com/content/topic/
```

Pick one consistent URL format.

Recommended:

```txt
Trailing slash for canonical URLs
```

Example:

```txt
https://www.dev-net-core.com/content/classes-structs-records/
```

### Decision: Trailing-Slash Canonical URLs

DEV_NET_CORE should use trailing-slash URLs as the canonical format for public indexable routes.

Reason:

- Static pre-rendering commonly outputs `/route/index.html`.
- That naturally maps to `/route/`.
- The app already accepts trailing-slash route variants for important topic routes.
- This avoids fighting the hosting platform later.

Examples:

```txt
https://www.dev-net-core.com/content/async-and-await-semantics-in-csharp/
https://www.dev-net-core.com/practice/async-and-await-semantics-in-csharp/
https://www.dev-net-core.com/roadmap/
https://www.dev-net-core.com/
```

Use the same trailing-slash format for:

- Canonical URLs
- Sitemap entries
- Open Graph URLs
- X/Twitter Card URLs
- Structured data URLs
- Internal generated links

Non-trailing versions may continue to work for user convenience, but they should not be used in sitemap URLs, canonical tags, Open Graph URLs, X/Twitter Card URLs, structured data URLs, or internal generated links.

Practical caveat: static public routes such as `/roadmap/`, `/about-us/`, and `/simulation/` should be explicitly supported in React Router and verified in production so canonical trailing-slash URLs work correctly.

### 6. Handle Invalid Routes

Invalid content or practice routes should not be indexed.

For invalid routes:

- Show a real Not Found page in the app.
- Add:

```html
<meta name="robots" content="noindex">
```

This avoids soft-404 indexing issues.

### Decision: Invalid Topic Routes

Invalid topic routes should show a Not Found experience with `noindex`, not redirect to the first available topic.

Recommended behavior:

```txt
/content/                  Valid index/welcome page
/content/valid-topic-id/   Valid topic page
/content/bad-topic-id/     Not Found + noindex
/practice/                 Valid practice index page
/practice/valid-topic-id/  Valid practice topic page
/practice/bad-topic-id/    Not Found + noindex
```

Rules:

- `/content/` with no topic remains a valid index/welcome route.
- `/practice/` with no topic remains a valid practice index route.
- Valid `/content/:topicId/` and `/practice/:topicId/` routes render the requested topic.
- Valid topic pages use canonical trailing-slash URLs.
- Invalid `/content/:topicId/` and `/practice/:topicId/` routes render the app's `NotFound` page or a clear topic-specific Not Found state.
- Invalid routes include `<meta name="robots" content="noindex">`.
- Invalid routes should not redirect to the first topic, because that can make bad URLs look like real curriculum pages and may create soft-404 or duplicate-content signals.
- Unknown global routes should continue to use the app's Not Found behavior and should also include `noindex`.

If pre-rendering/static generation is added later, generate only valid topic pages. Invalid generated/static paths should return real 404 behavior where the hosting setup allows it.

### Decision: Production Hosting and Redirect Authority

Production hosting is GitHub Pages with a Cloudflare-managed custom domain.

Cloudflare is used for domain/DNS management. It should not be treated as the application host unless the site is explicitly migrated to Cloudflare Pages or Cloudflare proxy/rules are configured.

Redirect and rewrite behavior should be assumed to come from GitHub Pages unless Cloudflare proxy/rules are explicitly enabled and documented.

Rules:

- Valid sitemap URLs must resolve to real GitHub Pages-served static files or another verified `200 OK` production response.
- Valid sitemap URLs must not depend on the generic `404.html` SPA fallback.
- Do not assume Cloudflare enforces trailing-slash redirects unless Cloudflare proxy/rules are configured.
- If Cloudflare rules are used later, document the exact rules and validate them in production.
- If Cloudflare Pages replaces GitHub Pages later, update this plan before relying on Cloudflare Pages routing behavior.

Current deployment note: the GitHub Actions workflow creates an SPA fallback by copying `dist/index.html` to `dist/404.html`. That fallback may make browser navigation appear to work, but it must not be the only mechanism supporting URLs included in `sitemap.xml`.

### Decision: SSG-Only Hosting Model for GitHub Pages

DEV_NET_CORE should use SSR-style rendering only at build time while the site remains hosted on GitHub Pages.

GitHub Pages can serve static HTML, CSS, JavaScript, images, and generated route files, but it cannot run a React SSR server per request.

Rules:

- Keep GitHub Pages as the production host for the current SEO plan.
- Use the SSR/SSG readiness refactor to generate static HTML during the build.
- Do not introduce request-time SSR unless the project intentionally migrates hosting.
- Generated sitemap URLs must map to static files in `dist`, such as `dist/content/async-await/index.html`.
- The build may use React SSR APIs internally, but the deployed output must remain static.
- If runtime SSR becomes a future requirement, create a separate hosting migration plan before changing the deployment target.

Expected static deployment flow:

```txt
npm run build
-> Vite client build
-> SEO/SSG postbuild renders static HTML route files
-> dist contains route index.html files, sitemap.xml, assets, and optional 404.html fallback
-> GitHub Pages deploys dist
```

### Decision: Deployment and Status-Code Handling

Every URL included in `sitemap.xml` must return `200 OK` on direct load without depending on a generic GitHub Pages-style `404.html` fallback as the only route handling mechanism.

Invalid routes should return a real `404` where the hosting platform allows it. If true 404 status handling is not practical because of SPA routing, invalid/error routes must render a clear Not Found page and include:

- `<meta name="robots" content="noindex">`
- A clear page title such as `Page Not Found | DEV_NET_CORE`
- No sitemap entry
- No internal links pointing to the invalid URL
- No redirect to the first topic or another valid content page

Invalid routes should not use canonical tags that point to valid topic pages, because that can make bad URLs look like alternate versions of real content.

Follow the `noindex` vs `robots.txt` decision from Phase 1 for invalid SPA routes.

### Decision: Dedicated Static 404 Output

If `dist/404.html` is needed for GitHub Pages SPA fallback behavior, generate it as a dedicated Not Found document instead of blindly copying `dist/index.html`.

Rules:

- `dist/404.html` should render a clear Not Found page in source HTML.
- `dist/404.html` should include `noindex`.
- `dist/404.html` should not include a canonical tag pointing to a valid content route.
- `dist/404.html` should not be listed in `sitemap.xml`.
- The SEO postbuild script should generate or validate the dedicated `404.html` output.
- A workflow fallback copy step must not overwrite a dedicated `404.html` generated by SEO postbuild.
- If the dedicated `404.html` hydrates into the React app, it must still keep Not Found + `noindex` behavior for invalid routes.
- No sitemap URL may be considered valid merely because it can be reached through `404.html`.

### Decision: Route Indexability Matrix

Use this matrix to decide which routes belong in the sitemap, which routes are indexable, and how non-canonical variants should behave.

Rules:

- Only rows with `Sitemap = Yes` should appear in `sitemap.xml`.
- `Sitemap = Yes` means indexable + canonical + static/pre-rendered + production validated.
- Sitemap URLs must be the final canonical trailing-slash URLs.
- Non-trailing variants should preferably redirect with `301` to the trailing-slash canonical URL.
- If the host cannot do real redirects, non-trailing variants may return `200`, but they must use canonical tags pointing to the trailing-slash URL and must not appear in the sitemap.
- Invalid routes should not have canonical tags that point to real content pages.
- Routes not currently supported with trailing slashes must be explicitly supported before they are used as canonical URLs.

| Route | Sitemap | Index | Canonical | Redirect | Expected status |
|---|---:|---:|---|---|---|
| `/` | Yes | Yes | `/` | No | 200 |
| `/home` | No | Canonical target only | `/` | Prefer redirect to `/` | 301 preferred, 200 acceptable |
| `/home/` | No | Canonical target only | `/` | Prefer redirect to `/` | 301 preferred, 200 acceptable |
| `/content` | No | Canonical target only | `/content/` | Prefer redirect to `/content/` | 301 preferred, 200 acceptable |
| `/content/` | Yes | Yes | `/content/` | No | 200 |
| `/content/:topicId` | No | Canonical target only | `/content/:topicId/` | Prefer redirect to trailing slash | 301 preferred, 200 acceptable |
| `/content/:topicId/` | Yes | Yes | `/content/:topicId/` | No | 200 |
| `/practice` | No | Canonical target only | `/practice/` | Prefer redirect to `/practice/` | 301 preferred, 200 acceptable |
| `/practice/` | No by default | Optional landing index | `/practice/` | No | 200 |
| `/practice/:topicId` | No | Noindex or canonical target only | `/practice/:topicId/` | Prefer redirect to trailing slash | 301 preferred, 200 acceptable |
| `/practice/:topicId/` | No unless intentionally indexable | Noindex first | `/practice/:topicId/` | No | 200 |
| `/simulation` | No | Canonical target only | `/simulation/` | Prefer redirect to `/simulation/` | 301 preferred, 200 acceptable |
| `/simulation/` | Optional landing only | Optional landing index | `/simulation/` | No | 200 |
| `/simulation/setup` | No | Noindex | `/simulation/setup/` | Prefer redirect to trailing slash | 301 preferred, 200 acceptable |
| `/simulation/setup/` | No | Noindex | `/simulation/setup/` | No | 200 |
| `/simulation/session/:sessionId` | No | Noindex | None or self | No | 200 |
| `/simulation/result/:sessionId` | No | Noindex | None or self | No | 200 |
| `/roadmap` | No | Canonical target only | `/roadmap/` | Prefer redirect to `/roadmap/` | 301 preferred, 200 acceptable |
| `/roadmap/` | Yes | Yes | `/roadmap/` | No | 200 |
| `/about-us` | No | Canonical target only | `/about-us/` | Prefer redirect to `/about-us/` | 301 preferred, 200 acceptable |
| `/about-us/` | Yes | Yes | `/about-us/` | No | 200 |
| `/changelog` | No | Canonical target only | `/changelog/` | Prefer redirect to `/changelog/` | 301 preferred, 200 acceptable |
| `/changelog/` | Optional | Optional | `/changelog/` | No | 200 |
| `/bug-report` | No | Noindex | `/bug-report/` | Prefer redirect to `/bug-report/` | 301 preferred, 200 acceptable |
| `/bug-report/` | No | Noindex | `/bug-report/` | No | 200 |
| `/privacy` | No | Canonical target only | `/privacy/` | Prefer redirect to `/privacy/` | 301 preferred, 200 acceptable |
| `/privacy/` | Yes | Yes | `/privacy/` | No | 200 |
| `/terms` | No | Canonical target only | `/terms/` | Prefer redirect to `/terms/` | 301 preferred, 200 acceptable |
| `/terms/` | Yes | Yes | `/terms/` | No | 200 |
| Invalid routes | No | Noindex | None | Prefer real 404 route | 404 where possible, otherwise 200 + noindex |

`/content/:topicId/` is the main SEO asset for each curriculum topic. `/practice/:topicId/` is useful for users, but should stay `noindex` at first unless those pages are intentionally written with unique visible content.

Google warns that SPA error pages can cause soft 404s. For client-side routing, prefer redirecting to a URL that returns a real `404` where practical, or add `noindex` to error pages when true 404 status handling is not practical.

### Decision: Deep-Link UX Matrix

Use this matrix to separate SEO sitemap requirements from app-only deep-link behavior.

Routes included in the sitemap must never depend on the generic SPA `404.html` fallback. App-only routes may use the fallback when needed, but they must stay out of the sitemap and use `noindex` when crawlable.

| Route | SEO sitemap? | Direct-load status required? | Static artifact? | Accept 404 fallback? | Notes |
|---|---:|---:|---:|---:|---|
| `/` | Yes | `200` | Yes | No | Main homepage. Must be fully production-ready. |
| `/home/` | No | Optional | Optional | No | Prefer redirect/canonical to `/`, or remove from sitemap. |
| `/content/` | Yes | `200` | Yes | No | Curriculum landing page. |
| `/content/:topicId/` | Yes | `200` | Yes | No | Main SEO target pages. Must have static/pre-rendered HTML. |
| `/practice/` | No by default | `200` if public | Optional | Yes if noindex/app-only | Useful app page, but not primary SEO page. |
| `/practice/:topicId/` | No by default | `200` if public | Optional | Yes if noindex/app-only | Prefer noindex unless it has unique searchable content. |
| `/simulation/` | Optional | `200` if indexed | Required only if sitemap yes | No if sitemap yes | Include only if landing page has real content. |
| `/simulation/setup/` | No | `200` if public app flow | No | Yes | App flow page, not search target. Add noindex if crawled. |
| `/simulation/session/:sessionId/` | No | `200` or app fallback | No | Yes | Session-specific route. Must not be in sitemap. Noindex. |
| `/simulation/result/:sessionId/` | No | `200` or app fallback | No | Yes | Session-specific route. Must not be in sitemap. Noindex. |
| `/roadmap/` | Yes | `200` | Yes | No | Index only if it has meaningful visible content. |
| `/about-us/` | Yes | `200` | Yes | No | Brand/about page. |
| `/changelog/` | Optional | `200` if indexed | Required only if sitemap yes | No if sitemap yes | Include only if you want it indexed. |
| `/bug-report/` | No | `200` if public | No | Yes | Utility page. Noindex. |
| `/privacy/` | Yes | `200` | Yes | No | Legal page. |
| `/terms/` | Yes | `200` | Yes | No | Legal page. |
| Non-trailing variants | No | Prefer redirect to trailing slash | No | No | Example: `/content/topic` -> `/content/topic/`. |
| Invalid routes | No | Prefer real `404` | No | Yes | If SPA fallback makes this `200`, render clear Not Found + `noindex`. |

### Acceptance Criteria

- Valid pages have canonical URLs.
- Every URL included in `sitemap.xml` returns `200 OK` on direct load.
- The route indexability matrix is implemented or explicitly verified for production behavior.
- The deep-link UX matrix is implemented or explicitly verified for production behavior.
- Non-canonical route variants redirect to or canonicalize to their trailing-slash canonical URL.
- Invalid pages are not indexable.
- Existing user navigation still works.
- Invalid topic IDs do not redirect to the first topic.
- `/content/` and `/practice/` index routes remain valid.

## Phase 6: Structured Data

### 7. Add Website Structured Data

On the homepage, add JSON-LD:

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "DEV_NET_CORE",
  "url": "https://www.dev-net-core.com/",
  "description": "A developer-focused interview preparation website for .NET, React, SQL, Azure, architecture, and software engineering topics."
}
```

### 8. Add Article Structured Data for Content Pages

For each content topic, add JSON-LD like:

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Async/Await in C# Interview Questions",
  "description": "Learn async and await in C# for technical interviews.",
  "url": "https://www.dev-net-core.com/content/async-await/",
  "author": {
    "@type": "Person",
    "name": "Minh Vu"
  }
}
```

### Recommended Implementation

Generate structured data from the shared metadata builder and inject it into source HTML through SEO postbuild.

The React SEO component may mirror the same JSON-LD after hydration, but it should not be the source of truth for sitemap URLs.

Example:

```html
<script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Article"}
</script>
```

Make sure JSON is valid and does not include undefined values.

Rules:

- Use the same route metadata source as canonical, Open Graph, and Twitter/X tags.
- Keep JSON-LD aligned with visible page content.
- Inject JSON-LD into pre-rendered source HTML for every sitemap URL where structured data is used.
- Validate JSON-LD against Google's structured data rules before deployment.
- Do not emit structured data for routes where the visible source content does not support it.

### Acceptance Criteria

- Homepage includes valid `WebSite` structured data.
- Content pages include valid `Article` structured data.
- Structured data matches visible page content.
- Structured data exists in source HTML for sitemap URLs after pre-render/static generation.
- Structured data can be validated using Google Rich Results Test or Schema Markup Validator.

## Phase 7: Markdown Content SEO Improvements

### 9. Improve Topic Titles

Each Markdown topic should have a clear H1 that includes search intent.

Good:

```md
# Async/Await in C# Interview Questions
```

Less ideal:

```md
# Async/Await
```

### 10. Improve Topic Introductions

The first paragraph should clearly explain the page topic and interview relevance.

Good example:

```md
Async and await are core C# features used to write asynchronous code for I/O-bound operations such as database calls, HTTP requests, and file access. Interviewers often ask this topic to check whether candidates understand Task, thread usage, exception handling, cancellation, and common deadlock risks.
```

### 11. Preserve Required Markdown Structure

Do not break the existing app extraction rules.

Each content file should generally keep:

```md
# Topic Name

## Overview

## Core Concepts

## Common Interview Questions
```

Question markers must remain stable and balanced.

### Decision: Content Quality for Indexable Topic Pages

Index:

```txt
/content/:topicId/
```

Noindex:

```txt
/practice/:topicId/
/simulation/*
```

Reason:

- `/content/:topicId/` is the real educational landing page.
- `/practice/:topicId/` is an app interaction page.
- `/simulation/*` is session/user-flow content, not search landing content.

If a related practice route is `noindex`, the matching content route must fully satisfy the search intent.

For example, if `/practice/async-await/` is `noindex`, then `/content/async-await/` must include enough visible content to rank for queries such as:

```txt
C# async await interview questions
async await C# interview
Task vs thread C# interview
```

Each indexable content page should include:

- Clear H1 with the topic and interview intent
- Strong opening paragraph
- Practical explanation
- Core concepts
- Code examples where useful
- Trade-offs
- Common mistakes
- Best practices
- Interview questions and expected answers
- Internal links to related topics

This aligns with Google's guidance to create substantial, complete, helpful content for people rather than thin pages made primarily for search engines.

### Acceptance Criteria

- Topic titles are descriptive.
- Introductions explain interview relevance.
- Indexable content pages are strong enough to satisfy the relevant interview search intent without depending on the matching practice page.
- `/practice/:topicId/` and `/simulation/*` routes stay `noindex` unless they are later redesigned as standalone searchable pages.
- Markdown still renders correctly.
- Practice questions still extract correctly.
- Simulation question generation still works.

## Phase 8: Pre-Rendering

### 12. Pre-render All Sitemap-Eligible Routes

Static/pre-rendered output is required for every route included in `sitemap.xml` before submitting the sitemap to Google Search Console.

Current Vite React SPA behavior may rely on JavaScript rendering. Google can render JavaScript, but pre-rendered HTML is faster and easier for crawlers.

### Pre-Render Proof of Concept

Before implementing pre-rendering for the full route set, run a small proof of concept for one representative topic route.

Recommended proof-of-concept route:

```txt
/content/classes-structs-records/
```

The proof of concept should validate:

- Static output exists at `dist/content/classes-structs-records/index.html`.
- Production direct load returns `200 OK`.
- Production direct load does not redirect.
- Source HTML contains route-specific title, description, canonical URL, Open Graph URL, and `og:image`.
- Source HTML contains visible page content, not only a generic app shell.
- React hydration still works after the page loads.
- The generated URL matches the trailing-slash canonical format.

Use the result to confirm the pre-rendering approach before applying it to every sitemap-eligible route.

Recommended approach:

- Keep the current Vite + React app.
- Add route pre-rendering for every route that will be included in the sitemap.
- Generate route-specific initial HTML metadata for indexable pages.
- Generate visible source HTML content for every sitemap URL.
- Generate required sitemap-eligible routes:
  - `/`
  - `/content/`
  - `/content/:topicId/`
  - `/roadmap/`
  - `/about-us/`
  - `/privacy/`
  - `/terms/`
- Generate optional sitemap-eligible routes only if they are intended to rank:
  - `/changelog/`
  - `/simulation/`

Do not include optional routes unless they have enough unique visible content and are intended to rank.

Do not pre-render `/practice/:topicId/` pages in the first SEO pass. Those pages are interactive workflow pages and should stay `noindex` unless they are later redesigned as standalone searchable Q&A landing pages.

### Decision: Submit Sitemap Only After Pre-Rendering

Do not submit the full sitemap containing `Sitemap = Yes` URLs to Google Search Console until every included route has pre-rendered/static HTML and production validation passes.

During earlier local foundation work, sitemap generation can be implemented and tested locally. However, do not expose a full production sitemap through `robots.txt` or Search Console until every sitemap URL is pre-rendered and validated.

Recommended order:

1. Finish the SEO technical foundation locally.
2. Complete the pre-render proof of concept.
3. Implement pre-render/static HTML for every sitemap-eligible route.
4. Validate production URLs and source HTML.
5. Submit the sitemap to Google Search Console.

Reason:

- `/content/:topicId/` is the main SEO asset, but every sitemap URL must meet the same standard.
- URLs in `sitemap.xml` must direct-load with `200 OK`.
- Route-specific title, description, canonical URL, and Open Graph tags should exist in the initial HTML before search engines and social crawlers inspect the full topic set.
- Submitting sitemap URLs before pre-rendering can create inconsistent crawl, render, soft-404, and social-preview signals.

### Options

Option A: Add Vite pre-rendering to current app.

Best first choice because it avoids a major migration.

Option B: Move content pages to Astro.

Good if content SEO becomes the main product priority.

Option C: Move the app to Next.js.

Good only if the project later needs stronger SSR or backend/API features.

### Recommendation

Do not migrate to Astro or Next.js immediately.

First implement the SEO foundation in the current Vite app:

```txt
robots.txt + manifest-driven sitemap generation + metadata + canonical URLs + pre-rendered sitemap-eligible routes
```

Then validate production URLs and submit the sitemap to Search Console.

### Acceptance Criteria

- Every sitemap URL has meaningful HTML before JavaScript fully runs.
- `/content/:topicId/` pages have route-specific source HTML metadata.
- Static pages included in the sitemap have route-specific source HTML metadata.
- Generated pages still hydrate correctly.
- Routes still work after refresh.
- Deployment still works on GitHub Pages with the Cloudflare-managed custom domain.

## Production Validation Gate Before Search Console Submission

Do not submit the sitemap to Google Search Console until production URL validation passes.

For every URL in `sitemap.xml`, verify:

- URL is absolute.
- URL uses the canonical trailing-slash format.
- URL returns `200 OK` on direct load.
- URL does not redirect.
- URL is not blocked by `robots.txt`.
- URL does not contain `noindex`.
- URL has a canonical tag matching itself.
- URL has route-specific source HTML metadata before JavaScript runs.
- URL has unique title and meta description.
- URL has correct Open Graph URL.
- URL has route-specific or fallback Open Graph metadata in source HTML.
- URL has visible page content in source HTML.
- URL appears only once in the sitemap.

Suggested check command:

```bash
curl -I https://www.dev-net-core.com/content/classes-structs-records/
```

Also inspect HTML:

```bash
curl -L https://www.dev-net-core.com/content/classes-structs-records/
```

Do not rely only on local dev behavior. Validate against the production GitHub Pages website on the Cloudflare-managed custom domain.

Important caveat: if metadata is added only by React at runtime, `curl` will not show route-specific metadata. That should be recorded as a limitation until pre-rendering/static HTML generation is added. Google can render JavaScript, but server-side rendering or pre-rendering is still a good idea because it is faster for users and crawlers, and not all bots can run JavaScript.

## Phase 9: Search Console and Bing Webmaster Tools

### 13. Set Up Google Search Console

Do this only after every sitemap-included route has static/pre-rendered production output and the Production Validation Gate passes.

Steps:

1. Go to Google Search Console.
2. Add the domain property:

```txt
dev-net-core.com
```

3. Verify ownership using Cloudflare DNS.
4. Confirm every sitemap-included route has static/pre-rendered source HTML.
5. Complete the Production Validation Gate Before Search Console Submission.
6. Submit:

```txt
https://www.dev-net-core.com/sitemap.xml
```

7. Use URL Inspection for sitemap-included routes:
   - Homepage
   - `/content/`
   - A few important topic pages
   - `/roadmap/`
   - `/about-us/`
   - `/privacy/`
   - `/terms/`
   - `/changelog/` only if included
   - `/simulation/` only if included

8. Request indexing for key pages.

### 14. Set Up Bing Webmaster Tools

Steps:

1. Open Bing Webmaster Tools.
2. Import from Google Search Console if available.
3. Submit the sitemap.
4. Check indexing status.

### Acceptance Criteria

- Google Search Console property is verified.
- Production Validation Gate Before Search Console Submission passes before sitemap submission.
- Sitemap is submitted.
- Google can fetch and render important URLs.
- Bing Webmaster Tools is configured.
- Indexing issues are documented.

## Phase 10: Favicon and Branding SEO

### 15. Add Website Icon Files

Recommended files:

```txt
public/favicon.ico
public/favicon.svg
public/apple-touch-icon.png
public/icon-192.png
public/icon-512.png
```

Add to `index.html`:

```html
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

### Acceptance Criteria

- Favicon loads in browser tabs.
- Favicon files are crawlable.
- Homepage is crawlable.
- The icon appears correctly on desktop and mobile.

## Phase 11: Monitoring and Iteration

### 16. Monitor Indexing

Check Google Search Console weekly after deployment.

Manual checks are enough for the first SEO pass. Automated production validation can be added later as an optional scheduled Codex check.

Watch:

- Indexed pages
- Crawled but not indexed pages
- Discovered but not indexed pages
- Duplicate without user-selected canonical
- Soft 404
- Page with redirect
- Not found
- Core Web Vitals
- Search queries
- Click-through rate

### 17. Improve Based on Data

If important pages are not indexed:

- Check whether the page has unique content.
- Check whether the page appears in sitemap.
- Check whether internal links point to it.
- Check whether canonical URL is correct.
- Check whether it is accidentally `noindex`.
- Check rendered HTML.
- Check whether pre-rendered source HTML and route-specific metadata are present in production.

If impressions are low:

- Improve H1.
- Improve title.
- Improve meta description.
- Add stronger intro content.
- Add more specific subheadings.
- Add internal links from related topics.
- Add more complete expected answers.

## Suggested Implementation Tasks

### Task 1: Add Basic SEO Files

Files:

```txt
public/robots.txt
```

Optional only if it contains already-validated URLs:

```txt
public/sitemap.xml
```

Do not deploy a full production sitemap from `public/`. Final sitemap output belongs to the SEO postbuild script and should be written to `dist/sitemap.xml`.

Validation:

```bash
npm run build
```

### Task 2: Extend Curriculum Manifest for SEO Fields

Files:

```txt
scripts/generate-curriculum-manifest.mjs
src/contents/curriculumManifest.generated.ts
shared/content/curriculumSeoManifest.generated.json
src/contents/v1/**/*.md
```

Implementation:

- Parse `seoTitle`, `seoDescription`, and optional `canonicalPath` from Markdown frontmatter.
- Generate `canonicalPath` as `/content/[id]/` when it is not explicitly provided.
- Continue generating the TypeScript manifest for React app navigation and question extraction.
- Generate a Node-readable SEO manifest JSON for SEO postbuild tooling.
- Include content path, canonical path, title/subtopic/topic/category, and SEO fields in the SEO manifest.
- Validate missing SEO fields after the transition period.
- Validate duplicate `canonicalPath` values.
- Validate trailing-slash canonical paths.
- Do not parse or maintain manual `lastmod` values from Markdown frontmatter.
- Keep fallback metadata available during transition.
- Ensure the SEO manifest includes enough data for static route HTML, sitemap URLs, metadata, and route data generation.

Validation:

```bash
npm run generate:curriculum
npm run build
```

### Optional Task 2A: Content Metadata Rollout Strategy

This is an optional planning task to make the frontmatter metadata rollout manageable across the Markdown curriculum.

Goal:

- Add custom `seoTitle` and `seoDescription` fields gradually without blocking the technical SEO foundation.
- Prioritize high-value content pages first.
- Avoid shipping a large set of repetitive fallback descriptions into the sitemap.

Recommended approach:

1. Create a short metadata rollout checklist for curriculum topics.
2. Prioritize pages likely to drive search demand, such as C# fundamentals, ASP.NET Core, async/await, Entity Framework, SQL indexing, React hooks, and Azure hosting topics.
3. Track whether each indexable topic has:
   - Custom `seoTitle`
   - Custom `seoDescription`
   - Generated or verified `canonicalPath`
   - No manual `lastmod`
4. Allow fallback metadata during local implementation and early migration.
5. Before submitting the production sitemap, confirm every `/content/:topicId/` URL included in the sitemap has either custom metadata or an explicitly accepted temporary fallback.

Optional artifact:

```txt
docs/plans/content-metadata-rollout.md
```

Validation:

- Metadata rollout list exists if this optional task is used.
- High-priority topic pages are identified.
- Sitemap-included topic pages have non-repetitive titles and descriptions before Search Console submission.

### Task 3: Generate Sitemap from Curriculum Manifest

Files:

```txt
scripts/seo-postbuild.mjs
package.json
shared/content/curriculumSeoManifest.generated.json
```

Implementation:

- Generate sitemap data from the Node-readable SEO manifest and sitemap-eligible static route list.
- Write final production sitemap output to `dist/sitemap.xml` from the custom SEO postbuild script.
- Do not rely on `public/sitemap.xml` for the final production sitemap unless it contains only already-validated URLs.
- Ensure sitemap generation happens after Vite has produced `dist`.
- Read `dist/index.html` as the base route HTML template.
- Preserve Vite-generated script, stylesheet, preload, modulepreload, and asset references.
- Import only the built server/static render entry from the private build output, such as `dist-server/entry-server.js`.
- Do not import TypeScript files, Vite-only modules, `import.meta.glob`, or React app internals from the postbuild script.
- Inject route-specific metadata from the shared metadata builder.
- Inject safe serialized route data for content pages that need hydration data.
- Validate that no sitemap route depends on `dist/404.html`.
- Start with warning-mode validation while the SSG/pre-render proof of concept is still incomplete.
- Switch to strict mode only after the pre-render proof of concept validates static output, source HTML content, and hydration.

Validation:

```bash
npm run build
```

### Task 3A: Add Machine-Readable SEO Route Config

Create a shared route config that encodes the route indexability matrix for static non-content routes.

Suggested files:

```txt
shared/seo/seoRoutes.mjs
shared/seo/seoRoutes.d.ts
scripts/seo-postbuild.mjs
```

Implementation:

- Define static route metadata for routes such as `/`, `/content/`, `/roadmap/`, `/about-us/`, `/privacy/`, `/terms/`, `/bug-report/`, `/practice/`, and `/simulation/`.
- Include route fields such as `path`, `sitemap`, `index`, `prerender`, and optional `canonicalPath`.
- Keep canonical paths in trailing-slash format.
- Exclude app-only, user-flow-only, and utility routes from the sitemap by default.
- Merge generated content topic routes from the curriculum manifest with this static route config during sitemap and pre-render generation.
- Use this config from sitemap generation, pre-rendering, route metadata, and local validation scripts.
- Add `.d.ts` typing if React TypeScript code imports the `.mjs` route config.

Validation:

```bash
npm run lint
npm run build
```

### Task 4: Add Shared SEO Metadata Builder

Create one manifest-backed metadata builder used by sitemap generation, pre-rendered HTML, and React route metadata.

Suggested files:

```txt
shared/seo/buildSeoMetadata.mjs
shared/seo/buildSeoMetadata.d.ts
shared/seo/seoRoutes.mjs
shared/content/curriculumSeoManifest.generated.json
scripts/seo-postbuild.mjs
src/components/seo/Seo.tsx
src/pages/Content.tsx
```

Implementation:

- Implement the builder as a plain `.mjs` module with no React dependency.
- Keep it pure, dependency-free, and boring.
- Do not use browser-only APIs such as `window`, `document`, `localStorage`, or `navigator`.
- Do not depend on Vite-only features, Vite-only aliases, TypeScript runtime loading, or unguarded `import.meta.env` values.
- Ensure the module can be consumed by both Node scripts and React code.
- Add `shared/seo/buildSeoMetadata.d.ts` or an equivalent type bridge if TypeScript needs explicit declarations for the `.mjs` import.
- Validate the React TypeScript build without disabling strict type checking for SEO modules.
- Build route metadata from the generated SEO manifest and static route definitions.
- Generate title, description, canonical URL, Open Graph URL, and default Open Graph image values from one source.
- Use Markdown frontmatter fields where available.
- Use temporary fallbacks only during transition.
- Keep canonical paths in trailing-slash format.
- Do not duplicate metadata in separate hardcoded maps for sitemap, pre-rendering, and React routes.
- Treat mismatches between pre-rendered source HTML metadata and hydrated React metadata as bugs.

Validation:

```bash
npm run lint
npm run build
```

### Task 5: Add SEO Component

Files:

```txt
public/og/default-og-image.png
src/components/seo/Seo.tsx
src/main.tsx
src/App.tsx
```

Validation:

```bash
npm run lint
npm run build
```

### Task 6: Add Metadata to Core Pages

Files:

```txt
public/og/default-og-image.png
src/pages/Home.tsx
src/pages/Content.tsx
src/pages/Practice.tsx
src/pages/Simulation.tsx
src/pages/Roadmap.tsx
src/pages/AboutUs.tsx
src/pages/NotFound.tsx
```

Validation:

```bash
npm run lint
npm run build
```

### Task 7: Write Structured Data Rules Note

Before adding structured data, write a short project note summarizing the Google structured data rules DEV_NET_CORE will follow.

Suggested file:

```txt
docs/plans/structured-data-rules.md
```

The note should cover:

- Structured data must match visible page content.
- Do not invent author, publisher, date, rating, review, FAQ, or article facts.
- Use only schema types that accurately describe the page.
- Do not add structured data to pages where the visible content does not support it.
- Validate structured data with Google Rich Results Test or Schema Markup Validator when possible.

Validation:

- The note exists.
- The structured data implementation plan is checked against the note before code changes.
- Any structured data fields that cannot be verified against visible content are removed or deferred.

### Task 8: Add Structured Data

Files:

```txt
src/components/seo/Seo.tsx
src/pages/Home.tsx
src/pages/Content.tsx
```

Validation:

```bash
npm run lint
npm run build
```

### Task 9: Review Internal Links

Files:

```txt
src/components/content/CurriculumTreeView.tsx
src/components/content/LeftContentPanel.tsx
src/components/content/RightContentPanel.tsx
src/pages/Practice.tsx
```

Validation:

```bash
npm run lint
npm run build
```

### Task 10: Add Explicit Trailing-Slash Route Support

Files:

```txt
src/App.tsx
```

Add explicit route support for canonical trailing-slash URLs.

Examples:

- `/content/`
- `/practice/`
- `/simulation/`
- `/roadmap/`
- `/about-us/`
- `/changelog/`
- `/privacy/`
- `/terms/`
- `/bug-report/`
- `/simulation/setup/`

Non-trailing variants may continue to work for user convenience, but they should redirect to or canonicalize to the trailing-slash URL.

Important caveat: explicit React Router support only fixes client-side route matching. It does not guarantee `200 OK` on direct production loads from GitHub Pages. Sitemap URLs still need real static output, verified production behavior, or another confirmed hosting solution.

Validation:

```bash
npm run lint
npm run build
```

Manual validation:

- Load each canonical trailing-slash route in the app.
- Confirm non-trailing variants redirect to or canonicalize to the matching trailing-slash URL.
- Confirm route behavior still matches the route indexability matrix.

### Task 11: Update AGENTS.md SEO Context

Perform this task immediately after the SEO plan is finalized and before implementation work begins.

Update `AGENTS.md` so future Codex work follows the SEO plan's route, invalid-topic, sitemap, and pre-rendering decisions.

Files:

```txt
AGENTS.md
docs/plans/dev-net-core-seo-improvement-plan.md
```

Implementation:

- Record that invalid content/practice topic IDs should render Not Found + `noindex`, not redirect to the first available topic.
- Record that canonical public SEO URLs use trailing slashes.
- Record that sitemap URLs require static/pre-rendered production output and must not depend on the GitHub Pages `404.html` SPA fallback.
- Record that `/practice/:topicId/`, `/simulation/*`, and utility routes are noindex/no-sitemap by default.
- Keep AGENTS.md concise and aligned with the final SEO plan.

Validation:

- `AGENTS.md` no longer conflicts with the SEO plan.
- Route behavior guidance in `AGENTS.md` matches the route indexability and deep-link UX matrices.

### Task 11A0: React Router 7 SSG Spike

Before writing the final SEO postbuild implementation, run a spike to determine whether React Router framework-mode SSG is a better fit than the custom Vite SSR/SSG + SEO postbuild approach.

This is an investigation task, not a migration commitment.

Files to inspect:

```txt
package.json
vite.config.ts
src/App.tsx
src/main.tsx
src/layouts/MainLayout.tsx
src/pages/Content.tsx
scripts/generate-curriculum-manifest.mjs
src/contents/curriculumManifest.generated.ts
shared/content/curriculumSeoManifest.generated.json
```

Questions to answer:

- Can the project migrate safely from `BrowserRouter`/`Routes`/`createRoot` to React Router framework mode?
- Can `react-router.config.ts` use `ssr: false` for static-file deployment?
- Can `prerender()` generate static paths for `/`, `/content/`, `/content/:topicId/`, `/roadmap/`, `/about-us/`, `/privacy/`, and `/terms/`?
- Can dynamic `/content/:topicId/` paths be generated from the Node-readable curriculum SEO manifest?
- Can loaders receive Markdown content and curriculum metadata at build time?
- Can generated framework-mode output deploy cleanly to GitHub Pages with the current custom domain?
- How much route, layout, provider, and navigation code must change?
- Does framework-mode SSG reduce the amount of custom SEO postbuild code, or does it introduce more migration risk than it removes?

Decision outcomes:

- If the migration cost is acceptable, create a follow-up implementation plan for React Router framework-mode SSG.
- If the migration cost is too high, continue with the custom SEO postbuild approach in this plan.
- Do not build the full sitemap pre-rendering implementation until this spike has a documented outcome.

Validation:

- Document a short spike result in this plan or a linked follow-up note.
- Include an implementation recommendation and rejected alternative.
- Confirm the chosen route still supports GitHub Pages static deployment.

### Task 11A: SSR/SSG Readiness Refactor

Refactor the current client-only Vite React entry so the app can be rendered at build time for static output while still deploying to GitHub Pages.

This task prepares the app for SSG/pre-rendering. It does not introduce request-time SSR.

Suggested files:

```txt
src/App.tsx
src/AppProviders.tsx
src/entry-client.tsx
src/entry-server.tsx
src/main.tsx
src/lib/redux/createAppStore.ts
src/lib/redux/store.ts
src/theme/ThemeModeProvider.tsx
src/theme/themeMode.ts
```

Implementation:

- Extract shared app providers into a reusable component.
- Extract a Redux store factory such as `createAppStore(preloadedState?)`.
- Keep the browser singleton store as a client concern, not something imported by `entry-server`.
- Move Redux/localStorage persistence subscriptions into the client entry or guard them behind explicit browser checks.
- Keep browser bootstrapping in a client entry that uses `BrowserRouter` and `hydrateRoot` or `createRoot` as appropriate.
- Add a server/static render entry that can render the same app tree with a static router and a fresh Redux store per route render.
- Give `src/entry-server.tsx` an explicit `renderRoute({ url, routeData, preloadedState })` API for the SEO postbuild script.
- Keep `entry-server` focused on rendering app markup; do not make it write files, generate sitemap output, or mutate `dist`.
- Pass initial route data or preloaded state through shared providers so the first client render can match the pre-rendered HTML.
- Keep routing behavior shared so client and pre-rendered output do not diverge.
- Add or document the SSR/SSG build command needed to produce the server/static render bundle, such as `vite build --ssr src/entry-server.tsx`.
- Ensure `scripts/seo-postbuild.mjs` can import the built server/static render entry after the client build and SSR/SSG build have completed.
- Write the server/static render bundle to a non-public build output such as `dist-server`.
- Ensure `dist-server` is not uploaded to GitHub Pages.
- Guard browser-only APIs such as `window`, `document`, `localStorage`, `navigator`, `matchMedia`, and scroll APIs.
- Ensure Redux/localStorage persistence gracefully falls back during static rendering.
- Ensure theme setup does not require `document` during static rendering.
- Ensure static rendering does not read from or write to localStorage/sessionStorage.
- Ensure route-derived data wins over persisted Redux selected-topic state during hydration.
- Keep the deployed output static and compatible with GitHub Pages.
- Do not add a Node server or request-time SSR runtime.

Validation:

```bash
npm run lint
npm run build
```

Manual validation:

- Confirm normal local SPA navigation still works.
- Confirm direct client-side routes still hydrate correctly.
- Confirm the refactor does not change visible route behavior.
- Confirm no new hosting requirement is introduced.
- Confirm `entry-server` does not import the browser singleton Redux store.
- Confirm each server/static render call creates an isolated Redux store.
- Confirm browser persistence subscriptions do not run during static rendering.

### Task 11A1: Static Theme Bootstrap

Add or design a small static theme bootstrap so pre-rendered pages do not flash the wrong theme before React hydrates.

Suggested files:

```txt
index.html
src/theme/themeMode.ts
src/theme/ThemeModeProvider.tsx
src/entry-client.tsx
scripts/seo-postbuild.mjs
```

Implementation:

- Decide whether the bootstrap belongs in `index.html` or generated route HTML.
- Keep the bootstrap tiny, dependency-free, and safe if localStorage is unavailable.
- Set the root `data-theme`, `dark`/`light` class, and critical CSS variables before paint if needed.
- Keep the production default theme stable when no stored preference exists.
- Ensure React reads or initializes the same theme state during hydration.
- Avoid markup or state differences that create hydration mismatch.

Validation:

```bash
npm run lint
npm run build
```

Manual validation:

- Load a pre-rendered page with no saved theme preference.
- Load a pre-rendered page with a saved theme preference.
- Confirm there is no obvious flash of the wrong theme.
- Confirm React hydration does not emit mismatch warnings.

### Task 11B: Add Content Route Data Loading and Hydration Seeding

Add a shared route-data path so pre-rendered content pages receive Markdown and curriculum metadata before rendering, and the client hydrates with the same data.

Suggested files:

```txt
shared/content/loadContentRouteData.mjs
shared/content/loadContentRouteData.d.ts
shared/content/curriculumSeoManifest.generated.json
src/pages/Content.tsx
src/entry-client.tsx
src/entry-server.tsx
scripts/seo-postbuild.mjs
scripts/generate-curriculum-manifest.mjs
```

Implementation:

- Create a shared content route-data loader that can run in Node during pre-rendering.
- Load topic metadata from `shared/content/curriculumSeoManifest.generated.json`.
- Resolve manifest `contentPath` values to filesystem paths under `src/contents/v1`.
- Reject traversal attempts or content paths outside the expected content root.
- Read Markdown with Node `fs`; do not use `import.meta.glob`.
- Load the selected topic's curriculum metadata and Markdown before rendering `/content/:topicId/`.
- Return route data containing the topic, Markdown, SEO metadata, and canonical path.
- Pass route data into the server/static render entry before rendering the route.
- Pass route data through the explicit `renderRoute` input, not through module-level mutable state.
- Serialize the same route data into generated HTML using a safe JSON escaping strategy.
- Inject serialized route data through the managed route-data template slot.
- Keep serialized route data as small as practical.
- Strip Markdown frontmatter before serializing if the client does not need it.
- Escape `<`, `>`, `&`, `</script>`, and Unicode line separator characters.
- Read the serialized route data before client hydration.
- Use `hydrateRoot` when generated app markup exists and `createRoot` only for generic or empty app shells.
- Ignore serialized route data if it does not match the current URL.
- Refactor `Content.tsx` to use preloaded route data when it matches the URL topic ID.
- Keep the existing client-side content loading path as a fallback for non-pre-rendered or app-only routes.
- Ensure the first client render uses the same route data as the pre-rendered HTML.
- Keep URL params as the source of truth for content pages.
- Update persisted Redux selected-topic state after hydration if needed, but do not let persisted state override the URL topic.
- Render Not Found + `noindex` for invalid content or practice topic IDs instead of redirecting to the first topic.
- Do not include invalid topic URLs in the sitemap or pre-render output.

Validation:

```bash
npm run lint
npm run build
```

Manual validation:

- Pre-render a content route and confirm source HTML contains actual article content, not `Loading content...`.
- Confirm the client hydrates without changing the visible article content.
- Confirm a persisted selected topic that differs from the URL does not change the rendered URL topic.
- Confirm stale serialized route data is ignored if the browser URL does not match it.
- Confirm hydration uses `hydrateRoot` for pre-rendered routes and does not replace valid source markup on first render.
- Confirm invalid content/practice topic IDs render Not Found + `noindex`.

### Task 12: Pre-render Compatibility Audit

Before the pre-render proof of concept, audit the app for assumptions that may fail when sitemap-eligible routes render outside a normal browser session.

Files to inspect:

```txt
vite.config.ts
package.json
scripts/
src/App.tsx
src/AppProviders.tsx
src/entry-client.tsx
src/entry-server.tsx
src/main.tsx
src/pages/Home.tsx
src/pages/Content.tsx
src/pages/Roadmap.tsx
src/pages/AboutUs.tsx
src/pages/Privacy.tsx
src/pages/Terms.tsx
src/pages/Changelog.tsx
src/pages/Simulation.tsx
src/components/
src/lib/
shared/content/loadContentRouteData.mjs
shared/content/curriculumSeoManifest.generated.json
shared/seo/buildSeoMetadata.mjs
shared/seo/seoRoutes.mjs
dist/index.html
dist-server/
```

Audit checklist:

- Check sitemap-eligible routes for render-time use of browser-only globals such as `window`, `document`, `localStorage`, `sessionStorage`, `navigator`, `IntersectionObserver`, and layout measurement APIs.
- Confirm browser-only behavior is guarded behind effects, environment checks, or client-only boundaries.
- Confirm Redux/localStorage persistence does not block server/pre-render execution.
- Confirm Redux/localStorage persistence is client-only and does not run at module load in code imported by `entry-server`.
- Confirm `entry-server` creates a fresh Redux store for every route render.
- Confirm `entry-server` does not import the browser singleton Redux store.
- Confirm the client entry and server/static render entry share the same app providers and route tree.
- Confirm the server/static render entry uses a static router, not `BrowserRouter`.
- Confirm the server/static render entry exposes a small `renderRoute` API for SEO postbuild.
- Confirm content routes can receive Markdown and curriculum metadata as route data before render.
- Confirm content route data comes from the Node-readable SEO manifest, not the TypeScript app manifest.
- Confirm Node route-data loading resolves manifest `contentPath` values safely under `src/contents/v1`.
- Confirm the client can read the same serialized route data before hydration.
- Confirm `Content.tsx` does not render `Loading content...` in source HTML for sitemap-eligible content routes.
- Confirm URL params are the source of truth and persisted Redux selected-topic state cannot override a pre-rendered URL topic.
- Confirm invalid topic IDs render Not Found + `noindex`, not a redirect to the first topic.
- Confirm Markdown loading and generated manifest imports can run in the pre-render environment.
- Confirm Vite asset paths work for nested static pages such as `/content/[topicId]/index.html` with `base: "/"`.
- Confirm `shared/seo/buildSeoMetadata.mjs` can be imported from both Node scripts and React code without Vite-only alias or TypeScript runtime issues.
- Confirm `scripts/seo-postbuild.mjs` does not import Vite-only modules, TypeScript source files at runtime, `import.meta.glob`, or React app internals except the built server/static render entry.
- Confirm `scripts/seo-postbuild.mjs` uses `dist/index.html` as the base template and preserves Vite-generated asset references.
- Confirm `scripts/seo-postbuild.mjs` mutates only managed template slots or explicitly parsed nodes for SEO head tags, app markup, and route data.
- Confirm the server/static render bundle is produced outside public `dist`.
- Confirm source HTML metadata is injected from the shared metadata builder by SEO postbuild.
- Confirm `dist/404.html`, if generated, is a dedicated Not Found + `noindex` document and not a blind copy of the app shell.
- Confirm MUI/Emotion styling does not create blocking SSR/SSG issues for pre-rendered pages.
- Confirm pre-rendered HTML can hydrate without markup mismatch for representative sitemap routes.
- Confirm optional sitemap routes such as `/changelog/` and `/simulation/` are excluded unless their visible source HTML content is strong enough to rank.

Outcome:

- Document any route or component that needs a client-only guard before pre-rendering.
- Confirm the shared metadata builder lives at `shared/seo/buildSeoMetadata.mjs` and can be imported safely by both Node and React.
- Do not start the full pre-render rollout until compatibility blockers are resolved or explicitly scoped out.

Validation:

```bash
npm run lint
npm run build
```

### Task 12A: Define Pre-render Output Budgets

Before expanding from the POC route to every sitemap-eligible route, define measurable output and build-time budgets.

Suggested budget fields:

```txt
Maximum total dist size:
Maximum HTML file size per route:
Maximum serialized route-data JSON size per route:
Maximum number of pre-rendered routes in the first sitemap release:
Maximum production build time:
```

Implementation:

- Measure the one-route POC before setting final rollout budgets.
- Record the number of generated routes.
- Record total `dist` size after the client build and after pre-rendering.
- Record the generated HTML file size for the POC route.
- Record the serialized route-data JSON size for the POC route.
- Check whether route data duplicates full Markdown that already exists in rendered HTML.
- Prefer minimal hydration data over serializing large duplicated Markdown payloads when possible.

Validation:

- The POC records size and build-time numbers.
- The all-routes rollout does not proceed until budgets are defined or explicitly waived.
- Any budget exception is documented with the reason and mitigation.

### Task 13: Pre-Render Proof of Concept

Before implementing the full sitemap route set, prove the pre-rendering approach on one representative topic page.

Proof-of-concept route:

```txt
/content/classes-structs-records/
```

Files to inspect:

```txt
vite.config.ts
package.json
scripts/
src/App.tsx
src/AppProviders.tsx
src/entry-client.tsx
src/entry-server.tsx
src/pages/Content.tsx
src/contents/curriculumManifest.generated.ts
shared/content/loadContentRouteData.mjs
shared/content/curriculumSeoManifest.generated.json
dist/index.html
dist-server/
```

Implementation:

- Use a proper React SSR/SSG render entry if feasible so the pre-rendered HTML matches the hydrated React app.
- Avoid ad hoc HTML injection that creates markup React cannot hydrate cleanly.
- Use build-time rendering only; do not add request-time SSR or a production Node server.
- Use the shared app providers and static router from the SSR/SSG readiness refactor.
- Import the built server/static render entry from the private build output, such as `dist-server`.
- Call the explicit `renderRoute` API with the canonical URL and route data.
- Confirm the render entry creates a fresh Redux store for the POC route.
- Use `dist/index.html` as the base HTML template for the generated route.
- Inject route head tags, app markup, and serialized route data through managed template slots or explicitly parsed nodes.
- Preserve Vite-generated scripts, stylesheets, preload/modulepreload links, and asset references.
- Load `/content/classes-structs-records/` Markdown and curriculum metadata as route data before rendering.
- Pass the same route data into the server/static render entry and the generated client HTML.
- Generate static HTML for `/content/classes-structs-records/`.
- Write output to `dist/content/classes-structs-records/index.html`.
- Include route-specific title, description, canonical URL, Open Graph URL, and Open Graph image metadata in the initial HTML.
- Include visible page content in source HTML, not only a generic app shell.
- Confirm the source HTML does not contain `Loading content...` as the primary content.
- Measure generated HTML size, serialized route-data size, total `dist` size, and build duration.
- Check whether full Markdown is duplicated in both rendered HTML and serialized route data.
- Confirm MUI/Emotion styles render acceptably before hydration.
- If the POC shows MUI/Emotion style-order, hydration, or flash-of-unstyled-content issues, add Emotion SSR extraction and a shared cache/provider setup before expanding to all sitemap routes.
- Preserve React hydration and existing client-side routing.

Validation:

```bash
npm run lint
npm run build
```

Manual validation:

- Inspect `dist/content/classes-structs-records/index.html`.
- Confirm source HTML includes route-specific metadata and visible content before JavaScript runs.
- Confirm source HTML includes the expected Markdown-derived heading and article text.
- Confirm serialized route data exists and is safely escaped.
- Confirm serialized route data is written in the managed route-data slot.
- Confirm serialized route data is not larger than the defined POC budget unless explicitly accepted.
- Confirm the generated HTML preserves Vite-generated JS and CSS references from `dist/index.html`.
- Confirm only the managed SEO head block, root app markup, and route-data block changed from the base template.
- Confirm the browser loads the generated route's JS and CSS assets successfully.
- Confirm the server/static render bundle is not present in the public deployed `dist`.
- Deploy and confirm `curl -I https://www.dev-net-core.com/content/classes-structs-records/` returns `200 OK`.
- Confirm the production URL does not redirect.
- Confirm `curl -L https://www.dev-net-core.com/content/classes-structs-records/` shows route-specific source HTML metadata.
- Confirm `curl -L https://www.dev-net-core.com/content/classes-structs-records/` shows visible route content and not only `Loading content...`.
- Confirm the page still hydrates correctly in the browser.
- Confirm browser console does not show hydration mismatch errors.
- Confirm browser console does not show MUI/Emotion hydration or style insertion warnings.
- Confirm the page does not show an obvious flash of unstyled content.
- Record POC output size and build-time measurements before expanding to all sitemap routes.

### Task 14: Pre-render All Sitemap-Eligible Routes

Files to inspect:

```txt
vite.config.ts
package.json
scripts/
src/App.tsx
src/AppProviders.tsx
src/entry-client.tsx
src/entry-server.tsx
src/pages/Home.tsx
src/pages/Content.tsx
src/pages/Roadmap.tsx
src/pages/AboutUs.tsx
src/pages/Privacy.tsx
src/pages/Terms.tsx
src/pages/Changelog.tsx
src/pages/Simulation.tsx
src/contents/curriculumManifest.generated.ts
shared/content/loadContentRouteData.mjs
shared/content/curriculumSeoManifest.generated.json
dist/index.html
dist-server/
```

Implementation:

- Use the rendering method proven in the POC, preferring a proper React SSR/SSG render entry if feasible.
- Use build-time SSG/pre-rendering only while deploying to GitHub Pages.
- Generate static HTML/pre-rendered output for every route included in `sitemap.xml`.
- Use the generated curriculum manifest as the content topic route list.
- Use the Node-readable SEO manifest for SEO postbuild content route generation.
- Use the machine-readable SEO route config for static sitemap-eligible routes.
- Render each route through the explicit `renderRoute` API.
- Create an isolated Redux store for each generated route.
- Use `dist/index.html` as the base HTML template for every generated route.
- Inject only managed SEO head, root app markup, and route-data slots for every generated route.
- Preserve Vite-generated scripts, stylesheets, preload/modulepreload links, and asset references for every generated route.
- Load Markdown and curriculum metadata as route data before rendering each `/content/:topicId/` route.
- Seed each generated content page with the same route data that was used during pre-rendering.
- Use each topic's `canonicalPath` for output paths.
- Generate files that map cleanly to trailing-slash URLs, such as `dist/content/[topicId]/index.html`.
- Generate required sitemap-eligible routes:
  - `/`
  - `/content/`
  - `/content/:topicId/`
  - `/roadmap/`
  - `/about-us/`
  - `/privacy/`
  - `/terms/`
- Generate optional sitemap-eligible routes only if they have enough unique visible content and are intended to rank:
  - `/changelog/`
  - `/simulation/`
- Include route-specific title, description, canonical URL, Open Graph URL, and Open Graph image metadata in the initial HTML.
- Include visible page content in source HTML for every sitemap URL.
- Ensure content page source HTML contains real Markdown-derived content, not `Loading content...`.
- Confirm MUI/Emotion styles render acceptably before hydration for representative route types.
- If MUI/Emotion issues were found in the POC, apply the chosen Emotion SSR extraction/cache solution before adding affected routes to the sitemap.
- Preserve React hydration and existing client-side routing.
- Keep `/practice/:topicId/` routes excluded from the sitemap and `noindex` unless they are later redesigned as standalone searchable pages.
- Keep app-only, user-flow-only, and session-specific routes out of the sitemap.

Validation:

```bash
npm run lint
npm run build
```

Manual validation:

- Inspect generated `dist/content/[topicId]/index.html` files.
- Confirm every sitemap URL has matching static/pre-rendered output.
- Confirm representative pages include source HTML metadata and visible content before JavaScript runs.
- Confirm representative content pages include route-data seeding and hydrate using that same data.
- Confirm representative pages preserve Vite-generated JS and CSS references from `dist/index.html`.
- Confirm representative generated HTML only changes managed SEO head, root app markup, and route-data regions from the base template.
- Confirm public `dist` does not include the private server/static render bundle.
- Confirm per-route rendering does not reuse Redux state across routes.
- Confirm total `dist` size, route HTML size, serialized route-data size, route count, and build time stay within the defined budgets or have documented exceptions.
- Confirm persisted selected-topic state does not override the URL topic during hydration.
- Confirm pre-rendered pages still hydrate correctly in the browser.
- Confirm browser console does not show hydration mismatch errors on representative pre-rendered routes.
- Confirm browser console does not show MUI/Emotion hydration or style insertion warnings on representative pre-rendered routes.
- Confirm canonical trailing-slash URLs still match the route indexability matrix.
- Run a production-like local preview against `dist` after each major SEO build step.
- In the local preview, verify nested static routes such as `/content/classes-structs-records/` load JS, CSS, images, and hydrated UI correctly.

### Optional Task 14A: Local SEO Build Validation Script

Add a local validation script after pre-rendering is implemented if repeated manual checks become noisy.

Suggested file:

```txt
scripts/validate-seo-build.mjs
```

Suggested package script:

```json
{
  "scripts": {
    "validate:seo-build": "node scripts/validate-seo-build.mjs"
  }
}
```

Suggested checks:

- Parse `dist/sitemap.xml`.
- Verify every sitemap `<loc>` is absolute.
- Verify every sitemap URL uses the canonical trailing-slash format.
- Map every sitemap URL to a local static/pre-rendered output file.
- Verify the matching output file exists.
- Verify source HTML includes a route-specific `<title>`.
- Verify source HTML includes a meta description.
- Verify source HTML includes a self-matching canonical URL.
- Verify source HTML includes `og:url` and `og:image`.
- Verify source HTML includes visible page content, not only a generic app shell.
- Verify source HTML does not include `noindex`.
- Verify there are no duplicate sitemap URLs.
- Verify `<lastmod>` is omitted unless an automated source generates accurate values.
- Verify generated route HTML preserves Vite-generated JS and CSS references.
- Verify generated route HTML mutates only managed SEO head, root app markup, and route-data regions.
- Verify generated route HTML includes safe serialized route data where needed.
- Verify generated content route source HTML does not render `Loading content...`.
- Verify public `dist` does not include the private server/static render bundle.
- Verify `dist/404.html`, if present, contains Not Found source content and `noindex`.
- Optionally start a static preview server against `dist` and verify representative nested routes load assets and hydrate correctly.

Important caveat: this script validates local build output only. It does not replace production validation with `curl -I` and `curl -L`.

Validation:

```bash
npm run build
npm run preview
npm run validate:seo-build
```

### Task 15: Verify Hosting and Redirect Behavior

Files to inspect:

```txt
.github/workflows/main.yml
public/CNAME
```

Validation:

- Confirm production is deployed by GitHub Pages.
- Confirm the custom domain is managed through Cloudflare DNS.
- Confirm whether Cloudflare proxy/rules are enabled.
- Confirm any Cloudflare redirect rules are documented if they exist.
- Confirm GitHub Actions order is:
  1. Generate curriculum manifest.
  2. Generate the Node-readable SEO manifest, either as part of curriculum generation or as an explicit step.
  3. Build client assets.
  4. Build server/static render entry to private build output such as `dist-server`, or run the chosen framework-mode pre-render build.
  5. SEO postbuild reads `dist/index.html`, imports the built server/static render entry if using the custom path, creates route HTML artifacts, and writes `dist/sitemap.xml`.
  6. Generate or validate `dist/404.html` as a dedicated Not Found + `noindex` document.
  7. Run SEO build validation when available.
  8. Deployment publishes only the final `dist`.
- Confirm the `404.html` step does not overwrite a dedicated Not Found + `noindex` file or replace generated route artifacts.
- Confirm `dist-server` is not uploaded to GitHub Pages.
- Confirm sitemap URLs return `200 OK` without depending on `dist/404.html`.
- Confirm non-canonical route variants redirect to or canonicalize to trailing-slash URLs.
- Confirm valid trailing-slash routes direct-load in production.

Current Step 15 status as of June 28, 2026:

- The first guarded `framework` deployment completed successfully from
  `main` at commit `27d6f39`.
- All 227 sitemap URLs passed direct production checks for `200 OK`, canonical
  trailing-slash URLs, indexability, source titles, and visible headings.
- HTTPS, apex-to-`www`, non-trailing route redirects, `robots.txt`, and the
  dedicated `404` + `noindex` response passed.
- Initial browser validation found a homepage-only React hydration mismatch
  because the Live Drills list used `Math.random()` independently during SSG
  and browser hydration.
- The homepage now selects deterministic first, middle, and last drill
  candidates. Local framework preview validation passes repeated homepage
  loads with identical drill content and no console errors.
- Keep Step 15 open until this fix is merged, redeployed, and the production
  browser hydration check passes.

### Task 16: Search Console Setup

No code changes required.

Validation:

- Domain verified.
- Pre-rendered/static output for every sitemap-included route is deployed.
- Production Validation Gate Before Search Console Submission passes.
- Sitemap submitted.
- Production sitemap URLs pass `curl -I` and `curl -L` checks.
- Key pages inspected.
- Indexing requested.

### Task 17: Optional Scheduled Production SEO Validation

Manual production validation is enough for the first SEO pass. Add automated validation later if repeated checks become useful.

Use a scheduled Codex task to periodically check production SEO health.

Suggested schedule:

```txt
Weekly after deployment
```

Suggested checks:

- Fetch `https://www.dev-net-core.com/sitemap.xml`.
- Parse every `<loc>` URL.
- Verify each sitemap URL returns `200 OK`.
- Verify sitemap URLs do not redirect.
- Verify sitemap URLs use the canonical trailing-slash format.
- Verify each page has a self-matching canonical tag.
- Verify pages are not blocked by `robots.txt`.
- Verify pages do not include `noindex`.
- Verify each page has a unique title and meta description.
- Verify each page has correct Open Graph URL and `og:image`.
- Report any soft-404, redirect, duplicate canonical, or missing metadata issues.

Important caveat: if any route-specific metadata is still added only by React at runtime, source HTML checks will not see that metadata. Record that as an expected limitation and keep those routes out of the sitemap until pre-rendering/static HTML generation covers them.

This task is optional and should not block the initial manual Production Validation Gate Before Search Console Submission.

### Task 18: Optional Framework or Pre-Rendering Follow-Up Research

Create a follow-up plan only if the Vite-compatible pre-rendering path has meaningful limitations.

Research:

- Vite-compatible pre-rendering options.
- GitHub Pages custom-domain deployment compatibility.
- Cloudflare proxy/rules compatibility only if Cloudflare proxy/rules are explicitly enabled.
- React Router compatibility.
- Generated content route list from curriculum manifest.
- Whether Astro, Next.js, or another framework would materially improve SEO, performance, or maintainability.

Do not start a framework migration without a separate plan.

## Risks

### React SPA Rendering Risk

Search engines may need to render JavaScript before seeing meaningful content. This can delay indexing.

Mitigation:

- Add sitemap.
- Add metadata.
- Add pre-rendering before submitting sitemap URLs to Search Console.

### Premature Sitemap Submission Risk

Submitting sitemap URLs before pre-rendered source HTML and production validation are ready may create weak crawl signals, inconsistent metadata, or soft-404-like behavior.

Mitigation:

- Generate the sitemap locally as part of the technical foundation, but do not submit it yet.
- Pre-render every sitemap-eligible route first.
- Validate production `200 OK` direct loads and source HTML metadata.
- Submit the sitemap only after the Production Validation Gate passes.

### Duplicate URL Risk

Routes with and without trailing slash may create duplicate URLs.

Mitigation:

- Use canonical URLs.
- Use one consistent URL format.
- Avoid linking to both versions.
- Treat trailing-slash URLs as the only sitemap/canonical format for GitHub Pages static output.
- Do not rely on non-trailing production redirects unless Cloudflare or another layer explicitly implements and validates them.

### Soft 404 Risk

Invalid SPA routes may return the app shell instead of a real 404.

Mitigation:

- Add `noindex` to invalid routes.
- Use a clear Not Found page.
- Do not include invalid routes in `sitemap.xml`.
- Do not block invalid SPA routes in `robots.txt` if relying on `noindex`.
- Ensure sitemap URLs return `200 OK` on direct load and do not rely only on the generic `404.html` SPA fallback.

### Hosting and Redirect Authority Risk

The custom domain is managed in Cloudflare, but the application is hosted on GitHub Pages. This can cause confusion about where redirects, rewrites, and status codes are actually controlled.

Mitigation:

- Treat GitHub Pages as the production static host unless the site is explicitly migrated.
- Treat Cloudflare as DNS/domain management unless Cloudflare proxy/rules are explicitly enabled.
- Do not rely on Cloudflare redirects unless the exact rules are configured, documented, and validated.
- Generate real static output for sitemap URLs where possible.
- Validate production behavior with `curl -I` and `curl -L` before submitting the sitemap.

### Sitemap Drift Risk

Manual sitemap entries may become outdated as curriculum content changes.

Mitigation:

- Generate sitemap from the curriculum manifest.

### Metadata Drift Risk

Manual metadata can become outdated or duplicated.

Mitigation:

- Generate content metadata from frontmatter/curriculum data.
- Validate duplicate canonical paths.
- Keep fallback metadata only as a transition aid.

### Manifest SEO Field Risk

The current generated curriculum manifest may not expose enough SEO fields for sitemap, metadata, and pre-rendering output.

Mitigation:

- Extend the frontmatter parser before relying on generated metadata.
- Add validation for required SEO fields and canonical path format.
- Omit `lastmod` unless a future automated source can generate it accurately.
- Do not output `<priority>` or `<changefreq>` in the sitemap.

### Content Route Data Hydration Risk

Content pages currently load selected-topic Markdown on the client after render. If pre-rendering uses the same effect-only loading path, source HTML may contain `Loading content...` instead of the actual article, and the client may hydrate with data that does not match the pre-rendered HTML.

Mitigation:

- Load Markdown and curriculum metadata as route data before pre-rendering content pages.
- Serialize the same route data into generated HTML for the client to read before hydration.
- Refactor `Content.tsx` to use matching preloaded route data before falling back to client-side loading.
- Keep URL params as the content route source of truth.
- Prevent persisted Redux selected-topic state from overriding the URL topic during hydration.
- Validate that sitemap-included content pages contain real article content in source HTML.

### React Router Framework-Mode Migration Risk

React Router framework-mode SSG may reduce custom pre-rendering code, but migrating from the current Vite SPA structure may require routing, loader, provider, and build pipeline changes.

Mitigation:

- Run the React Router 7 SSG spike before committing to the implementation path.
- Compare framework-mode SSG with the custom SEO postbuild approach.
- Confirm GitHub Pages static deployment works before migration.
- Do not start the full sitemap pre-render rollout until the spike outcome is documented.

### Singleton Store and Hydration Bootstrap Risk

The current app is client-first and may rely on a singleton Redux store plus localStorage persistence. If that store is reused during build-time rendering, route state can leak across generated pages. If the client does not hydrate from the same route data used during pre-rendering, React may replace or mismatch the source HTML.

Mitigation:

- Extract a `createAppStore(preloadedState?)` factory.
- Create a fresh store for every server/static render call.
- Keep browser persistence subscriptions client-only.
- Read serialized route data before the first client render.
- Use `hydrateRoot` for pre-rendered routes and `createRoot` only for non-pre-rendered shells.
- Treat route-data mismatches and hydration warnings as bugs before expanding the sitemap.

### Static Theme Bootstrap Risk

Pre-rendered HTML may show the wrong theme before React hydrates if theme classes, attributes, or CSS variables are applied only in client effects.

Mitigation:

- Add a tiny before-paint theme bootstrap if needed.
- Keep the bootstrap dependency-free and safe when localStorage is unavailable.
- Align the bootstrap result with React's initial theme state.
- Validate that pre-rendered pages do not flash the wrong theme or produce hydration warnings.

### Node/Vite Build Boundary Risk

SEO postbuild may accidentally depend on Vite-only imports, TypeScript runtime execution, `import.meta.glob`, or React app internals. It may also generate route HTML that loses Vite's hashed JS/CSS asset references.

Mitigation:

- Generate a Node-readable SEO manifest during curriculum generation.
- Keep SEO postbuild dependent on JSON manifests, pure shared `.mjs` helpers, Node `fs`, `dist/index.html`, and the built server/static render entry only.
- Use `dist/index.html` as the base template for generated route HTML.
- Preserve Vite-generated script, stylesheet, preload, modulepreload, and asset references.
- Build the server/static render entry to a private output such as `dist-server`.
- Deploy only `dist` to GitHub Pages.
- Validate generated nested routes load JS/CSS and hydrate correctly.

### Structured Data Drift Risk

JSON-LD can drift from canonical metadata or visible content if it is generated separately from title, description, canonical URL, and Open Graph tags.

Mitigation:

- Generate JSON-LD from the shared metadata builder.
- Inject JSON-LD through SEO postbuild for sitemap URLs.
- Let React mirror the same structured data after hydration, not own it separately.
- Validate structured data against Google rules before deployment.

### Template Injection and 404 Output Risk

Ad hoc HTML string replacement can remove Vite-generated asset tags or inject metadata in the wrong place. A blind `dist/index.html` to `dist/404.html` copy can also make invalid URLs look like normal app-shell pages.

Mitigation:

- Use explicit managed template slots or a constrained HTML parser.
- Mutate only SEO head tags, root app markup, and serialized route data.
- Preserve Vite-generated script, style, preload, modulepreload, and public asset references.
- Generate or validate a dedicated `dist/404.html` with Not Found source content and `noindex`.
- Prevent GitHub Actions from overwriting the dedicated `404.html` after SEO postbuild.

### MUI/Emotion Static Rendering Risk

Material UI and Emotion may need SSR-specific style extraction or cache setup to avoid style-order warnings, hydration mismatch, or a flash of unstyled content on pre-rendered pages.

Mitigation:

- Check this during the one-route pre-render proof of concept.
- If issues appear, add Emotion SSR extraction and a shared cache/provider setup before expanding to all sitemap routes.
- Keep affected routes out of the sitemap until their pre-rendered source HTML hydrates without React, MUI, or Emotion warnings.

### Pre-render Output Bloat Risk

Pre-rendering every Markdown topic can significantly increase `dist` size, especially if each page contains rendered HTML plus duplicated full Markdown or large route-data JSON.

Mitigation:

- Define output-size and build-time budgets during the POC.
- Measure generated HTML size, serialized route-data size, route count, total `dist` size, and build duration.
- Serialize only the route data needed for hydration.
- Document any budget exception before expanding to all sitemap routes.

### Build Risk

New sitemap or SEO scripts may break the Vite build if they depend on generated files in the wrong order.

Mitigation:

- Keep script order clear.
- Use staged SEO postbuild modes: `off`, `warn`, then `strict`.
- Keep strict postbuild validation disabled until the pre-render proof of concept passes.
- Require strict postbuild validation before exposing a full production sitemap.
- Validate with `npm run build`.

## Assumptions

- The production domain is `https://www.dev-net-core.com/`.
- Apex/root domain behavior has already been deployed and validated; re-check only if DNS, GitHub Pages, Cloudflare, or canonical-domain settings change.
- The production site is hosted on GitHub Pages.
- The custom domain is managed through Cloudflare DNS.
- Cloudflare should not be treated as the application host unless the site is explicitly migrated to Cloudflare Pages.
- Cloudflare proxy/rules should not be assumed unless explicitly configured and documented.
- The project remains a Vite + React app deployed as static output.
- SSR-style rendering should be used only at build time for SSG/pre-rendering while GitHub Pages remains the host.
- Runtime SSR is out of scope unless a separate hosting migration plan is created.
- Markdown content remains the source of truth for curriculum pages.
- The generated React curriculum manifest will continue to support app navigation and question extraction.
- A generated Node-readable SEO manifest will contain enough data to build sitemap URLs, page metadata, route data, and the pre-rendered content route list.
- Static non-content routes will be managed through the sitemap-eligible route list.
- The goal is organic discoverability, not paid advertising.
- The implementation should remain incremental, but the full sitemap should not be submitted until pre-rendered sitemap-eligible routes and production validation are complete.

## Validation Checklist

After implementation, validate:

```bash
npm run generate:curriculum
npm run lint
npm run build
npm run preview
```

If Optional Task 14A is implemented, also validate:

```bash
npm run validate:seo-build
```

Manual checks:

- Open `https://www.dev-net-core.com/robots.txt`.
- Open `https://www.dev-net-core.com/sitemap.xml`.
- Open `https://www.dev-net-core.com/og/default-og-image.png`.
- Confirm final production sitemap output is written by `scripts/seo-postbuild.mjs`.
- Confirm GitHub Pages is the production static host.
- Confirm SSR/SSG rendering is build-time only and does not require a production Node server.
- Confirm the server/static render entry is built before the SEO postbuild script imports or uses it.
- Confirm the server/static render entry is built outside public `dist`.
- Confirm the server/static render entry exposes the agreed `renderRoute` API.
- Confirm the server/static render entry creates a fresh Redux store for each route render.
- Confirm Redux/localStorage persistence subscriptions are client-only.
- Confirm client hydration reads serialized route data before the first render.
- Confirm pre-rendered routes use `hydrateRoot` and generic app shells use `createRoot`.
- Confirm only `dist` is uploaded to GitHub Pages.
- Confirm Cloudflare is being used for domain/DNS management.
- Confirm whether Cloudflare proxy/rules are enabled and documented.
- Confirm non-trailing URLs are not used in sitemap, canonical, Open Graph, Twitter/X, structured data, or internal generated SEO links.
- Confirm non-trailing production redirects are not assumed unless Cloudflare or another layer explicitly implements and validates them.
- Confirm the shared SEO route config matches the route indexability matrix.
- Confirm the React Router 7 SSG spike has a documented outcome before full pre-render implementation starts.
- Confirm the curriculum generation step outputs a Node-readable SEO manifest.
- Confirm SEO postbuild consumes the Node-readable SEO manifest, not the TypeScript app manifest.
- Confirm SEO postbuild does not rely on Vite-only imports, TypeScript runtime execution, `import.meta.glob`, or React app internals.
- Confirm SEO postbuild uses `dist/index.html` as the base template and preserves Vite-generated asset references.
- Confirm SEO postbuild mutates only managed SEO head, root app markup, and route-data regions.
- Confirm `dist/404.html`, if present, is a dedicated Not Found + `noindex` document and is not a blind copy of `dist/index.html`.
- Confirm sitemap URLs do not rely on the GitHub Pages `404.html` SPA fallback.
- Confirm sitemap content URLs come from `canonicalPath`.
- Confirm sitemap omits `<priority>` and `<changefreq>`.
- Confirm sitemap omits `<lastmod>` unless an automated source generates accurate values.
- Confirm pre-rendered output exists for every route included in `sitemap.xml`.
- Confirm every sitemap URL source HTML includes route-specific title, description, canonical URL, Open Graph URL, default or custom `og:image`, and visible page content.
- Confirm every sitemap URL with structured data has JSON-LD in source HTML generated from the shared metadata builder.
- Confirm every sitemap-included content page receives Markdown and curriculum metadata as pre-render route data.
- Confirm every sitemap-included content page serializes safe initial route data for hydration.
- Confirm every sitemap-included content page source HTML contains real article content and not only `Loading content...`.
- Confirm persisted selected-topic state does not override the URL topic during hydration.
- Confirm serialized route data is minimized and safely escaped.
- Confirm metadata-only static HTML shell output is not used as the basis for sitemap inclusion.
- Confirm pre-rendered pages do not flash the wrong theme before hydration.
- Confirm representative pre-rendered pages hydrate without React, MUI, or Emotion warnings.
- Confirm output-size and build-time budgets are defined before all-routes pre-render rollout.
- Confirm generated route count, total `dist` size, HTML file size, route-data JSON size, and build duration stay within budget or have documented exceptions.
- Run production `curl -I` checks for representative sitemap URLs.
- Run production `curl -L` HTML inspections for representative sitemap URLs.
- Open several `/content/:topicId/` pages.
- Open canonical trailing-slash static routes such as `/roadmap/`, `/about-us/`, `/privacy/`, `/terms/`, and optional sitemap routes if included.
- Confirm explicit React Router support for canonical trailing-slash routes.
- Check browser title changes per page.
- Check meta description using browser dev tools.
- Check canonical URL.
- Check Open Graph tags.
- Check `og:image` is absolute, public, and points to the default image when no custom image exists.
- Check invalid routes have `noindex`.
- Complete the Production Validation Gate Before Search Console Submission.
- Submit sitemap to Google Search Console only after pre-rendering and production validation pass.
- Inspect a few URLs with Google URL Inspection.
- Confirm Google can render page content.
- Submit sitemap to Bing Webmaster Tools.

## Success Criteria

This SEO plan is successful when:

- Google Search Console shows the sitemap as successfully processed.
- Important routes are indexed.
- Curriculum topic pages appear in Search Console performance data.
- Search result titles are relevant and unique.
- Search result descriptions are relevant.
- No important pages are blocked by `robots.txt`.
- No important pages are marked `noindex`.
- Invalid routes do not get indexed.
- Content pages are discoverable through sitemap and internal links.

## Recommended Next Step

Start with a small first PR:

```txt
Add robots.txt, SEO frontmatter support, shared SEO route config, and generated sitemap infrastructure in warning mode
```

Then make a second PR:

```txt
Add metadata, canonical URLs, crawlable links, and trailing-slash route support
```

Then make a third PR:

```txt
Run React Router 7 SSG spike and document the chosen pre-rendering architecture
```

Then make a fourth PR:

```txt
Add SSR/SSG readiness refactor, renderRoute API, store factory, hydration bootstrap, and static theme bootstrap
```

Then make a fifth PR:

```txt
Add content route data loading and hydration seeding
```

Then make a sixth PR:

```txt
Add pre-render proof of concept for one content route and record output-size/build-time budgets
```

Then make a seventh PR:

```txt
Add pre-render/static HTML output for all sitemap-eligible routes
```

After deployment, complete production validation and then submit the sitemap to Google Search Console and Bing Webmaster Tools.
