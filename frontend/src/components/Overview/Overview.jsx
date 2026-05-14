import OverviewQB from "./OverviewQB.jsx";
import OverviewRB from "./OverviewRB.jsx";
import OverviewReceiver from "./OverviewReceiver.jsx";
import "./Overview.css";

function Overview({ player }) {
  if (!player) return null;

  let content;
  switch (player.position) {
    case "QB":
      content = <OverviewQB player={player} />;
      break;
    case "RB":
      content = <OverviewRB player={player} />;
      break;
    case "WR":
    case "TE":
      content = <OverviewReceiver player={player} />;
      break;
    default:
      console.warn(`Overview: unknown position "${player.position}"`);
      return null;
  }

  return <div className="overview">{content}</div>;
}

export default Overview;
