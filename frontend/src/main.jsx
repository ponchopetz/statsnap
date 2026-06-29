import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./components/App/App.jsx";
import { applyTheme, getStoredTheme } from "./components/TweaksPanel/theme.js";
import "./index.css";

// Apply the persisted accent before first paint so the theme is honoured on
// every route — including a deep-linked player page, where the picker (landing
// only) never mounts.
applyTheme(getStoredTheme());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
