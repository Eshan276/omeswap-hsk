/**
 * contracts/config.ts — thin re-export shim.
 *
 * All values are sourced from the chain registry so this stays the single
 * backward-compatible import point for the rest of the codebase. To change
 * addresses, update the active chain config in lib/chain-registry/chains/.
 *
 * Default chain: the registry default (Mantle).
 */

import { getChainConfig, getDefaultChainId } from '@/lib/chain-registry'
import type { Address } from 'viem'

const _cfg = getChainConfig(getDefaultChainId())
const _rt = _cfg.tokens

// ── OmeSwap contracts ─────────────────────────────────────────────────────────

export const CONTRACT_ADDRESSES = {
  POOLS: (_cfg.omeswapPools ?? '0x0000000000000000000000000000000000000000') as Address,
  ROUTER: (_cfg.omeswapRouter ?? '0x0000000000000000000000000000000000000000') as Address,
}

/** Wrapped native token address for the active chain (e.g. WMNT on Mantle). */
export const WRAPPED_NATIVE_ADDRESS = _cfg.nativeWrapped

// ── Token addresses ───────────────────────────────────────────────────────────

export const TOKEN_ADDRESSES: { [key: string]: { address: Address; name: string; symbol: string; decimals: number } } = {
  // Live chain tokens from the registry (Mantle: WMNT, USDC, USDT, WETH).
  ...Object.fromEntries(
    Object.entries(_rt).map(([key, t]) => [
      key,
      { address: t.address, name: t.name, symbol: t.symbol, decimals: t.decimals },
    ]),
  ),
  // OmeSwap native tokens — pending deployment on the active chain.
  OmE: _rt.OmE ?? { address: '0x87E3FC6944FAe11FEfd71d61003f42C6d1b445BF' as Address, name: 'OmE Token', symbol: 'OmE', decimals: 18 },
  USDO: _rt.USDO ?? { address: '0x4c95c850D6C89775791B801fDc7ED739702a8811' as Address, name: 'OmeSwap USD', symbol: 'USDO', decimals: 6 },
}

export const TOKENS = TOKEN_ADDRESSES
export const MAINNET_TOKENS = TOKEN_ADDRESSES

export const TOKEN_LIST = Object.values(TOKEN_ADDRESSES)
