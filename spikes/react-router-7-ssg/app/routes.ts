import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("./routes/home.tsx"),
  route("content/", "./routes/content.tsx"),
  route("content/:topicId/", "./routes/content-topic.tsx"),
  route(
    "readiness/content/:topicId/",
    "./routes/readiness-content.tsx"
  ),
] satisfies RouteConfig;
