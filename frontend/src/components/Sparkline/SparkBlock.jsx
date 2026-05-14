import Sparkline from "./Sparkline.jsx";
import "./Sparkline.css";

function SparkBlock({ label, data = [], weeks = [], formatValue = (n) => String(n) }) {
  const validValues = data.filter((v) => v != null);
  const peak = validValues.length > 0 ? Math.max(...validValues) : null;
  const avg =
    validValues.length > 0
      ? validValues.reduce((a, b) => a + b, 0) / validValues.length
      : null;

  // Show up to 10 evenly-spaced week labels along the axis
  const stride = weeks.length <= 10 ? 1 : Math.ceil(weeks.length / 10);
  const axisLabels = weeks.map((w, i) => (i % stride === 0 ? w : null));

  return (
    <div className="sparkblock">
      <div className="sparkblock-header">
        <div className="sparkblock-label">{label}</div>
        <div className="sparkblock-stats">
          <div>
            <span className="sparkblock-stat-label">PEAK</span>
            <span className="sparkblock-stat-value">
              {peak != null ? formatValue(peak) : "—"}
            </span>
          </div>
          <div>
            <span className="sparkblock-stat-label">AVG</span>
            <span className="sparkblock-stat-value">
              {avg != null ? formatValue(avg) : "—"}
            </span>
          </div>
        </div>
      </div>
      <div className="sparkblock-chart">
        <Sparkline data={data} />
      </div>
      <div className="sparkblock-axis">
        {axisLabels.map((w, i) => (
          <span key={i}>{w == null ? "" : `W${w}`}</span>
        ))}
      </div>
    </div>
  );
}

export default SparkBlock;
