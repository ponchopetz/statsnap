import { Link } from "react-router-dom";
import "./NotFound.css";

function NotFound() {
  return (
    <div className="notfound">
      <div className="notfound-code">404</div>
      <div className="notfound-title">NO ROUTE</div>
      <p className="notfound-copy">This page doesn&apos;t exist.</p>
      <Link className="notfound-link" to="/">
        ← BACK TO SEARCH
      </Link>
    </div>
  );
}

export default NotFound;
