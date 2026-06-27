import { Route, Routes } from "react-router-dom";
import "./App.css";
import { Seo } from "./components/seo/Seo";
import AboutUs from "./pages/AboutUs";
import BugReport from "./pages/BugReport";
import Changelog from "./pages/Changelog";
import Content from "./pages/Content";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Practice from "./pages/Practice";
import Privacy from "./pages/Privacy";
import Roadmap from "./pages/Roadmap";
import Simulation from "./pages/Simulation";
import SimulationResult from "./pages/SimulationResult";
import SimulationSession from "./pages/SimulationSession";
import Terms from "./pages/Terms";
import { MainLayout } from "./layouts/MainLayout";

function App() {
  return (
    <>
      <Seo />
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/content" element={<Content />} />
          <Route path="/content/:topicId" element={<Content />} />
          <Route path="/content/:topicId/" element={<Content />} />
          <Route path="/about-us" element={<AboutUs />} />
          <Route path="/bug-report" element={<BugReport />} />
          <Route path="/changelog" element={<Changelog />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/practice/:topicId" element={<Practice />} />
          <Route path="/practice/:topicId/" element={<Practice />} />
          <Route path="/simulation" element={<Simulation />} />
          <Route path="/simulation/setup" element={<Simulation />} />
          <Route path="/simulation/session/:sessionId" element={<SimulationSession />} />
          <Route path="/simulation/result/:sessionId" element={<SimulationResult />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
