'use client'

import { useCurrentAccount } from '@mysten/dapp-kit'
import { useState, useEffect } from 'react'
import { useGameState } from '@/hooks/useGameState'
import { GameMap } from '@/components/GameMap'
import { ChatLog } from '@/components/ChatLog'
import { BettingPanel } from '@/components/BettingPanel'
import { VotingPanel } from '@/components/VotingPanel'
import { OnboardingSection } from '@/components/OnboardingSection'

import { AgentProfileModal } from '@/components/AgentProfileModal'
import { Player } from '@/types'

export default function Home() {
  const account = useCurrentAccount()
  const address = account?.address
  const [isMounted, setIsMounted] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  // Auto-connect to sim-1
  const { gameState, isConnected: isBackendConnected, sendMessage, odds, voteTally, streakMap } = useGameState("sim-1")

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) return null;

  return (
    <main className="text-white px-3 py-4 sm:px-8 sm:pb-8 relative">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Modal Overlay */}
        {selectedPlayer && (
            <AgentProfileModal 
                player={selectedPlayer} 
                onClose={() => setSelectedPlayer(null)} 
            />
        )}

        {/* Game HUD bar */}
        <div className="flex items-center justify-between retro-panel p-2 sm:p-3 rounded-lg gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
             <div className={`flex items-center gap-1.5 text-[7px] sm:text-[8px] font-pixel flex-shrink-0 ${isBackendConnected ? 'text-[#88d8b0]' : 'text-[#ff6b6b]'}`}>
                 <div className={`w-2 h-2 rounded-full ${isBackendConnected ? 'bg-[#88d8b0]' : 'bg-[#ff6b6b]'} animate-pulse`} />
                 {isBackendConnected ? 'LIVE' : 'OFFLINE'}
             </div>
             <div className="text-[7px] sm:text-[8px] text-[#a8d8ea] font-pixel truncate">
                 PHASE: <span className="text-[#ffd700]">{gameState?.phase || 'SYNCING...'}</span>
             </div>
          </div>
          <div className="flex flex-col items-center flex-shrink-0">
              <span className="text-[6px] sm:text-[7px] text-[#a8d8ea]/50 uppercase tracking-widest font-pixel">Timer</span>
              <div className={`text-base sm:text-lg font-pixel ${gameState?.timer && gameState.timer < 10 ? 'text-[#ff6b6b] animate-pulse text-glow-red' : 'text-[#ffd700] text-glow-gold'}`}>
                  {gameState?.timer || '00'}s
              </div>
          </div>
        </div>

        {/* ROW 1: Map (left) + Betting Panel (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8">
                <GameMap
                    players={gameState?.players || {}}
                    currentPlayerId={address}
                    messages={gameState?.messages || []}
                    phase={gameState?.phase || 'LOBBY'}
                    meetingContext={gameState?.meetingContext}
                    winner={gameState?.winner}
                    sabotage={gameState?.sabotage}
                    onPlayerClick={(player) => setSelectedPlayer(player)}
                    selectedPlayerId={selectedPlayer?.id}
                    odds={odds ?? undefined}
                />
            </div>
            <div className="lg:col-span-4">
                <BettingPanel
                    phase={gameState?.phase || 'LOBBY'}
                    winner={gameState?.winner}
                    onChainGameId={gameState?.onChainGameId}
                    bettingOpen={gameState?.bettingOpen}
                    bettingTimer={gameState?.bettingTimer}
                    bettingOpensIn={gameState?.bettingOpensIn}
                    odds={odds ?? undefined}
                    streak={address ? streakMap[address] : undefined}
                />
            </div>
        </div>

        {/* Vote Panel — visible during LOBBY */}
        {gameState?.phase === 'LOBBY' && gameState?.onChainGameId && (
          <VotingPanel
            onChainGameId={gameState.onChainGameId}
            voteTally={voteTally ?? undefined}
          />
        )}

        {/* ROW 2: Stats bar — full width */}
        {(() => {
            const phase = gameState?.phase || 'LOBBY';
            const showTasks = phase === 'ACTION' || phase === 'MEETING';
            const taskTotal = gameState?.taskProgress?.total || 0;
            const taskCompleted = gameState?.taskProgress?.completed || 0;
            return (
            <div className={`grid gap-3 grid-cols-2 ${showTasks ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
                <div className="retro-panel p-2 sm:p-3 text-center min-w-0">
                    <div className="text-base sm:text-lg font-pixel text-[#a8d8ea] text-glow-gold">{Object.values(gameState?.players || {}).filter(p => p.role !== 'Impostor' && p.alive).length}</div>
                    <div className="text-[6px] sm:text-[8px] uppercase text-[#a8d8ea]/60 font-pixel tracking-wider truncate">Crewmates</div>
                </div>
                <div className="retro-panel p-2 sm:p-3 text-center min-w-0">
                    <div className="text-base sm:text-lg font-pixel text-[#ff6b6b] text-glow-red">{Object.values(gameState?.players || {}).filter(p => p.role === 'Impostor' && p.alive).length}</div>
                    <div className="text-[6px] sm:text-[8px] uppercase text-[#ff6b6b]/60 font-pixel tracking-wider truncate">Impostors</div>
                </div>
                <div className="retro-panel border-[#ff6b6b]/30 p-2 sm:p-3 text-center min-w-0">
                    <div className="text-lg sm:text-xl font-pixel text-[#ff6b6b] text-glow-red">
                        {Object.values(gameState?.players || {}).filter(p => !p.alive).length}
                    </div>
                    <div className="text-[6px] sm:text-[8px] uppercase text-[#ff6b6b] font-pixel tracking-wider truncate">DEAD</div>
                </div>
                {showTasks && (
                    <div className={`retro-panel p-2 sm:p-3 flex flex-col justify-center min-w-0 ${gameState?.sabotage ? 'border-[#ff6b6b]/50' : ''}`}>
                        <div className="flex justify-between items-center mb-1.5">
                            <div className="text-[6px] sm:text-[8px] uppercase text-[#88d8b0]/60 font-pixel tracking-wider truncate">Tasks</div>
                            <div className="text-[6px] sm:text-[8px] font-pixel text-[#88d8b0]">
                                {taskTotal > 0 ? `${taskCompleted}/${taskTotal}` : '—'}
                            </div>
                        </div>
                        <div className="w-full h-2 bg-[#0a1628] rounded-sm overflow-hidden">
                            <div
                                className="h-full bg-[#88d8b0] rounded-sm transition-all duration-500"
                                style={{ width: `${taskTotal > 0 ? (taskCompleted / taskTotal) * 100 : 0}%` }}
                            />
                        </div>
                        {gameState?.sabotage && (
                            <div className="mt-1.5 text-[6px] sm:text-[7px] font-pixel text-[#ff6b6b] animate-pulse text-center truncate">
                                {gameState.sabotage.name} — {gameState.sabotage.timer}s
                            </div>
                        )}
                    </div>
                )}
            </div>
            );
        })()}

        {/* ROW 3: Space Chat — full width */}
        <div className="h-[500px] retro-panel rounded-lg overflow-hidden flex flex-col">
            <div className="bg-[#0d2137] p-2 text-[9px] font-pixel text-[#ffd700] border-b border-[#ffd700]/20 shrink-0 text-glow-gold">
                SPACE CHAT
            </div>
            <div className="flex-1 overflow-hidden relative">
                <ChatLog
                    messages={gameState?.messages || []}
                    onSendMessage={(msg) => sendMessage(msg)}
                    readOnly={false}
                />
            </div>
        </div>

        {/* ROW 4: Human / Agent Onboarding — full width */}
        <OnboardingSection />
      </div>
    </main>
  )
}
