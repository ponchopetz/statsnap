import { useMemo } from "react";
import "./Sparkline.css";

function Sparkline({ data = [], height = 60, width = 600 }) {
  const { linePath, fillPoints, avgY, computed, peakIndex, valleyIndex } = useMemo(() => {
    const points = data
      .map((value, index) => ({ index, value }))
      .filter((p) => p.value != null);

    if (points.length === 0) {
      return { linePath: null, fillPoints: null, avgY: null, computed: [], peakIndex: -1, valleyIndex: -1 };
    }

    const inset = 4;
    const xScale = data.length > 1 ? data.length - 1 : 1;
    const toX = (idx) => inset + (idx / xScale) * (width - 2 * inset);

    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    // SVG origin is top-left, so higher values map to smaller y
    const toY = (v) =>
      range === 0 ? height / 2 : inset + (1 - (v - min) / range) * (height - 2 * inset);

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const avgY = range === 0 ? height / 2 : inset + (1 - (avg - min) / range) * (height - 2 * inset);

    const computed = points.map((p) => ({ x: toX(p.index), y: toY(p.value) }));

    const peakIndex = points.reduce((maxI, p, i) => (p.value > points[maxI].value ? i : maxI), 0);
    const valleyIndex = points.reduce((minI, p, i) => (p.value < points[minI].value ? i : minI), 0);

    if (points.length === 1) {
      return { linePath: null, fillPoints: null, avgY, computed, peakIndex, valleyIndex };
    }

    const linePath =
      "M " + computed.map(({ x, y }) => `${x} ${y}`).join(" L ");

    // Bottom corners stay at y=height (flush to edge) so the fill feels grounded
    const firstX = computed[0].x;
    const lastX = computed[computed.length - 1].x;
    const fillPoints = [
      ...computed.map(({ x, y }) => `${x},${y}`),
      `${lastX},${height}`,
      `${firstX},${height}`,
    ].join(" ");

    return { linePath, fillPoints, avgY, computed, peakIndex, valleyIndex };
  }, [data, height, width]);

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {fillPoints && <polygon className="sparkline-fill" points={fillPoints} />}
      {avgY != null && computed.length >= 2 && (
        <line className="sparkline-avg" x1={4} y1={avgY} x2={width - 4} y2={avgY} />
      )}
      {linePath && <path className="sparkline-line" d={linePath} />}
      {computed.map((pt, i) => {
        const isExtreme = i === peakIndex || i === valleyIndex;
        return (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={isExtreme ? 3.5 : 2.5}
            className={isExtreme ? "sparkline-dot sparkline-dot-extreme" : "sparkline-dot"}
          />
        );
      })}
    </svg>
  );
}

export default Sparkline;
