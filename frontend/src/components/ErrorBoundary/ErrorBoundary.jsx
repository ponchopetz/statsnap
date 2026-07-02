import { Component } from "react";
import "./ErrorBoundary.css";

/**
 * Catches render errors anywhere below it and shows a branded failure
 * panel instead of a white screen. Class component because React error
 * boundaries have no hook equivalent — getDerivedStateFromError and
 * componentDidCatch only exist on classes.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("statsnap: render error", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="error-boundary">
        <div className="error-boundary-code">×</div>
        <div className="error-boundary-title">SOMETHING BROKE</div>
        <p className="error-boundary-copy">
          An unexpected error stopped the page from rendering.
        </p>
        <button
          type="button"
          className="error-boundary-btn"
          onClick={() => window.location.assign("/")}
        >
          ← BACK TO SEARCH
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
