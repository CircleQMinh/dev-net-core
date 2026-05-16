import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./lib/redux/store.ts";
import { AppThemeModeProvider } from "./theme/ThemeModeProvider.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <AppThemeModeProvider>
          <App />
        </AppThemeModeProvider>
      </BrowserRouter>
    </Provider>
  </StrictMode>
);
