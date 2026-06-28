import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "DEV_NET_CORE SSG Spike" },
  {
    name: "description",
    content: "React Router framework-mode static generation proof.",
  },
];

export default function Home() {
  return (
    <main>
      <h1>DEV_NET_CORE SSG Spike</h1>
      <p>This content was rendered into the initial HTML at build time.</p>
    </main>
  );
}
