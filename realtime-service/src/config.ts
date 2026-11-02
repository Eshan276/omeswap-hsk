/**
 * Service configuration — MIRRORS lib/chain-registry/chains/mantle.ts in the
 * main app. Keep the two in sync when addresses change. This file is the
 * standalone-process equivalent so the service has no import dependency on the
 * Next.js build.
 */

import { defineChain, type Address } from "viem";

const env = (key: string, fallback: string): string =>
  process.env[key]?.trim() || fallback;

export const MANTLE_NETWORK = env("MANTLE_NETWORK", "mainnet");
const IS_TESTNET = MANTLE_NETWORK === "testnet";

export const MANTLE_CHAIN_ID = IS_TESTNET ? 5003 : 5000;
export const MANTLE_RPC = env(
  "MANTLE_RPC",
  IS_TESTNET ? "https://rpc.sepolia.mantle.xyz" : "https://rpc.mantle.xyz",
);
export const MANTLE_WSS = env(
  "MANTLE_WSS",
  IS_TESTNET ? "wss://wss.sepolia.mantle.xyz" : "wss://wss.mantle.xyz",
);

export const mantleChain = defineChain({
  id: MANTLE_CHAIN_ID,
  name: IS_TESTNET ? "Mantle Sepolia Testnet" : "Mantle",
  nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
  rpcUrls: {
    default: { http: [MANTLE_RPC], webSocket: [MANTLE_WSS] },
  },
  contracts: {
    // Canonical Multicall3, deployed at the same address across most chains
    // including Mantle. Enables batched reads in pool discovery / resync.
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
  testnet: IS_TESTNET,
});

// ── Tokens (verified on Mantle mainnet) ───────────────────────────────────────

export type TokenInfo = {
  address: Address;
  symbol: string;
  decimals: number;
  /** Treated as a $1 anchor for USD price derivation. */
  isStable?: boolean;
};

export const TOKENS = {
  WMNT: {
    address: "0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8",
    symbol: "WMNT",
    decimals: 18,
  },
  USDC: {
    address: "0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9",
    symbol: "USDC",
    decimals: 6,
    isStable: true,
  },
  USDT: {
    address: "0x201eba5cc46d216ce6dc03f6a759e8e766e956ae",
    symbol: "USDT",
    decimals: 6,
    isStable: true,
  },
  // LayerZero USDT0 — the actively-traded stable on Mantle (more volume than
  // classic USDT). decimals 6.
  USDT0: {
    address: "0x779ded0c9e1022225f8e0630b35a9b54be713736",
    symbol: "USDT0",
    decimals: 6,
    isStable: true,
  },
  WETH: {
    address: "0xdeaddeaddeaddeaddeaddeaddeaddeaddead1111",
    symbol: "WETH",
    decimals: 18,
  },
} satisfies Record<string, TokenInfo>;

export const TOKEN_LIST: TokenInfo[] = Object.values(TOKENS);

/** Lower-cased address → token, for fast lookup when decoding logs. */
export const TOKENS_BY_ADDRESS: Map<string, TokenInfo> = new Map(
  TOKEN_LIST.map((t) => [t.address.toLowerCase(), t]),
);

/** Routing hubs, deepest liquidity first. */
export const HUB_TOKENS: Address[] = [
  TOKENS.WMNT.address,
  TOKENS.USDC.address,
  TOKENS.USDT0.address,
  TOKENS.USDT.address,
];

// ── V3 DEX factories on Mantle (Uniswap V3 forks) ─────────────────────────────
// The service probes every factory × token-pair × fee-tier during discovery, so
// pools from any of these venues are tracked. Add a factory here to extend
// coverage. Addresses verified on-chain.

export type V3Factory = {
  id: string;
  address: Address;
  /** QuoterV2 for exact on-chain route fallback (optional). */
  quoter?: Address;
};

export const V3_FACTORIES: V3Factory[] = [
  {
    id: "fusionx_v3",
    address: "0x530d2766D1988CC1c000C8b7d00334c14B69AD71",
    quoter: "0x90f72244294E7c5028aFd6a96E18CC2c1E913995",
  },
  {
    // High-volume Mantle V3 CLMM factory observed on-chain (Agni / Merchant Moe
    // family). Carries the active USDT0 + long-tail volume.
    id: "mantle_v3_hi",
    address: "0xF883162Ed9c7E8EF604214c964c678E40c9B737C",
  },
];

/** Uniswap V3 fee tiers (in hundredths of a bip) to probe during discovery. */
export const V3_FEE_TIERS = [100, 500, 2500, 3000, 10000] as const;

// ── Service ports ─────────────────────────────────────────────────────────────

export const PORT = Number(env("PORT", "8080"));
export const ALLOWED_ORIGINS = env("ALLOWED_ORIGINS", "*");
