import { useState, useEffect, useCallback } from "react";
import { useSuiClient } from "@mysten/dapp-kit";

export interface UnclaimedPayout {
  gameId: string; // Sui Object ID of the Game (NOT the numeric game_id)
  team: number;
  betAmount: string; // raw MIST string
  winningTeam: number;
}

interface InternalState {
  payouts: UnclaimedPayout[];
  count: number;
  loading: boolean;
}

export interface UnclaimedPayoutsState extends InternalState {
  refetch: () => void;
}

/**
 * Finds all unclaimed winning bets across past games.
 *
 * All on-chain events use `game_id: u64` (numeric), but `claim_payout`
 * requires the Sui Object ID of the Game. This hook resolves the mapping by
 * fetching the `EvGameCreated` transaction effects and extracting the created
 * shared Game object for each relevant game.
 */
export function useUnclaimedPayouts(
  address: string | undefined,
  interval = 10000,
): UnclaimedPayoutsState {
  const suiClient = useSuiClient();
  const [state, setState] = useState<InternalState>({
    payouts: [],
    count: 0,
    loading: false,
  });

  const fetchData = useCallback(async () => {
    if (!address) {
      setState({ payouts: [], count: 0, loading: false });
      return;
    }

    try {
      const [betEvents, settledEvents, claimEvents, createdEvents] =
        await Promise.all([
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
            limit: 100,
          }),
          suiClient.queryEvents({
            query: {
              MoveEventType: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::game::EvPayoutClaimed`,
            },
            limit: 100,
          }),
          suiClient.queryEvents({
            query: {
              MoveEventType: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::game::EvGameCreated`,
            },
            limit: 200,
          }),
        ]);

      // ── Resolve numeric game_id → Sui Object ID ─────────────────────────
      // All events use game_id: u64 (e.g. 49), but claim_payout needs the
      // actual shared Game object ID (e.g. 0xabcd...).
      // Strategy: for each numeric game_id the user bet on, find its
      // EvGameCreated event and fetch that tx's effects.created to get
      // the newly-created shared Game object.

      const userBets = betEvents.data
        .map((e) => e.parsedJson as Record<string, unknown> | null)
        .filter((j): j is Record<string, unknown> => j?.bettor === address);

      const userBetGameIds = new Set(userBets.map((b) => String(b.game_id)));

      // Only resolve games the user actually bet on
      const relevantCreated = createdEvents.data.filter((e) =>
        userBetGameIds.has(String((e.parsedJson as any)?.game_id)),
      );

      const numericToObjectId = new Map<string, string>();
      await Promise.all(
        relevantCreated.map(async (e) => {
          const numericId = String((e.parsedJson as any)?.game_id);
          try {
            const tx = await (suiClient as any).getTransactionBlock({
              digest: e.id.txDigest,
              options: { showEffects: true },
            });
            const created: any[] = tx?.effects?.created ?? [];
            // The Game object is the only new Shared object in seed_pool()
            const gameObj = created.find(
              (obj: any) =>
                typeof obj.owner === "object" &&
                obj.owner !== null &&
                "Shared" in obj.owner,
            );
            if (gameObj?.reference?.objectId) {
              numericToObjectId.set(numericId, gameObj.reference.objectId);
            }
          } catch {
            // Skip — this game won't appear in unclaimed list
          }
        }),
      );

      // ── Build settled map: numeric game_id → winning team ───────────────
      const settledMap = new Map<string, number>();
      for (const e of settledEvents.data) {
        const json = e.parsedJson as Record<string, unknown> | null;
        if (json?.game_id != null)
          settledMap.set(String(json.game_id), Number(json.winning_team));
      }

      // ── Build claimed set: numeric game_ids already claimed ─────────────
      const claimedSet = new Set<string>();
      for (const e of claimEvents.data) {
        const json = e.parsedJson as Record<string, unknown> | null;
        if (json?.bettor === address && json?.game_id != null)
          claimedSet.add(String(json.game_id));
      }

      // ── Assemble unclaimed winning payouts ───────────────────────────────
      const unclaimed: UnclaimedPayout[] = [];
      for (const bet of userBets) {
        const numericId = String(bet.game_id);
        const winningTeam = settledMap.get(numericId);
        if (winningTeam === undefined) continue; // not yet settled
        if (Number(bet.team) !== winningTeam) continue; // user lost
        if (claimedSet.has(numericId)) continue; // already claimed

        const objectId = numericToObjectId.get(numericId);
        if (!objectId) continue; // can't claim without the Sui Object ID

        unclaimed.push({
          gameId: objectId, // ← correct Sui Object ID for claim_payout()
          team: Number(bet.team),
          betAmount: String(bet.amount),
          winningTeam,
        });
      }

      setState({ payouts: unclaimed, count: unclaimed.length, loading: false });
    } catch (err) {
      console.error("[useUnclaimedPayouts] Sui event query failed:", err);
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [address, suiClient]);

  useEffect(() => {
    setState((prev) => ({ ...prev, loading: true }));
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!address) return;
    const timer = setInterval(fetchData, interval);
    return () => clearInterval(timer);
  }, [fetchData, interval, address]);

  return { ...state, refetch: fetchData };
}
