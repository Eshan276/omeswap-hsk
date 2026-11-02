import type { Chain } from 'viem/chains'
import type { Address } from 'viem'

export interface TokenInfo {
  address: Address
  name: string
  symbol: string
  decimals: number
  logoUrl?: string
  coingeckoId?: string
}

export interface DexRouter {
  /** Stable identifier used in code, e.g. "traderjoe" | "pangolin" | "traderjoe_v2" */
  id: string
  /** Human-readable label shown in the UI */
  name: string
  type: 'uniswapV2' | 'traderJoeV2' | 'custom'
  routerAddress: Address
  /** Required for traderJoeV2 — the LBQuoter contract */
  quoterAddress?: Address
}

export interface ChainConfig {
  /** viem Chain object (id, name, nativeCurrency, rpcUrls, etc.) */
  chain: Chain
  /** Wrapped native token address (WAVAX, WETH, …) */
  nativeWrapped: Address
  /**
   * Intermediate hop addresses for V1 multi-hop routing.
   * The aggregator tries [tokenIn → hub → tokenOut] for each hub when a
   * direct path has no liquidity.  First entry should be the deepest
   * liquidity hub (typically the wrapped native).
   */
  hubTokens: Address[]
  /** Block explorer base URL, no trailing slash */
  explorerUrl: string
  /** Path segment for transaction links, e.g. "/tx/" */
  explorerTxPath: string
  /** Path segment for address links, e.g. "/address/" */
  explorerAddressPath: string
  /** All DEXes available on this chain, ordered by preference */
  dexRouters: DexRouter[]
  /** Per-chain token list; keys are the canonical symbol used by the app */
  tokens: Record<string, TokenInfo>
  /** OmeSwap deployed pools contract (zero address until deployed) */
  omeswapPools?: Address
  /** OmeSwap deployed router contract (zero address until deployed) */
  omeswapRouter?: Address
}
