"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  useCurrentAccount,
  useSuiClient,
  ConnectButton,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { getKeypairFromEnv } from "@/lib/directSigner";

const teamName = (t: number) => (t === 0 ? "Crewmates" : "Impostors");
const teamColor = (t: number) => (t === 0 ? "#a8d8ea" : "#ff6b6b");
const formatSui = (mist: string) => (Number(mist) / 1_000_000_000).toFixed(4);
const formatDate = (tsMs: number) => {
  const d = new Date(tsMs);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  );
};

interface HistoryRow {
  gameId: string;
  gameObjectId: string | null; // Sui Object ID needed for claim_payout
  team: number;
  amount: string;
  timestampMs: number;
  winningTeam: number | null;
  result: "win" | "lose" | "pending" | "cancelled" | "refunded";
  claimed: boolean;
  claimedAmount: string | null;
}

export default function HistoryPage() {
  const account = useCurrentAccount();
  const address = account?.address;
  const suiClient = useSuiClient();
  const keypair = useMemo(() => getKeypairFromEnv(), []);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimingGameId, setClaimingGameId] = useState<string | null>(null);
  const [claimedGameIds, setClaimedGameIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({
    wins: 0,
    losses: 0,
    pending: 0,
    cancelled: 0,
    refunded: 0,
    totalBet: 0,
    totalClaimed: 0,
  });

  // ── Direct exec for auto-claiming ──
  const directExec = async (tx: Transaction) => {
    const sender = keypair!.toSuiAddress();
    tx.setSenderIfNotSet(sender);
    const { data: gasCoins } = await (suiClient as any).getCoins({
      owner: sender,
      coinType: "0x2::oct::OCT",
    });
    if (!gasCoins?.length) throw new Error("No OCT gas coins found for sender");
    tx.setGasPayment(
      gasCoins.slice(0, 3).map((c: any) => ({
        objectId: c.coinObjectId,
        version: c.version,
        digest: c.digest,
      })),
    );
    tx.setGasBudgetIfNotSet(10_000_000);
    const bytes = await tx.build({ client: suiClient as any });
    const { bytes: b64bytes, signature } =
      await keypair!.signTransaction(bytes);
    return (suiClient as any).executeTransactionBlock({
      transactionBlock: b64bytes,
      signature,
      options: { showEffects: true },
    });
  };

  const fetchHistory = useCallback(async () => {
    if (!address) {
      setRows([]);
      return;
    }
    setLoading(true);

    try {
      const [
        betEvents,
        settledEvents,
        claimEvents,
        cancelEvents,
        refundEvents,
        createdEvents,
      ] = await Promise.all([
        suiClient.queryEvents({
          query: {
            MoveEventType: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::game::EvBetPlaced`,
          },
          limit: 200,
        }),
        suiClient.queryEvents({
          query: {
            MoveEventType: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::game::EvGameSettled`,
          },
          limit: 200,
        }),
        suiClient.queryEvents({
          query: {
            MoveEventType: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::game::EvPayoutClaimed`,
          },
          limit: 200,
        }),
        suiClient.queryEvents({
          query: {
            MoveEventType: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::game::EvGameCancelled`,
          },
          limit: 200,
        }),
        suiClient.queryEvents({
          query: {
            MoveEventType: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::game::EvRefundClaimed`,
          },
          limit: 200,
        }),
        suiClient.queryEvents({
          query: {
            MoveEventType: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::game::EvGameCreated`,
          },
          limit: 200,
        }),
      ]);

      // User's bets only
      const userBets = betEvents.data.filter((e) => {
        const j = e.parsedJson as Record<string, unknown> | null;
        return j?.bettor === address;
      });

      const settledMap = new Map<string, number>();
      for (const e of settledEvents.data) {
        const j = e.parsedJson as Record<string, unknown> | null;
        if (j?.game_id)
          settledMap.set(String(j.game_id), Number(j.winning_team));
      }

      const claimMap = new Map<string, string>();
      for (const e of claimEvents.data) {
        const j = e.parsedJson as Record<string, unknown> | null;
        if (j?.bettor === address && j?.game_id)
          claimMap.set(String(j.game_id), String(j.amount));
      }

      const cancelledSet = new Set<string>();
      for (const e of cancelEvents.data) {
        const j = e.parsedJson as Record<string, unknown> | null;
        if (j?.game_id) cancelledSet.add(String(j.game_id));
      }

      const refundMap = new Map<string, string>();
      for (const e of refundEvents.data) {
        const j = e.parsedJson as Record<string, unknown> | null;
        if (j?.bettor === address && j?.game_id)
          refundMap.set(String(j.game_id), String(j.amount));
      }

      // Resolve numeric game_id → Sui Object ID (needed for claim_payout)
      const userBetGameIds = new Set(
        userBets.map((e) => String((e.parsedJson as any)?.game_id)),
      );
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
            // Skip
          }
        }),
      );

      let wins = 0,
        losses = 0,
        pending = 0,
        cancelled = 0,
        refunded = 0,
        totalBet = 0,
        totalClaimed = 0;

      const history: HistoryRow[] = userBets.map((e) => {
        const j = e.parsedJson as Record<string, unknown>;
        const gameId = String(j.game_id);
        const team = Number(j.team);
        const winningTeam = settledMap.get(gameId) ?? null;
        const claimedAmount = claimMap.get(gameId) ?? null;
        const isCancelled = cancelledSet.has(gameId);
        const refundAmount = refundMap.get(gameId) ?? null;
        const gameObjectId = numericToObjectId.get(gameId) ?? null;

        let result: "win" | "lose" | "pending" | "cancelled" | "refunded" =
          "pending";
        if (isCancelled) {
          result = refundAmount ? "refunded" : "cancelled";
        } else if (winningTeam !== null) {
          result = team === winningTeam ? "win" : "lose";
        }

        totalBet += Number(j.amount) / 1e9;
        if (result === "win") wins++;
        else if (result === "lose") losses++;
        else if (result === "cancelled") cancelled++;
        else if (result === "refunded") refunded++;
        else pending++;
        if (claimedAmount) totalClaimed += Number(claimedAmount) / 1e9;
        if (refundAmount) totalClaimed += Number(refundAmount) / 1e9;

        return {
          gameId,
          gameObjectId,
          team,
          amount: String(j.amount),
          timestampMs: e.timestampMs ? Number(e.timestampMs) : 0,
          winningTeam,
          result,
          claimed: !!(claimedAmount || refundAmount),
          claimedAmount: claimedAmount || refundAmount,
        };
      });

      setRows(history);
      setStats({
        wins,
        losses,
        pending,
        cancelled,
        refunded,
        totalBet,
        totalClaimed,
      });
    } catch (err) {
      console.error("[History] Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [address, suiClient]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ── Claim handler ──
  const handleClaim = async (row: HistoryRow) => {
    if (!keypair || !row.gameObjectId) return;
    setClaimingGameId(row.gameId);
    const tx = new Transaction();
    tx.moveCall({
      target: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::game::claim_payout`,
      arguments: [tx.object(row.gameObjectId)],
    });
    try {
      await directExec(tx);
      setClaimedGameIds((prev) => new Set(prev).add(row.gameId));
      // Re-fetch to get the on-chain claim event and update amounts
      setTimeout(() => fetchHistory(), 2000);
    } catch (e: any) {
      console.error("[History] Claim failed:", e);
      alert(`Claim failed: ${e?.message?.slice(0, 100) ?? "Unknown error"}`);
    } finally {
      setClaimingGameId(null);
    }
  };

  return (
    <div className="text-white p-4 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-sm font-pixel text-[#ffd700] text-glow-gold uppercase tracking-wider">
            Bet History
          </h1>
          <p className="text-[7px] font-pixel text-[#a8d8ea]/40 mt-1">
            Your recent on-chain predictions
          </p>
        </div>

        {!address ? (
          <div className="retro-panel p-8 text-center">
            <div className="text-[8px] font-pixel text-[#a8d8ea]/50 mb-4">
              Connect your wallet to view bet history
            </div>
            <ConnectButton
              className="px-6 py-2.5 rounded-sm text-[9px] font-pixel uppercase tracking-wider
                                bg-[#ffd700] hover:bg-[#ffed4a] text-[#0a1628] pixel-border hover:scale-[1.02] transition-all"
            />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              <div className="retro-panel p-3 text-center">
                <div className="text-sm font-pixel text-[#88d8b0] text-glow-mint">
                  {stats.wins}
                </div>
                <div className="text-[7px] font-pixel text-[#88d8b0]/50 uppercase tracking-wider">
                  Wins
                </div>
              </div>
              <div className="retro-panel p-3 text-center">
                <div className="text-sm font-pixel text-[#ff6b6b] text-glow-red">
                  {stats.losses}
                </div>
                <div className="text-[7px] font-pixel text-[#ff6b6b]/50 uppercase tracking-wider">
                  Losses
                </div>
              </div>
              <div className="retro-panel p-3 text-center">
                <div className="text-sm font-pixel text-[#ffd700]">
                  {stats.pending}
                </div>
                <div className="text-[7px] font-pixel text-[#ffd700]/50 uppercase tracking-wider">
                  Pending
                </div>
              </div>
              <div className="retro-panel p-3 text-center">
                <div className="text-sm font-pixel text-[#c4a0ff]">
                  {stats.cancelled + stats.refunded}
                </div>
                <div className="text-[7px] font-pixel text-[#c4a0ff]/50 uppercase tracking-wider">
                  Refunded
                </div>
              </div>
              <div className="retro-panel p-3 text-center">
                <div className="text-sm font-pixel text-[#a8d8ea]">
                  {stats.totalBet.toFixed(2)}
                </div>
                <div className="text-[7px] font-pixel text-[#a8d8ea]/50 uppercase tracking-wider">
                  OCT Bet
                </div>
              </div>
              <div className="retro-panel p-3 text-center">
                <div className="text-sm font-pixel text-[#88d8b0]">
                  {stats.totalClaimed.toFixed(2)}
                </div>
                <div className="text-[7px] font-pixel text-[#88d8b0]/50 uppercase tracking-wider">
                  OCT Claimed
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="retro-panel overflow-hidden">
              <div className="grid grid-cols-12 gap-2 p-3 bg-[#0d2137] border-b border-[#ffd700]/20 text-[7px] font-pixel text-[#a8d8ea]/50 uppercase tracking-wider">
                <div className="col-span-1">Bet #</div>
                <div className="col-span-2">Team</div>
                <div className="col-span-2 text-right">Bet</div>
                <div className="col-span-2 text-center">Result</div>
                <div className="col-span-2 text-right">Payout</div>
                <div className="col-span-3 text-right">Time</div>
              </div>

              {loading ? (
                <div className="p-6 flex justify-center">
                  <div className="relative w-6 h-6">
                    <div className="absolute inset-0 rounded-full border-2 border-[#ffd700]/10" />
                    <div className="absolute inset-0 rounded-full border-2 border-t-[#ffd700] animate-spin" />
                  </div>
                </div>
              ) : rows.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="text-[8px] font-pixel text-[#a8d8ea]/30">
                    No bets found
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-[#a8d8ea]/5">
                  {rows.map((row, i) => {
                    const isSessionClaimed = claimedGameIds.has(row.gameId);
                    const isClaiming = claimingGameId === row.gameId;
                    const effectivelyClaimed = row.claimed || isSessionClaimed;

                    return (
                      <div
                        key={`${row.gameId}-${i}`}
                        className="grid grid-cols-12 gap-2 p-3 text-[8px] font-pixel hover:bg-[#0d2137]/40 transition-colors items-center"
                      >
                        <div className="col-span-1 text-[#a8d8ea]/60 truncate text-[6px]">
                          {row.gameId.slice(0, 6)}…
                        </div>
                        <div className="col-span-2">
                          <span
                            className="px-1.5 py-0.5 rounded-sm text-[7px]"
                            style={{
                              color: teamColor(row.team),
                              backgroundColor: `${teamColor(row.team)}15`,
                              border: `1px solid ${teamColor(row.team)}30`,
                            }}
                          >
                            {teamName(row.team)}
                          </span>
                        </div>
                        <div className="col-span-2 text-right text-[#ffd700]">
                          {formatSui(row.amount)}{" "}
                          <span className="text-[#a8d8ea]/30">OCT</span>
                        </div>
                        <div className="col-span-2 text-center">
                          {row.result === "win" && (
                            <span className="text-[#88d8b0] text-glow-mint">
                              WIN
                            </span>
                          )}
                          {row.result === "lose" && (
                            <span className="text-[#ff6b6b]">LOSE</span>
                          )}
                          {row.result === "pending" && (
                            <span className="text-[#ffd700]/50 animate-pulse">
                              ...
                            </span>
                          )}
                          {row.result === "cancelled" && (
                            <span className="text-[#c4a0ff]">CANCELLED</span>
                          )}
                          {row.result === "refunded" && (
                            <span className="text-[#c4a0ff]">REFUNDED</span>
                          )}
                        </div>
                        <div className="col-span-2 text-right">
                          {row.result === "refunded" && row.claimedAmount ? (
                            <span className="text-[#c4a0ff]">
                              {formatSui(row.claimedAmount)}{" "}
                              <span className="text-[#a8d8ea]/30">OCT</span>
                            </span>
                          ) : row.result === "cancelled" ? (
                            <span className="text-[#c4a0ff]/50 text-[7px]">
                              Claim Refund
                            </span>
                          ) : effectivelyClaimed && (row.claimedAmount || isSessionClaimed) ? (
                            <span className="text-[#88d8b0]">
                              {row.claimedAmount ? (
                                <>
                                  {formatSui(row.claimedAmount)}{" "}
                                  <span className="text-[#a8d8ea]/30">OCT</span>
                                </>
                              ) : (
                                <span className="text-[7px]">✓ Claimed</span>
                              )}
                            </span>
                          ) : row.result === "win" && !effectivelyClaimed ? (
                            keypair && row.gameObjectId ? (
                              <button
                                onClick={() => handleClaim(row)}
                                disabled={isClaiming}
                                className="px-2 py-0.5 rounded-sm text-[7px] font-pixel uppercase tracking-wider transition-all
                                  bg-[#88d8b0] hover:bg-[#9de8c0] text-[#0a1628]
                                  disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {isClaiming ? "..." : "Claim"}
                              </button>
                            ) : (
                              <span className="text-[#ffd700]/50 text-[7px]">
                                Unclaimed
                              </span>
                            )
                          ) : (
                            <span className="text-[#a8d8ea]/20">—</span>
                          )}
                        </div>
                        <div className="col-span-3 text-right text-[#a8d8ea]/30 text-[7px]">
                          {row.timestampMs ? formatDate(row.timestampMs) : "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="text-center">
              <button
                onClick={fetchHistory}
                disabled={loading}
                className="px-4 py-1.5 rounded-sm text-[7px] font-pixel uppercase tracking-wider
                                    text-[#a8d8ea]/40 hover:text-[#a8d8ea] border border-[#a8d8ea]/10 hover:border-[#a8d8ea]/30
                                    transition-all disabled:opacity-40"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
