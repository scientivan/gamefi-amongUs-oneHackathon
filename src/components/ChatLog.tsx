import { useState, useEffect, useRef } from 'react';

interface ChatLogProps {
    messages: { sender: string, content: string, timestamp?: number, type?: "chat" | "meeting" }[];
    onSendMessage: (msg: string) => void;
    readOnly?: boolean;
    players?: Record<string, any>; // [NEW] Added players map for name lookup
}

export function ChatLog({ messages, onSendMessage, readOnly = false, players }: ChatLogProps) {
    const [inputValue, setInputValue] = useState("");
    
    // Only show "chat" messages here; "meeting" messages go to the DISCUSS overlay.
    // Combined with flex-col-reverse, newest ends up at the BOTTOM visually.
    const displayMessages = messages.filter((m) => m.type !== "meeting").reverse();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim()) {
            onSendMessage(inputValue.trim());
            setInputValue("");
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0a1628]/80">
            {/* Messages Area - Reverse Column */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col-reverse gap-3 custom-scrollbar">
                {displayMessages.map((msg, i) => {
                     const senderName = players && players[msg.sender]
                         ? players[msg.sender].name
                         : msg.sender.replace(/^agent-/, '').replace(/-\d+$/, '');

                     const senderAvatar = players && players[msg.sender]?.avatar;

                     // SYSTEM messages get a distinct announcement style
                     if (msg.sender === "SYSTEM") {
                       return (
                         <div key={i} className="text-center text-[7px] font-pixel text-[#ffd700] py-1.5 border-y border-[#ffd700]/20 shrink-0 animate-in fade-in duration-300">
                           {msg.content}
                         </div>
                       );
                     }

                     return (
                        <div key={i} className="flex gap-3 animate-in slide-in-from-left-2 fade-in duration-300 shrink-0">
                             {/* Avatar */}
                             <div className="w-10 h-10 flex-shrink-0">
                                 {senderAvatar ? (
                                     <img src={senderAvatar} alt={senderName} className="w-full h-full object-contain image-rendering-pixelated" />
                                 ) : (
                                     <div className="w-full h-full bg-[#0d2137] border border-[#ffd700]/30 rounded-sm flex items-center justify-center text-[8px] font-pixel text-[#ffd700]">
                                         {senderName.slice(0, 2).toUpperCase()}
                                     </div>
                                 )}
                             </div>

                             <div className="flex flex-col max-w-[85%]">
                                  <div className="flex items-center gap-2">
                                      <span className={`text-[8px] font-pixel ${msg.sender === 'Spectator' ? 'text-[#88d8b0]' : 'text-[#a8d8ea]'}`}>
                                          {senderName}
                                      </span>
                                      <span className="text-[7px] text-[#a8d8ea]/30 font-pixel">{new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                  </div>
                                  <div className="text-[9px] text-[#e0e0e0] break-words leading-relaxed font-pixel">
                                      {msg.content}
                                  </div>
                             </div>
                        </div>
                     );
                })}

                {messages.length === 0 && (
                    <div className="text-center text-[#a8d8ea]/40 text-[8px] font-pixel mt-10 mb-auto">
                        Waiting for transmissions...
                    </div>
                )}
            </div>

            {/* Input Area */}
            {!readOnly && (
                <form onSubmit={handleSubmit} className="p-3 bg-[#0d2137] border-t border-[#ffd700]/20 flex gap-2">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 bg-[#0a1628] border border-[#ffd700]/20 text-white rounded-sm px-3 py-2 text-[10px] font-pixel focus:outline-none focus:border-[#ffd700]/50 transition-colors placeholder:text-[#a8d8ea]/30"
                    />
                    <button
                        type="submit"
                        disabled={!inputValue.trim()}
                        className="bg-[#ffd700] hover:bg-[#ffed4a] disabled:opacity-50 disabled:cursor-not-allowed text-[#0a1628] px-4 py-2 rounded-sm text-[8px] font-pixel transition-colors pixel-border"
                    >
                        SEND
                    </button>
                </form>
            )}
        </div>
    );
}
