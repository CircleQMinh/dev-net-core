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
    <div className="theme-page flex min-h-screen items-center justify-center">
      <p className="gleeple-heading theme-muted text-sm font-semibold uppercase">
        Loading DEV_NET_CORE...
      </p>
    </div>
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
