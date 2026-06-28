const routeDefinitions = [
  {
    path: "/",
    canonicalPath: "/",
    index: true,
    sitemap: true,
    prerender: true,
    seoDescription:
      "Structured interview preparation for .NET, React, SQL, Azure, architecture, and modern software engineering topics.",
    seoTitle: "DEV_NET_CORE | Developer Interview Preparation",
  },
  {
    path: "/home/",
    canonicalPath: "/",
    index: false,
    sitemap: false,
    prerender: false,
    seoDescription:
      "Structured interview preparation for .NET, React, SQL, Azure, architecture, and modern software engineering topics.",
    seoTitle: "DEV_NET_CORE | Developer Interview Preparation",
  },
  {
    path: "/content/",
    canonicalPath: "/content/",
    index: true,
    sitemap: true,
    prerender: true,
    seoDescription:
      "Explore structured interview preparation across .NET, architecture, SQL, React, Azure, and modern software engineering topics.",
    seoTitle: "Software Engineering Interview Curriculum | DEV_NET_CORE",
  },
  {
    path: "/practice/",
    canonicalPath: "/practice/",
    index: false,
    sitemap: false,
    prerender: false,
    seoDescription:
      "Practice topic-based software engineering interview questions with expected answers, key points, and progress tracking.",
    seoTitle: "Technical Interview Practice | DEV_NET_CORE",
  },
  {
    path: "/simulation/",
    canonicalPath: "/simulation/",
    index: false,
    sitemap: false,
    prerender: false,
    seoDescription:
      "Practice a realistic technical interview session by selecting focus topics, difficulty level, and question count.",
    seoTitle: "Mock Interview Simulation | DEV_NET_CORE",
  },
  {
    path: "/simulation/setup/",
    canonicalPath: "/simulation/setup/",
    index: false,
    sitemap: false,
    prerender: false,
    seoDescription:
      "Configure focus topics, difficulty, and question count for a DEV_NET_CORE mock interview session.",
    seoTitle: "Set Up a Mock Interview | DEV_NET_CORE",
  },
  {
    path: "/roadmap/",
    canonicalPath: "/roadmap/",
    index: true,
    sitemap: true,
    prerender: true,
    seoDescription:
      "Explore the DEV_NET_CORE roadmap for structured technical learning, interview practice, and simulation improvements.",
    seoTitle: "Developer Interview Preparation Roadmap | DEV_NET_CORE",
  },
  {
    path: "/about-us/",
    canonicalPath: "/about-us/",
    index: true,
    sitemap: true,
    prerender: true,
    seoDescription:
      "Learn how DEV_NET_CORE helps software engineers prepare for technical interviews with structured content and realistic practice.",
    seoTitle: "About DEV_NET_CORE | Developer Interview Preparation",
  },
  {
    path: "/changelog/",
    canonicalPath: "/changelog/",
    index: false,
    sitemap: false,
    prerender: false,
    seoDescription:
      "Review updates and improvements to DEV_NET_CORE interview preparation content, practice, and simulations.",
    seoTitle: "DEV_NET_CORE Changelog",
  },
  {
    path: "/bug-report/",
    canonicalPath: "/bug-report/",
    index: false,
    sitemap: false,
    prerender: false,
    seoDescription:
      "Report a problem with DEV_NET_CORE content, navigation, interview practice, or simulation workflows.",
    seoTitle: "Report a Bug | DEV_NET_CORE",
  },
  {
    path: "/privacy/",
    canonicalPath: "/privacy/",
    index: true,
    sitemap: true,
    prerender: true,
    seoDescription:
      "Review the DEV_NET_CORE privacy policy for the developer interview preparation website.",
    seoTitle: "Privacy Policy | DEV_NET_CORE",
  },
  {
    path: "/terms/",
    canonicalPath: "/terms/",
    index: true,
    sitemap: true,
    prerender: true,
    seoDescription:
      "Review the terms of use for the DEV_NET_CORE developer interview preparation website.",
    seoTitle: "Terms of Use | DEV_NET_CORE",
  },
];

export function validateStaticSeoRoutes(routes) {
  if (!Array.isArray(routes)) {
    throw new TypeError("Static SEO routes must be an array.");
  }

  const seenPaths = new Set();
  const seenIndexableDescriptions = new Set();
  const seenIndexableTitles = new Set();

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

    for (const field of ["seoTitle", "seoDescription"]) {
      if (typeof route[field] !== "string" || !route[field].trim()) {
        throw new TypeError(
          `Static SEO route ${label} must define non-empty ${field}.`
        );
      }
    }

    if (route.index && route.canonicalPath !== route.path) {
      throw new Error(`Indexable static SEO route ${label} must be self-canonical.`);
    }

    if (route.index) {
      if (seenIndexableTitles.has(route.seoTitle)) {
        throw new Error(
          `Indexable static SEO route ${label} must have a unique seoTitle.`
        );
      }

      if (seenIndexableDescriptions.has(route.seoDescription)) {
        throw new Error(
          `Indexable static SEO route ${label} must have a unique seoDescription.`
        );
      }

      seenIndexableTitles.add(route.seoTitle);
      seenIndexableDescriptions.add(route.seoDescription);
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
