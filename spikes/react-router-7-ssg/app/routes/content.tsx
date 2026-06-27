import type { MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router";
import { getFirstTopicPath } from "../lib/content.server";

export function loader() {
  return { firstTopicPath: getFirstTopicPath() };
}

export const meta: MetaFunction = () => [
  { title: "Software Engineering Interview Curriculum | DEV_NET_CORE" },
  {
    name: "description",
    content: "Explore the DEV_NET_CORE interview preparation curriculum.",
  },
];

export default function ContentIndex() {
  const { firstTopicPath } = useLoaderData<typeof loader>();

  return (
    <main>
      <h1>Software Engineering Interview Curriculum</h1>
      <p>This route proves static output for the curriculum landing page.</p>
      <Link to={firstTopicPath}>Open pre-rendered topic</Link>
    </main>
  );
}
