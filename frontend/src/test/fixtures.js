// Player-season documents in the exact shape GET /players/:playerId returns.

export function week(overrides = {}) {
  return {
    week: 1,
    opponent: "DEN",
    homeAway: "home",
    teamScore: 27,
    opponentScore: 20,
    overtime: 0,
    result: "W",
    ...overrides,
  };
}

export function qbSeason(overrides = {}) {
  const weeks = overrides.weeks ?? [
    week({ week: 1, attempts: 30, completions: 20, passingYards: 250, passingTds: 2, interceptions: 0, passingEpa: 8.4, sacksSuffered: 2, fantasyPointsPpr: 21.5 }),
    week({ week: 2, opponent: "LAC", homeAway: "away", result: "L", teamScore: 17, opponentScore: 24, attempts: 40, completions: 24, passingYards: 300, passingTds: 1, interceptions: 2, passingEpa: -4.2, sacksSuffered: 3, fantasyPointsPpr: 14.0 }),
  ];
  return {
    playerId: "00-0033873",
    displayName: "Patrick Mahomes",
    position: "QB",
    team: "KC",
    teamCity: "Kansas City",
    season: 2024,
    gamesPlayed: weeks.length,
    seasonComplete: true,
    birthDate: "1995-09-17",
    college: "Texas Tech",
    experience: 7,
    headshotUrl: "https://example.test/mahomes.png",
    heightInches: 74,
    jerseyNumber: 15,
    weight: 225,
    draftYear: 2017,
    draftRound: 1,
    draftPick: 10,
    ...overrides,
    weeks,
  };
}

export function wrSeason(overrides = {}) {
  const weeks = overrides.weeks ?? [
    week({ week: 1, targets: 9, receptions: 6, receivingYards: 88, receivingYac: 31, receivingAirYards: 96, targetShare: 0.24, airYardsShare: 0.31, wopr: 0.58, receivingEpa: 4.1, receivingTds: 1, rushingTds: 0, fantasyPointsPpr: 20.8 }),
    week({ week: 3, opponent: "GB", homeAway: "away", targets: 12, receptions: 8, receivingYards: 131, receivingYac: 45, receivingAirYards: 128, targetShare: 0.29, airYardsShare: 0.36, wopr: 0.69, receivingEpa: 6.8, receivingTds: 0, rushingTds: 1, fantasyPointsPpr: 27.1 }),
  ];
  return {
    playerId: "00-0036322",
    displayName: "Justin Jefferson",
    position: "WR",
    team: "MIN",
    teamCity: "Minnesota",
    season: 2024,
    gamesPlayed: weeks.length,
    seasonComplete: true,
    birthDate: "1999-06-16",
    college: "LSU",
    experience: 4,
    heightInches: 73,
    jerseyNumber: 18,
    weight: 195,
    draftYear: 2020,
    draftRound: 1,
    draftPick: 22,
    ...overrides,
    weeks,
  };
}
