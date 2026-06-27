import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AppProviders } from "./AppProviders.tsx";
import { BrowserRouter } from "react-router-dom";
import { browserStore } from "./lib/redux/store.ts";

const routerBasename =
  import.meta.env.BASE_URL === "/"
    ? undefined
    : import.meta.env.BASE_URL.replace(/\/$/, "");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders store={browserStore}>
      <BrowserRouter basename={routerBasename}>
        <App />
      </BrowserRouter>
    </AppProviders>
  </StrictMode>
);
