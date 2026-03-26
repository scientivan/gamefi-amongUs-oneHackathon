'use client'

import { SuiClientProvider, WalletProvider, useSuiClientContext } from '@mysten/dapp-kit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { suiNetworks, SUI_NETWORK, createOnelabsClient } from '@/lib/sui'
import { useState, useEffect, type ReactNode } from 'react'
import '@mysten/dapp-kit/dist/index.css'

// Runs inside SuiClientProvider — ensures app always stays on onechain
function NetworkEnforcer() {
  const { network, selectNetwork } = useSuiClientContext()
  useEffect(() => {
    if (network !== 'onechain') selectNetwork('onechain')
  }, [network, selectNetwork])
  return null
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider
        networks={suiNetworks}
        network={SUI_NETWORK}
        createClient={createOnelabsClient}
      >
        <NetworkEnforcer />
        <WalletProvider autoConnect preferredWallets={['OneWallet', 'Slush']}>
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  )
}
