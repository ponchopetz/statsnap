// Plain-English definitions for the advanced metrics, keyed by the label
// each ADVANCED_CONFIG row displays (utils/stats.js). The Advanced panel
// shows them per row; the Leaderboards key shows the selected metric's.

export const STAT_GLOSSARY = {
  "Target Share": "Share of the team's pass attempts thrown to this player. League WR1 ≈ 25–30%.",
  "Air Yards Share": "Share of the team's total air yards (downfield distance on all targets) accounted for by this player.",
  "WOPR": "Weighted Opportunity Rating — combines target share (1.5×) and air-yards share (0.7×). Single number for receiving opportunity. 0.50+ is elite.",
  "RACR": "Receiver Air Conversion Ratio — receiving yards ÷ air yards thrown his way. >1.0 means he's adding yards beyond what was thrown.",
  "Receiving Air Yards": "Total downfield distance of every pass thrown to him at the moment of release. Targets behind the line of scrimmage — screens and checkdowns — count as negative, so backs and short-area receivers can post low or even negative totals.",
  "YAC / Rec": "Yards After Catch per Reception. Pure with-ball production.",
  "Receiving EPA": "Expected Points Added on plays targeting him. Captures yards + situation (down, distance, field position).",
  "Rushing EPA": "Expected Points Added on his carries. Positive = above league expectation given the down & distance.",
  "Passing EPA": "Expected Points Added per dropback. The single best holistic QB efficiency stat.",
  "PACR": "Passing Air Conversion Ratio — passing yards ÷ passing air yards. Measures how well the QB realizes his intended depth.",
  "Passing CPOE": "Completion Percentage Over Expected. How much better (or worse) the QB completes vs. league average on similar throws.",
  "Passing Air Yards": "Total downfield distance of every pass attempt, completed or not.",
  "Avg Depth of Target": "aDOT — average depth past the line of scrimmage on the QB's targets.",
  "Carries": "Rushing attempts. A volume stat: how much of the backfield work he gets, not how well he uses it.",
  "Sacks Suffered": "Times the QB was sacked. Fewer is better, so the fewest sacks rank highest.",
  "Sack Yards Lost": "Total yards lost to sacks, shown as a positive number. Fewer is better.",
};
