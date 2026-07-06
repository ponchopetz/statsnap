import { useState } from "react";
import { STORAGE_KEY, THEMES, applyTheme, getStoredTheme } from "./theme.js";
import "./TweaksPanel.css";

// ─────────────────────────────────────────────────────────────────────────────
// StatSnap — TweaksPanel (accent-colour picker)
//
// Rendered on the LANDING page only (see Landing.jsx). The chosen accent still
// applies app-wide because the theme is written to :root and bootstrapped at
// startup in main.jsx — only this control is scoped to the landing page.
//
//   • Clicking the trigger pill (bottom-right) opens a 4-swatch panel.
//   • Picking a swatch writes --accent / --accent-ink to :root immediately,
//     persists the key to localStorage, and closes the panel.
// ─────────────────────────────────────────────────────────────────────────────

function TweaksPanel() {
  const [theme, setTheme] = useState(getStoredTheme);
  const [open, setOpen] = useState(false);

  const pick = (key) => {
    setTheme(key);
    applyTheme(key);
    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch {
      /* storage blocked */
    }
    setOpen(false);
  };

  const currentAccent = (THEMES[theme] ?? THEMES.lime).accent;

  return (
    <div className="theme-picker">
      {open && (
        <div
          className="theme-picker-panel"
          role="dialog"
          aria-label="Choose accent colour"
        >
          <p className="theme-picker-label">ACCENT THEME</p>
          <div className="theme-picker-swatches">
            {Object.entries(THEMES).map(([key, t]) => (
              <button
                key={key}
                type="button"
                className={"theme-swatch" + (theme === key ? " active" : "")}
                onClick={() => pick(key)}
                aria-pressed={theme === key}
                title={t.label}
              >
                <span className="theme-swatch-chip" style={{ "--c": t.accent }} />
                <span className="theme-swatch-name">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className={"theme-trigger" + (open ? " is-open" : "")}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close theme picker" : "Choose accent colour"}
        aria-expanded={open}
      >
        <span className="theme-trigger-dot" style={{ "--c": currentAccent }} />
        <span className="theme-trigger-text">{open ? "CLOSE" : "THEME"}</span>
      </button>
    </div>
  );
}

export default TweaksPanel;
