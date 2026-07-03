import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "simplebar-core/dist/simplebar.css";
import "./styles/simplebar.css";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
