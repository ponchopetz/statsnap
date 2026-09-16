import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Typeahead from "../Typeahead/Typeahead.jsx";

const players = [
  { playerId: "a", displayName: "Alpha One", position: "QB", team: "KC" },
  { playerId: "b", displayName: "Bravo Two", position: "", team: "FA" },
];

describe("Typeahead", () => {
  it("renders nothing while idle", () => {
    const { container } = render(<Typeahead status="idle" results={[]} activeIdx={0} onPick={() => {}} listboxId="lb" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows searching, slow-server, error, and empty states", () => {
    const { rerender } = render(<Typeahead status="loading" results={[]} activeIdx={0} onPick={() => {}} listboxId="lb" />);
    expect(screen.getByText("SEARCHING...")).toBeInTheDocument();
    rerender(<Typeahead status="loading" slow results={[]} activeIdx={0} onPick={() => {}} listboxId="lb" />);
    expect(screen.getByText(/WAKING FREE SERVER/)).toBeInTheDocument();
    rerender(<Typeahead status="error" errorMessage="Player search failed: 503" results={[]} activeIdx={0} onPick={() => {}} listboxId="lb" />);
    expect(screen.getByText("SEARCH FAILED — Player search failed: 503")).toBeInTheDocument();
    rerender(<Typeahead status="success" results={[]} activeIdx={0} onPick={() => {}} listboxId="lb" />);
    expect(screen.getByText(/NO PLAYER FOUND/)).toBeInTheDocument();
  });

  it("lists results with the active row selected and picks on click", () => {
    const onPick = vi.fn();
    render(<Typeahead status="success" results={players} activeIdx={1} onPick={onPick} listboxId="lb" getOptionId={(p) => `opt-${p.playerId}`} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("MATCHES")).toBeInTheDocument();
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("id", "opt-b");
    expect(options[1]).toHaveClass("typeahead-item--no-pos"); // no position badge
    fireEvent.click(options[0]);
    expect(onPick).toHaveBeenCalledWith(players[0]);
  });
});
