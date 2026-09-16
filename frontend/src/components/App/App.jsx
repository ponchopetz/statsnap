import { Routes, Route } from "react-router-dom";
import SiteHeader from "../SiteHeader/SiteHeader.jsx";
import Landing from "../Landing/Landing.jsx";
import PlayerPage from "../PlayerPage/PlayerPage.jsx";
import ErrorBoundary from "../ErrorBoundary/ErrorBoundary.jsx";
import NotFound from "../NotFound/NotFound.jsx";
import Compare from "../Compare/Compare.jsx";
import Leaderboards from "../Leaderboards/Leaderboards.jsx";
import "./App.css";

function App() {
  return (
    <div className="app-shell">
      <SiteHeader />
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/players/:playerId" element={<PlayerPage />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/leaderboards" element={<Leaderboards />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
    </div>
  );
}

export default App;
