import { useState, useEffect, useRef } from "react";
import useOffscreenCount from "../../hooks/useOffscreenCount.js";
import { useSlowLoading } from "../../hooks/useSlowLoading.js";
import LoadingStatus from "../LoadingStatus/LoadingStatus.jsx";
import { getSchedule } from "../../utils/api.js";
import "./ScheduleRail.css";

// Mirrors FINAL_AFTER_MS in backend/utils/scheduleRefresh.js: a game counts
// as over 4h after kickoff, even if its final score never arrived.
const FINAL_AFTER_MS = 4 * 60 * 60 * 1000;

// "upcoming" | "live" | "final" for one game at time `now` (ms)
function gameState(game, now) {
  if (game.completed) return "final";
  const kickoff = Date.parse(game.kickoff);
  if (now < kickoff) return "upcoming";
  return now - kickoff < FINAL_AFTER_MS ? "live" : "final";
}

function formatKickoff(iso) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString([], { weekday: "short" }).toUpperCase(),
    time: d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  };
}

function ScheduleRail() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    getSchedule(controller.signal)
      .then((json) => {
        if (ignore) return;
        setData(json);
        setStatus("ready");
      })
      .catch((err) => {
        // Ignore abort errors — they are expected on cleanup, not real failures
        if (ignore || err.name === "AbortError") return;
        setStatus("error");
      });

    return () => {
      ignore = true;
      controller.abort();
    };
  }, []);

  const scrollRef = useRef(null);
  const offscreen = useOffscreenCount(scrollRef, [data]);
  const slow = useSlowLoading(status === "loading");

  if (status === "loading") {
    return (
      <div className="sched-rail">
        <LoadingStatus
          className="sched-message"
          label="SCHEDULE · LOADING"
          slowLabel="SCHEDULE · WAKING FREE SERVER (~20S)"
          slow={slow}
        />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="sched-rail">
        <div className="sched-message">SCHEDULE UNAVAILABLE</div>
      </div>
    );
  }

  if (!data.games.length) {
    return (
      <div className="sched-rail">
        <div className="sched-message">NO GAMES SCHEDULED · OFFSEASON</div>
      </div>
    );
  }

  const now = Date.now();

  return (
    <section className="sched-rail">
      <div className="sched-scroll-wrap">
        <div className="sched-week-label">
          <span>WK {data.week}</span>
          <span>{data.games.length} GAMES</span>
          <span className="local">LOCAL TIME</span>
        </div>
        <ul className="sched-scroll" ref={scrollRef}>
          {data.games.map((g) => {
            const state = gameState(g, now);
            const { day, time } = formatKickoff(g.kickoff);
            // Scores exist only on finished games; a tie dims neither side
            const awayLost = g.completed && g.awayScore < g.homeScore;
            const homeLost = g.completed && g.homeScore < g.awayScore;
            return (
              <li key={g.id} className={`sched-card sched-card--${state}`}>
                <div className="sched-card-time">
                  {state === "upcoming" ? `${day} ${time}` : state.toUpperCase()}
                </div>
                <div className="sched-matchup">
                  <span className={`sched-team${awayLost ? " sched-team--loss" : ""}`}>
                    {g.away}
                  </span>
                  <span className="sched-at">@</span>
                  <span className={`sched-team${homeLost ? " sched-team--loss" : ""}`}>
                    {g.home}
                  </span>
                </div>
                {g.completed && (
                  <div className="sched-score">
                    {g.awayScore} – {g.homeScore}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {/* Overflow hint flows below the rail (mirrors ByWeekRail) — an overlay
          fade only obscured the rightmost card. Fades out once the strip is
          scrolled to the end, but stays mounted so the hint's height doesn't
          collapse and shift the layout below it. */}
      <div className="sched-more-hint" aria-hidden="true">
        <span className={`sched-more${offscreen > 0 ? "" : " sched-more--hidden"}`}>
          +{offscreen} MORE →
        </span>
      </div>
    </section>
  );
}

export default ScheduleRail;
