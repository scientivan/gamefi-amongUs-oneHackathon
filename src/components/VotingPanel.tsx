"use client";

import { useState, useMemo, useEffect } from "react";
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction, ConnectButton } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { getKeypairFromEnv } from "@/lib/directSigner";
import { saveVoteCast, loadVoteCast } from "@/lib/persistence";
import type { VoteTally } from "@/hooks/useGameState";

interface VotingPanelProps {
  onChainGameId: string;
  voteTally?: VoteTally;
}

const VOTE_OPTIONS = [
  { id: 0, label: "Emergency Meeting", icon: "🚨", effect: "-5% Imp win chance", color: "#a8d8ea" },
  { id: 1, label: "Sabotage",          icon: "💥", effect: "+5% Imp win chance", color: "#ff6b6b" },
  { id: 2, label: "Report Body",       icon: "🔍", effect: "-3% Imp win chance", color: "#88d8b0" },
  { id: 3, label: "Vote Out",          icon: "👋", effect: "±3% Random",         color: "#ffd700" },
] as const;

const VOTE_COST_MIST = BigInt(1_000_000); // 0.001 OCT

export function VotingPanel({ onChainGameId, voteTally }: VotingPanelProps) {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const keypair = useMemo(() => getKeypairFromEnv(), []);
  const { mutate: signAndExecute } = useSignAndExecuteTransaction({
    execute: ({ bytes, signature }) =>
      (suiClient as any).executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: { showEffects: true },
      }),
  });
  const [voting, setVoting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successVote, setSuccessVote] = useState<number | null>(null);
  // Persisted: which vote option this address cast for this game (survives refresh)
  const [userVote, setUserVote] = useState<number | null>(null);
  // Optimistic +1 per option immediately on tx success (before server tally updates)
  const [optimisticExtra, setOptimisticExtra] = useState<Record<number, number>>({});

  const packageId = process.env.NEXT_PUBLIC_PACKAGE_ID;

  // Restore persisted vote when game or account changes
  useEffect(() => {
    if (!onChainGameId || !account?.address) return;
    const saved = loadVoteCast(onChainGameId, account.address);
    setUserVote(saved);
  }, [onChainGameId, account?.address]);

  const markSuccess = (voteType: number) => {
    setSuccessVote(voteType);
    setUserVote(voteType);
    setOptimisticExtra((prev) => ({ ...prev, [voteType]: (prev[voteType] ?? 0) + 1 }));
    if (account?.address) saveVoteCast(onChainGameId, account.address, voteType);
    setTimeout(() => setSuccessVote(null), 4000);
  };

  const handleVote = async (voteType: number) => {
    if (!account || !packageId) return;
    setVoting(voteType);
    setError(null);

    const tx = new Transaction();
    tx.setSenderIfNotSet(account.address);
    const [feeCoin] = tx.splitCoins(tx.gas, [VOTE_COST_MIST]);
    tx.moveCall({
      target: `${packageId}::game::cast_vote`,
      arguments: [
        tx.object(onChainGameId),
        tx.pure.u8(voteType),
        feeCoin,
      ],
    });

    if (keypair) {
      try {
        const kpAddress = keypair.toSuiAddress();
        tx.setSenderIfNotSet(kpAddress);
        const { data: gasCoins } = await (suiClient as any).getCoins({
          owner: kpAddress,
          coinType: "0x2::oct::OCT",
        });
        if (gasCoins?.length) {
          tx.setGasPayment(
            gasCoins.slice(0, 3).map((c: any) => ({
              objectId: c.coinObjectId,
              version: c.version,
              digest: c.digest,
            })),
          );
        }
        tx.setGasBudgetIfNotSet(5_000_000);
        const bytes = await tx.build({ client: suiClient as any });
        const { bytes: b64bytes, signature } = await keypair.signTransaction(bytes);
        await (suiClient as any).executeTransactionBlock({
          transactionBlock: b64bytes,
          signature,
          options: { showEffects: true },
        });
        markSuccess(voteType);
      } catch (e: any) {
        setError(e?.message?.slice(0, 80) ?? "Vote failed");
      } finally {
        setVoting(null);
      }
      return;
    }

    let resolvedTx: Transaction = tx;
    try {
      const bytes = await tx.build({ client: suiClient as any });
      resolvedTx = Transaction.from(bytes);
    } catch (e) {
      console.warn("[VotingPanel] tx.build failed, using raw tx:", e);
    }

    signAndExecute(
      { transaction: resolvedTx as any },
      {
        onSuccess: () => markSuccess(voteType),
        onError: (e) => setError(e.message?.slice(0, 80) ?? "Vote failed"),
        onSettled: () => setVoting(null),
      },
    );
  };

  // Merge server counts with optimistic extras
  const serverCounts = voteTally?.counts ?? [0, 0, 0, 0];
  const counts = serverCounts.map((c, i) => c + (optimisticExtra[i] ?? 0));
  const totalVotes = counts.reduce((a, b) => a + b, 0);

  return (
    <div className="retro-panel p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-[8px] font-pixel text-[#ffd700] uppercase tracking-widest text-glow-gold">
          Community Voting
        </div>
        <div className="text-[7px] font-pixel text-[#a8d8ea]/40">
          0.001 OCT per vote · influences outcome
        </div>
      </div>

      {/* Success toast */}
      {successVote !== null && (
        <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-sm bg-[#88d8b0]/15 border border-[#88d8b0]/40">
          <span className="text-[#88d8b0] text-sm">✓</span>
          <div className="flex flex-col">
            <span className="text-[8px] font-pixel text-[#88d8b0]">
              Vote cast! · {VOTE_OPTIONS[successVote].label}
            </span>
            <span className="text-[6px] font-pixel text-[#88d8b0]/50">
              Confirmed on-chain
            </span>
          </div>
        </div>
      )}

      {/* Vote buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {VOTE_OPTIONS.map((opt) => {
          const count = counts[opt.id];
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isVoting = voting === opt.id;
          const isSuccess = successVote === opt.id;      // transient 4s flash
          const isMyVote = userVote === opt.id;           // persisted across refresh
          const alreadyVoted = userVote !== null;

          return (
            <button
              key={opt.id}
              onClick={() => handleVote(opt.id)}
              disabled={!account || isVoting || voting !== null || alreadyVoted}
              className={`
                relative flex flex-col items-center gap-1 p-2.5 rounded-sm border transition-all duration-200
                ${isSuccess
                  ? "border-[#88d8b0] bg-[#88d8b0]/15 shadow-[0_0_12px_rgba(136,216,176,0.3)]"
                  : isMyVote
                    ? "border-[#88d8b0]/50 bg-[#88d8b0]/8"
                    : isVoting
                      ? "border-[#ffd700]/40 bg-[#ffd700]/5"
                      : alreadyVoted
                        ? "border-[#ffd700]/5 bg-[#0d2137]/20 opacity-40"
                        : "border-[#ffd700]/10 bg-[#0d2137]/40 hover:border-[#ffd700]/30 hover:bg-[#0d2137]/60"}
                disabled:cursor-not-allowed
              `}
            >
              {/* Persistent voted badge */}
              {isMyVote && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#88d8b0] flex items-center justify-center">
                  <span className="text-[8px] text-[#0a1628] leading-none font-bold">✓</span>
                </div>
              )}

              <span className="text-lg">{opt.icon}</span>
              <span className="text-[7px] font-pixel text-center" style={{ color: opt.color }}>
                {opt.label}
              </span>
              <span className="text-[6px] font-pixel text-[#a8d8ea]/40 text-center">
                {opt.effect}
              </span>
              <div className="w-full mt-1">
                <div className="h-1 bg-[#0a1628] rounded-sm overflow-hidden">
                  <div
                    className="h-full rounded-sm transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: opt.color }}
                  />
                </div>
                <div
                  className="text-[6px] font-pixel text-center mt-0.5 transition-all"
                  style={{ color: isMyVote ? opt.color : "rgba(168,216,234,0.3)" }}
                >
                  {count} vote{count !== 1 ? "s" : ""}
                  {isMyVote && " ← you"}
                </div>
              </div>
              {isVoting && (
                <span className="text-[6px] font-pixel text-[#ffd700] animate-pulse">
                  signing...
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!account && (
        <div className="flex justify-center mt-3">
          <ConnectButton className="text-[8px] font-pixel" />
        </div>
      )}

      {error && (
        <div className="text-[7px] font-pixel text-[#ff6b6b] text-center mt-2 truncate">
          {error}
        </div>
      )}
    </div>
  );
}
