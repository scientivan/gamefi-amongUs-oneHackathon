/**
 * localStorage persistence for per-user, per-game state.
 * Keys are scoped to gameId + address so they never bleed between sessions.
 */

const P = "amnads_"; // key prefix

// ── Pending bet (cleared once on-chain event confirms hasBet) ──────────────

export interface PendingBet {
  team: "Crewmates" | "Impostors";
  amount: string; // OCT display string, e.g. "0.05"
}

export function savePendingBet(
  gameId: string,
  address: string,
  data: PendingBet,
) {
  try {
    localStorage.setItem(
      `${P}pending_bet_${gameId}_${address}`,
      JSON.stringify(data),
    );
  } catch {}
}

export function loadPendingBet(
  gameId: string,
  address: string,
): PendingBet | null {
  try {
    const raw = localStorage.getItem(`${P}pending_bet_${gameId}_${address}`);
    return raw ? (JSON.parse(raw) as PendingBet) : null;
  } catch {
    return null;
  }
}

export function clearPendingBet(gameId: string, address: string) {
  try {
    localStorage.removeItem(`${P}pending_bet_${gameId}_${address}`);
  } catch {}
}

// ── Vote cast (permanent for the game session) ─────────────────────────────

export function saveVoteCast(
  gameId: string,
  address: string,
  voteType: number,
) {
  try {
    localStorage.setItem(`${P}vote_${gameId}_${address}`, String(voteType));
  } catch {}
}

export function loadVoteCast(
  gameId: string,
  address: string,
): number | null {
  try {
    const raw = localStorage.getItem(`${P}vote_${gameId}_${address}`);
    if (raw === null) return null;
    const n = parseInt(raw, 10);
    return isNaN(n) ? null : n;
  } catch {
    return null;
  }
}
