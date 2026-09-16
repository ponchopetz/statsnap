import { useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { usePlayerProfile } from "../../hooks/usePlayerProfile.js";
import { HEADLINE_CONFIG } from "../../utils/headline.js";
import { buildAdvancedRows } from "../../utils/stats.js";
import "./ShareCard.css";

// LABS (flag: shareCard) — a 1200×630 player card as inline SVG, exportable
// to PNG through a canvas. No headshot: a cross-origin image would taint the
// canvas and block the export, so the jersey number is the watermark.

const W = 1200;
const H = 630;
const MONO = "JetBrains Mono, ui-monospace, Menlo, monospace";
const SANS = "Space Grotesk, ui-sans-serif, system-ui, sans-serif";

function cssVar(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

export function CardSvg({ player, svgRef }) {
  const accent = cssVar("--accent", "oklch(0.88 0.22 128)");
  const bg = "#1a1a1a";
  const fg = "#f7f7f7";
  const fg2 = "#bdbdbd";
  const fg3 = "#8a8a8a";
  const line = "#3d3d3d";

  const rows = HEADLINE_CONFIG[player.position] ?? [];
  const weeks = player.weeks ?? [];
  const advanced = buildAdvancedRows(player).slice(0, 7);
  const nameParts = player.displayName.split(" ");
  const last = nameParts[nameParts.length - 1].toUpperCase();
  const first = nameParts.slice(0, -1).join(" ");

  const cellW = 640 / rows.length;
  const advX = 720;
  const advW = 420;

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${player.displayName} ${player.season} stat card`} xmlns="http://www.w3.org/2000/svg">
      <rect width={W} height={H} fill={bg} />
      <rect x={0} y={0} width={10} height={H} fill={accent} />
      <text x={40} y={54} fill={fg} fontFamily={MONO} fontSize={18} fontWeight={700} letterSpacing={3}>
        STAT<tspan fill={accent}>/</tspan>SNAP
      </text>
      <text x={W - 40} y={54} fill={fg3} fontFamily={MONO} fontSize={14} letterSpacing={3} textAnchor="end">
        {player.season} SEASON · {player.position} · {player.team}
      </text>
      <line x1={40} y1={72} x2={W - 40} y2={72} stroke={line} />

      <text x={W - 40} y={H - 40} fill={line} fontFamily={MONO} fontSize={260} fontWeight={800} textAnchor="end" opacity={0.6}>
        {player.jerseyNumber ?? ""}
      </text>

      <text x={40} y={130} fill={fg2} fontFamily={MONO} fontSize={28} fontWeight={500}>{first}</text>
      <text x={40} y={190} fill={fg} fontFamily={MONO} fontSize={64} fontWeight={800} letterSpacing={-2}>{last}</text>

      <line x1={40} y1={230} x2={680} y2={230} stroke={line} />
      {rows.map((r, i) => {
        const x = 40 + i * cellW;
        return (
          <g key={r.key}>
            <text x={x} y={262} fill={fg3} fontFamily={MONO} fontSize={11} letterSpacing={2}>{r.label}</text>
            <text x={x} y={306} fill={fg} fontFamily={MONO} fontSize={36} fontWeight={800}>{r.format(r.value(weeks, player))}</text>
            {i > 0 && <line x1={x - 12} y1={240} x2={x - 12} y2={320} stroke={line} />}
          </g>
        );
      })}
      <line x1={40} y1={334} x2={680} y2={334} stroke={line} />

      <text x={advX} y={120} fill={accent} fontFamily={MONO} fontSize={11} fontWeight={700} letterSpacing={2}>
        ADVANCED · PERCENTILE VS {player.position}S
      </text>
      {advanced.map((row, i) => {
        const y = 150 + i * 46;
        const pct = row.bar;
        return (
          <g key={row.k}>
            <text x={advX} y={y + 4} fill={fg2} fontFamily={MONO} fontSize={12}>{row.k}</text>
            <rect x={advX + 190} y={y - 4} width={advW - 260} height={8} fill={line} />
            {pct != null && <rect x={advX + 190} y={y - 4} width={(advW - 260) * pct} height={8} fill={accent} />}
            <text x={advX + advW} y={y + 4} fill={fg} fontFamily={MONO} fontSize={14} fontWeight={700} textAnchor="end">{row.v}</text>
            <text x={advX + advW - 90} y={y + 4} fill={fg3} fontFamily={MONO} fontSize={10} textAnchor="end">{pct != null ? `P${Math.round(pct * 100)}` : "—"}</text>
          </g>
        );
      })}

      <text x={40} y={H - 40} fill={fg3} fontFamily={SANS} fontSize={14}>
        Free advanced NFL skill-position stats · nflverse data · statsnap
      </text>
    </svg>
  );
}

function ShareCard() {
  const { playerId } = useParams();
  const [searchParams] = useSearchParams();
  const { status, data } = usePlayerProfile(playerId);
  const svgRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  const seasons = data?.map((d) => d.season) ?? [];
  const paramSeason = Number(searchParams.get("season"));
  const season = seasons.includes(paramSeason) ? paramSeason : seasons[0];
  const player = useMemo(() => data?.find((d) => d.season === season) ?? null, [data, season]);

  const download = async () => {
    if (!svgRef.current || !player) return;
    setExporting(true);
    setExportError(null);
    try {
      const xml = new XMLSerializer().serializeToString(svgRef.current);
      const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("could not rasterise the card"));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = W * 2;
      canvas.height = H * 2;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const png = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(png);
      a.download = `statsnap-${player.displayName.replace(/\s+/g, "-").toLowerCase()}-${player.season}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="card-page">
      <header className="card-topbar">
        <Link to={player ? `/players/${playerId}?season=${player.season}` : `/players/${playerId}`} className="back-btn">← BACK</Link>
        <div className="card-title">
          <span className="card-title-main">SHARE CARD</span>
          <span className="card-title-sub">1200 × 630 · PNG EXPORT · LABS</span>
        </div>
        {player && (
          <button type="button" className="back-btn" onClick={download} disabled={exporting}>
            {exporting ? "EXPORTING..." : "DOWNLOAD PNG"}
          </button>
        )}
      </header>

      {status === "loading" && <div className="card-status">LOADING PLAYER...</div>}
      {status === "not_found" && <div className="card-status">PLAYER NOT FOUND — ID: {playerId}</div>}
      {status === "error" && <div className="card-status">FAILED TO LOAD PLAYER</div>}
      {exportError && <div className="card-status">EXPORT FAILED — {exportError}</div>}

      {player && (
        <main className="card-body">
          <div className="card-frame">
            <CardSvg player={player} svgRef={svgRef} />
          </div>
          <p className="card-note">
            THE PNG USES THE SYSTEM MONOSPACE FONT IF JETBRAINS MONO IS NOT INSTALLED LOCALLY. NO HEADSHOT ON THE CARD SO THE EXPORT NEVER TRIPS A CROSS-ORIGIN CANVAS BLOCK.
          </p>
        </main>
      )}
    </div>
  );
}

export default ShareCard;
