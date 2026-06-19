---
id: nested-routes-layouts-params-and-route-boundaries
topic: Routing, forms, and server communication
subtopic: Nested routes, layouts, params, and route boundaries
category: React
---

## Overview

Nested routes, layouts, params, and route boundaries are central to building React applications where the URL reflects the shape of the UI. Instead of treating routing as a flat list of pages, modern routing libraries such as React Router let routes form a tree. Parent routes can provide layout, navigation, shared data, error handling, and loading boundaries while child routes render the specific screen for the current URL.

```tsx
const router = createBrowserRouter([
  {
    path: "/dashboard",
    Component: DashboardLayout,
    children: [
      { index: true, Component: DashboardHome },
      { path: "settings", Component: SettingsPage },
      { path: "teams/:teamId", Component: TeamPage },
    ],
  },
]);
```

In this example:

- `/dashboard` renders `DashboardLayout` and `DashboardHome`.
- `/dashboard/settings` renders `DashboardLayout` and `SettingsPage`.
- `/dashboard/teams/42` renders `DashboardLayout` and `TeamPage` with `teamId` available as a route param.

This topic matters for interviews because routing reveals whether a developer understands more than navigation links. Strong React developers should be able to design route trees, explain layout routes and outlets, use params correctly, avoid route ambiguity, place error/loading boundaries thoughtfully, and understand how route-level boundaries affect data loading and resilience.

The practical goal is to make the URL, data requirements, layout hierarchy, and error isolation match the user's mental model of the application.

## Core Concepts

### Route Trees

A route tree describes which UI should render for a URL.

```tsx
const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: HomePage },
      { path: "about", Component: AboutPage },
      {
        path: "projects",
        Component: ProjectsLayout,
        children: [
          { index: true, Component: ProjectsIndex },
          { path: ":projectId", Component: ProjectDetails },
        ],
      },
    ],
  },
]);
```

This route tree maps to a UI tree. Parent routes stay mounted while child routes change, which is useful for persistent navigation, shared layout, tabs, sidebars, and common data.

Route trees help avoid duplicating page shells:

```tsx
function RootLayout() {
  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
    </>
  );
}
```

The `Outlet` is where the matching child route renders.

### Nested Routes

Nested routes are child routes declared under a parent route.

```tsx
{
  path: "/account",
  Component: AccountLayout,
  children: [
    { index: true, Component: AccountOverview },
    { path: "billing", Component: BillingPage },
    { path: "security", Component: SecurityPage },
  ],
}
```

The child paths are relative to the parent:

- `/account`
- `/account/billing`
- `/account/security`

The parent component must render an `Outlet` for children to appear.

```tsx
function AccountLayout() {
  return (
    <section>
      <AccountNav />
      <Outlet />
    </section>
  );
}
```

If the parent does not render `Outlet`, the child route can match but the child UI has nowhere to render.

### Layout Routes

A layout route provides UI structure without necessarily adding a URL segment.

```tsx
{
  Component: MarketingLayout,
  children: [
    { index: true, Component: LandingPage },
    { path: "pricing", Component: PricingPage },
    { path: "contact", Component: ContactPage },
  ],
}
```

Because the parent route has no `path`, it does not add a URL segment. It only wraps its children in shared layout.

Layout routes are useful for:

- Marketing pages.
- Auth pages.
- App shell vs public shell.
- Admin sections.
- Repeated navigation and sidebars.
- Shared error boundaries.

Example with multiple layout layers:

```tsx
{
  path: "/app",
  Component: AppLayout,
  children: [
    {
      Component: SettingsLayout,
      children: [
        { path: "profile", Component: ProfileSettings },
        { path: "billing", Component: BillingSettings },
      ],
    },
  ],
}
```

The URL `/app/profile` can render both `AppLayout` and `SettingsLayout` even if `SettingsLayout` does not add its own segment.

### Index Routes

An index route is the default child route for a parent URL.

```tsx
{
  path: "/dashboard",
  Component: DashboardLayout,
  children: [
    { index: true, Component: DashboardHome },
    { path: "reports", Component: ReportsPage },
  ],
}
```

When the user visits `/dashboard`, the index route renders inside `DashboardLayout`.

Index routes:

- Do not have a `path`.
- Render at the parent route's URL.
- Cannot have child routes.
- Are useful for default content.

Common mistake:

```tsx
{ path: "", Component: DashboardHome }
```

Prefer `index: true` because it clearly communicates "default child route."

### Prefix Routes

A prefix route groups child routes under a URL path without adding a layout component.

```tsx
{
  path: "/projects",
  children: [
    { index: true, Component: ProjectsHome },
    { path: ":projectId", Component: ProjectDetails },
    { path: ":projectId/edit", Component: EditProject },
  ],
}
```

This creates URL paths under `/projects`, but no parent component is rendered. Use this when you want path grouping without shared UI.

Use a layout route when shared UI or an `Outlet` is needed. Use a prefix route when only the URL grouping matters.

### Dynamic Params

A dynamic segment starts with `:`.

```tsx
{
  path: "teams/:teamId",
  Component: TeamPage,
}
```

For `/teams/42`, `teamId` is `"42"`.

Components can read params:

```tsx
function TeamPage() {
  const params = useParams();

  return <h1>Team {params.teamId}</h1>;
}
```

Loaders and actions can also receive params:

```tsx
{
  path: "teams/:teamId",
  loader: async ({ params }) => {
    return fetchTeam(params.teamId);
  },
  Component: TeamPage,
}
```

Params are strings. Convert and validate them when needed:

```tsx
const teamId = Number(params.teamId);

if (!Number.isInteger(teamId)) {
  throw new Error("Invalid team id");
}
```

Do not assume route params are trusted or valid just because the route matched.

### Nested Params

Child routes inherit params from parent routes.

```tsx
{
  path: "organizations/:orgId",
  Component: OrganizationLayout,
  children: [
    { path: "projects/:projectId", Component: ProjectPage },
  ],
}
```

At `/organizations/acme/projects/123`, the project route can access both:

```tsx
const { orgId, projectId } = useParams();
```

This is useful when child data depends on parent identity:

```tsx
async function loader({ params }: LoaderArgs) {
  return fetchProject({
    orgId: params.orgId,
    projectId: params.projectId,
  });
}
```

Avoid reusing the same param name at multiple levels because it creates confusion:

```tsx
// Risky: both parent and child use :id.
"/organizations/:id/projects/:id"
```

Prefer meaningful names:

```tsx
"/organizations/:orgId/projects/:projectId"
```

### Search Params vs Route Params

Route params identify path segments:

```text
/products/42
```

`42` is usually a route param such as `productId`.

Search params represent query-string state:

```text
/products?sort=price&page=2
```

`sort` and `page` are search params.

Use route params for:

- Entity identity.
- Hierarchical resources.
- Canonical page identity.

Use search params for:

- Filters.
- Sort order.
- Pagination.
- Search text.
- View options.

Good design:

```text
/teams/:teamId/members?role=admin&page=2
```

The team identity is part of the path. Filtering and pagination are query-string state.

### Optional Segments and Splats

Some routing systems support optional path segments and splats.

Optional segment:

```tsx
{ path: ":lang?/categories", Component: CategoriesPage }
```

This can match both:

- `/categories`
- `/en/categories`

Splat route:

```tsx
{ path: "files/*", Component: FileBrowser }
```

A splat catches the remaining path. It is useful for file paths, documentation paths, and catch-all screens.

Be careful with broad splats. Put specific routes before broad catch-all concepts in your mental model, and keep 404 behavior intentional.

### Route Boundaries

A route boundary is a place where routing behavior is isolated. It can be a layout boundary, data boundary, loading boundary, or error boundary.

Examples:

- A parent route layout that keeps sidebar state while children change.
- A loader boundary that fetches data for a section.
- An error boundary that catches route errors below it.
- A lazy route boundary that code-splits a feature area.
- A reset boundary where changing a route key resets local state.

Route boundaries make large apps more resilient. A failure in `/invoices/:invoiceId` should not necessarily crash the whole app shell. An error boundary near the invoice route can show a focused failure screen while preserving the broader layout.

### Error Boundaries

Route-level error boundaries render when a route component, loader, action, or related route API throws.

```tsx
const router = createBrowserRouter([
  {
    path: "/app",
    Component: AppLayout,
    ErrorBoundary: AppErrorBoundary,
    children: [
      {
        path: "invoices/:invoiceId",
        Component: InvoicePage,
        ErrorBoundary: InvoiceErrorBoundary,
      },
    ],
  },
]);
```

If `InvoicePage` or its loader throws, the nearest boundary is `InvoiceErrorBoundary`. If a route has no boundary, the error bubbles to the nearest parent boundary.

Use route error boundaries for:

- 404s from route loaders.
- Failed route data requirements.
- Unexpected route rendering errors.
- Keeping layout shells alive when a child route fails.

Do not use error boundaries for normal form validation. Validation errors should usually be rendered through action data or component state.

### Route-Level Code Splitting

Routes are natural code-splitting boundaries. A user who never opens the admin area should not necessarily download all admin screens on the first page load.

Data routers can lazy-load route modules:

```tsx
{
  path: "/admin",
  lazy: async () => {
    const module = await import("./routes/admin");

    return {
      Component: module.AdminPage,
      loader: module.loader,
    };
  },
}
```

Good route splitting:

- Splits large feature areas.
- Avoids excessive tiny chunks.
- Keeps route data and route UI colocated when possible.
- Provides pending UI for navigation.

### Navigation Links

Use router-aware links instead of raw anchors for client-side navigation.

```tsx
import { Link, NavLink } from "react-router";

function MainNav() {
  return (
    <nav>
      <NavLink to="/dashboard">Dashboard</NavLink>
      <NavLink to="/dashboard/settings">Settings</NavLink>
    </nav>
  );
}
```

`Link` navigates without a full page reload. `NavLink` can expose active or pending states for navigation styling.

Use normal `<a>` for external URLs or when intentionally leaving the app.

### Designing Route Trees

A good route tree reflects product structure.

For an app with projects:

```tsx
{
  path: "/projects",
  Component: ProjectsLayout,
  children: [
    { index: true, Component: ProjectList },
    {
      path: ":projectId",
      Component: ProjectLayout,
      children: [
        { index: true, Component: ProjectOverview },
        { path: "settings", Component: ProjectSettings },
        { path: "members", Component: ProjectMembers },
      ],
    },
  ],
}
```

This supports:

- Persistent project navigation.
- Project-level params.
- Project-level data loading.
- Project-level error boundary.
- Child screens for sections.

Avoid huge flat route lists when the UI has obvious hierarchy. Avoid deeply nested routes when the UI does not actually share layout or data.

### Common Mistakes

Common mistakes include:

- Forgetting to render `Outlet` in a parent route.
- Using nested routes when a flat route would be clearer.
- Using flat routes and duplicating layout everywhere.
- Treating params as numbers without conversion.
- Reusing generic param names like `:id` at several levels.
- Putting filters and pagination in path params instead of search params.
- Using broad splat routes that hide real 404 behavior.
- Placing error boundaries only at the root.
- Using normal `<a>` tags for internal navigation and causing full page reloads.
- Creating route trees that do not match the product's actual information architecture.

### Best Practices

Use these rules of thumb:

- Let the route tree mirror the UI and product hierarchy.
- Use layouts for shared shell, navigation, and persistent UI.
- Use `Outlet` intentionally at parent routes.
- Use index routes for default child content.
- Use meaningful param names such as `orgId` and `projectId`.
- Validate and convert params before using them in data calls.
- Use search params for filters, sorting, and pagination.
- Place error boundaries where failures should be isolated.
- Use route boundaries for code splitting and data ownership.
- Keep route definitions understandable enough to reason about navigation flow.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What are nested routes in React routing?

<!-- question:start:nested-routes-layouts-params-and-route-boundaries-beginner-q01 -->
<!-- question-id:nested-routes-layouts-params-and-route-boundaries-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Nested routes are routes declared as children of another route. The parent route usually renders shared UI such as navigation or layout, and the child route renders inside the parent's `Outlet`.

```tsx
{
  path: "/dashboard",
  Component: DashboardLayout,
  children: [
    { index: true, Component: DashboardHome },
    { path: "settings", Component: SettingsPage },
  ],
}
```

The URL `/dashboard/settings` renders both `DashboardLayout` and `SettingsPage`. This avoids duplicating layout code and lets route structure match UI structure.

##### Key Points to Mention

- Nested routes are child routes.
- Child paths are relative to parent paths.
- Parent routes render children through `Outlet`.
- Nested routes are useful for shared layouts.
- They help the URL reflect UI hierarchy.

<!-- question:end:nested-routes-layouts-params-and-route-boundaries-beginner-q01 -->

#### What is an `Outlet`?

<!-- question:start:nested-routes-layouts-params-and-route-boundaries-beginner-q02 -->
<!-- question-id:nested-routes-layouts-params-and-route-boundaries-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

An `Outlet` is the placeholder in a parent route where the matched child route renders.

```tsx
function DashboardLayout() {
  return (
    <section>
      <DashboardNav />
      <Outlet />
    </section>
  );
}
```

If a route has children but the parent component does not render an `Outlet`, the child route UI will not appear in the layout.

##### Key Points to Mention

- `Outlet` renders the active child route.
- It belongs in parent layout components.
- It enables nested UI.
- Without it, child route content has nowhere to render.
- It can also pass context to child routes in some router APIs.

<!-- question:end:nested-routes-layouts-params-and-route-boundaries-beginner-q02 -->

#### What is a route param?

<!-- question:start:nested-routes-layouts-params-and-route-boundaries-beginner-q03 -->
<!-- question-id:nested-routes-layouts-params-and-route-boundaries-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A route param is a dynamic value captured from the URL path. It is usually declared with a colon.

```tsx
{ path: "teams/:teamId", Component: TeamPage }
```

For `/teams/42`, `teamId` is `"42"`. Components can read params with `useParams`, and loaders or actions can receive params from the router.

Params are strings, so IDs that need to be numbers should be converted and validated.

##### Key Points to Mention

- Params capture dynamic URL path segments.
- `:teamId` is a dynamic segment.
- Params are available to components and route data APIs.
- Params are strings.
- Validate params before using them for data access.

<!-- question:end:nested-routes-layouts-params-and-route-boundaries-beginner-q03 -->

#### What is an index route?

<!-- question:start:nested-routes-layouts-params-and-route-boundaries-beginner-q04 -->
<!-- question-id:nested-routes-layouts-params-and-route-boundaries-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

An index route is the default child route that renders at the parent route's URL.

```tsx
{
  path: "/dashboard",
  Component: DashboardLayout,
  children: [
    { index: true, Component: DashboardHome },
    { path: "settings", Component: SettingsPage },
  ],
}
```

When the user visits `/dashboard`, `DashboardHome` renders inside `DashboardLayout`. Index routes do not have a path and cannot have children.

##### Key Points to Mention

- Index routes are default child routes.
- They render at the parent URL.
- They use `index: true`.
- They do not have a path.
- They are useful for default section content.

<!-- question:end:nested-routes-layouts-params-and-route-boundaries-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How do layout routes differ from prefix routes?

<!-- question:start:nested-routes-layouts-params-and-route-boundaries-intermediate-q01 -->
<!-- question-id:nested-routes-layouts-params-and-route-boundaries-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

A layout route provides a component that wraps child routes and renders an `Outlet`. It may or may not add a URL segment. A prefix route groups child paths under a URL prefix without rendering a layout component.

Use a layout route when the children share UI, state, navigation, data, or boundaries. Use a prefix route when you only need path organization.

```tsx
{
  path: "/projects",
  children: [
    { index: true, Component: ProjectsHome },
    { path: ":projectId", Component: ProjectDetails },
  ],
}
```

This groups paths under `/projects` without introducing shared UI.

##### Key Points to Mention

- Layout routes render a component and an outlet.
- Prefix routes group paths without shared UI.
- Layout routes are for shared shells.
- Prefix routes are for URL organization.
- Choose based on whether a parent UI boundary is needed.

<!-- question:end:nested-routes-layouts-params-and-route-boundaries-intermediate-q01 -->

#### How should route params and search params be used differently?

<!-- question:start:nested-routes-layouts-params-and-route-boundaries-intermediate-q02 -->
<!-- question-id:nested-routes-layouts-params-and-route-boundaries-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Route params should represent path identity, such as an entity or hierarchy. Search params should represent optional view state such as filters, sorting, pagination, and search text.

Good example:

```text
/teams/:teamId/members?role=admin&page=2
```

`teamId` identifies the team. `role` and `page` describe how to view the members list.

Putting every filter into path segments makes URLs rigid and creates unnecessary route definitions. Putting core entity identity only in query strings can make routes less meaningful.

##### Key Points to Mention

- Route params identify path resources.
- Search params represent view options.
- Filters and pagination usually belong in query strings.
- Entity IDs usually belong in the path.
- Good URL design improves shareability and routing clarity.

<!-- question:end:nested-routes-layouts-params-and-route-boundaries-intermediate-q02 -->

#### What are route error boundaries?

<!-- question:start:nested-routes-layouts-params-and-route-boundaries-intermediate-q03 -->
<!-- question-id:nested-routes-layouts-params-and-route-boundaries-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Route error boundaries are error boundaries attached to routes. They render when a route component, loader, action, or other route API throws. The closest matching error boundary handles the error.

```tsx
{
  path: "/app",
  Component: AppLayout,
  ErrorBoundary: AppErrorBoundary,
  children: [
    {
      path: "invoices/:invoiceId",
      Component: InvoicePage,
      ErrorBoundary: InvoiceErrorBoundary,
    },
  ],
}
```

If the invoice route fails, the invoice boundary can show a focused error while the app shell remains available.

##### Key Points to Mention

- Boundaries catch route rendering and data errors.
- The closest boundary handles the error.
- They help isolate failures.
- Root boundaries are still important.
- They are not a replacement for normal form validation.

<!-- question:end:nested-routes-layouts-params-and-route-boundaries-intermediate-q03 -->

#### How do nested params work?

<!-- question:start:nested-routes-layouts-params-and-route-boundaries-intermediate-q04 -->
<!-- question-id:nested-routes-layouts-params-and-route-boundaries-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Child routes inherit params from parent routes. If the route tree has `organizations/:orgId` and a child route `projects/:projectId`, the project page can access both `orgId` and `projectId`.

```tsx
const { orgId, projectId } = useParams();
```

This is useful for nested resource loading. Use meaningful names to avoid collisions. `:orgId` and `:projectId` are clearer than using `:id` at multiple levels.

##### Key Points to Mention

- Child routes inherit parent params.
- Params are useful in loaders and components.
- Names should be meaningful.
- Avoid duplicate generic names like `:id`.
- Validate params before data access.

<!-- question:end:nested-routes-layouts-params-and-route-boundaries-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design routes for a project management area?

<!-- question:start:nested-routes-layouts-params-and-route-boundaries-advanced-q01 -->
<!-- question-id:nested-routes-layouts-params-and-route-boundaries-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Use nested routes that reflect the product hierarchy. A `/projects` layout can own the project list shell. A `:projectId` layout can own project-level navigation, project data, and project-level boundaries. Child routes can represent overview, settings, members, and activity.

```tsx
{
  path: "/projects",
  Component: ProjectsLayout,
  children: [
    { index: true, Component: ProjectList },
    {
      path: ":projectId",
      Component: ProjectLayout,
      ErrorBoundary: ProjectErrorBoundary,
      children: [
        { index: true, Component: ProjectOverview },
        { path: "settings", Component: ProjectSettings },
        { path: "members", Component: ProjectMembers },
      ],
    },
  ],
}
```

This keeps shared project UI persistent while child screens change.

##### Key Points to Mention

- Let routes mirror product hierarchy.
- Use layout routes for shared shell and navigation.
- Put entity-level params at the right boundary.
- Add boundaries where failures should be isolated.
- Avoid duplicating layout in flat route definitions.

<!-- question:end:nested-routes-layouts-params-and-route-boundaries-advanced-q01 -->

#### How should route boundaries influence data loading and error handling?

<!-- question:start:nested-routes-layouts-params-and-route-boundaries-advanced-q02 -->
<!-- question-id:nested-routes-layouts-params-and-route-boundaries-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Route boundaries should align with data ownership and failure isolation. A parent route can load data needed by the whole section, such as the current organization. A child route can load data needed only by that screen, such as one invoice. If the invoice loader fails, the invoice boundary can render an error without replacing the entire app shell.

Good placement prevents both extremes: one root loader that fetches everything and one root error boundary that turns every child failure into a full-page crash.

##### Key Points to Mention

- Parent routes can own shared data.
- Child routes can own screen-specific data.
- Error boundaries should isolate expected failure areas.
- Avoid loading all data at the root.
- Avoid handling every error only at the root.

<!-- question:end:nested-routes-layouts-params-and-route-boundaries-advanced-q02 -->

#### What are common route tree design mistakes?

<!-- question:start:nested-routes-layouts-params-and-route-boundaries-advanced-q03 -->
<!-- question-id:nested-routes-layouts-params-and-route-boundaries-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Common mistakes include making the route tree flat even when the UI has obvious shared layout, nesting routes only because paths share words, forgetting `Outlet`, placing all error handling at the root, using vague param names, putting filter state into path params, and using catch-all routes too broadly.

Another mistake is letting route structure mirror file organization instead of product navigation. File organization should support routing, but the URL and route tree should primarily express user-facing information architecture.

##### Key Points to Mention

- Flat routes can duplicate layout.
- Over-nesting can add complexity without shared UI.
- Missing `Outlet` hides child routes.
- Vague params cause bugs.
- Catch-all routes can hide 404 behavior.

<!-- question:end:nested-routes-layouts-params-and-route-boundaries-advanced-q03 -->

#### How do route-level code splitting and boundaries work together?

<!-- question:start:nested-routes-layouts-params-and-route-boundaries-advanced-q04 -->
<!-- question-id:nested-routes-layouts-params-and-route-boundaries-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Routes are natural code-splitting boundaries because users usually visit one route at a time. A route can lazy-load its component, loader, and related module code when the user navigates there. Layout routes can keep shared UI loaded while feature routes load on demand.

Boundaries make this safer. Pending UI can show while a route loads, and error boundaries can catch route load, data, or render failures. The result is better initial load performance without losing resilience.

Avoid splitting every tiny route into a separate chunk if it creates overhead. Split around meaningful feature areas.

##### Key Points to Mention

- Routes are natural lazy-loading boundaries.
- Layouts can stay mounted while children load.
- Pending UI improves navigation feedback.
- Error boundaries handle lazy/data/render failures.
- Split meaningful feature areas, not every small component.

<!-- question:end:nested-routes-layouts-params-and-route-boundaries-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
