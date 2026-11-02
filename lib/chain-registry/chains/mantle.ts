/**
 * Mantle chain configurations — single source of truth for both Mantle Mainnet
 * and Mantle Sepolia Testnet in the app.
 *
 * Keep the configurations in sync with /realtime-service/src/config.ts.
 */

import { defineChain } from "viem";
import type { Address } from "viem";
import type { ChainConfig } from "../types";

export const MANTLE_CHAIN_ID = 5000;

// ── Chain Definitions ────────────────────────────────────────────────────────

export const mantleMainnetChain = defineChain({
  id: 5000,
  name: "Mantle",
  nativeCurrency: {
    name: "Mantle",
    symbol: "MNT",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_MANTLE_RPC?.trim() || "https://rpc.mantle.xyz"],
      webSocket: [process.env.NEXT_PUBLIC_MANTLE_WSS?.trim() || "wss://wss.mantle.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "Mantle Explorer",
      url: "https://explorer.mantle.xyz",
    },
  },
  testnet: false,
});

export const mantleSepoliaChain = defineChain({
  id: 5003,
  name: "Mantle Sepolia Testnet",
  nativeCurrency: {
    name: "Mantle",
    symbol: "MNT",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_MANTLE_RPC_SEPOLIA?.trim() || "https://rpc.sepolia.mantle.xyz"],
      webSocket: [process.env.NEXT_PUBLIC_MANTLE_WSS_SEPOLIA?.trim() || "wss://wss.sepolia.mantle.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "Mantle Sepolia Explorer",
      url: "https://explorer.sepolia.mantle.xyz",
    },
  },
  testnet: true,
});

// Backward-compatible exports used by existing research tooling.
const USE_MANTLE_SEPOLIA = process.env.NEXT_PUBLIC_MANTLE_NETWORK === "sepolia";
export const mantleChain = USE_MANTLE_SEPOLIA ? mantleSepoliaChain : mantleMainnetChain;
export const MANTLE_RPC = USE_MANTLE_SEPOLIA
  ? process.env.NEXT_PUBLIC_MANTLE_RPC_SEPOLIA?.trim() || "https://rpc.sepolia.mantle.xyz"
  : process.env.NEXT_PUBLIC_MANTLE_RPC?.trim() || "https://rpc.mantle.xyz";

// EIP-3085 Params for MetaMask
export const MANTLE_MAINNET_PARAMS = {
  chainId: `0x${(5000).toString(16)}` as const,
  chainName: "Mantle",
  nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
  rpcUrls: [process.env.NEXT_PUBLIC_MANTLE_RPC?.trim() || "https://rpc.mantle.xyz"],
  blockExplorerUrls: ["https://explorer.mantle.xyz/"],
} as const;

export const MANTLE_SEPOLIA_PARAMS = {
  chainId: `0x${(5003).toString(16)}` as const,
  chainName: "Mantle Sepolia Testnet",
  nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
  rpcUrls: [process.env.NEXT_PUBLIC_MANTLE_RPC_SEPOLIA?.trim() || "https://rpc.sepolia.mantle.xyz"],
  blockExplorerUrls: ["https://explorer.sepolia.mantle.xyz/"],
} as const;

// ── Verified Mantle mainnet token addresses ──────────────────────────────────
const WMNT_ADDRESS = "0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8" as Address;
const USDC_ADDRESS = "0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9" as Address;
const USDT_ADDRESS = "0x201eba5cc46d216ce6dc03f6a759e8e766e956ae" as Address;
const WETH_ADDRESS = "0xdeaddeaddeaddeaddeaddeaddeaddeaddead1111" as Address;

// ── DEX Router Configurations ────────────────────────────────────────────────
export const FUSIONX_V3_FACTORY = "0x530d2766D1988CC1c000C8b7d00334c14B69AD71" as Address;
export const FUSIONX_V3_SWAP_ROUTER = "0x5989FB161568b9F133eDf5Cf6787f5597762797F" as Address;
export const FUSIONX_V3_QUOTER_V2 = "0x90f72244294E7c5028aFd6a96E18CC2c1E913995" as Address;

export const AGNI_V3_SWAP_ROUTER = "0x319B69888b0d11cEC22caA5034e25FfFBDc88421" as Address;
export const AGNI_V3_QUOTER_V2 = "0xc4aaDc921E1cdb66c5300Bc158a313292923C0cb" as Address;

export const MERCHANT_MOE_LB_ROUTER = "0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a" as Address;
export const MERCHANT_MOE_LB_QUOTER = "0x501b8AFd35df20f531fF45F6f695793AC3316c85" as Address;

// ── Configurations ──────────────────────────────────────────────────────────

export const mantleMainnetConfig: ChainConfig = {
  chain: mantleMainnetChain,
  nativeWrapped: WMNT_ADDRESS,
  hubTokens: [WMNT_ADDRESS, USDC_ADDRESS, USDT_ADDRESS],
  explorerUrl: "https://explorer.mantle.xyz",
  explorerTxPath: "/tx/",
  explorerAddressPath: "/address/",
  dexRouters: [
    {
      id: "fusionx_v3",
      name: "FusionX V3",
      type: "custom",
      routerAddress: FUSIONX_V3_SWAP_ROUTER,
      quoterAddress: FUSIONX_V3_QUOTER_V2,
    },
    {
      id: "agni_v3",
      name: "Agni Finance",
      type: "custom",
      routerAddress: AGNI_V3_SWAP_ROUTER,
      quoterAddress: AGNI_V3_QUOTER_V2,
    },
    {
      id: "merchant_moe",
      name: "Merchant Moe",
      type: "traderJoeV2",
      routerAddress: MERCHANT_MOE_LB_ROUTER,
      quoterAddress: MERCHANT_MOE_LB_QUOTER,
    },
  ],
  tokens: {
    WMNT: {
      address: WMNT_ADDRESS,
      name: "Wrapped Mantle",
      symbol: "WMNT",
      decimals: 18,
      coingeckoId: "mantle",
    },
    USDC: {
      address: USDC_ADDRESS,
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
      coingeckoId: "usd-coin",
    },
    USDT: {
      address: USDT_ADDRESS,
      name: "Tether USD",
      symbol: "USDT",
      decimals: 6,
      coingeckoId: "tether",
    },
    WETH: {
      address: WETH_ADDRESS,
      name: "Wrapped Ether",
      symbol: "WETH",
      decimals: 18,
      coingeckoId: "ethereum",
    },
  },
  omeswapPools: undefined,
  omeswapRouter: undefined,
};

export const mantleSepoliaConfig: ChainConfig = {
  chain: mantleSepoliaChain,
  nativeWrapped: WMNT_ADDRESS,
  hubTokens: [WMNT_ADDRESS, USDC_ADDRESS, USDT_ADDRESS],
  explorerUrl: "https://explorer.sepolia.mantle.xyz",
  explorerTxPath: "/tx/",
  explorerAddressPath: "/address/",
  dexRouters: [],
  tokens: {
    WMNT: {
      address: WMNT_ADDRESS,
      name: "Wrapped Mantle",
      symbol: "WMNT",
      decimals: 18,
      coingeckoId: "mantle",
    },
    USDC: {
      address: USDC_ADDRESS,
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
      coingeckoId: "usd-coin",
    },
    USDT: {
      address: USDT_ADDRESS,
      name: "Tether USD",
      symbol: "USDT",
      decimals: 6,
      coingeckoId: "tether",
    },
    WETH: {
      address: WETH_ADDRESS,
      name: "Wrapped Ether",
      symbol: "WETH",
      decimals: 18,
      coingeckoId: "ethereum",
    },
    OmE: {
      address: "0x2735D13B1C0C15B82cdbAcA6Eeff5afd23A87040" as Address,
      name: "OmE Token",
      symbol: "OmE",
      decimals: 18,
    },
    USDO: {
      address: "0xeeD4609D5661bcd7B8F6C5BF0e1c3507E435D2E2" as Address,
      name: "OmeSwap USD",
      symbol: "USDO",
      decimals: 6,
    },
  },
  omeswapPools: "0xA07c89A5072979B13755D3bd9018ba812E399e3f" as Address,
  omeswapRouter: "0x74e112c5b68a8CCF72c032aD5758889f330be519" as Address,
};
