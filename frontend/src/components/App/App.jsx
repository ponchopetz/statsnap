import { Routes, Route } from "react-router-dom";
import SiteHeader from "../SiteHeader/SiteHeader.jsx";
import Landing from "../Landing/Landing.jsx";
import PlayerPage from "../PlayerPage/PlayerPage.jsx";
import "./App.css";

function App() {
  return (
    <div className="app-shell">
      <SiteHeader />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/players/:playerId" element={<PlayerPage />} />
      </Routes>
    </div>
  );
}

export default App;
