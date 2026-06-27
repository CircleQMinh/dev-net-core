export type StaticSeoRoute = Readonly<{
  canonicalPath: string;
  index: boolean;
  path: string;
  prerender: boolean;
  seoDescription: string;
  seoTitle: string;
  sitemap: boolean;
}>;

export const staticSeoRoutes: readonly StaticSeoRoute[];

export function getStaticSeoRoute(path: string): StaticSeoRoute | undefined;

export function validateStaticSeoRoutes(
  routes: readonly StaticSeoRoute[]
): void;
