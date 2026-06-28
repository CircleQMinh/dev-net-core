# Framework Routing Dual-Build Cutover

Task 11A2 introduces a production-shaped React Router framework build without
changing the current GitHub Pages deployment artifact.

## Build Ownership

- `npm run build` remains the deployable Vite SPA build and writes `dist/`.
- `npm run build:framework` builds the migration candidate and writes
  `build-framework/client/`.
- React Router uses `ssr: false`; no request-time Node server is required.
- The temporary framework server bundle is removed after pre-rendering.
- The manual deployment workflow continues to publish `dist/` until a separate
  cutover task is approved.

## GitHub Actions Ownership

- `.github/workflows/framework-candidate.yml` runs on pull requests and pushes
  to `main`, plus manual dispatch. It has read-only repository permissions,
  builds both outputs, finalizes and validates the framework output, and never
  uploads or deploys a Pages artifact.
- The candidate check is initially advisory. After several stable GitHub runs
  confirm timing and reliability, it can be made required through repository
  branch protection settings.
- `.github/workflows/main.yml` is manual-only and restricted to `main`. It runs
  the complete validation gate before publishing the existing `dist/` SPA.
- Candidate and deployment workflows use separate concurrency groups, so
  validation cannot cancel or replace a deployment.

## Framework Output

The framework build pre-renders:

- `/`
- `/content/`
- Every valid `/content/:topicId/` route from the curriculum SEO manifest
- `/roadmap/`
- `/about-us/`
- `/privacy/`
- `/terms/`

App-only and noindex routes use `__spa-fallback.html` and are not treated as
valid sitemap artifacts.

## Validation

Run:

```bash
npm run build:framework
npm run finalize:framework
npm run validate:framework
npm run preview:framework
```

`finalize:framework` writes `sitemap.xml`, candidate `robots.txt`, and the
dedicated Not Found + `noindex` `404.html` into `build-framework/client/`.

`validate:framework` checks that every expected static route has visible source
HTML, self-canonical metadata, Open Graph metadata, and the required route
artifact. It parses the sitemap, validates the dedicated fallback, enforces
output budgets, confirms that app-only routes were not emitted as static
sitemap pages, and confirms that the existing `dist/index.html` SPA artifact
still exists.

The final hosting cutover still needs explicit GitHub Pages fallback/output
handling and production URL validation. `__spa-fallback.html` must not be
counted as static output for any sitemap URL.

## Candidate Output Budgets

The first sitemap release uses these guardrails:

- Maximum public client output: 80 MiB
- Maximum route HTML: 512 KiB
- Maximum route-data file: 100 KiB
- Maximum pre-rendered routes: 250
- Maximum framework build duration in CI: 60 seconds

`validate:framework` enforces the size and route-count budgets. Both GitHub
workflows record framework build duration in the run summary and fail when the
build exceeds 60 seconds. The current duplicated Markdown in route HTML and
route data is accepted for the first cutover while these limits pass; optimize
it later if growth approaches a budget.
