import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PlayerSearch from "../PlayerSearch/PlayerSearch.jsx";

vi.mock("../../utils/api.js", () => ({ searchPlayers: vi.fn() }));
import { searchPlayers } from "../../utils/api.js";

afterEach(() => vi.clearAllMocks());

const results = [
  { playerId: "mahomes", displayName: "Patrick Mahomes", position: "QB", team: "KC" },
  { playerId: "mahomes2", displayName: "Other Mahomes", position: "WR", team: "MIN" },
];

const input = () => screen.getByRole("combobox");

describe("PlayerSearch", () => {
  it("debounces typing into one search and renders the results", async () => {
    searchPlayers.mockResolvedValue(results);
    render(<PlayerSearch onSelect={() => {}} />);
    fireEvent.change(input(), { target: { value: "m" } });
    fireEvent.change(input(), { target: { value: "ma" } });
    fireEvent.change(input(), { target: { value: "mah" } });

    expect(await screen.findByRole("option", { name: /Patrick Mahomes/ })).toBeInTheDocument();
    expect(searchPlayers).toHaveBeenCalledTimes(1);
    expect(searchPlayers).toHaveBeenCalledWith("mah", expect.any(AbortSignal));
    expect(input()).toHaveAttribute("aria-expanded", "true");
  });

  it("arrow keys move the active option and Enter selects it, then clears and closes", async () => {
    searchPlayers.mockResolvedValue(results);
    const onSelect = vi.fn();
    render(<PlayerSearch onSelect={onSelect} />);
    fireEvent.change(input(), { target: { value: "mah" } });
    await screen.findByRole("option", { name: /Patrick Mahomes/ });

    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "ArrowDown" }); // clamps at the last row
    expect(screen.getByRole("option", { name: /Other Mahomes/ })).toHaveAttribute("aria-selected", "true");
    expect(input()).toHaveAttribute("aria-activedescendant", expect.stringContaining("mahomes2"));
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(results[0]);
    expect(input()).toHaveValue("");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("Escape clears the query and closes; typing reopens", async () => {
    searchPlayers.mockResolvedValue(results);
    render(<PlayerSearch onSelect={() => {}} />);
    fireEvent.change(input(), { target: { value: "mah" } });
    await screen.findByRole("option", { name: /Patrick Mahomes/ });
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(input()).toHaveValue("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    fireEvent.change(input(), { target: { value: "mah" } });
    expect(await screen.findByRole("option", { name: /Patrick Mahomes/ })).toBeInTheDocument();
  });

  it("controlled mode reports changes to the parent and Enter does nothing with no results", async () => {
    searchPlayers.mockResolvedValue([]);
    const onChange = vi.fn();
    const onSelect = vi.fn();
    render(<PlayerSearch value="" onChange={onChange} onSelect={onSelect} />);
    fireEvent.change(input(), { target: { value: "zz" } });
    expect(onChange).toHaveBeenCalledWith("zz");
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("surfaces a failed search without throwing", async () => {
    searchPlayers.mockRejectedValue(new Error("Player search failed: 503"));
    render(<PlayerSearch onSelect={() => {}} />);
    fireEvent.change(input(), { target: { value: "mah" } });
    expect(await screen.findByText(/SEARCH FAILED/)).toBeInTheDocument();
  });

  it("Cmd/Ctrl+K focuses the hero search only", async () => {
    const { unmount } = render(<PlayerSearch variant="hero" onSelect={() => {}} />);
    expect(document.activeElement).not.toBe(input());
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(document.activeElement).toBe(input());
    unmount();

    render(<PlayerSearch variant="compact" onSelect={() => {}} />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    await waitFor(() => expect(document.activeElement).not.toBe(input()));
    expect(screen.queryByText("⌘K")).not.toBeInTheDocument();
  });
});
