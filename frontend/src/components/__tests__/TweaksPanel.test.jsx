import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TweaksPanel from "../TweaksPanel/TweaksPanel.jsx";
import { THEMES, STORAGE_KEY, getStoredTheme, applyTheme } from "../TweaksPanel/theme.js";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.style.removeProperty("--accent");
  document.documentElement.style.removeProperty("--accent-ink");
});

describe("theme model", () => {
  it("falls back to lime for a missing or unknown key", () => {
    expect(getStoredTheme()).toBe("lime");
    applyTheme("nope");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe(THEMES.lime.accent);
  });
});

describe("TweaksPanel", () => {
  it("opens, lists the swatches with the stored one pressed, and closes", () => {
    window.localStorage.setItem(STORAGE_KEY, "cyan");
    render(<TweaksPanel />);
    const trigger = screen.getByRole("button", { name: "Choose accent colour" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Choose accent colour" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Cyan" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Close theme picker" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("picking a swatch writes the CSS variables, persists the key, and closes", () => {
    render(<TweaksPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Choose accent colour" }));
    fireEvent.click(screen.getByRole("button", { name: "Red" }));
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe(THEMES.red.accent);
    expect(document.documentElement.style.getPropertyValue("--accent-ink")).toBe(THEMES.red.ink);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("red");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
