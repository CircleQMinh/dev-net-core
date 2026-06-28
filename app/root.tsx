import type { ReactNode } from "react";
import {
  Links,
  Meta,
  Navigate,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";
import "../src/App.css";
import "../src/index.css";
import { AppProviders } from "../src/AppProviders";
import { getCanonicalPathname } from "../src/routing/canonicalPath";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/icon.png" />
        <script src="/theme-bootstrap.js" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return (
    <AppProviders hydrateBrowserPersistence>
      <CanonicalOutlet />
    </AppProviders>
  );
}

export function HydrateFallback() {
  return (
    <main className="theme-page flex min-h-screen items-center justify-center px-6">
      <section className="theme-content-card max-w-xl rounded-lg p-8 text-center">
        <p className="gleeple-heading theme-accent text-sm font-semibold uppercase">
          Error 404
        </p>
        <h1 className="gleeple-heading theme-text mt-3 text-3xl font-semibold">
          404 - Page Not Found
        </h1>
        <p className="theme-muted mt-4">
          The requested DEV_NET_CORE page could not be found.
        </p>
        <a
          className="gleeple-heading theme-accent mt-6 inline-block font-semibold"
          href="/"
        >
          Return home
        </a>
      </section>
    </main>
  );
}

function CanonicalOutlet() {
  const location = useLocation();
  const canonicalPathname = getCanonicalPathname(location.pathname);

  if (canonicalPathname) {
    return (
      <Navigate
        replace
        state={location.state}
        to={{
          hash: location.hash,
          pathname: canonicalPathname,
          search: location.search,
        }}
      />
    );
  }

  return <Outlet />;
}
