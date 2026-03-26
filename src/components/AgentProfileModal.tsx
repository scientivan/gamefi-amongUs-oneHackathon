import { useState } from "react";
import { Player } from "@/types";

interface AgentProfileModalProps {
  player: Player;
  onClose: () => void;
}

export function AgentProfileModal({ player, onClose }: AgentProfileModalProps) {
  const getRecentPost = () => {
    if (player.posts && player.posts.length > 0) {
      return player.posts[player.posts.length - 1]; // Get latest
    }
    return "Minting GPT - #ready";
  };

  const socialHandle = player.owner
    ? `@${player.owner}`
    : `@${player.name.replace(/\s+/g, "").toLowerCase()}`;
  const profileUrl = `https://www.moltbook.com/u/${player.name}`;

  // Share Logic
  const shareText = `I found ${socialHandle}'s Openclaw "${player.name}" in Among Ones! 🦞\n\nThey just posted: "${getRecentPost()}"\n\nFind yours: https://among-nads.vercel.app/`;
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

  return (
    <div className="fixed inset-0 z-[9099] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Card - Reduced max-width from 400px to 320px */}
      <div
        className="relative w-full bg-[#0f172a] border-2 border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col font-sans"
        style={{ maxWidth: "320px" }}
      >
        {/* Header / Close Button */}
        <div className="absolute top-2 right-2 z-10">
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-xs"
          >
            ✕
          </button>
        </div>

        {/* Content Container */}
        <div className="p-4 sm:p-5 flex flex-col items-center pt-6 sm:pt-8 w-full">
          {/* Avatar - Smaller on mobile */}
          <div
            className={`relative w-16 h-16 sm:w-20 sm:h-20 mb-2 sm:mb-3 ${!player.alive ? "grayscale" : ""}`}
          >
            <img
              src={player.avatar || "/characters/molandak-black-tg.webp"}
              alt={player.name}
              className="w-full h-full object-contain drop-shadow-xl"
            />
          </div>

          {/* Name & Karma */}
          <h2 className="text-lg sm:text-xl font-bold text-white mb-0.5 flex items-center gap-2 text-center leading-tight">
            {player.name}
            {player.role === "Impostor" && (
              <span className="text-[9px] sm:text-[10px] bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded border border-red-800">
                IMP
              </span>
            )}
          </h2>
          <div className="flex items-center gap-1 text-yellow-500 mb-3 sm:mb-4 text-xs">
            <span>⭐</span>
            <span className="font-bold">{player.karma || 0} karma</span>
          </div>

          {/* Social Handle Box */}
          <div className="w-full space-y-1.5 sm:space-y-2 mb-2 sm:mb-3">
            {/* Moltbook Identity */}
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-[#1e293b] hover:bg-[#2a3855] transition-colors rounded-xl p-2 sm:p-2.5 flex items-center gap-2 sm:gap-2.5 border border-slate-700/50 group"
            >
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-[9px] sm:text-[10px]">
                M
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] sm:text-[10px] text-slate-400 leading-none mb-0.5">
                  Moltbook Identity
                </div>
                <div className="text-[10px] sm:text-xs text-blue-400 font-medium truncate group-hover:underline">
                  @{player.name}
                </div>
              </div>
            </a>

            {/* Twitter / X Identity */}
            {player.owner && (
              <a
                href={`https://twitter.com/${player.owner}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-[#1e293b] hover:bg-[#2a3855] transition-colors rounded-xl p-2 sm:p-2.5 flex items-center gap-2 sm:gap-2.5 border border-slate-700/50 group"
              >
                {/* X Avatar or Icon */}
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black flex items-center justify-center text-white font-bold text-[9px] sm:text-[10px] overflow-hidden shrink-0">
                  {player.ownerAvatar ? (
                    <img
                      src={player.ownerAvatar}
                      alt="X"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    "𝕏"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="text-[9px] sm:text-[10px] text-slate-400 leading-none">
                      X Identity
                    </div>
                    {player.ownerFollowers !== undefined && (
                      <span className="text-[8px] sm:text-[9px] text-slate-500 bg-slate-800/50 px-1 rounded">
                        {player.ownerFollowers >= 1000
                          ? (player.ownerFollowers / 1000).toFixed(1) + "k"
                          : player.ownerFollowers}{" "}
                        followers
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] sm:text-xs text-white font-medium truncate group-hover:underline">
                    @{player.owner}
                  </div>
                </div>
                <div className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-[8px] sm:text-[9px] rounded border border-blue-500/20">
                  VERIFIED
                </div>
              </a>
            )}
          </div>

          {/* Recent Post Box */}
          <div className="w-full bg-[#1e293b]/50 rounded-xl p-2.5 sm:p-3 mb-3 sm:mb-4 border border-slate-800 relative overflow-hidden">
            <div className="text-[8px] sm:text-[9px] uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
              <span>📰</span> Recent Post
            </div>
            <p className="text-[10px] sm:text-xs text-slate-300 italic line-clamp-3 leading-relaxed">
              "{getRecentPost()}"
            </p>
            {/* Decorative background element */}
            <div className="absolute -bottom-3 -right-1 text-5xl opacity-[0.03] rotate-12 select-none">
              💬
            </div>
          </div>

          {/* Main Action Button */}
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 sm:py-2.5 rounded-xl text-center text-xs sm:text-sm transition-colors mb-2 sm:mb-3 flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20"
          >
            View Full Profile ➜
          </a>

          {/* Share Button (Twitter) - Only button remaining */}
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20 text-[#1DA1F2] text-xs font-semibold py-2 sm:py-2.5 rounded-xl border border-[#1DA1F2]/30 transition-colors flex items-center justify-center gap-2"
          >
            <span>🐦</span> Share on X
          </a>
        </div>
      </div>
    </div>
  );
}
