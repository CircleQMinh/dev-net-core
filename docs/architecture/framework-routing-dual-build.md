# Framework Routing Dual-Build Cutover

Task 11A2 introduces a production-shaped React Router framework build without
changing the current GitHub Pages deployment artifact.

## Build Ownership

- `npm run build` remains the deployable Vite SPA build and writes `dist/`.
- `npm run build:framework` builds the migration candidate and writes
  `build-framework/client/`.
- React Router uses `ssr: false`; no request-time Node server is required.
- The temporary framework server bundle is removed after pre-rendering.
- The current deployment workflow must continue to publish `dist/` until a
  separate cutover task is approved.

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
npm run validate:framework
npm run preview:framework
```

`validate:framework` checks that every expected static route has visible source
HTML, self-canonical metadata, Open Graph metadata, and the required route
artifact. It also confirms that app-only routes were not emitted as static
sitemap pages and that the existing `dist/index.html` SPA artifact still
exists.

The final hosting cutover still needs explicit GitHub Pages fallback/output
handling and production URL validation. `__spa-fallback.html` must not be
counted as static output for any sitemap URL.
