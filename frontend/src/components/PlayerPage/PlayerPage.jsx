import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { usePlayerProfile } from "../../hooks/usePlayerProfile.js";
import { formatAge, formatHeight, formatDraft } from "../../utils/format.js";
import Tabs from "../Tabs/Tabs.jsx";
import Overview from "../Overview/Overview.jsx";
import AdvancedPanel from "../AdvancedPanel/AdvancedPanel.jsx";
import GameLog from "../GameLog/GameLog.jsx";
import Career from "../Career/Career.jsx";
import SeasonSelector from "../SeasonSelector/SeasonSelector.jsx";
import PlayerSearch from "../PlayerSearch/PlayerSearch.jsx";
import "./PlayerPage.css";

function PlayerPage() {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { status, data, errorMessage } = usePlayerProfile(playerId);

  const seasons = data?.map((d) => d.season) ?? [];
  const paramSeason = Number(searchParams.get("season"));
  const selectedSeason = seasons.includes(paramSeason) ? paramSeason : seasons[0];
  const player = data?.find((d) => d.season === selectedSeason);

  const handleSeasonChange = (season) => {
    // setSearchParams replaces ALL search params. Fine today — season is the
    // only one. When the search box lands (Chunk 18), merge instead of clobbering:
    //   setSearchParams((prev) => { prev.set("season", String(season)); return prev; });
    setSearchParams({ season: String(season) });
  };

  const [activeTab, setActiveTab] = useState("overview");

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

        <PlayerSearch
          variant="compact"
          placeholder="Search another player..."
          onSelect={(player) => navigate(`/players/${player.playerId}`)}
        />

        <button
          type="button"
          className="brand-mark"
          onClick={() => navigate("/")}
        >
          STAT<span className="slash">/</span>SNAP
        </button>
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
            {seasons.length > 1 && activeTab !== "career" && (
              <div className="stats-header">
                <span className="stats-header-label">SEASON</span>
                <SeasonSelector
                  seasons={seasons}
                  selected={selectedSeason}
                  onSelect={handleSeasonChange}
                />
              </div>
            )}
            <Tabs activeTab={activeTab} onTabChange={setActiveTab}>
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
                <AdvancedPanel player={player} />
              </Tabs.Panel>

              <Tabs.Panel id="gamelog">
                <GameLog player={player} />
              </Tabs.Panel>

              <Tabs.Panel id="career">
                <Career data={data} />
              </Tabs.Panel>
            </Tabs>
          </main>
        </div>
      )}
    </div>
  );
}

export default PlayerPage;
