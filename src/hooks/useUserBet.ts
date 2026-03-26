import { useState, useEffect, useCallback } from "react";
import { useSuiClient } from "@mysten/dapp-kit";

export type BetResult = "win" | "lose" | null;

interface UserBetState {
  hasBet: boolean;
  team: number | null; // 0 = Crewmates, 1 = Impostors
  amount: string | null; // raw MIST amount string
  winningTeam: number | null; // null if game not settled
  result: BetResult;
  hasClaimed: boolean;
  claimedAmount: string | null;
  loading: boolean;
}

const INITIAL_STATE: UserBetState = {
  hasBet: false,
  team: null,
  amount: null,
  winningTeam: null,
  result: null,
  hasClaimed: false,
  claimedAmount: null,
  loading: false,
};

/**
 * Queries Sui events for a user's bet, game result, and claim status.
 *
 * Events use `game_id: u64` (numeric), but the hook receives the Sui Object ID.
 * We resolve the numeric game_id by reading the Game object's fields before
 * filtering events.
 */
export function useUserBet(
  gameObjectId: string | null | undefined,
  address: string | undefined,
  interval = 5000,
): UserBetState {
  const suiClient = useSuiClient();
  const [state, setState] = useState<UserBetState>(INITIAL_STATE);

  const fetchData = useCallback(async () => {
    if (!gameObjectId || !address) {
      setState(INITIAL_STATE);
      return;
    }

    try {
      // Resolve numeric game_id from the Game object's fields.
      // Events emit game_id: u64 (e.g. "49"), not the Sui Object ID.
      let numericGameId: string | null = null;
      try {
        const gameObj = await suiClient.getObject({
          id: gameObjectId,
          options: { showContent: true },
        });
        const fields = (gameObj.data?.content as any)?.fields;
        if (fields?.game_id != null) {
          numericGameId = String(fields.game_id);
        }
      } catch {
        // If object lookup fails, fall back to treating gameObjectId as the
        // filter value (will likely match nothing, but avoids breaking).
        numericGameId = gameObjectId;
      }

      // Fetch all relevant event types in parallel
      const [betEvents, settledEvents, claimEvents] = await Promise.all([
        suiClient.queryEvents({
          query: {
            MoveEventType: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::game::EvBetPlaced`,
          },
          limit: 100,
        }),
        suiClient.queryEvents({
          query: {
            MoveEventType: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::game::EvGameSettled`,
          },
          limit: 50,
        }),
        suiClient.queryEvents({
          query: {
            MoveEventType: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::game::EvPayoutClaimed`,
          },
          limit: 100,
        }),
      ]);

      // Filter by numeric game_id (what events actually contain)
      const matchGame = (json: Record<string, unknown> | null) =>
        json != null && String(json.game_id) === numericGameId;

      const betEvent = betEvents.data.find((e) => {
        const json = e.parsedJson as Record<string, unknown> | null;
        return matchGame(json) && json?.bettor === address;
      });

      const settledEvent = settledEvents.data.find((e) =>
        matchGame(e.parsedJson as Record<string, unknown> | null),
      );

      const claimEvent = claimEvents.data.find((e) => {
        const json = e.parsedJson as Record<string, unknown> | null;
        return matchGame(json) && json?.bettor === address;
      });

      const betJson = betEvent?.parsedJson as Record<string, unknown> | null;
      const settledJson = settledEvent?.parsedJson as Record<string, unknown> | null;
      const claimJson = claimEvent?.parsedJson as Record<string, unknown> | null;

      let result: BetResult = null;
      if (betJson && settledJson) {
        result =
          Number(betJson.team) === Number(settledJson.winning_team)
            ? "win"
            : "lose";
      }

      setState({
        hasBet: !!betJson,
        team: betJson ? Number(betJson.team) : null,
        amount: betJson ? String(betJson.amount) : null,
        winningTeam: settledJson ? Number(settledJson.winning_team) : null,
        result,
        hasClaimed: !!claimJson,
        claimedAmount: claimJson ? String(claimJson.amount) : null,
        loading: false,
      });
    } catch (err) {
      console.error("[useUserBet] Sui event query failed:", err);
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [gameObjectId, address, suiClient]);

  useEffect(() => {
    setState((prev) => ({ ...prev, loading: true }));
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!gameObjectId || !address) return;
    const timer = setInterval(fetchData, interval);
    return () => clearInterval(timer);
  }, [fetchData, interval, gameObjectId, address]);

  return state;
}
