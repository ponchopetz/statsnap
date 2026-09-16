// Feature flags for prototype features. Everything defaults OFF so the
// production build behaves exactly as before. A flag is on when the first
// of these says so:
//
//   1. localStorage "statsnap:flags"  → {"compare": true}   (per browser)
//   2. Vite env  VITE_FLAG_COMPARE=true                       (per build)
//   3. the default below
//
// A demo link can switch flags on for a browser without a rebuild:
//   /?labs=compare,splits,leaderboards    (persisted, see applyFlagsFromUrl)
//   /?labs=off                            (clears every override)
//
// Flags are read at render time, not subscribed to, so a change needs a
// page load to take effect. That is deliberate: prototypes should never
// pop into an existing session.

export const FLAG_DEFAULTS = {
  compare: false,
  splits: false,
  leaderboards: false,
};

export const FLAGS_STORAGE_KEY = "statsnap:flags";

function readStored() {
  try {
    const raw = window.localStorage.getItem(FLAGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readEnv(name) {
  const value = import.meta.env[`VITE_FLAG_${name.toUpperCase()}`];
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export function isFlagEnabled(name) {
  if (!(name in FLAG_DEFAULTS)) return false;
  const stored = readStored()[name];
  if (typeof stored === "boolean") return stored;
  const env = readEnv(name);
  if (env !== undefined) return env;
  return FLAG_DEFAULTS[name];
}

export function enabledFlags() {
  return Object.keys(FLAG_DEFAULTS).filter(isFlagEnabled);
}

export function setFlags(overrides) {
  try {
    const next = { ...readStored(), ...overrides };
    window.localStorage.setItem(FLAGS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked */
  }
}

/**
 * Reads ?labs=a,b from the current URL, persists it, and strips the param so
 * the address bar stays clean. Called once at boot from main.jsx.
 */
export function applyFlagsFromUrl() {
  let url;
  try {
    url = new URL(window.location.href);
  } catch {
    return;
  }
  const labs = url.searchParams.get("labs");
  if (labs === null) return;

  if (labs === "off") {
    try {
      window.localStorage.removeItem(FLAGS_STORAGE_KEY);
    } catch {
      /* storage blocked */
    }
  } else {
    const wanted = labs.split(",").map((s) => s.trim()).filter((s) => s in FLAG_DEFAULTS);
    setFlags(Object.fromEntries(wanted.map((name) => [name, true])));
  }

  url.searchParams.delete("labs");
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}
