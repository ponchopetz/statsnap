// Small factories for player-season documents. Every field the real ETL
// writes is optional here so a test only states what it cares about.

let counter = 0;

export function makeWeek(overrides = {}) {
  return {
    week: 1,
    opponent: "KC",
    homeAway: "home",
    teamScore: 24,
    opponentScore: 17,
    result: "W",
    ...overrides,
  };
}

export function makePlayer(overrides = {}) {
  counter += 1;
  const weeks = overrides.weeks ?? [makeWeek()];
  return {
    playerId: `00-00000${counter}`,
    displayName: `Test Player ${counter}`,
    position: "QB",
    team: "KC",
    season: 2024,
    gamesPlayed: weeks.length,
    seasonComplete: true,
    birthDate: "1995-09-17",
    college: "Texas Tech",
    experience: 7,
    headshotUrl: "https://example.test/headshot.png",
    heightInches: 74,
    jerseyNumber: 15,
    teamCity: "Kansas City",
    weight: 225,
    draftYear: 2017,
    draftRound: 1,
    draftPick: 10,
    ...overrides,
    weeks,
  };
}
