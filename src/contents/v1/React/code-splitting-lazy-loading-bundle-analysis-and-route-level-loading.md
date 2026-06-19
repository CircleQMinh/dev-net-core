---
id: code-splitting-lazy-loading-bundle-analysis-and-route-level-loading
topic: Forms, validation, and frontend performance in production
subtopic: Code splitting, lazy loading, bundle analysis, and route-level loading
category: React
---

## Overview

Code splitting is the practice of breaking a JavaScript application into smaller chunks that can be loaded only when needed. Lazy loading is one common way to trigger those chunks on demand. Bundle analysis is the process of inspecting what actually ended up in the production bundle and why. Route-level loading applies these ideas at navigation boundaries so each route can load its code, data, and pending UI deliberately.

This matters because React applications often grow by adding routes, forms, charts, editors, date libraries, design systems, validation libraries, and API clients. If everything ships in the initial bundle, first load gets slower, parsing and execution cost increases, and users pay for features they may never open.

In production apps, code splitting is commonly used for admin sections, dashboards, report builders, markdown editors, rich text editors, route modules, modals, maps, charts, and rarely used workflows. It should be guided by real measurements, not by splitting every file just because dynamic import exists.

For interviews, this topic is important because it tests whether a candidate understands the difference between network size, parse/execute cost, loading UX, route boundaries, caching, and practical trade-offs. A strong answer balances performance with maintainability.

## Core Concepts

### Initial Bundle

The initial bundle is the JavaScript needed before the app can render the first meaningful screen. It usually includes the app shell, router, core layout, shared UI primitives, auth bootstrap, critical route code, and vendor dependencies required immediately.

Large initial bundles hurt because the browser must:

- Download the files.
- Parse JavaScript.
- Compile JavaScript.
- Execute module initialization.
- Hydrate or render the UI.

Code splitting reduces what is needed up front by moving non-critical code into async chunks.

### Dynamic Import

Dynamic `import()` is the JavaScript mechanism bundlers use to create async chunks.

```ts
async function openReportBuilder() {
  const module = await import("./ReportBuilder");
  return module.ReportBuilder;
}
```

Static imports are loaded with the main module graph:

```ts
import { ReportBuilder } from "./ReportBuilder";
```

Dynamic imports are loaded when code reaches the import call. This is the foundation for many lazy loading patterns.

### `React.lazy`

`React.lazy` lets a component's code load only when that component is first rendered.

```tsx
import { lazy, Suspense } from "react";

const MarkdownPreview = lazy(() => import("./MarkdownPreview"));

export function Editor() {
  return (
    <Suspense fallback={<p>Loading preview...</p>}>
      <MarkdownPreview />
    </Suspense>
  );
}
```

Important rules:

- Declare lazy components at module scope, not inside another component.
- The imported module must provide a default export for `React.lazy`.
- Wrap lazy components in `Suspense`.
- Use an error boundary for failed chunk loads.

Bad:

```tsx
function Editor() {
  const MarkdownPreview = lazy(() => import("./MarkdownPreview"));
  return <MarkdownPreview />;
}
```

Declaring the lazy component inside render can reset state and recreate the component type.

### `Suspense`

`Suspense` shows fallback UI while a child tree is waiting for something, such as a lazy component chunk.

```tsx
<Suspense fallback={<RouteSkeleton />}>
  <SettingsPage />
</Suspense>
```

Good Suspense fallbacks:

- Match the space the content will occupy.
- Avoid layout jumps.
- Avoid replacing the whole app shell when only one panel is loading.
- Use skeletons for route content.
- Use small spinners for small regions.

Poor Suspense fallbacks:

- Full-page blank states for every small chunk.
- Loading text with no context.
- Nested boundaries that flash too often.
- Fallbacks that hide already-loaded stable layout.

Suspense improves loading UX only when boundaries are placed thoughtfully.

### Error Boundaries for Lazy Chunks

Lazy chunks can fail to load because of network errors, deployment version mismatch, ad blockers, stale service workers, or corrupted caches.

Wrap lazy regions with error boundaries:

```tsx
<ErrorBoundary fallback={<ChunkLoadError />}>
  <Suspense fallback={<SettingsSkeleton />}>
    <SettingsPage />
  </Suspense>
</ErrorBoundary>
```

Good chunk error UX should offer:

- Retry.
- Refresh page.
- Clear message.
- Support code if useful.

Do not assume lazy loading only has a loading path. It also has a failure path.

### Route-Level Code Splitting

Routes are natural code-splitting boundaries because users navigate to one route at a time.

With React Router route objects, route modules can be lazy:

```tsx
const router = createBrowserRouter([
  {
    path: "/settings",
    lazy: async () => {
      const module = await import("./routes/settings");
      return {
        Component: module.SettingsRoute,
        loader: module.loader,
        ErrorBoundary: module.ErrorBoundary,
      };
    },
  },
]);
```

This lets route code load when the route is needed. For many apps, route-level splitting gives better results than splitting small shared components.

### Route-Level Data Loading

Route-level loading is not only about code. It is also about data and pending UI.

Common responsibilities:

- Load route code.
- Load route data.
- Show pending navigation UI.
- Handle loader errors.
- Avoid duplicate fetches.
- Preserve app shell while route content loads.

Example with pending navigation:

```tsx
function AppShell() {
  const navigation = useNavigation();
  const isNavigating = navigation.state !== "idle";

  return (
    <>
      {isNavigating ? <TopProgressBar /> : null}
      <Outlet />
    </>
  );
}
```

Route-level pending UI should tell users that navigation is happening without destroying useful context.

### Bundle Analysis

Bundle analysis answers: what is in the bundle, how big is it, and why is it there?

Useful questions:

- Which dependencies dominate the bundle?
- Are multiple versions of a library included?
- Is a heavy library imported by the initial route?
- Are dynamic imports creating useful chunks?
- Did a barrel file accidentally pull in too much?
- Are locale files, icons, or editor plugins included unnecessarily?
- Are dev-only dependencies leaking into production?

Bundle analysis should be part of performance work because intuition about bundle size is often wrong.

### Bundle Size Metrics

Different sizes mean different things:

- Raw size: file size before compression.
- Minified size: after removing whitespace and shortening code.
- Gzip or Brotli size: transfer size over network.
- Parsed size: JavaScript the browser must parse.
- Execution cost: work done when modules initialize.

A small compressed file can still have expensive parse or execution cost. A charting library, date library, or editor can be costly even if transfer size looks acceptable.

### Vendor Chunks

Bundlers often separate application code from vendor dependencies. Manual chunking can help caching and loading strategy, but it can also make performance worse if done blindly.

Useful vendor chunk strategy:

- Keep stable, commonly used dependencies cacheable.
- Split rarely used heavy dependencies from the initial route.
- Avoid one massive vendor chunk that every route must download.
- Avoid too many tiny chunks that create request overhead.

Example Vite/Rollup configuration shape:

```ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["recharts"],
          markdown: ["react-markdown"],
        },
      },
    },
  },
});
```

Manual chunks should follow measured usage patterns, not guesswork.

### Lazy Loading Heavy Features

Good lazy loading candidates:

- Rich text editors.
- Markdown previewers.
- Charting dashboards.
- Map components.
- Admin-only routes.
- Report builders.
- Large schema-driven forms.
- Rarely used modals.
- Payment provider SDKs that are not needed immediately.

Poor candidates:

- Tiny components used on the first screen.
- Core layout components.
- Shared UI primitives used everywhere.
- Components whose loading fallback is more expensive than the component.

Lazy loading has overhead. Split where it meaningfully improves the user path.

### Prefetching and Preloading

Lazy loading can create a delay on first use. Prefetching can reduce that delay by starting the load before the user actually navigates.

Common prefetch triggers:

- Link hover.
- Link visible in viewport.
- User intent signal.
- After initial route becomes idle.
- Route likely to be visited next.

Example:

```tsx
function preloadSettingsRoute() {
  void import("./routes/settings");
}

<Link to="/settings" onMouseEnter={preloadSettingsRoute}>
  Settings
</Link>
```

Prefetching should be selective. Eagerly prefetching every route can undo the benefit of code splitting.

### Avoiding Waterfalls

Lazy loading can accidentally create waterfalls:

- Load route chunk.
- Then route component starts data request.
- Then component lazy-loads a heavy child.
- Then child starts another request.

Better patterns:

- Start route data in loaders.
- Lazy-load route module and important data in parallel where the router supports it.
- Preload likely child chunks.
- Move fetches out of deeply nested effects when route data is known.

The goal is not only smaller chunks. It is faster user-perceived loading.

### Route Boundaries and UX

Route-level splitting should preserve layout stability.

Good pattern:

- Keep app shell loaded.
- Show route skeleton in the outlet area.
- Keep navigation visible.
- Show route-specific error boundary on failure.

Bad pattern:

- Blank the entire screen for every route change.
- Lose navigation and user context.
- Show unrelated spinners in multiple regions.
- Hide already loaded data during background route revalidation.

Users should know where they are, where they are going, and what is loading.

### Common Mistakes

Common mistakes include:

- Declaring `lazy` components inside render.
- Splitting tiny components while leaving huge libraries in the initial bundle.
- Not adding error boundaries for failed chunks.
- Showing full-page spinners for every lazy section.
- Creating too many tiny chunks.
- Creating one huge vendor chunk needed by every route.
- Lazy loading code but still fetching data in nested effects, causing waterfalls.
- Not measuring before and after.
- Importing heavy dependencies through broad barrel files.
- Ignoring parse and execution cost.

### Best Practices

Best practices include:

- Start with route-level splitting.
- Lazy-load heavy, rare, or role-specific features.
- Keep critical app shell code eager.
- Use `Suspense` boundaries that preserve context.
- Add error boundaries around lazy routes or chunks.
- Analyze production bundles regularly.
- Track initial JavaScript, route chunks, and duplicate dependencies.
- Prefer measured manual chunking over guesswork.
- Prefetch likely next routes selectively.
- Avoid waterfalls by coordinating code and data loading.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is code splitting in React?

<!-- question:start:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-beginner-q01 -->
<!-- question-id:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Code splitting means breaking the JavaScript bundle into smaller chunks so the browser does not have to download and execute the whole application at initial load. React apps commonly use dynamic `import()`, `React.lazy`, route-level lazy loading, or framework-level route modules to load code only when needed.

The goal is to improve first load and user-perceived performance by deferring non-critical code.

##### Key Points to Mention

- Splits JavaScript into chunks.
- Reduces initial bundle cost.
- Uses dynamic import or route-level lazy loading.
- Helps when code is not needed immediately.
- Should be measured with bundle analysis.

<!-- question:end:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-beginner-q01 -->

#### What does `React.lazy` do?

<!-- question:start:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-beginner-q02 -->
<!-- question-id:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

`React.lazy` lets a component's code be loaded when the component is first rendered. It wraps a dynamic import and works with `Suspense`, which shows fallback UI while the component chunk loads.

The lazy component should be declared at module scope and should usually be protected by an error boundary for chunk-load failures.

##### Key Points to Mention

- Defers component code loading.
- Uses dynamic import.
- Requires `Suspense` for loading fallback.
- Declare lazy components outside render.
- Add error handling for chunk failures.

<!-- question:end:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-beginner-q02 -->

#### Why is route-level code splitting useful?

<!-- question:start:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-beginner-q03 -->
<!-- question-id:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Routes are natural boundaries because users usually view one route at a time. Route-level splitting keeps code for settings, admin pages, reports, or rarely used flows out of the initial bundle until the user navigates there.

It often gives a cleaner performance win than splitting many tiny shared components.

##### Key Points to Mention

- Routes match user navigation.
- Defers code for pages not yet visited.
- Good for admin, reports, dashboards, and editors.
- Works well with route loaders and pending UI.
- Avoids shipping every route up front.

<!-- question:end:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-beginner-q03 -->

#### What is bundle analysis?

<!-- question:start:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-beginner-q04 -->
<!-- question-id:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Bundle analysis is inspecting production build output to understand what code is included, how large chunks are, which dependencies dominate size, and whether code splitting is working as intended.

It helps teams find heavy libraries, duplicate dependencies, broad imports, and route chunks that accidentally pull in too much code.

##### Key Points to Mention

- Inspect production bundles.
- Identify large dependencies.
- Find duplicate libraries.
- Confirm lazy chunks.
- Guide optimization with data.

<!-- question:end:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How should Suspense boundaries be placed for route loading?

<!-- question:start:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-intermediate-q01 -->
<!-- question-id:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Suspense boundaries should preserve useful context. For route loading, the app shell and navigation should usually stay visible while the outlet or route content shows a skeleton or pending state. A full-page spinner may be acceptable for initial app boot, but it is usually too disruptive for ordinary route changes.

Boundaries should also be paired with route error handling so failed chunks or loaders do not crash the whole app.

##### Key Points to Mention

- Keep stable layout visible.
- Use route-level skeletons.
- Avoid blanking the whole app.
- Add error boundaries.
- Match fallback size to the loading region.

<!-- question:end:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-intermediate-q01 -->

#### What are good candidates for lazy loading?

<!-- question:start:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-intermediate-q02 -->
<!-- question-id:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Good candidates are heavy or rarely used features, such as rich text editors, charting dashboards, maps, report builders, admin-only routes, large form builders, and payment SDKs that are not needed on first load.

Poor candidates are tiny components, core layout, shared primitives, or anything needed immediately for the first screen.

##### Key Points to Mention

- Heavy dependencies.
- Rarely used routes.
- Role-specific features.
- Large editors, charts, maps, reports.
- Avoid splitting tiny critical components.

<!-- question:end:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-intermediate-q02 -->

#### What is a loading waterfall, and how can code splitting make it worse?

<!-- question:start:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-intermediate-q03 -->
<!-- question-id:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

A loading waterfall happens when one async step starts only after another finishes. Code splitting can make this worse if the app loads a route chunk, then starts the data request, then lazy-loads a child component, then that child starts another request.

To reduce waterfalls, load route code and route data in parallel where possible, use route loaders, prefetch likely chunks, and avoid deeply nested effects for required data.

##### Key Points to Mention

- Sequential async work slows navigation.
- Lazy chunks can delay data requests.
- Nested effects can create more steps.
- Start code and data early.
- Use route loaders and selective prefetching.

<!-- question:end:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-intermediate-q03 -->

#### How would you investigate a large Vite bundle?

<!-- question:start:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-intermediate-q04 -->
<!-- question-id:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

I would run a production build, inspect chunk sizes, use a bundle visualizer if available, and identify which modules are in the initial chunk. Then I would look for large dependencies, duplicate versions, broad imports, heavy route code loaded initially, and opportunities for route-level splitting.

I would measure before and after changes because manual chunking and lazy loading can create trade-offs.

##### Key Points to Mention

- Inspect production build output.
- Use analyzer or visualizer.
- Find heavy dependencies and duplicates.
- Check initial chunk versus async chunks.
- Measure before and after.

<!-- question:end:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design route-level loading for a dashboard route?

<!-- question:start:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-advanced-q01 -->
<!-- question-id:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would split the dashboard route module from the initial bundle, use a route loader or data library to start critical data loading at navigation time, keep the app shell visible, and show a dashboard skeleton in the route outlet. Heavy secondary widgets such as charts or maps could be lazy-loaded behind smaller Suspense boundaries.

I would also add route error boundaries, chunk-load retry UX, and selective prefetching if analytics show users commonly navigate there next.

##### Key Points to Mention

- Lazy route module.
- Start critical data early.
- Keep app shell visible.
- Skeleton for route content.
- Lazy secondary widgets.
- Add error boundaries and prefetch.

<!-- question:end:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-advanced-q01 -->

#### What are the trade-offs of manual chunks?

<!-- question:start:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-advanced-q02 -->
<!-- question-id:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Manual chunks can improve caching and keep heavy dependencies out of the initial bundle, but they can also create extra requests, duplicate shared code, or force users to download a large vendor chunk for a small route. The chunk strategy should be based on real route usage, dependency size, and cache behavior.

Manual chunking is useful when measured output shows a clear problem; it should not be applied blindly.

##### Key Points to Mention

- Can improve caching.
- Can isolate heavy dependencies.
- Can create too many requests.
- Can make vendor chunks too large.
- Should be based on bundle analysis.

<!-- question:end:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-advanced-q02 -->

#### How do you decide whether to prefetch a lazy route?

<!-- question:start:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-advanced-q03 -->
<!-- question-id:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

I would prefetch when there is a strong intent signal or high probability of navigation, such as link hover, viewport visibility, next-step flow, or route analytics. I would avoid prefetching every route because that can waste bandwidth and undo the benefit of splitting.

Prefetching should respect network conditions and should focus on chunks or data likely to be needed soon.

##### Key Points to Mention

- Use intent signals.
- Link hover or viewport visibility can help.
- Next-step flows are good candidates.
- Avoid prefetching everything.
- Consider bandwidth and device constraints.

<!-- question:end:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-advanced-q03 -->

#### What can cause a lazy-loaded chunk to fail, and how should the app respond?

<!-- question:start:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-advanced-q04 -->
<!-- question-id:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Chunk loading can fail because of network loss, stale cached HTML after a deployment, service worker issues, blocked files, or CDN problems. The app should use an error boundary around lazy routes or components and show a clear recovery path such as retrying, refreshing the page, or contacting support.

For deployment mismatch issues, a full page refresh often loads the current asset manifest and resolves the problem.

##### Key Points to Mention

- Network failures.
- Stale deployment assets.
- CDN or service worker issues.
- Error boundaries around lazy chunks.
- Retry or refresh recovery path.

<!-- question:end:code-splitting-lazy-loading-bundle-analysis-and-route-level-loading-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
