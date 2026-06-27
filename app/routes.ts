import {
  index,
  layout,
  route,
  type RouteConfig,
} from "@react-router/dev/routes";

const pageModule = "./routes/page.tsx";
const contentModule = "./routes/content.tsx";

export default [
  layout("./routes/main-layout.tsx", [
    index(pageModule, { id: "home" }),
    route("content/", contentModule, { id: "content-index" }),
    route("content/:topicId/", contentModule, { id: "content-topic" }),
    route("about-us/", pageModule, { id: "about-us" }),
    route("bug-report/", pageModule, { id: "bug-report" }),
    route("changelog/", pageModule, { id: "changelog" }),
    route("privacy/", pageModule, { id: "privacy" }),
    route("roadmap/", pageModule, { id: "roadmap" }),
    route("terms/", pageModule, { id: "terms" }),
    route("practice/", pageModule, { id: "practice-index" }),
    route("practice/:topicId/", pageModule, { id: "practice-topic" }),
    route("simulation/", pageModule, { id: "simulation-index" }),
    route("simulation/setup/", pageModule, { id: "simulation-setup" }),
    route("simulation/session/:sessionId", pageModule, {
      id: "simulation-session",
    }),
    route("simulation/result/:sessionId", pageModule, {
      id: "simulation-result",
    }),
    route("*", pageModule, { id: "not-found" }),
  ]),
] satisfies RouteConfig;
