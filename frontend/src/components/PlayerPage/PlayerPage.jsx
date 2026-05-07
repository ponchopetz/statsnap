import { useParams } from "react-router-dom";
import "./PlayerPage.css";

function PlayerPage() {
  const { playerId } = useParams();
  return <p>Player route — id: {playerId}</p>;
}

export default PlayerPage;
