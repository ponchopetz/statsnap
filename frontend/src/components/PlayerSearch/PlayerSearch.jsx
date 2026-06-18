import { useState, useRef, useEffect, useId } from "react";
import { usePlayerSearch } from "../../hooks/usePlayerSearch.js";
import Typeahead from "../Typeahead/Typeahead.jsx";
import "./PlayerSearch.css";

function PlayerSearch({
  variant = "hero",
  onSelect,
  autoFocus = false,
  placeholder = "Type a player...",
  value: controlledValue,
  onChange,
}) {
  const isControlled = controlledValue !== undefined;
  const [internalQuery, setInternalQuery] = useState("");
  const query = isControlled ? controlledValue : internalQuery;

  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const listboxId = useId();

  const { status, results, errorMessage } = usePlayerSearch(query);

  const updateQuery = (next) => {
    if (!isControlled) setInternalQuery(next);
    onChange?.(next);
  };

  useEffect(() => {
    setActiveIdx(0);
  }, [results]);

  // Cmd/Ctrl-K focus shortcut — hero only
  useEffect(() => {
    if (variant !== "hero") return;
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [variant]);

  const onInputKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length > 0) {
        setActiveIdx((i) => Math.min(i + 1, results.length - 1));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length > 0) {
        setActiveIdx((i) => Math.max(i - 1, 0));
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results.length > 0) {
        onSelect(results[activeIdx]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      updateQuery("");
    }
  };

  const getOptionId = (player) => `${listboxId}-opt-${player.playerId}`;

  const isExpanded = status !== "idle";
  const activeOptionId =
    status === "success" && results.length > 0
      ? getOptionId(results[activeIdx])
      : undefined;

  return (
    <div className={`playersearch playersearch--${variant}`}>
      <div className="search-box">
        <span className="caret">&gt;</span>
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          onKeyDown={onInputKeyDown}
          role="combobox"
          aria-expanded={isExpanded}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          aria-autocomplete="list"
        />
        {variant === "hero" && <span className="kbd">⌘K</span>}
      </div>
      <Typeahead
        status={status}
        results={results}
        errorMessage={errorMessage}
        activeIdx={activeIdx}
        onPick={onSelect}
        listboxId={listboxId}
        getOptionId={getOptionId}
      />
    </div>
  );
}

export default PlayerSearch;
