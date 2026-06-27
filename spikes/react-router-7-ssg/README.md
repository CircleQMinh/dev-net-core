# React Router 7 SSG Spike

This isolated proof tests React Router framework-mode pre-rendering without
changing the production Vite SPA.

The findings and implementation recommendation are recorded in
[`docs/spikes/react-router-7-ssg-spike.md`](../../docs/spikes/react-router-7-ssg-spike.md).

Run it from the repository root:

```bash
npm run spike:ssg:build
```

The spike intentionally proves only the architecture boundaries:

- `ssr: false` static-file output
- initial route discovery without a runtime `/__manifest` endpoint
- dynamic pre-render paths read from the Node-readable curriculum SEO manifest
- Markdown and metadata loaded before rendering
- trailing-slash static output
- hydration data emitted alongside HTML
- production providers and content rendered from initial route data

React Router requires `react-router.config.ts` at the framework project root.
The repository-level config points back to this isolated app directory; the
normal Vite build does not use it.

The generated output is written to `build/client` inside this directory and is
ignored by Git.
