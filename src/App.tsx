import { Route, Routes } from "react-router-dom";
import "./App.css";
import AboutUs from "./pages/AboutUs";
import Content from "./pages/Content";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Practice from "./pages/Practice";
import { MainLayout } from "./layouts/MainLayout";

function App() {
  return (
    <>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/content" element={<Content />} />
          <Route path="/content/:topicId" element={<Content />} />
          <Route path="/content/:topicId/" element={<Content />} />
          <Route path="/about-us" element={<AboutUs />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/practice/:topicId" element={<Practice />} />
          <Route path="/practice/:topicId/" element={<Practice />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
