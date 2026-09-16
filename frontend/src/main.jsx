import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./components/App/App.jsx";
import { applyTheme, getStoredTheme } from "./components/TweaksPanel/theme.js";
import { applyFlagsFromUrl } from "./utils/flags.js";
import "./index.css";

// Apply the persisted accent before first paint so the theme is honoured on
// every route — including a deep-linked player page, where the picker (landing
// only) never mounts.
applyTheme(getStoredTheme());

// Prototype feature flags: ?labs=compare,splits persists an opt-in for this
// browser before the router mounts (see utils/flags.js).
applyFlagsFromUrl();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
