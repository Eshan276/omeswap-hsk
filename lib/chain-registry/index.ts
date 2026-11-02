/**
 * Chain Registry — central lookup for all supported chain configs.
 *
 * Default chain: Mantle (selected in lib/chain-registry/chains/mantle.ts)
 * Mantle is an EVM-compatible L2 (chainId 5000); FusionX V3 is its primary DEX.
 *
 * Note: 0G's Storage / Compute / DA remain in use as external agent
 * infrastructure via lib/zerog — independent of this trading-chain registry.
 *
 * To add a new chain:
 *   1. Create lib/chain-registry/chains/<chain>.ts exporting a ChainConfig
 *   2. Import it below and add it to REGISTRY
 *   Done — wallet provider, swap hooks, agent nodes, and explorer links all
 *   pick it up automatically.
 */

import type { ChainConfig, DexRouter, TokenInfo } from './types'
import { mantleMainnetConfig, mantleSepoliaConfig } from './chains/mantle'

// ── Registry ─────────────────────────────────────────────────────────────────

const REGISTRY: Record<number, ChainConfig> = {
  [mantleMainnetConfig.chain.id]: mantleMainnetConfig,
  [mantleSepoliaConfig.chain.id]: mantleSepoliaConfig,
}

export const DEFAULT_CHAIN_ID: number = mantleSepoliaConfig.chain.id

// ── Lookup helpers ────────────────────────────────────────────────────────────

/**
 * Returns the ChainConfig for the given chainId.
 * Throws if the chain has not been registered.
 */
export function getChainConfig(chainId: number): ChainConfig {
  const config = REGISTRY[chainId]
  if (!config) {
    throw new Error(
      `Chain ${chainId} is not registered. ` +
      `Add its config to lib/chain-registry/chains/ and import it in lib/chain-registry/index.ts.`
    )
  }
  return config
}

/** Returns all registered ChainConfig objects */
export function getSupportedChains(): ChainConfig[] {
  return Object.values(REGISTRY)
}

/** Returns the default chain ID (Mantle). */
export function getDefaultChainId(): number {
  return DEFAULT_CHAIN_ID
}

/** Convenience: returns the token map for a given chain */
export function getTokens(chainId: number): Record<string, TokenInfo> {
  return getChainConfig(chainId).tokens
}

/** Convenience: returns the DEX router list for a given chain */
export function getDexRouters(chainId: number): DexRouter[] {
  return getChainConfig(chainId).dexRouters
}

/**
 * Builds a block-explorer URL for the given chain.
 *
 * @example
 *   getExplorerLink(getDefaultChainId(), 'tx', '0xabc…')
 */
export function getExplorerLink(
  chainId: number,
  type: 'tx' | 'address',
  hash: string,
): string {
  const config = getChainConfig(chainId)
  const path = type === 'tx' ? config.explorerTxPath : config.explorerAddressPath
  return `${config.explorerUrl}${path}${hash}`
}

// ── Re-exports ────────────────────────────────────────────────────────────────

export type { ChainConfig, DexRouter, TokenInfo } from './types'
