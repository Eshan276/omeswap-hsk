/**
 * FusionX V3 adapter — Mantle's primary DEX execution path.
 *
 * FusionX V3 is a Uniswap V3 fork (concentrated liquidity, multiple fee tiers).
 * The deployed SwapRouter (0x5989…797F) dispatches the original Uniswap V3
 * `exactInputSingle` selector 0x414bf389 — i.e. the params struct INCLUDES a
 * `deadline` field (verified against on-chain bytecode). This differs from the
 * SwapRouter02 / PancakeSwap "smart router" variants, which drop the deadline.
 *
 * Quotes come from the QuoterV2 (`quoteExactInputSingle`, struct param), which
 * is `nonpayable` and therefore must be called via eth_call (`simulateContract`),
 * never `readContract`.
 *
 * Addresses are sourced from the chain registry (`chains/mantle.ts`) — never
 * hardcode them elsewhere. This module mirrors the old 0G `jaine.ts` adapter.
 */

import {
  createPublicClient,
  createWalletClient,
  encodePacked,
  http,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
} from 'viem'
import type { PrivateKeyAccount } from 'viem/accounts'
import {
  MANTLE_CHAIN_ID,
  FUSIONX_V3_SWAP_ROUTER,
  FUSIONX_V3_QUOTER_V2,
} from '@/lib/chain-registry/chains/mantle'

// ── Identity ──────────────────────────────────────────────────────────────────

export const FUSIONX_CHAIN_ID = MANTLE_CHAIN_ID
export const FUSIONX_DEX_ID = 'fusionx_v3'
export const FUSIONX_DEX_NAME = 'FusionX V3'
export const FUSIONX_SWAP_URL = 'https://fusionx.finance/swap'
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

/** True for unset/zero/burn-style placeholder addresses (chain registry entries pending deployment). */
export function isPlaceholderAddress(address: Address | undefined): boolean {
  if (!address) return true
  const lower = address.toLowerCase()
  if (lower === ZERO_ADDRESS) return true
  return /^0x0{20,}[0-9a-f]{1,20}$/i.test(lower)
}

/**
 * Candidate fee tiers, probed lowest→highest. Includes both the Uniswap-V3
 * lineage (3000) and the PancakeSwap-fork lineage (2500) so pool discovery
 * works regardless of which tiers the FusionX factory enabled. Tiers with no
 * pool simply revert in the quoter and are skipped.
 */
export const FUSIONX_FEE_TIERS = [100, 500, 2500, 3000, 10000] as const
export type FusionXFeeTier = (typeof FUSIONX_FEE_TIERS)[number]

// ── ABIs ────────────────────────────────────────────────────────────────────

export const FUSIONX_ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

/** QuoterV2.quoteExactInputSingle — struct param, nonpayable (call via eth_call). */
export const FUSIONX_QUOTER_V2_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'quoteExactInputSingle',
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

/** SwapRouter.exactInputSingle — original Uniswap V3 shape WITH `deadline`. */
export const FUSIONX_V3_ROUTER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'deadline', type: 'uint256' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'exactInputSingle',
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
] as const

/** QuoterV2.quoteExactInput — multi-hop, packed-bytes path (verified selector 0xcdca1753). */
export const FUSIONX_QUOTER_V2_PATH_ABI = [
  {
    inputs: [
      { name: 'path', type: 'bytes' },
      { name: 'amountIn', type: 'uint256' },
    ],
    name: 'quoteExactInput',
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96AfterList', type: 'uint160[]' },
      { name: 'initializedTicksCrossedList', type: 'uint32[]' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

/** SwapRouter.exactInput — multi-hop, packed-bytes path (verified selector 0xc04b8d59). */
export const FUSIONX_V3_ROUTER_EXACT_INPUT_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'path', type: 'bytes' },
          { name: 'recipient', type: 'address' },
          { name: 'deadline', type: 'uint256' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
        ],
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'exactInput',
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
] as const

// ── Types ───────────────────────────────────────────────────────────────────

export type FusionXToken = {
  address: Address
  symbol: string
  decimals: number
}

export type FusionXQuote = {
  amountOut: bigint
  /** The fee tier (in hundredths of a bip) that produced the best quote. */
  fee: number
}

// ── Quoting ─────────────────────────────────────────────────────────────────

/**
 * Probes every candidate fee tier via the QuoterV2 and returns the tier with
 * the best output. Returns `null` if no FusionX V3 pool exists for the pair.
 *
 * Works with both a server viem `PublicClient` and the wagmi browser client —
 * both expose `simulateContract`, which is required because the quoter is a
 * state-mutating simulation (it reverts to return its result).
 */
export async function quoteFusionXBestTier(
  publicClient: PublicClient,
  params: {
    tokenIn: Address
    tokenOut: Address
    amountIn: bigint
    feeTiers?: readonly number[]
    quoter?: Address
  },
): Promise<FusionXQuote | null> {
  const { tokenIn, tokenOut, amountIn } = params
  const feeTiers = params.feeTiers ?? FUSIONX_FEE_TIERS
  const quoter = params.quoter ?? (FUSIONX_V3_QUOTER_V2 as Address)

  if (amountIn <= 0n) return null

  const results = await Promise.all(
    feeTiers.map(async (fee) => {
      try {
        const { result } = await publicClient.simulateContract({
          address: quoter,
          abi: FUSIONX_QUOTER_V2_ABI,
          functionName: 'quoteExactInputSingle',
          args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
        })
        const amountOut = (result as readonly [bigint, bigint, number, bigint])[0]
        return { fee, amountOut }
      } catch {
        // No pool at this fee tier, or insufficient liquidity — skip.
        return null
      }
    }),
  )

  let best: FusionXQuote | null = null
  for (const r of results) {
    if (r && r.amountOut > 0n && (!best || r.amountOut > best.amountOut)) {
      best = { amountOut: r.amountOut, fee: r.fee }
    }
  }
  return best
}

// ── Multi-hop routing ───────────────────────────────────────────────────────

/**
 * Encodes a Uniswap V3 swap path as the packed `address-fee-address-...-address`
 * bytes string expected by `exactInput` / `quoteExactInput`.
 */
export function encodeV3Path(tokens: Address[], fees: number[]): Hex {
  if (tokens.length !== fees.length + 1) {
    throw new Error('encodeV3Path: expected fees.length === tokens.length - 1')
  }
  const types: ('address' | 'uint24')[] = []
  const values: (Address | number)[] = []
  tokens.forEach((token, i) => {
    types.push('address')
    values.push(token)
    if (i < fees.length) {
      types.push('uint24')
      values.push(fees[i])
    }
  })
  return encodePacked(types, values)
}

export type FusionXMultiHopQuote = {
  amountOut: bigint
  /** Token addresses along the route, e.g. [tokenIn, hub, tokenOut]. */
  path: Address[]
  /** Fee tier for each hop, parallel to `path` (length = path.length - 1). */
  fees: number[]
  /** Packed-bytes path ready for `exactInput`. */
  encodedPath: Hex
}

/**
 * Finds the best two-hop route `tokenIn -> hub -> tokenOut` through any of the
 * given hub tokens (e.g. WMNT/USDC/USDT), probing each hop's best fee tier
 * independently and then re-quoting the assembled path end-to-end via
 * `quoteExactInput` for an accurate combined-slippage estimate.
 *
 * Returns `null` if no two-hop route has any liquidity.
 */
export async function quoteFusionXMultiHop(
  publicClient: PublicClient,
  params: {
    tokenIn: Address
    tokenOut: Address
    amountIn: bigint
    hubTokens: Address[]
    quoter?: Address
    feeTiers?: readonly number[]
  },
): Promise<FusionXMultiHopQuote | null> {
  const { tokenIn, tokenOut, amountIn, hubTokens, feeTiers } = params
  const quoter = params.quoter ?? (FUSIONX_V3_QUOTER_V2 as Address)
  if (amountIn <= 0n) return null

  const hubs = hubTokens.filter(
    (hub) =>
      hub.toLowerCase() !== tokenIn.toLowerCase() &&
      hub.toLowerCase() !== tokenOut.toLowerCase(),
  )

  let best: FusionXMultiHopQuote | null = null

  for (const hub of hubs) {
    const leg1 = await quoteFusionXBestTier(publicClient, {
      tokenIn,
      tokenOut: hub,
      amountIn,
      feeTiers,
      quoter,
    })
    if (!leg1 || leg1.amountOut <= 0n) continue

    const leg2 = await quoteFusionXBestTier(publicClient, {
      tokenIn: hub,
      tokenOut,
      amountIn: leg1.amountOut,
      feeTiers,
      quoter,
    })
    if (!leg2 || leg2.amountOut <= 0n) continue

    const path = [tokenIn, hub, tokenOut]
    const fees = [leg1.fee, leg2.fee]
    const encodedPath = encodeV3Path(path, fees)

    try {
      const { result } = await publicClient.simulateContract({
        address: quoter,
        abi: FUSIONX_QUOTER_V2_PATH_ABI,
        functionName: 'quoteExactInput',
        args: [encodedPath, amountIn],
      })
      const amountOut = (result as readonly [bigint, readonly bigint[], readonly number[], bigint])[0]
      if (amountOut > 0n && (!best || amountOut > best.amountOut)) {
        best = { amountOut, path, fees, encodedPath }
      }
    } catch {
      // Combined path not viable end-to-end — skip.
    }
  }

  return best
}

// ── Server-side execution (agent burner wallet) ──────────────────────────────

export type FusionXSwapResult = {
  txHash: `0x${string}`
  amountIn: bigint
  amountOut: bigint
  amountOutMinimum: bigint
  fee: number
  tokenIn: string
  tokenOut: string
}

/**
 * Executes a single-hop FusionX V3 swap from a server-managed agent wallet.
 *
 * Resolves the best fee tier via the QuoterV2, derives `amountOutMinimum` from
 * the live quote + slippage (so it works for any decimal/price ratio — unlike a
 * naive 1:1 minimum), approves the router if needed, then calls
 * `exactInputSingle`. Throws on insufficient balance or no available pool.
 *
 * Does not wait for the swap receipt — returns the submitted tx hash, matching
 * the previous Jaine adapter's behaviour. (It does wait for the approval
 * receipt, since the swap depends on it.)
 */
export async function executeFusionXAgentSwap(params: {
  account: PrivateKeyAccount
  chain: Chain
  rpcUrl: string
  tokenIn: FusionXToken
  tokenOut: FusionXToken
  /** Amount to sell, already denominated in `tokenIn` base units. */
  amountIn: bigint
  slippageBps?: number
  /** Force a fee tier instead of probing (skips quoter pool discovery). */
  fee?: number
  swapRouter?: Address
  quoter?: Address
}): Promise<FusionXSwapResult> {
  const {
    account,
    chain,
    rpcUrl,
    tokenIn,
    tokenOut,
    amountIn,
    slippageBps = 200,
    fee: forcedFee,
    swapRouter = FUSIONX_V3_SWAP_ROUTER as Address,
    quoter = FUSIONX_V3_QUOTER_V2 as Address,
  } = params

  if (amountIn <= 0n) {
    throw new Error('FusionX swap amount must be greater than 0.')
  }

  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) })

  // Resolve the best fee tier + expected output.
  const quote = await quoteFusionXBestTier(publicClient, {
    tokenIn: tokenIn.address,
    tokenOut: tokenOut.address,
    amountIn,
    feeTiers: forcedFee !== undefined ? [forcedFee] : undefined,
    quoter,
  })
  if (!quote) {
    throw new Error(
      `No FusionX V3 pool with liquidity for ${tokenIn.symbol}/${tokenOut.symbol}.`,
    )
  }

  const slippageMultiplier = BigInt(Math.max(0, 10_000 - slippageBps))
  const amountOutMinimum = (quote.amountOut * slippageMultiplier) / 10_000n

  // Balance check.
  const balance = (await publicClient.readContract({
    address: tokenIn.address,
    abi: FUSIONX_ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  })) as bigint
  if (balance < amountIn) {
    throw new Error(`Insufficient ${tokenIn.symbol} balance for the agent wallet.`)
  }

  // Approve the router if the current allowance is short.
  const allowance = (await publicClient.readContract({
    address: tokenIn.address,
    abi: FUSIONX_ERC20_ABI,
    functionName: 'allowance',
    args: [account.address, swapRouter],
  })) as bigint
  if (allowance < amountIn) {
    const approveTx = await walletClient.writeContract({
      address: tokenIn.address,
      abi: FUSIONX_ERC20_ABI,
      functionName: 'approve',
      args: [swapRouter, amountIn],
    })
    await publicClient.waitForTransactionReceipt({ hash: approveTx })
  }

  const txHash = await walletClient.writeContract({
    address: swapRouter,
    abi: FUSIONX_V3_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        fee: quote.fee,
        recipient: account.address,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 20 * 60),
        amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
  })

  return {
    txHash,
    amountIn,
    amountOut: quote.amountOut,
    amountOutMinimum,
    fee: quote.fee,
    tokenIn: tokenIn.symbol,
    tokenOut: tokenOut.symbol,
  }
}
