import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./index.css";
import App from "./App";

const storedTheme = window.localStorage.getItem("mlsc_theme");
const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
if (storedTheme === "dark" || (!storedTheme && prefersDark)) {
  document.documentElement.classList.add("dark");
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
