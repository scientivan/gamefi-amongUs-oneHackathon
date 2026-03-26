'use client'

import { useCurrentAccount, useSuiClientQuery, ConnectButton } from '@mysten/dapp-kit';

export default function FaucetPage() {
    const account = useCurrentAccount();
    const address = account?.address;

    const { data: balanceData } = useSuiClientQuery(
        'getBalance',
        { owner: address ?? '', coinType: '0x2::oct::OCT' },
        { enabled: !!address, refetchInterval: 10000 }
    );

    const suiBalance = balanceData?.totalBalance != null
        ? (Number(balanceData.totalBalance) / 1_000_000_000).toFixed(4)
        : '—';

    return (
        <div className="text-white p-4 sm:px-8">
            <div className="max-w-xl mx-auto space-y-6">
                <div>
                    <h1 className="text-sm font-pixel text-[#ffd700] text-glow-gold uppercase tracking-wider">
                        OneChain Testnet
                    </h1>
                    <p className="text-[7px] font-pixel text-[#a8d8ea]/40 mt-1">
                        You need OCT tokens to pay for gas and place bets on OneChain
                    </p>
                </div>

                <div className="retro-panel p-5 flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                        <img src="/MON_Logos.png" alt="OCT" className="w-10 h-10 rounded-full" />
                        <div>
                            <div className="text-[10px] font-pixel text-white">OCT</div>
                            <div className="text-[7px] font-pixel text-[#a8d8ea]/40">OneChain Testnet</div>
                        </div>
                    </div>

                    <div className="bg-[#0d2137]/60 border border-[#a8d8ea]/10 rounded-sm p-3 mb-3">
                        <div className="text-[7px] font-pixel text-[#a8d8ea]/50 uppercase tracking-wider mb-1">Your Balance</div>
                        <div className="flex items-center gap-2">
                            <div className="text-base font-pixel text-[#836ef9]">{suiBalance}</div>
                            <div className="text-[8px] font-pixel text-[#a8d8ea]/40">OCT</div>
                        </div>
                    </div>

                    <div className="bg-[#0d2137]/60 border border-[#ffd700]/10 rounded-sm p-3 mb-3">
                        <div className="flex justify-between items-center mb-1">
                            <div className="text-[7px] font-pixel text-[#a8d8ea]/50 uppercase tracking-wider">Source</div>
                            <div className="text-[8px] font-pixel text-[#ffd700]">OneChain Faucet</div>
                        </div>
                        <div className="text-[7px] font-pixel text-[#a8d8ea]/40 mt-2 leading-relaxed">
                            Get OCT testnet tokens from the OneChain faucet to pay for gas and place bets.
                        </div>
                    </div>

                    <div className="mt-auto pt-2">
                        {address ? (
                            <a
                                href="https://faucet.onelabs.cc"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-full py-3 rounded-sm text-[8px] font-pixel uppercase tracking-wider text-center transition-all
                                    bg-[#836ef9] hover:bg-[#9580ff] text-white pixel-border hover:scale-[1.02]"
                            >
                                Go to OneChain Faucet
                            </a>
                        ) : (
                            <ConnectButton
                                className="w-full py-3 rounded-sm text-[8px] font-pixel uppercase tracking-wider transition-all
                                    bg-[#ffd700] hover:bg-[#ffed4a] text-[#0a1628] pixel-border hover:scale-[1.02]"
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
