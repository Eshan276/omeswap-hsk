/**
 * Trader Joe Liquidity Book v2.2 adapter — used by Merchant Moe on Mantle
 * (and any other LB v2.2 fork registered as `type: 'traderJoeV2'`).
 *
 * `findBestPathFromAmountIn` performs its own path search across the token
 * set passed in `route`, so multi-hop support just means widening that set
 * with the chain's hub tokens (WMNT/USDC/USDT) — the quoter picks whichever
 * combination of pairs yields the best output.
 */

import type { Address, PublicClient } from 'viem'

// ── ABIs ────────────────────────────────────────────────────────────────────

export const LB_QUOTER_ABI = [
  {
    inputs: [
      { internalType: 'address[]', name: 'route', type: 'address[]' },
      { internalType: 'uint128', name: 'amountIn', type: 'uint128' },
    ],
    name: 'findBestPathFromAmountIn',
    outputs: [
      {
        name: 'quote',
        type: 'tuple',
        components: [
          { name: 'route', type: 'address[]' },
          { name: 'pairs', type: 'address[]' },
          { name: 'binSteps', type: 'uint256[]' },
          { name: 'versions', type: 'uint8[]' },
          { name: 'amounts', type: 'uint128[]' },
          { name: 'virtualAmountsWithoutSlippage', type: 'uint128[]' },
          { name: 'fees', type: 'uint256[]' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export const LB_ROUTER_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint256', name: 'amountOutMinShares', type: 'uint256' },
      {
        name: 'path',
        type: 'tuple',
        components: [
          { name: 'pairBinSteps', type: 'uint256[]' },
          { name: 'versions', type: 'uint8[]' },
          { name: 'tokenPath', type: 'address[]' },
        ],
      },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForTokens',
    outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

// ── Quoting ─────────────────────────────────────────────────────────────────

export type LBQuote = {
  amountOut: bigint
  /** Token addresses along the route, e.g. [tokenIn, hub, tokenOut]. */
  route: Address[]
  pairBinSteps: bigint[]
  versions: number[]
}

/**
 * Finds the best LB path from `tokenIn` to `tokenOut`, optionally hopping
 * through any of `hubTokens`. Returns `null` if no path has liquidity.
 */
export async function quoteLBBestPath(
  publicClient: PublicClient,
  params: {
    tokenIn: Address
    tokenOut: Address
    amountIn: bigint
    hubTokens?: Address[]
    quoter: Address
  },
): Promise<LBQuote | null> {
  const { tokenIn, tokenOut, amountIn, quoter, hubTokens = [] } = params
  if (amountIn <= 0n) return null

  const hubs = hubTokens.filter(
    (hub) =>
      hub.toLowerCase() !== tokenIn.toLowerCase() &&
      hub.toLowerCase() !== tokenOut.toLowerCase(),
  )
  const route = [tokenIn, ...hubs, tokenOut]

  try {
    const result = await publicClient.readContract({
      address: quoter,
      abi: LB_QUOTER_ABI,
      functionName: 'findBestPathFromAmountIn',
      args: [route, amountIn],
    })
    const quote = result as unknown as {
      route: readonly Address[]
      binSteps: readonly bigint[]
      versions: readonly number[]
      amounts: readonly bigint[]
    }
    const amounts = quote.amounts
    const amountOut = amounts[amounts.length - 1]
    if (!amountOut || amountOut <= 0n) return null

    return {
      amountOut,
      route: [...quote.route],
      pairBinSteps: [...quote.binSteps],
      versions: [...quote.versions],
    }
  } catch {
    return null
  }
}
