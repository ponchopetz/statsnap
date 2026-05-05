## Decisions made

- **MongoDB schema:** Single collection `playerstats`, one document per
  player-season, weekly stats embedded as a `weeks` array. ETL (load.py)
  already written to this shape. Two-collection split deferred to V2.
- **Schedule data source:** nflverse, not The Odds API. Odds API reserved
  for V2 betting lines only.
- **Dakota dropped:** Not in player stats endpoint. Replaced with
  `passing_cpoe`.
