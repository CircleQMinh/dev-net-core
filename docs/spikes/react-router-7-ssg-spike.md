# React Router 7 SSG Spike Result

Date: 2026-06-27

## Decision

Proceed toward React Router framework-mode SSG with `ssr: false`.

The spike proved that the project can generate GitHub Pages-compatible static
HTML for canonical trailing-slash routes while retaining client hydration and
route-loader navigation. The migration cost is moderate to high, but the
framework removes more custom rendering and hydration risk than it introduces.

Keep a small SEO finalization script for sitemap generation, output validation,
and GitHub Pages `404.html` handling. Do not build a separate custom Vite SSR
renderer unless the framework migration later fails on the real app tree.

## Proof

The isolated proof uses React Router 7.18.0 and:

- `ssr: false`
- `routeDiscovery: { mode: "initial" }`
- `future.v8_trailingSlashAwareDataRequests: true`
- dynamic `prerender` paths from
  `shared/content/curriculumSeoManifest.generated.json`
- Node build-time Markdown loading by manifest `contentPath`
- the existing shared SEO metadata builder
- route loader data shared by pre-rendering and hydration

The build generated:

```txt
build/client/index.html
build/client/content/index.html
build/client/content/_.data
build/client/content/<topic>/index.html
build/client/content/<topic>/_.data
build/client/__spa-fallback.html
```

The temporary server bundle was removed automatically because runtime SSR is
disabled.

## Questions Answered

| Question | Result |
|---|---|
| Can the app use framework mode? | Yes, but routes and the app entry must migrate to route modules. |
| Can static hosting use `ssr: false`? | Yes. No deployed Node server is required. |
| Can all sitemap paths be pre-rendered? | Yes. Static paths and manifest-generated topic paths are supported. |
| Can dynamic topic paths come from the SEO manifest? | Yes. The config reads the JSON manifest directly in Node. |
| Can loaders receive Markdown and metadata at build time? | Yes. The topic loader read the Markdown file and shared metadata before rendering. |
| Does hydration receive the same route data? | Yes. React Router generated `.data` output and hydrated without mismatch warnings. |
| Is GitHub Pages output compatible? | Yes for pre-rendered trailing-slash routes. A small fallback adapter is still required. |
| Does this eliminate the SEO postbuild step? | No. It reduces it to sitemap, validation, fallback, and output finalization work. |

## Browser Validation

Playwright verified:

- direct topic load returned the pre-rendered document
- the source document contained topic title, description, canonical, Open Graph,
  JSON-LD, and visible Markdown
- hydration completed with zero console errors
- client navigation from `/content/` to the dynamic topic loaded the generated
  topic `.data` file
- no request was made to `/__manifest`

For the sample topic, output included approximately 52 KB of HTML and 25 KB of
route data. Full Markdown is therefore duplicated between HTML and `.data`;
output-size budgets remain necessary before pre-rendering every topic.

## Required Migration Work

1. Replace `BrowserRouter`, component `<Routes>`, and `createRoot` ownership with
   framework route modules and framework entries.
2. Move shared providers into the framework root while preserving the current
   layout and navigation.
3. Create a Redux store factory and keep persistence subscriptions client-only.
4. Make theme and SEO behavior safe during build-time rendering.
5. Replace the content page's post-mount Markdown fetch with loader-provided
   initial route data.
6. Ensure the client hydrates from the same Markdown and curriculum metadata
   used during pre-rendering.
7. Convert route metadata to framework `meta` output backed by the shared
   metadata builder.
8. Generate every sitemap-eligible path through `prerender`.

## GitHub Pages Caveats

- Deploy `build/client` rather than a runtime server build.
- Keep canonical sitemap routes as `route/index.html` static artifacts.
- React Router emits `__spa-fallback.html`, while GitHub Pages uses `404.html`.
  The finalizer must create a dedicated `404.html` with `noindex`; it must not
  count as valid output for sitemap routes.
- Keep `routeDiscovery` in `initial` mode because GitHub Pages cannot serve a
  runtime `/__manifest` endpoint.
- Enable `future.v8_trailingSlashAwareDataRequests`. React Router 7.18 otherwise
  removes the trailing slash from generated data requests and rejects canonical
  paths such as `/content/` during pre-rendering.
- Pin React Router framework packages to the same version. Mixed framework
  package versions caused peer-resolution conflicts during the spike.
- Install `react-router` as a direct framework CLI peer alongside
  `react-router-dom`; relying only on the nested DOM package copy did not satisfy
  the 7.18 CLI.

## Rejected Alternative

Do not proceed with a fully custom Vite SSR/SSG renderer as the primary plan.
It would need to duplicate route matching, loader execution, hydration data,
metadata coordination, and asset handling already provided by React Router.

Retain custom Node scripts only for responsibilities React Router does not own:
sitemap generation, static-output validation, GitHub Pages fallback generation,
and deployment checks.

## Task 11A Staged Readiness Follow-Up

The first readiness stage was completed without changing production route
ownership:

- `createAppStore(preloadedState?)` now creates isolated Redux stores.
- Reducer defaults are deterministic and no longer read localStorage during
  module evaluation.
- Browser persistence loading and subscriptions are isolated from static
  rendering.
- `AppProviders` can use an injected store or create a fresh store from explicit
  preloaded state.
- Theme rendering uses an explicit initial mode and does not require `document`
  during static rendering.
- `Content` accepts serializable initial Markdown and curriculum metadata while
  preserving its current SPA Markdown loader as a fallback.

The spike now pre-renders the production providers and content page through a
dedicated readiness route. The generated source HTML contains the real topic
content instead of the loading placeholder, and Playwright hydration completed
without console warnings.

Production routing remains on `BrowserRouter` and component routes. Framework
route modules, loaders, metadata exports, and client hydration ownership belong
to the following migration task.
