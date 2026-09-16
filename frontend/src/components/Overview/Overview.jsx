import OverviewPanel from "./OverviewPanel.jsx";
import { HEADLINE_CONFIG } from "../../utils/headline.js";
import "./Overview.css";

function Overview({ player }) {
  if (!player) return null;

  if (!HEADLINE_CONFIG[player.position]) {
    console.warn(`Overview: unknown position "${player.position}"`);
    return null;
  }

  return (
    <div className="overview">
      <OverviewPanel player={player} />
    </div>
  );
}

export default Overview;
