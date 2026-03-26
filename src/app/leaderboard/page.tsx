"use client";

import { useState, useEffect, useCallback } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";

const shortAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

const fmtSui = (mist: bigint) => {
  const n = Number(mist) / 1_000_000_000;
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(4)}`;
};

interface LeaderRow {
  rank: number;
  address: string;
  totalBet: bigint;
  totalClaimed: bigint;
  pnl: bigint;
  games: number;
  wins: number;
  winRate: number;
}

interface StreakRecord {
  address: string;
  currentStreak: number;
  bestStreak: number;
}

export default function LeaderboardPage() {
  const account = useCurrentAccount();
  const address = account?.address;
  const suiClient = useSuiClient();
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [streakMap, setStreakMap] = useState<Record<string, StreakRecord>>({});

  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

  const fetchStreaks = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/api/streaks/top`);
      const data: StreakRecord[] = await res.json();
      const map: Record<string, StreakRecord> = {};
      for (const r of data) map[r.address] = r;
      setStreakMap(map);
    } catch {
      // silent
    }
  }, [BACKEND]);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const [betEvents, claimEvents, settledEvents] = await Promise.all([
        suiClient.queryEvents({
          query: {
            MoveEventType: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::game::EvBetPlaced`,
          },
          limit: 1000,
        }),
        suiClient.queryEvents({
          query: {
            MoveEventType: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::game::EvPayoutClaimed`,
          },
          limit: 1000,
        }),
        suiClient.queryEvents({
          query: {
            MoveEventType: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::game::EvGameSettled`,
          },
          limit: 500,
        }),
      ]);

      // Map: gameId → winningTeam
      const winMap = new Map<string, number>();
      for (const e of settledEvents.data) {
        const j = e.parsedJson as Record<string, unknown> | null;
        if (j?.game_id) winMap.set(String(j.game_id), Number(j.winning_team));
      }

      // Aggregate per bettor
      const map = new Map<
        string,
        {
          totalBet: bigint;
          totalClaimed: bigint;
          settledGames: Set<string>;
          wins: number;
          betsByGame: Map<string, number>;
        }
      >();

      for (const e of betEvents.data) {
        const j = e.parsedJson as Record<string, unknown> | null;
        if (!j) continue;
        const addr = String(j.bettor);
        if (!map.has(addr)) {
          map.set(addr, {
            totalBet: BigInt(0),
            totalClaimed: BigInt(0),
            settledGames: new Set(),
            wins: 0,
            betsByGame: new Map(),
          });
        }
        const entry = map.get(addr)!;
        const gameId = String(j.game_id);
        entry.betsByGame.set(gameId, Number(j.team));
        if (winMap.has(gameId)) {
          entry.totalBet += BigInt(String(j.amount));
          entry.settledGames.add(gameId);
        }
      }

      // Count wins
      for (const entry of map.values()) {
        for (const [gameId, team] of entry.betsByGame.entries()) {
          const winner = winMap.get(gameId);
          if (winner !== undefined && team === winner) entry.wins++;
        }
      }

      for (const e of claimEvents.data) {
        const j = e.parsedJson as Record<string, unknown> | null;
        if (!j) continue;
        const addr = String(j.bettor);
        if (!map.has(addr)) continue;
        map.get(addr)!.totalClaimed += BigInt(String(j.amount));
      }

      const result: LeaderRow[] = Array.from(map.entries())
        .map(([addr, e]) => ({
          rank: 0,
          address: addr,
          totalBet: e.totalBet,
          totalClaimed: e.totalClaimed,
          pnl: e.totalClaimed - e.totalBet,
          games: e.settledGames.size,
          wins: e.wins,
          winRate:
            e.settledGames.size > 0
              ? Math.round((e.wins / e.settledGames.size) * 100)
              : 0,
        }))
        .filter((r) => r.games > 0)
        .sort((a, b) => (b.pnl > a.pnl ? 1 : b.pnl < a.pnl ? -1 : 0));

      result.forEach((r, i) => {
        r.rank = i + 1;
      });
      setRows(result);
    } catch (err) {
      console.error("[Leaderboard] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [suiClient]);

  useEffect(() => {
    fetchLeaderboard();
    fetchStreaks();
    const t = setInterval(fetchLeaderboard, 30000);
    const s = setInterval(fetchStreaks, 30000);
    return () => { clearInterval(t); clearInterval(s); };
  }, [fetchLeaderboard, fetchStreaks]);

  const myRow = address ? rows.find((r) => r.address === address) : null;

  const rankBadge = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  return (
    <div className="text-white p-4 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-pixel text-[#ffd700] text-glow-gold uppercase tracking-wider">
              Leaderboard
            </h1>
            <p className="text-[7px] font-pixel text-[#a8d8ea]/40 mt-1">
              Ranked by PnL
            </p>
          </div>
        </div>

        {/* My position card */}
        {myRow && (
          <div className="retro-panel p-3 border border-[#ffd700]/30 bg-[#ffd700]/5">
            <div className="text-[7px] font-pixel text-[#ffd700]/60 uppercase tracking-wider mb-2">
              Your Position
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="text-[10px] font-pixel text-[#ffd700]">
                {rankBadge(myRow.rank)}
              </div>
              <div className="text-center">
                <div
                  className={`text-sm font-pixel ${myRow.pnl >= BigInt(0) ? "text-[#88d8b0] text-glow-mint" : "text-[#ff6b6b] text-glow-red"}`}
                >
                  {fmtSui(myRow.pnl)} OCT
                </div>
                <div className="text-[6px] font-pixel text-[#a8d8ea]/40 uppercase">
                  PnL
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-pixel text-[#a8d8ea]">
                  {myRow.games}
                </div>
                <div className="text-[6px] font-pixel text-[#a8d8ea]/40 uppercase">
                  Games
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-pixel text-[#88d8b0]">
                  {myRow.winRate}%
                </div>
                <div className="text-[6px] font-pixel text-[#a8d8ea]/40 uppercase">
                  Win Rate
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="retro-panel overflow-hidden">
          <div className="grid grid-cols-12 gap-2 p-3 bg-[#0d2137] border-b border-[#ffd700]/20 text-[7px] font-pixel text-[#a8d8ea]/50 uppercase tracking-wider">
            <div className="col-span-1">Rank</div>
            <div className="col-span-5">Address</div>
            <div className="col-span-3 text-right">PnL</div>
            <div className="col-span-1 text-center">Games</div>
            <div className="col-span-1 text-center">Win%</div>
            <div className="col-span-1 text-center">🔥</div>
          </div>

          {loading && rows.length === 0 ? (
            <div className="p-8 flex justify-center">
              <div className="relative w-6 h-6">
                <div className="absolute inset-0 rounded-full border-2 border-[#ffd700]/10" />
                <div className="absolute inset-0 rounded-full border-2 border-t-[#ffd700] animate-spin" />
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-[8px] font-pixel text-[#a8d8ea]/30">
                No bets yet
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[#a8d8ea]/5">
              {rows.map((row) => {
                const isMe = address === row.address;
                const isPos = row.pnl >= BigInt(0);
                return (
                  <div
                    key={row.address}
                    className={`grid grid-cols-12 gap-2 p-3 text-[8px] font-pixel items-center transition-colors ${
                      isMe
                        ? "bg-[#ffd700]/5 border-l-2 border-[#ffd700]/50"
                        : "hover:bg-[#0d2137]/40"
                    }`}
                  >
                    <div className="col-span-1 text-[#a8d8ea]/60">
                      {row.rank <= 3 ? (
                        <span>{rankBadge(row.rank)}</span>
                      ) : (
                        <span className="text-[#a8d8ea]/40">#{row.rank}</span>
                      )}
                    </div>
                    <div
                      className={`col-span-5 font-pixel text-[7px] truncate ${isMe ? "text-[#ffd700]" : "text-[#a8d8ea]/70"}`}
                    >
                      {isMe
                        ? `${shortAddr(row.address)} (you)`
                        : shortAddr(row.address)}
                    </div>
                    <div
                      className={`col-span-3 text-right font-pixel ${isPos ? "text-[#88d8b0] text-glow-mint" : "text-[#ff6b6b]"}`}
                    >
                      {fmtSui(row.pnl)}
                    </div>
                    <div className="col-span-1 text-center text-[#a8d8ea]/60">
                      {row.games}
                    </div>
                    <div className="col-span-1 text-center">
                      <span
                        className={
                          row.winRate >= 50
                            ? "text-[#88d8b0]"
                            : "text-[#a8d8ea]/40"
                        }
                      >
                        {row.winRate}%
                      </span>
                    </div>
                    <div className="col-span-1 text-center font-pixel text-[7px]">
                      {(() => {
                        const best = streakMap[row.address]?.bestStreak ?? 0;
                        return best > 0
                          ? <span className="text-[#ffd700]">{best}</span>
                          : <span className="text-[#a8d8ea]/20">—</span>;
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
