// LABS (flag: shareCard). Inline the web fonts into an SVG so a PNG export
// rendered through <img> + canvas (which cannot see the page's fonts) uses
// JetBrains Mono and Space Grotesk instead of the system monospace.
//
// Google Fonts serves a CSS file whose @font-face rules point at
// fonts.gstatic.com; those files are fetched and swapped for data: URIs.
// Anything failing along the way returns "" and the export falls back to
// system fonts rather than failing.

export const FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&family=Space+Grotesk:wght@400;600&display=swap";

const URL_PATTERN = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g;

function blobToDataUri(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

const FACE_PATTERN = /@font-face\s*\{[^}]*\}/g;

/**
 * Keeps only the @font-face blocks the card can use: those whose
 * unicode-range covers basic Latin (U+0000-00FF) or that declare no range.
 * Google serves one block per script subset; the others would only add
 * weight to the export.
 */
export function latinFacesOnly(css) {
  const faces = css.match(FACE_PATTERN) ?? [];
  return faces
    .filter((face) => !/unicode-range/i.test(face) || /U\+0000-00FF/i.test(face))
    .join("\n");
}

/**
 * Replaces every fonts.gstatic.com url() in `css` with a data: URI.
 * @param {string} css        the @font-face stylesheet
 * @param {(url: string) => Promise<Response>} fetcher   injectable for tests
 */
export async function inlineFontUrls(css, fetcher = fetch) {
  const urls = [...new Set([...css.matchAll(URL_PATTERN)].map((m) => m[1]))];
  const replacements = await Promise.all(
    urls.map(async (url) => {
      const res = await fetcher(url);
      if (!res.ok) throw new Error(`font fetch failed: ${res.status}`);
      return [url, await blobToDataUri(await res.blob())];
    }),
  );
  let out = css;
  for (const [url, data] of replacements) out = out.split(url).join(data);
  return out;
}

let cached = null;

/** Full @font-face CSS with embedded fonts, or "" if anything fails. Cached. */
export async function embeddedFontCss(fetcher = fetch) {
  if (cached != null) return cached;
  try {
    const res = await fetcher(FONT_CSS_URL);
    if (!res.ok) throw new Error(`font css failed: ${res.status}`);
    cached = await inlineFontUrls(latinFacesOnly(await res.text()), fetcher);
  } catch {
    cached = "";
  }
  return cached;
}

/** Test hook. */
export function resetFontCache() {
  cached = null;
}
