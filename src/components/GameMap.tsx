import { useMemo, useState, useEffect } from "react";
import { RoomType } from "@/types";
import { useSmoothedPositions } from "@/hooks/useSmoothedPositions";
import { OddsData } from "@/hooks/useGameState";

interface GameMapProps {
  players: Record<string, any>;
  currentPlayerId?: string;
  messages?: {
    sender: string;
    content: string;
    timestamp?: number;
    type?: "chat" | "meeting";
  }[];
  phase: string;
  meetingContext?: {
    reporter?: string;
    bodyFound?: string;
    votesReceived: Record<string, string>;
  };
  winner?: string | null;
  sabotage?: { name: string; timer: number } | null;
  onPlayerClick?: (player: any) => void;
  selectedPlayerId?: string;
  odds?: OddsData;
}

// Posisi tengah tiap room, disesuaikan dengan gambar amongones-map.webp
const ROOM_COORDS: Record<RoomType, { x: number; y: number }> = {
  [RoomType.ENGINE_ROOM]: { x: 10, y: 50 },
  [RoomType.WEAPONS_TOP]: { x: 22, y: 22 },
  [RoomType.WEAPONS_BOTTOM]: { x: 22, y: 75 },
  [RoomType.MEDBAY]: { x: 34, y: 40 },
  [RoomType.CAFETERIA]: { x: 50, y: 20 },
  [RoomType.STORAGE]: { x: 48, y: 65 },
  [RoomType.ADMIN]: { x: 60, y: 48 },
  [RoomType.NAVIGATION]: { x: 73, y: 18 },
  [RoomType.SHIELDS]: { x: 73, y: 72 },
  [RoomType.BRIDGE]: { x: 92, y: 50 },
  [RoomType.HALLWAY]: { x: 50, y: 50 },
};

/** Kembalikan src gambar yang tepat — selalu pakai karakter warna masing-masing */
function getAvatarSrc(player: any): string {
  return player.avatar || "/characters/molandak-black-tg.webp";
}

export function GameMap({
  players,
  currentPlayerId,
  messages,
  phase,
  meetingContext,
  winner,
  sabotage,
  onPlayerClick,
  selectedPlayerId,
  odds,
}: GameMapProps) {
  // Build target positions directly from server-sent x/y (waypoint-driven).
  // Fallback to ROOM_COORDS only if x/y are missing (e.g. first lobby tick).
  const targetPositions = useMemo(() => {
    const targets: Record<string, { x: number; y: number }> = {};
    Object.values(players).forEach((player: any) => {
      if (player.x != null && player.y != null) {
        targets[player.id] = { x: player.x, y: player.y };
      } else {
        const room = (player.room || RoomType.CAFETERIA) as RoomType;
        const coords = ROOM_COORDS[room] || ROOM_COORDS[RoomType.CAFETERIA];
        targets[player.id] = { x: coords.x, y: coords.y };
      }
    });
    return targets;
  }, [players]);

  // Smoothly interpolated positions (lerp each frame, like moltbook-town).
  const smoothedPositions = useSmoothedPositions(targetPositions);

  // Derived Meeting Data
  const reporter = meetingContext?.reporter
    ? players[meetingContext.reporter]
    : null;
  const body = meetingContext?.bodyFound
    ? players[meetingContext.bodyFound]
    : null;
  const recentMessages = messages
    ? messages.filter((m) => m.type === "meeting").slice(-4)
    : [];

  // Two-stage meeting: 'intro' shows the emergency image, 'discuss' shows the panel.
  // Resets to 'intro' every time the phase flips back to MEETING.
  const [meetingStage, setMeetingStage] = useState<"intro" | "discuss">(
    "intro",
  );

  useEffect(() => {
    if (phase === "MEETING") {
      setMeetingStage("intro");
      const timer = setTimeout(() => setMeetingStage("discuss"), 2500);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  return (
    <div className="w-full flex flex-col gap-2">
      {/* LOBBY PHASE & PERSISTENT HEADER — Player selection info (Moved above map) */}
      <div className="w-full bg-[#0a1628]/90 border border-slate-700/50 rounded-lg px-3 py-2 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-[8px] sm:text-[10px] font-pixel text-[#a8d8ea]/60 uppercase tracking-wider whitespace-nowrap">
            Players spawned from
          </span>
          <a
            href="https://moltbook.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[8px] sm:text-[10px] font-pixel text-[#ffd700] hover:text-[#ffed4a] transition-colors uppercase tracking-wider underline underline-offset-2"
          >
            Moltbook
          </a>
        </div>

        {/* Separator (Desktop only) */}
        <div className="hidden sm:block w-px h-3 bg-slate-700/50"></div>

        {/* Instruction */}
        <span className="text-[7px] sm:text-[9px] font-pixel text-[#a8d8ea]/40 animate-pulse text-center">
          (Click character to view profile)
        </span>
      </div>

      <div
        className="relative w-full rounded-xl overflow-hidden border border-slate-700 shadow-2xl"
        style={{ aspectRatio: "11 / 6" }}
      >
        {/* Map background image */}
        <img
          src="/maps/amongones-map.webp"
          alt="Among Ones Map"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Live odds color overlay — LOBBY only */}
        {phase === "LOBBY" && odds && odds.total > 0 && (
          <div
            className="absolute inset-0 z-10 pointer-events-none transition-all duration-1000"
            style={{
              background:
                odds.crewPool >= odds.impPool
                  ? `rgba(96,165,250,${Math.min(0.18, (odds.crewPool / odds.total - 0.5) * 0.36)})`
                  : `rgba(239,68,68,${Math.min(0.18, (odds.impPool / odds.total - 0.5) * 0.36)})`,
            }}
          />
        )}

        {/* Live odds badges — LOBBY only */}
        {phase === "LOBBY" && odds && (
          <div className={`absolute top-2 left-2 z-30 flex gap-1.5 ${odds.timeLeft < 30 ? "animate-pulse" : ""}`}>
            <span className="bg-blue-900/80 border border-blue-400/30 rounded px-2 py-0.5 text-[7px] font-pixel text-blue-300">
              CREW {odds.crewOdds}x
            </span>
            <span className="bg-red-900/80 border border-red-400/30 rounded px-2 py-0.5 text-[7px] font-pixel text-red-300">
              IMP {odds.impOdds}x
            </span>
          </div>
        )}

        {/* Draw Players - HIDE during meeting to focus on overlay */}
        {phase !== "MEETING" &&
          Object.values(players).map((player: any, i) => {
            // Use smoothed (lerped) position; skip render until first interpolation tick.
            const pos = smoothedPositions[player.id];
            if (!pos) return null;

            return (
              <div
                key={player.id || i}
                className={`absolute flex flex-col items-center transform -translate-x-1/2 -translate-y-1/2 z-20 group cursor-pointer transition-transform ${selectedPlayerId === player.id ? "scale-110" : ""}`}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  willChange: "transform",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayerClick?.(player);
                }}
              >
                {/* Avatar */}
                <div
                  className={`relative w-5 h-5 sm:w-16 sm:h-16 ${!player.alive ? "grayscale opacity-60" : ""}`}
                  style={
                    player.alive && player.role === "Impostor"
                      ? { filter: "drop-shadow(0 0 6px #ef4444)" }
                      : {}
                  }
                >
                  <img
                    src={getAvatarSrc(player)}
                    alt={player.name}
                    className="w-full h-full object-contain transition-transform group-hover:scale-110"
                  />
                  {!player.alive && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span
                        className="text-[10px] sm:text-2xl drop-shadow-lg"
                        style={{ textShadow: "0 0 4px #000" }}
                      >
                        💀
                      </span>
                    </div>
                  )}
                </div>

                {/* Name Label */}
                <div
                  className={`mt-0.5 sm:mt-1 px-0.5 sm:px-1.5 py-px sm:py-0.5 bg-black/60 backdrop-blur-sm rounded text-[4px] sm:text-[8px] text-white font-mono whitespace-nowrap group-hover:bg-[#ffd700]/20 transition-colors ${player.role === "Impostor" ? "text-red-400" : ""}`}
                >
                  {player.name || player.id.slice(0, 8)}
                </div>
              </div>
            );
          })}

        {/* SABOTAGE WARNING BANNER — shown at top of map during active sabotage */}

        {/* SABOTAGE WARNING BANNER — shown at top of map during active sabotage */}
        {phase === "ACTION" && sabotage && (
          <div className="absolute top-0 left-0 right-0 z-30 bg-red-900/90 border-b border-red-700 px-4 py-2 flex items-center justify-center gap-3 animate-pulse">
            <span className="text-red-200 text-xs font-black uppercase tracking-widest">
              {sabotage.name}
            </span>
            <span className="text-red-300 text-xs font-bold">
              — Fix in {sabotage.timer}s or lose
            </span>
          </div>
        )}

        {/* ENDED OVERLAY — Victory Screen */}
        {(phase === "ENDED" || winner) &&
          (() => {
            const crewWon = winner?.includes("Crewmates");
            // Show only alive winners: crewmates if crew won, impostors if impostors won
            const winners = Object.values(players).filter((p: any) =>
              crewWon
                ? p.role === "Crewmate" && p.alive
                : p.role === "Impostor" && p.alive,
            );

            return (
              <div className="absolute inset-0 z-50 animate-in fade-in duration-700 overflow-hidden">
                {/* Background — victory image with gradient overlay */}
                <img
                  src="/amongones-victory-tg.webp"
                  alt="Victory"
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                />
                {/* Dark gradient overlay for readability */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: crewWon
                      ? "radial-gradient(ellipse at center bottom, rgba(30,58,138,0.7) 0%, rgba(15,23,42,0.95) 70%)"
                      : "radial-gradient(ellipse at center bottom, rgba(127,29,29,0.7) 0%, rgba(15,23,42,0.95) 70%)",
                  }}
                />

                {/* Content */}
                <div className="relative z-10 flex flex-col items-center justify-center h-full px-4">
                  {/* "VICTORY" title */}
                  <h1
                    className={`font-pixel text-2xl sm:text-5xl md:text-7xl font-black uppercase tracking-widest mb-1 sm:mb-2 ${crewWon ? "text-blue-400" : "text-red-500"}`}
                    style={{
                      textShadow: crewWon
                        ? "0 0 30px rgba(96,165,250,0.8), 0 0 60px rgba(59,130,246,0.4)"
                        : "0 0 30px rgba(239,68,68,0.8), 0 0 60px rgba(220,38,38,0.4)",
                    }}
                  >
                    Victory
                  </h1>

                  {/* Subtitle — who won */}
                  <p
                    className={`font-pixel text-[7px] sm:text-xs md:text-sm uppercase tracking-[0.2em] mb-4 sm:mb-8 ${crewWon ? "text-blue-300/80" : "text-red-300/80"}`}
                  >
                    {crewWon ? "Crewmates Win" : "Impostors Win"}
                  </p>

                  {/* Win reason */}
                  <p className="text-slate-400 text-[6px] sm:text-[10px] font-pixel mb-3 sm:mb-6 uppercase tracking-wider">
                    {winner?.includes("Sabotage")
                      ? "💥 Critical sabotage was not repaired"
                      : winner?.includes("Tasks")
                        ? "✅ All tasks completed"
                        : winner?.includes("Survived")
                          ? "⏱️ Crewmates survived the timer"
                          : winner?.includes("Domination")
                            ? "🔪 Impostors dominated the crew"
                            : crewWon
                              ? "👋 All impostors eliminated"
                              : "💀 The impostors won"}
                  </p>

                  {/* Surviving winners — character showcase */}
                  <div className="flex items-end justify-center flex-wrap gap-2 sm:gap-4 px-2 max-w-full">
                    {winners.map((p: any, idx: number) => (
                      <div
                        key={p.id}
                        className="flex flex-col items-center animate-in slide-in-from-bottom-4 fade-in"
                        style={{
                          animationDelay: `${idx * 150}ms`,
                          animationFillMode: "both",
                        }}
                      >
                        {/* Character avatar — scale down when many winners */}
                        <div
                          className={`relative ${winners.length > 4 ? "w-10 h-10 sm:w-14 sm:h-14 md:w-18 md:h-18" : "w-12 h-12 sm:w-20 sm:h-20 md:w-28 md:h-28"}`}
                          style={{
                            filter:
                              p.role === "Impostor"
                                ? "drop-shadow(0 0 12px rgba(239,68,68,0.7))"
                                : "drop-shadow(0 0 12px rgba(96,165,250,0.7))",
                          }}
                        >
                          <img
                            src={getAvatarSrc(p)}
                            alt={p.name}
                            className="w-full h-full object-contain"
                          />
                        </div>

                        {/* Player name — red for impostors */}
                        <div
                          className={`mt-1 sm:mt-2 px-1 sm:px-2 py-0.5 rounded font-pixel text-[5px] sm:text-[7px] md:text-[9px] text-center truncate max-w-[80px] sm:max-w-[120px] ${
                            p.role === "Impostor"
                              ? "text-red-400 bg-red-900/30 border border-red-800/40"
                              : "text-blue-300 bg-blue-900/30 border border-blue-800/40"
                          }`}
                        >
                          {p.name}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* "Next game starting..." hint */}
                  <p className="mt-4 sm:mt-8 text-slate-500 text-[6px] sm:text-[9px] font-pixel animate-pulse">
                    Next round starting soon...
                  </p>
                </div>
              </div>
            );
          })()}

        {/* MEETING OVERLAY */}
        {phase === "MEETING" && (
          <div className="absolute inset-0 z-50">
            {/* STAGE 1 — Emergency image burst (auto-dismisses after 2.5s) */}
            {meetingStage === "intro" && (
              <div className="absolute inset-0 animate-red-flash flex items-center justify-center">
                <img
                  src="/among-ones-emergency-meeting-tg.webp"
                  alt="Emergency Meeting"
                  className="animate-meeting-burst max-w-[90%] max-h-[90%] object-contain drop-shadow-2xl"
                />
              </div>
            )}

            {/* STAGE 2 — Discuss panel */}
            {meetingStage === "discuss" && (
              <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center animate-in fade-in duration-300 p-1.5 sm:p-4">
                {/* Header */}
                <div className="text-center mb-1 sm:mb-6 flex-shrink-0">
                  <h2 className="text-[10px] sm:text-3xl md:text-5xl font-black text-red-500 animate-pulse uppercase italic">
                    {meetingContext?.bodyFound
                      ? "DEAD BODY REPORTED"
                      : "EMERGENCY MEETING"}
                  </h2>
                  {meetingContext?.bodyFound && body && (
                    <div className="text-slate-400 mt-0.5 sm:mt-2 text-[7px] sm:text-sm font-bold flex items-center gap-1 sm:gap-2 justify-center">
                      <span>Found body of </span>
                      <span className="bg-red-900/50 px-1 sm:px-2 py-0.5 sm:py-1 rounded text-red-200">
                        {body.name}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-row w-full max-w-5xl gap-1.5 sm:gap-6 flex-1 min-h-0">
                  {/* LEFT: Player Grid & Voting */}
                  <div className="flex-1 bg-slate-950/50 rounded-md sm:rounded-xl border border-slate-700 p-1 sm:p-4 overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1 sm:gap-3">
                      {Object.values(players).map((p: any) => {
                        const hasVoted =
                          meetingContext?.votesReceived &&
                          meetingContext.votesReceived[p.id];
                        return (
                          <div
                            key={p.id}
                            className={`flex items-center gap-1 sm:gap-3 p-0.5 sm:p-2 rounded-sm sm:rounded-lg border ${p.alive ? "bg-slate-800 border-slate-700" : "bg-red-900/20 border-red-900/50 opacity-60"}`}
                          >
                            <div
                              className={`w-4 h-4 sm:w-12 sm:h-12 flex-shrink-0 ${!p.alive ? "grayscale opacity-60" : ""}`}
                            >
                              <img
                                src={
                                  p.avatar ||
                                  "/characters/molandak-black-tg.webp"
                                }
                                alt={p.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="min-w-0 flex items-center gap-1">
                              <div className="text-[5px] sm:text-xs font-bold truncate text-slate-200">
                                {p.name}
                              </div>
                              {hasVoted && (
                                <div className="text-[5px] sm:text-[10px] text-green-400 font-bold flex-shrink-0">
                                  ✓
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* RIGHT: Discussion Bubbles */}
                  <div className="flex-1 bg-slate-800/50 rounded-md sm:rounded-xl border border-slate-700 p-1 sm:p-4 flex flex-col relative overflow-hidden">
                    <div className="text-[6px] sm:text-xs font-bold text-slate-500 mb-0.5 sm:mb-2 uppercase tracking-widest">
                      DISCUSS!
                    </div>

                    <div className="space-y-1 sm:space-y-3 overflow-y-auto flex-1 flex flex-col justify-end">
                      {recentMessages.map((msg, idx) => {
                        const sender = players[msg.sender];
                        return (
                          <div
                            key={idx}
                            className="flex gap-1 sm:gap-3 animate-in slide-in-from-bottom-2 fade-in duration-300"
                          >
                            <div className="w-4 h-4 sm:w-10 sm:h-10 flex-shrink-0">
                              <img
                                src={
                                  sender?.avatar ||
                                  "/characters/molandak-black-tg.webp"
                                }
                                alt={sender?.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="bg-white text-black p-0.5 sm:p-2 rounded-sm sm:rounded-lg rounded-tl-none shadow-lg max-w-[85%]">
                              <div className="text-[5px] sm:text-[10px] font-bold text-slate-500">
                                {sender?.name || "Unknown"}
                              </div>
                              <div className="text-[6px] sm:text-xs font-medium leading-tight sm:leading-relaxed">
                                {msg.content}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
