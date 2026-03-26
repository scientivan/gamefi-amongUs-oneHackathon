/** Get a user's bet on a specific game */
export const GET_USER_BET = `
  query GetUserBet($bettor: String!, $gameId: BigInt!) {
    betPlaceds(where: { bettor: $bettor, gameId: $gameId }) {
      amount
      team
      gameId
      timestamp_
    }
  }
`;

/** Get the settled result of a game */
export const GET_GAME_RESULT = `
  query GetGameResult($gameId: BigInt!) {
    gameSettleds(where: { gameId: $gameId }) {
      winningTeam
      gameId
      timestamp_
    }
  }
`;

/** Check if a user has claimed payout for a game */
export const GET_USER_CLAIM = `
  query GetUserClaim($bettor: String!, $gameId: BigInt!) {
    payoutClaimeds(where: { bettor: $bettor, gameId: $gameId }) {
      amount
      gameId
      timestamp_
    }
  }
`;

/** Get a user's recent bet history */
export const GET_USER_BET_HISTORY = `
  query GetUserBetHistory($bettor: String!) {
    betPlaceds(where: { bettor: $bettor }, orderBy: timestamp_, orderDirection: desc, first: 20) {
      amount
      team
      gameId
      timestamp_
    }
  }
`;

/** Get recent settled games */
export const GET_RECENT_GAMES = `
  query GetRecentGames {
    gameSettleds(orderBy: gameId, orderDirection: desc, first: 20) {
      gameId
      winningTeam
      timestamp_
    }
  }
`;

/** Get all claims by a user (for unclaimed payout detection) */
export const GET_ALL_USER_CLAIMS = `
  query GetAllUserClaims($bettor: String!) {
    payoutClaimeds(where: { bettor: $bettor }, first: 50) {
      gameId
      amount
      timestamp_
    }
  }
`;

/** Get cancelled games */
export const GET_CANCELLED_GAMES = `
  query GetCancelledGames {
    gameCancelleds(orderBy: gameId, orderDirection: desc, first: 50) {
      gameId
      timestamp_
    }
  }
`;

/** Get all refund claims by a user */
export const GET_ALL_USER_REFUNDS = `
  query GetAllUserRefunds($bettor: String!) {
    refundClaimeds(where: { bettor: $bettor }, first: 50) {
      gameId
      amount
      timestamp_
    }
  }
`;

/** Leaderboard: all bets + claims across all users */
export const GET_LEADERBOARD_DATA = `
  query GetLeaderboardData {
    betPlaceds(first: 1000, orderBy: timestamp_, orderDirection: desc) {
      bettor
      amount
      team
      gameId
    }
    payoutClaimeds(first: 1000, orderBy: timestamp_, orderDirection: desc) {
      bettor
      amount
      gameId
    }
    gameSettleds(first: 100, orderBy: gameId, orderDirection: desc) {
      gameId
      winningTeam
    }
  }
`;
