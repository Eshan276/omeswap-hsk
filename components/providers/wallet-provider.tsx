"use client";

import { useState, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createStorage, cookieStorage, http } from "wagmi";
import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { getSupportedChains } from "@/lib/chain-registry";
import type { Chain } from "viem/chains";
import "@rainbow-me/rainbowkit/styles.css";

interface WalletProviderProps {
  children: ReactNode;
  initialState?: any;
}

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const hasWalletConnectProjectId =
  !!walletConnectProjectId && walletConnectProjectId !== "YOUR_PROJECT_ID";

export function WalletProvider({
  children,
  initialState,
}: WalletProviderProps) {
  const [queryClient] = useState(() => new QueryClient());
  const [config] = useState(() => {
    const supportedChains = getSupportedChains().map(c => c.chain) as [Chain, ...Chain[]];
    const transports = Object.fromEntries(
      supportedChains.map((chain) => [chain.id, http(chain.rpcUrls.default.http[0])]),
    );
    return getDefaultConfig({
      appName: "Omega",
      projectId: walletConnectProjectId || "walletconnect-disabled",
      chains: supportedChains,
      transports,
      wallets: [
        {
          groupName: "Recommended",
          wallets: hasWalletConnectProjectId
            ? [metaMaskWallet, coinbaseWallet, walletConnectWallet]
            : [injectedWallet, metaMaskWallet, coinbaseWallet],
        },
      ],
      storage: createStorage({
        storage: cookieStorage,
      }),
    });
  });

  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
