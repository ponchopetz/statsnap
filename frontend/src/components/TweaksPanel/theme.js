// StatSnap — accent theme model.
// Shared by TweaksPanel (the picker UI, landing page only) and main.jsx
// (boot-time application, so the saved accent applies on every route —
// including a deep-linked player page where the picker never mounts).

export const STORAGE_KEY = "statsnap:theme";

export const THEMES = {
  lime: { accent: "oklch(0.88 0.22 128)", ink: "oklch(0.18 0.04 128)", label: "Lime" },
  cyan: { accent: "oklch(0.82 0.16 210)", ink: "oklch(0.14 0.04 210)", label: "Cyan" },
  red:  { accent: "oklch(0.72 0.22 28)",  ink: "oklch(0.98 0.01 28)",  label: "Red"  },
  blue: { accent: "oklch(0.72 0.18 250)", ink: "oklch(0.98 0.01 250)", label: "Blue" },
};

export const DEFAULT_THEME = "lime";

export function getStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

// Writes --accent and --accent-ink to :root. Every component using those
// custom properties re-renders via the cascade — no context or prop drilling.
export function applyTheme(key) {
  const t = THEMES[key] ?? THEMES[DEFAULT_THEME];
  document.documentElement.style.setProperty("--accent", t.accent);
  document.documentElement.style.setProperty("--accent-ink", t.ink);
}
