import "./SeasonSelector.css";

/**
 * SeasonSelector — presentational, controlled. Holds no state, never reads
 * or writes the URL. PlayerPage owns the selected season (derived from
 * useSearchParams) and passes it down; onSelect bubbles the click back up.
 *
 * Same controlled contract as the Tabs primitive in controlled mode
 * (activeTab + onTabChange): here it is selected + onSelect.
 *
 * Assumes a non-empty seasons array — PlayerPage only renders this when
 * there is more than one season to switch between.
 */
function SeasonSelector({ seasons, selected, onSelect }) {
  return (
    <div className="season-selector" role="group" aria-label="Season">
      {seasons.map((season) => {
        const isActive = season === selected;
        return (
          <button
            key={season}
            type="button"
            className={`season-btn${isActive ? " season-btn-active" : ""}`}
            aria-pressed={isActive}
            onClick={() => onSelect(season)}
          >
            {season}
          </button>
        );
      })}
    </div>
  );
}

export default SeasonSelector;
