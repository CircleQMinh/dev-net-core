const routeDefinitions = [
  {
    path: "/",
    canonicalPath: "/",
    index: true,
    sitemap: true,
    prerender: true,
  },
  {
    path: "/home/",
    canonicalPath: "/",
    index: false,
    sitemap: false,
    prerender: false,
  },
  {
    path: "/content/",
    canonicalPath: "/content/",
    index: true,
    sitemap: true,
    prerender: true,
  },
  {
    path: "/practice/",
    canonicalPath: "/practice/",
    index: false,
    sitemap: false,
    prerender: false,
  },
  {
    path: "/simulation/",
    canonicalPath: "/simulation/",
    index: false,
    sitemap: false,
    prerender: false,
  },
  {
    path: "/simulation/setup/",
    canonicalPath: "/simulation/setup/",
    index: false,
    sitemap: false,
    prerender: false,
  },
  {
    path: "/roadmap/",
    canonicalPath: "/roadmap/",
    index: true,
    sitemap: true,
    prerender: true,
  },
  {
    path: "/about-us/",
    canonicalPath: "/about-us/",
    index: true,
    sitemap: true,
    prerender: true,
  },
  {
    path: "/changelog/",
    canonicalPath: "/changelog/",
    index: false,
    sitemap: false,
    prerender: false,
  },
  {
    path: "/bug-report/",
    canonicalPath: "/bug-report/",
    index: false,
    sitemap: false,
    prerender: false,
  },
  {
    path: "/privacy/",
    canonicalPath: "/privacy/",
    index: true,
    sitemap: true,
    prerender: true,
  },
  {
    path: "/terms/",
    canonicalPath: "/terms/",
    index: true,
    sitemap: true,
    prerender: true,
  },
];

export function validateStaticSeoRoutes(routes) {
  if (!Array.isArray(routes)) {
    throw new TypeError("Static SEO routes must be an array.");
  }

  const seenPaths = new Set();

  routes.forEach((route, index) => {
    const label = route?.path || `entry ${index}`;

    if (!route || typeof route !== "object" || Array.isArray(route)) {
      throw new TypeError(`Static SEO route ${label} must be an object.`);
    }

    if (!isCanonicalPath(route.path)) {
      throw new Error(
        `Static SEO route path "${route.path}" must be "/" or a lowercase trailing-slash path.`
      );
    }

    if (seenPaths.has(route.path)) {
      throw new Error(`Duplicate static SEO route path "${route.path}".`);
    }

    seenPaths.add(route.path);

    if (!isCanonicalPath(route.canonicalPath)) {
      throw new Error(
        `Canonical path "${route.canonicalPath}" for ${label} must be "/" or a lowercase trailing-slash path.`
      );
    }

    for (const flag of ["index", "sitemap", "prerender"]) {
      if (typeof route[flag] !== "boolean") {
        throw new TypeError(`Static SEO route ${label} must define boolean ${flag}.`);
      }
    }

    if (route.index && route.canonicalPath !== route.path) {
      throw new Error(`Indexable static SEO route ${label} must be self-canonical.`);
    }

    if (
      route.sitemap &&
      (!route.index ||
        !route.prerender ||
        route.canonicalPath !== route.path)
    ) {
      throw new Error(
        `Sitemap route ${label} must be indexable, pre-rendered, and self-canonical.`
      );
    }
  });
}

function isCanonicalPath(value) {
  return (
    value === "/" ||
    (typeof value === "string" &&
      /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)+$/.test(value))
  );
}

validateStaticSeoRoutes(routeDefinitions);

export const staticSeoRoutes = Object.freeze(
  routeDefinitions.map((route) => Object.freeze({ ...route }))
);

export function getStaticSeoRoute(path) {
  return staticSeoRoutes.find((route) => route.path === path);
}
