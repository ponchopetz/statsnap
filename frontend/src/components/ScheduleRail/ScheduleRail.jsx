import { useState, useEffect, useRef } from "react";
import useOffscreenCount from "../../hooks/useOffscreenCount.js";
import { getSchedule } from "../../utils/api.js";
import "./ScheduleRail.css";

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

  if (status === "loading") {
    return (
      <div className="sched-rail">
        <div className="sched-message">SCHEDULE · LOADING</div>
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

  return (
    <div className="sched-rail">
      <div className="sched-scroll-wrap">
        <div className="sched-week-label">
          <span>WK {data.week}</span>
          <span>{data.games.length} GAMES</span>
          <span className="local">LOCAL TIME</span>
        </div>
        <div className="sched-scroll" ref={scrollRef}>
          {data.games.map((g) => {
            const { day, time } = formatKickoff(g.kickoff);
            return (
              <div key={g.id} className="sched-card">
                <div className="sched-card-time">
                  {day} {time}
                </div>
                <div className="sched-matchup">
                  <span className="sched-team">{g.away}</span>
                  <span className="sched-at">@</span>
                  <span className="sched-team">{g.home}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="sched-fade">
          {offscreen > 0 && (
            <span className="sched-more">+{offscreen} MORE →</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScheduleRail;
