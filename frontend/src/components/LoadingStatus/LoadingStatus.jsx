import "./LoadingStatus.css";

/**
 * Animated loading message. Three pips march left to right while the
 * request is in flight; once `slow` is true (see useSlowLoading) the copy
 * swaps to slowLabel and an indeterminate bar sweeps underneath, so a
 * ~20s free-tier cold start reads as progress instead of a frozen page.
 *
 * `className` is the call site's own status class, which keeps each
 * location's spacing and type.
 */
function LoadingStatus({ label, slowLabel, slow = false, className }) {
  return (
    <div className={className} role="status" aria-live="polite">
      <span className="ls">
        <span className="ls-row">
          <span>{slow && slowLabel ? slowLabel : label}</span>
          <span className="ls-pips" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </span>
        {slow && <span className="ls-bar" aria-hidden="true" data-testid="ls-bar" />}
      </span>
    </div>
  );
}

export default LoadingStatus;
