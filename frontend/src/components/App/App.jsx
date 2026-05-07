import { Routes, Route } from "react-router-dom";
import Landing from "../Landing/Landing.jsx";
import PlayerPage from "../PlayerPage/PlayerPage.jsx";
import "./App.css";

function App() {
  return (
    <div className="app-shell">
      <header className="app-topbar">
        <span className="brand-mark">
          <span className="dot" /> STAT<span className="slash">/</span>SNAP
        </span>
        <div className="meta">
          <span>
            <span className="live-dot" /> LIVE · SKILL POSITIONS ONLY
          </span>
          <span>v0.2</span>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/players/:playerId" element={<PlayerPage />} />
      </Routes>
    </div>
  );
}

export default App;
