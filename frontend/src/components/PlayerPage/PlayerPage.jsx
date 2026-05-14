import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePlayerProfile } from "../../hooks/usePlayerProfile.js";
import { formatAge, formatHeight, formatDraft } from "../../utils/format.js";
import Tabs from "../Tabs/Tabs.jsx";
import Overview from "../Overview/Overview.jsx";
import "./PlayerPage.css";

function PlayerPage() {
  const { playerId } = useParams();
  const navigate = useNavigate();

  const { status, data, errorMessage } = usePlayerProfile(playerId);
  const player = data?.[0];

  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => { setImageFailed(false); }, [playerId]);

  const nameParts = player?.displayName?.split(" ") ?? [];
  const firstName = nameParts.slice(0, -1).join(" ");
  const lastName = nameParts[nameParts.length - 1] ?? "";

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

      {status === "loading" && (
        <div className="player-status">LOADING PLAYER...</div>
      )}

      {status === "error" && (
        <div className="player-status">
          FAILED TO LOAD PLAYER — {errorMessage}
        </div>
      )}

      {status === "not_found" && (
        <div className="player-status">
          PLAYER NOT FOUND — ID: {playerId}
        </div>
      )}

      {status === "success" && player && (
        <div className="player-content">
          <aside className="identity">
            <div className="id-photo">
              {player.headshotUrl && !imageFailed ? (
                <img
                  src={player.headshotUrl}
                  alt={player.displayName}
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <>
                  <span className="id-photo-label">PHOTO · {player.team}</span>
                  {player.jerseyNumber != null && (
                    <span className="id-photo-jersey">{player.jerseyNumber}</span>
                  )}
                </>
              )}
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
              {player.jerseyNumber != null && (
                <>
                  <span className="id-sep">·</span>
                  <span>#{player.jerseyNumber}</span>
                </>
              )}
              {player.teamCity && (
                <>
                  <span className="id-sep">·</span>
                  <span>{player.teamCity}</span>
                </>
              )}
            </div>

            <div className="bio-grid">
              <div className="bio-cell">
                <div className="bio-label">AGE</div>
                <div className="bio-value">{formatAge(player.birthDate) ?? "—"}</div>
              </div>
              <div className="bio-cell">
                <div className="bio-label">EXP</div>
                <div className="bio-value">{player.experience ?? "—"}</div>
              </div>
              <div className="bio-cell">
                <div className="bio-label">HT</div>
                <div className="bio-value">{formatHeight(player.heightInches) ?? "—"}</div>
              </div>
              <div className="bio-cell">
                <div className="bio-label">WT</div>
                <div className="bio-value">{player.weight ?? "—"}</div>
              </div>
              <div className="bio-cell bio-cell-wide">
                <div className="bio-label">COLLEGE</div>
                <div className="bio-value">{player.college ?? "—"}</div>
              </div>
              <div className="bio-cell bio-cell-wide">
                <div className="bio-label">DRAFT</div>
                <div className="bio-value">{formatDraft(player.draftYear, player.draftRound, player.draftPick) ?? "—"}</div>
              </div>
            </div>
          </aside>

          <main className="stats">
            <Tabs defaultTab="overview">
              <Tabs.List>
                <Tabs.Tab id="overview">OVERVIEW</Tabs.Tab>
                <Tabs.Tab id="advanced">ADVANCED</Tabs.Tab>
                <Tabs.Tab id="gamelog">GAME LOG</Tabs.Tab>
                <Tabs.Tab id="career">CAREER</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel id="overview">
                <Overview player={player} />
              </Tabs.Panel>

              <Tabs.Panel id="advanced">
                <div className="stats-placeholder">
                  <div className="stats-placeholder-label">ADVANCED</div>
                  <div className="stats-placeholder-text">
                    Advanced metrics arrive in Chunk 14.
                  </div>
                </div>
              </Tabs.Panel>

              <Tabs.Panel id="gamelog">
                <div className="stats-placeholder">
                  <div className="stats-placeholder-label">GAME LOG</div>
                  <div className="stats-placeholder-text">
                    Game Log arrives in Chunk 15.
                  </div>
                </div>
              </Tabs.Panel>

              <Tabs.Panel id="career">
                <div className="stats-placeholder">
                  <div className="stats-placeholder-label">CAREER</div>
                  <div className="stats-placeholder-text">
                    Career arrives in Chunk 16.
                  </div>
                </div>
              </Tabs.Panel>
            </Tabs>
          </main>
        </div>
      )}
    </div>
  );
}

export default PlayerPage;
