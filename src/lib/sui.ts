import { getFullnodeUrl } from '@mysten/sui/client'
import { SuiClient as OnelabsSuiClient } from '@onelabs/sui/client'

export const suiNetworks = {
  mainnet: { url: getFullnodeUrl('mainnet') },
  testnet: { url: getFullnodeUrl('testnet') },
  onechain: { url: process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc-testnet.onelabs.cc:443' },
}

export type SuiNetwork = keyof typeof suiNetworks

export const SUI_NETWORK: SuiNetwork =
  (process.env.NEXT_PUBLIC_SUI_NETWORK as SuiNetwork) ?? 'onechain'

// Use @onelabs/sui client so dapp-kit resolves transactions against OneChain RPC correctly
// (OCT gas token, one:: module paths) instead of the default @mysten/sui resolver
export function createOnelabsClient(_network: string, config: { url: string }) {
  let url = config.url;
  // OnelabsSuiClient uses new URL(url) internally and requires an absolute URL.
  // Resolve relative proxy paths (e.g. /api/rpc) against the current browser origin.
  // This function is only called from SuiClientProvider ('use client'), so window is available.
  if (url.startsWith('/') && typeof window !== 'undefined') {
    url = window.location.origin + url;
  }
  return new OnelabsSuiClient({ url }) as any;
}
