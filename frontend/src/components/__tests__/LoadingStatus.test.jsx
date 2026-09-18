import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LoadingStatus from "../LoadingStatus/LoadingStatus.jsx";

describe("LoadingStatus", () => {
  it("renders the label as a live status region without the slow bar", () => {
    render(<LoadingStatus className="x-status" label="LOADING..." slowLabel="WAKING FREE SERVER" />);
    const status = screen.getByRole("status");
    expect(status).toHaveClass("x-status");
    expect(screen.getByText("LOADING...")).toBeInTheDocument();
    expect(screen.queryByTestId("ls-bar")).not.toBeInTheDocument();
  });

  it("swaps to the slow label and shows the sweep bar when slow", () => {
    render(<LoadingStatus label="LOADING..." slowLabel="WAKING FREE SERVER" slow />);
    expect(screen.getByText("WAKING FREE SERVER")).toBeInTheDocument();
    expect(screen.queryByText("LOADING...")).not.toBeInTheDocument();
    expect(screen.getByTestId("ls-bar")).toBeInTheDocument();
  });
});
