import { describe, it, expect, vi, beforeEach } from "vitest";
import { inlineFontUrls, embeddedFontCss, resetFontCache, latinFacesOnly, FONT_CSS_URL } from "../embedFonts.js";

const css = `@font-face{font-family:'JetBrains Mono';src:url(https://fonts.gstatic.com/a.woff2) format('woff2');}
@font-face{font-family:'Space Grotesk';src:url(https://fonts.gstatic.com/b.woff2) format('woff2');}
@font-face{font-family:'JetBrains Mono';font-weight:700;src:url(https://fonts.gstatic.com/a.woff2) format('woff2');}`;

const okFetcher = vi.fn(async (url) => ({
  ok: true,
  text: async () => css,
  blob: async () => new Blob([url.endsWith("a.woff2") ? "AAA" : "BBB"], { type: "font/woff2" }),
}));

beforeEach(() => {
  resetFontCache();
  okFetcher.mockClear();
});

describe("latinFacesOnly", () => {
  it("keeps latin and range-less blocks and drops other scripts", () => {
    const sheet = `/* cyrillic */
@font-face{font-family:'A';src:url(https://fonts.gstatic.com/c.woff2);unicode-range:U+0400-045F;}
/* latin-ext */
@font-face{font-family:'A';src:url(https://fonts.gstatic.com/e.woff2);unicode-range:U+0100-02BA;}
/* latin */
@font-face{font-family:'A';src:url(https://fonts.gstatic.com/l.woff2);unicode-range:U+0000-00FF,U+0131;}
@font-face{font-family:'B';src:url(https://fonts.gstatic.com/n.woff2);}`;
    const out = latinFacesOnly(sheet);
    expect(out).toContain("l.woff2");
    expect(out).toContain("n.woff2");
    expect(out).not.toContain("c.woff2");
    expect(out).not.toContain("e.woff2");
  });
});

describe("inlineFontUrls", () => {
  it("fetches each distinct font once and swaps every url for a data URI", async () => {
    const out = await inlineFontUrls(css, okFetcher);
    expect(okFetcher).toHaveBeenCalledTimes(2);
    expect(out).not.toContain("fonts.gstatic.com");
    expect(out.match(/data:font\/woff2;base64,/g)).toHaveLength(3);
    expect(out).toContain("font-family:'Space Grotesk'");
  });

  it("propagates a failed font fetch", async () => {
    const bad = vi.fn(async () => ({ ok: false, status: 503 }));
    await expect(inlineFontUrls(css, bad)).rejects.toThrow("font fetch failed: 503");
  });
});

describe("embeddedFontCss", () => {
  it("loads the stylesheet, inlines it, and caches the result", async () => {
    const first = await embeddedFontCss(okFetcher);
    expect(okFetcher.mock.calls[0][0]).toBe(FONT_CSS_URL);
    expect(first).toContain("data:font/woff2;base64,");
    const again = await embeddedFontCss(okFetcher);
    expect(again).toBe(first);
    expect(okFetcher).toHaveBeenCalledTimes(3); // css + two fonts, no refetch
  });

  it("returns an empty string (and caches it) when anything fails", async () => {
    const bad = vi.fn(async () => { throw new Error("offline"); });
    expect(await embeddedFontCss(bad)).toBe("");
    expect(await embeddedFontCss(bad)).toBe("");
    expect(bad).toHaveBeenCalledTimes(1);
  });
});
