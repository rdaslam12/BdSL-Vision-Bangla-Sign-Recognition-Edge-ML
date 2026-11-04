import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/archivo/wght.css";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles.css";
import "./showcase.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
