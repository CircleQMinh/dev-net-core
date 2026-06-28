const trailingSlashRouteAliases = new Set([
  "/about-us",
  "/bug-report",
  "/changelog",
  "/content",
  "/practice",
  "/privacy",
  "/roadmap",
  "/simulation",
  "/simulation/setup",
  "/terms",
]);

export function getCanonicalPathname(pathname: string) {
  if (pathname === "/home" || pathname === "/home/") {
    return "/";
  }

  if (pathname.endsWith("/")) {
    return undefined;
  }

  if (
    trailingSlashRouteAliases.has(pathname) ||
    /^\/(?:content|practice)\/[^/]+$/.test(pathname)
  ) {
    return `${pathname}/`;
  }

  return undefined;
}
