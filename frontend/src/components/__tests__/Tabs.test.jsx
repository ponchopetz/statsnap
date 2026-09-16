import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Tabs from "../Tabs/Tabs.jsx";

function Demo({ onTabChange, activeTab, defaultTab = "a" }) {
  return (
    <Tabs defaultTab={activeTab === undefined ? defaultTab : undefined} activeTab={activeTab} onTabChange={onTabChange}>
      <Tabs.List>
        <Tabs.Tab id="a">Alpha</Tabs.Tab>
        <Tabs.Tab id="b">Bravo</Tabs.Tab>
        <Tabs.Tab id="c">Charlie</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel id="a">panel a</Tabs.Panel>
      <Tabs.Panel id="b">panel b</Tabs.Panel>
      <Tabs.Panel id="c">panel c</Tabs.Panel>
    </Tabs>
  );
}

const tab = (name) => screen.getByRole("tab", { name });

describe("Tabs primitive", () => {
  it("mounts only the active panel and uses a roving tabindex", () => {
    render(<Demo />);
    expect(screen.getByRole("tabpanel")).toHaveTextContent("panel a");
    expect(screen.queryByText("panel b")).not.toBeInTheDocument();
    expect(tab("Alpha")).toHaveAttribute("tabindex", "0");
    expect(tab("Bravo")).toHaveAttribute("tabindex", "-1");
    expect(tab("Alpha")).toHaveAttribute("aria-selected", "true");
    expect(tab("Alpha")).toHaveAttribute("aria-controls", "panel-a");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "tab-a");
  });

  it("arrow keys move selection and focus, wrapping at both ends; Home and End jump", () => {
    const onTabChange = vi.fn();
    render(<Demo onTabChange={onTabChange} />);
    const list = screen.getByRole("tablist");
    tab("Alpha").focus();

    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(tab("Bravo")).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(tab("Bravo"));

    fireEvent.keyDown(list, { key: "ArrowLeft" });
    fireEvent.keyDown(list, { key: "ArrowLeft" });
    expect(tab("Charlie")).toHaveAttribute("aria-selected", "true"); // wrapped

    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(tab("Alpha")).toHaveAttribute("aria-selected", "true"); // wrapped forward

    fireEvent.keyDown(list, { key: "End" });
    expect(tab("Charlie")).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(list, { key: "Home" });
    expect(tab("Alpha")).toHaveAttribute("aria-selected", "true");

    expect(onTabChange).toHaveBeenCalledTimes(6);
    expect(screen.getByRole("tabpanel")).toHaveTextContent("panel a");
  });

  it("ignores unrelated keys and clicking selects", () => {
    render(<Demo />);
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowDown" });
    expect(tab("Alpha")).toHaveAttribute("aria-selected", "true");
    fireEvent.click(tab("Charlie"));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("panel c");
  });

  it("controlled mode: the parent owns the state and only onTabChange fires", () => {
    const onTabChange = vi.fn();
    const { rerender } = render(<Demo activeTab="b" onTabChange={onTabChange} />);
    expect(screen.getByRole("tabpanel")).toHaveTextContent("panel b");
    fireEvent.click(tab("Charlie"));
    expect(onTabChange).toHaveBeenCalledWith("c");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("panel b"); // unchanged until parent rerenders
    rerender(<Demo activeTab="c" onTabChange={onTabChange} />);
    expect(screen.getByRole("tabpanel")).toHaveTextContent("panel c");
  });

  it("throws a clear error when a subcomponent is used outside <Tabs>", () => {
    // React logs the throw and jsdom re-reports it on window; keep the
    // output clean since the throw is the behaviour under test.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const swallow = (e) => e.preventDefault();
    window.addEventListener("error", swallow);
    expect(() => render(<Tabs.Tab id="x">x</Tabs.Tab>)).toThrow(/must be used inside <Tabs>/);
    window.removeEventListener("error", swallow);
    spy.mockRestore();
  });
});
