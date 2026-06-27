import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("./routes/home.tsx"),
  route("content/", "./routes/content.tsx"),
  route("content/:topicId/", "./routes/content-topic.tsx"),
] satisfies RouteConfig;
