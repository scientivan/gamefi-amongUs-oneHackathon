"use client";

import { useState, useEffect, useCallback } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { ConnectButton } from "@mysten/dapp-kit";

interface MissionWithProgress {
  id: string;
  type: "daily" | "weekly";
  title: string;
  description: string;
  req: { kind: string; target: number };
  reward: string; // OCT in MIST as string
  progress: number;
  completed: boolean;
  claimed: boolean;
  periodKey: string;
}

function formatOct(mist: string): string {
  return (Number(mist) / 1_000_000_000).toFixed(4);
}

function formatProgress(m: MissionWithProgress): string {
  if (m.req.kind === "total_bet_mist") {
    const prog = (m.progress / 1_000_000_000).toFixed(3);
    const tgt = (m.req.target / 1_000_000_000).toFixed(2);
    return `${prog} / ${tgt} OCT`;
  }
  return `${m.progress}/${m.req.target}`;
}

function getResetCountdown(type: "daily" | "weekly"): string {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);

  if (type === "weekly") {
    const dayOfWeek = now.getUTCDay(); // 0=Sun
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    midnight.setUTCDate(now.getUTCDate() + daysUntilMonday - 1);
    midnight.setUTCHours(24, 0, 0, 0);
  }

  const diff = midnight.getTime() - Date.now();
  if (diff <= 0) return "Resetting...";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `Resets in ${h}h ${m}m`;
}

export default function MissionsPage() {
  const account = useCurrentAccount();
  const address = account?.address;
  const [missions, setMissions] = useState<MissionWithProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimMsg, setClaimMsg] = useState<{ id: string; msg: string } | null>(null);
  const [tick, setTick] = useState(0);

  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

  const fetchMissions = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/missions/${address}`);
      const data = await res.json();
      setMissions(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [address, BACKEND]);

  useEffect(() => {
    fetchMissions();
    const interval = setInterval(fetchMissions, 15_000);
    return () => clearInterval(interval);
  }, [fetchMissions]);

  // Countdown refresh every minute
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const handleClaim = async (missionId: string) => {
    if (!address) return;
    setClaiming(missionId);
    try {
      const res = await fetch(`${BACKEND}/api/missions/${address}/claim/${missionId}`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setClaimMsg({ id: missionId, msg: `Claimed! Tx: ${data.txDigest.slice(0, 12)}…` });
      setTimeout(() => setClaimMsg(null), 5000);
      fetchMissions();
    } catch (err: any) {
      setClaimMsg({ id: missionId, msg: err.message?.slice(0, 60) ?? "Claim failed" });
      setTimeout(() => setClaimMsg(null), 4000);
    } finally {
      setClaiming(null);
    }
  };

  const daily = missions.filter((m) => m.type === "daily");
  const weekly = missions.filter((m) => m.type === "weekly");

  if (!address) {
    return (
      <main className="text-white px-3 py-8 sm:px-8 flex flex-col items-center gap-4">
        <div className="text-[10px] font-pixel text-[#a8d8ea]/60 uppercase tracking-wider">
          Connect wallet to view missions
        </div>
        <ConnectButton className="text-[8px] font-pixel" />
      </main>
    );
  }

  const renderSection = (label: string, items: MissionWithProgress[], type: "daily" | "weekly") => (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[9px] font-pixel text-[#ffd700] uppercase tracking-widest text-glow-gold">
          {label}
        </div>
        <div className="text-[7px] font-pixel text-[#a8d8ea]/40">
          {getResetCountdown(type)}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((m) => {
          const pct = Math.min(100, Math.round((m.progress / m.req.target) * 100));
          const isMsg = claimMsg?.id === m.id;
          return (
            <div
              key={m.id}
              className={`retro-panel p-3 flex flex-col gap-2 ${m.completed && !m.claimed ? "border-[#ffd700]/40" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[8px] font-pixel text-[#ffd700]">{m.title}</div>
                  <div className="text-[7px] font-pixel text-[#a8d8ea]/50 mt-0.5">{m.description}</div>
                </div>
                <div className="text-[7px] font-pixel text-[#88d8b0] whitespace-nowrap">
                  +{formatOct(m.reward)} OCT
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[6px] font-pixel text-[#a8d8ea]/40">Progress</span>
                  <span className="text-[6px] font-pixel text-[#a8d8ea]/60">
                    {formatProgress(m)}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#0a1628] rounded-sm overflow-hidden">
                  <div
                    className={`h-full rounded-sm transition-all duration-500 ${m.completed ? "bg-[#ffd700]" : "bg-[#88d8b0]"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Claim button */}
              {m.claimed ? (
                <div className="text-[7px] font-pixel text-[#a8d8ea]/30 text-center">
                  ✓ Claimed
                </div>
              ) : m.completed ? (
                <button
                  onClick={() => handleClaim(m.id)}
                  disabled={claiming === m.id}
                  className="w-full py-1.5 rounded-sm text-[7px] font-pixel uppercase tracking-wider
                    bg-[#ffd700] hover:bg-[#ffed4a] text-[#0a1628] pixel-border transition-all
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {claiming === m.id ? "Claiming..." : "Claim Reward"}
                </button>
              ) : (
                <div className="text-[7px] font-pixel text-[#a8d8ea]/30 text-center">
                  {pct}% complete
                </div>
              )}

              {isMsg && (
                <div className={`text-[7px] font-pixel text-center ${claimMsg?.msg.startsWith("Claimed") ? "text-[#88d8b0]" : "text-[#ff6b6b]"}`}>
                  {claimMsg?.msg}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <main className="text-white px-3 py-4 sm:px-8 sm:pb-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="retro-panel p-3 flex items-center justify-between">
          <div className="text-[9px] font-pixel text-[#ffd700] uppercase tracking-widest text-glow-gold">
            Missions
          </div>
          <div className="text-[7px] font-pixel text-[#a8d8ea]/40">
            Complete missions to earn OCT rewards
          </div>
        </div>

        {loading && missions.length === 0 ? (
          <div className="text-center text-[8px] font-pixel text-[#a8d8ea]/40 animate-pulse py-8">
            Loading missions...
          </div>
        ) : (
          <>
            {renderSection("Daily Missions", daily, "daily")}
            {renderSection("Weekly Missions", weekly, "weekly")}
          </>
        )}
      </div>
    </main>
  );
}
