import { useParams, useNavigate } from "react-router-dom";
import "./PlayerPage.css";

// Mock data shape — defines the contract for usePlayerProfile (Chunk 9)
// and the ETL roster + draft extension (Chunk 10). Every field below
// must be available from nflverse load_rosters() or load_draft_picks().
const MOCK_PLAYER = {
  playerId: "00-0033873",
  displayName: "Patrick Mahomes",
  position: "QB",
  team: "KC",
  teamCity: "Kansas City",
  jerseyNumber: 15,
  age: 30,
  experience: 9,
  height: "6'2\"",
  weight: 230,
  college: "Texas Tech",
  draftYear: 2017,
  draftRound: 1,
  draftPick: 10,
  headshotUrl: null,
};

function PlayerPage() {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const player = MOCK_PLAYER;

  // Split "Patrick Mahomes" into firstName "Patrick" + lastName "Mahomes"
  // so the lastname can render large per the design.
  const nameParts = player.displayName.split(" ");
  const firstName = nameParts.slice(0, -1).join(" ");
  const lastName = nameParts[nameParts.length - 1];

  return (
    <div className="player-page">
      <header className="player-topbar">
        <button
          type="button"
          className="back-btn"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
        >
          ← BACK
        </button>

        <div className="player-topbar-search">
          <span className="caret">&gt;</span>
          <input
            placeholder="Search another player..."
            disabled
          />
        </div>

        <span className="brand-mark">
          STAT<span className="slash">/</span>SNAP
        </span>
      </header>

      <div className="player-content">
        <aside className="identity">
          <div className="id-photo">
            <span className="id-photo-label">PHOTO · {player.team}</span>
            <span className="id-photo-jersey">{player.jerseyNumber}</span>
          </div>

          <div className="id-name">
            <div className="id-firstname">{firstName}</div>
            <div className="id-lastname">{lastName.toUpperCase()}</div>
          </div>

          <div className="id-meta">
            <span className={"pos-badge " + player.position}>
              {player.position}
            </span>
            <span className="id-team">{player.team}</span>
            <span className="id-sep">·</span>
            <span>#{player.jerseyNumber}</span>
            <span className="id-sep">·</span>
            <span>{player.teamCity.toUpperCase()}</span>
          </div>

          <div className="bio-grid">
            <div className="bio-cell">
              <div className="bio-label">AGE</div>
              <div className="bio-value">{player.age}</div>
            </div>
            <div className="bio-cell">
              <div className="bio-label">EXP</div>
              <div className="bio-value">{player.experience} YR</div>
            </div>
            <div className="bio-cell">
              <div className="bio-label">HT</div>
              <div className="bio-value">{player.height}</div>
            </div>
            <div className="bio-cell">
              <div className="bio-label">WT</div>
              <div className="bio-value">{player.weight}</div>
            </div>
            <div className="bio-cell bio-cell-wide">
              <div className="bio-label">COLLEGE</div>
              <div className="bio-value">{player.college}</div>
            </div>
            <div className="bio-cell bio-cell-wide">
              <div className="bio-label">DRAFT</div>
              <div className="bio-value">
                {player.draftYear} · R{player.draftRound} · #{player.draftPick}
              </div>
            </div>
          </div>
        </aside>

        <main className="stats">
          <div className="stats-placeholder">
            <div className="stats-placeholder-label">STATS</div>
            <div className="stats-placeholder-text">
              Tabs (Overview · Advanced · Game Log · Career), stat tiles,
              and advanced metrics arrive in Chunks 11 through 15.
            </div>
            <div className="stats-placeholder-id">
              playerId from URL: {playerId}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default PlayerPage;
