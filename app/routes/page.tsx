import type { MetaFunction } from "react-router";
import { useLocation } from "react-router";
import { buildSeoMetadata } from "../../shared/seo/buildSeoMetadata.mjs";
import AboutUs from "../../src/pages/AboutUs";
import BugReport from "../../src/pages/BugReport";
import Changelog from "../../src/pages/Changelog";
import Home from "../../src/pages/Home";
import NotFound from "../../src/pages/NotFound";
import Practice from "../../src/pages/Practice";
import Privacy from "../../src/pages/Privacy";
import Roadmap from "../../src/pages/Roadmap";
import Simulation from "../../src/pages/Simulation";
import SimulationResult from "../../src/pages/SimulationResult";
import SimulationSession from "../../src/pages/SimulationSession";
import Terms from "../../src/pages/Terms";
import { curriculumManifest } from "../../src/contents/curriculumManifest.generated";
import {
  createMetaDescriptors,
  StructuredData,
} from "../seo/routeMetadata";

const curriculumEntriesById = new Map(
  curriculumManifest.map((entry) => [entry.id, entry])
);

export const meta: MetaFunction = ({ location }) =>
  createMetaDescriptors(getPageMetadata(location.pathname));

export default function PageRoute() {
  const { pathname } = useLocation();
  const metadata = getPageMetadata(pathname);

  return (
    <>
      <StructuredData value={metadata.structuredData} />
      {renderPage(pathname)}
    </>
  );
}

function renderPage(pathname: string) {
  switch (pathname) {
    case "/":
      return <Home />;
    case "/about-us/":
      return <AboutUs />;
    case "/bug-report/":
      return <BugReport />;
    case "/changelog/":
      return <Changelog />;
    case "/practice/":
      return <Practice />;
    case "/privacy/":
      return <Privacy />;
    case "/roadmap/":
      return <Roadmap />;
    case "/simulation/":
    case "/simulation/setup/":
      return <Simulation />;
    case "/terms/":
      return <Terms />;
  }

  if (/^\/practice\/[^/]+\/$/.test(pathname)) {
    return <Practice />;
  }

  if (/^\/simulation\/session\/[^/]+\/?$/.test(pathname)) {
    return <SimulationSession />;
  }

  if (/^\/simulation\/result\/[^/]+\/?$/.test(pathname)) {
    return <SimulationResult />;
  }

  return <NotFound />;
}

function getPageMetadata(pathname: string) {
  const topicId = pathname.match(
    /^\/practice\/([a-z0-9][a-z0-9-]*)\/$/
  )?.[1];

  return buildSeoMetadata({
    contentEntry: topicId
      ? curriculumEntriesById.get(topicId)
      : undefined,
    pathname,
  });
}
