"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";

export function Navbar() {
  const pathname = usePathname();
  const account = useCurrentAccount();

  const isWrongNetwork =
    account != null &&
    !account.chains.some(
      (c) =>
        c.toLowerCase().includes("one") || c.toLowerCase().includes("onechain"),
    );

  const navLinks = [
    { name: "Game", path: "/" },
    { name: "History", path: "/history" },
    { name: "Leaderboard", path: "/leaderboard" },
    { name: "Missions", path: "/missions" },
  ];

  const renderLinks = (mobile: boolean) => (
    <>
      {navLinks.map((link) => (
        <Link
          key={link.path}
          href={link.path}
          className={`
                        ${mobile ? "text-center" : ""}
                        px-2 sm:px-3 py-1.5 rounded-sm text-[7px] sm:text-[8px] font-pixel uppercase tracking-wider transition-all
                        ${
                          pathname === link.path
                            ? "bg-[#ffd700]/10 text-[#ffd700] border border-[#ffd700]/30"
                            : "text-[#a8d8ea]/50 hover:text-[#a8d8ea] hover:bg-[#0d2137]/40"
                        }
                    `}
        >
          {link.name}
        </Link>
      ))}
    </>
  );

  const shortAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <>
      {/* {isWrongNetwork && (
      <div className="bg-[#ff6b6b]/20 border-b border-[#ff6b6b]/30 px-4 py-1 text-center">
        <span className="text-[8px] font-pixel text-[#ff6b6b]">
          ⚠ OneWallet may be on mainnet — open OneWallet → switch to OneChain Testnet → reconnect
        </span>
      </div>
    )} */}
      <nav className="retro-panel p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 sm:gap-2">
        {/* Top Row (Mobile) / Left Side (Desktop) */}
        <div className="flex items-center justify-between w-full sm:w-auto sm:justify-start sm:gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/amongnads_logo_tg.png"
              alt="Among Nads"
              className="w-8 h-8 rounded-full"
            />
            <span className="text-base font-pixel text-shimmer tracking-tight hidden sm:inline">
              AMONG NADS
            </span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden sm:flex items-center gap-1">
            {renderLinks(false)}
          </div>

          {/* Mobile Connect Button */}
          <div className="sm:hidden flex-shrink-0">
            {!account ? (
              <ConnectButton
                className="px-3 py-1.5 rounded-sm text-[7px] font-pixel uppercase tracking-wider
                                bg-[#ffd700] hover:bg-[#ffed4a] text-[#0a1628] pixel-border transition-all"
              />
            ) : (
              <ConnectButton
                className="px-2 py-1.5 rounded-sm text-[7px] font-pixel tracking-wider
                                bg-[#0d2137]/60 border border-[#a8d8ea]/20 text-[#a8d8ea] hover:border-[#a8d8ea]/40 transition-all truncate max-w-[120px]"
              />
            )}
          </div>
        </div>

        {/* Mobile Links Row */}
        <div className="flex sm:hidden items-center justify-between gap-1 w-full">
          {renderLinks(true)}
        </div>

        {/* Desktop Connect Button */}
        <div className="hidden sm:block flex-shrink-0">
          {!account ? (
            <ConnectButton
              className="px-4 py-1.5 rounded-sm text-[8px] font-pixel uppercase tracking-wider
                            bg-[#ffd700] hover:bg-[#ffed4a] text-[#0a1628] pixel-border transition-all hover:scale-[1.02]"
            />
          ) : (
            <button
              className="px-3 py-1.5 rounded-sm text-[8px] font-pixel tracking-wider
                            bg-[#0d2137]/60 border border-[#a8d8ea]/20 text-[#a8d8ea] hover:border-[#a8d8ea]/40 transition-all"
            >
              {shortAddress(account.address)}
              <span className="text-[#88d8b0] ml-1.5">OCT</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
