import "./Typeahead.css";

/**
 * Presentational component. Receives all data via props — no state,
 * no fetching. Renders the dropdown based on status, highlights the
 * row at activeIdx, and emits onPick(player) when a row is clicked.
 */
function Typeahead({ status, results, errorMessage, activeIdx, onPick, listboxId, getOptionId }) {
  if (status === "idle") return null;

  return (
    <div className="typeahead" role="listbox" id={listboxId}>
      {status === "loading" && (
        <div className="typeahead-hint">SEARCHING...</div>
      )}

      {status === "error" && (
        <div className="typeahead-empty">SEARCH FAILED — {errorMessage}</div>
      )}

      {status === "success" && results.length === 0 && (
        <div className="typeahead-empty">
          NO PLAYER FOUND — TRY "JEFFERSON" OR "MAHOMES"
        </div>
      )}

      {status === "success" && results.length > 0 && (
        <>
          <div className="typeahead-hint">
            <b>{results.length}</b> {results.length === 1 ? "MATCH" : "MATCHES"}
          </div>
          {results.map((p, i) => (
            <div
              key={p.playerId}
              id={getOptionId?.(p)}
              className={
                "typeahead-item" +
                (i === activeIdx ? " active" : "") +
                (!p.position ? " typeahead-item--no-pos" : "")
              }
              role="option"
              aria-selected={i === activeIdx}
              onClick={() => onPick(p)}
            >
              {p.position && (
                <div className={"pos-badge " + p.position}>{p.position}</div>
              )}
              <div>
                <div className="typeahead-name">{p.displayName}</div>
                <div className="typeahead-meta">{p.team}</div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default Typeahead;
