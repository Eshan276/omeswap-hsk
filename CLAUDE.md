# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
bun run dev          # or: npm run dev
bun run build
bun run lint

# Smart contract operations (self-contained hardhat project in 0g-contract/)
cd 0g-contract && npm install
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deployTokens.js  --network mantleSepolia  # deploy test tokens
npx hardhat run scripts/deploy.js        --network mantleSepolia  # deploy pools + router
npx hardhat run scripts/addLiquidity.js  --network mantleSepolia  # seed liquidity
```

## Environment

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=  # required — from cloud.walletconnect.com
```

## Architecture

**Omeswap** is a DEX and autonomous agent platform on **Mantle** (EVM-compatible L2, chainId 5000 mainnet / 5003 Sepolia testnet) using Next.js 15 App Router. The repo has no tests; validate with `bun run build` and visual inspection.

The **trading chain is Mantle**; swaps route through Mantle DEXes (FusionX V3, Agni Finance, Merchant Moe). Separately, the app consumes 0G's decentralized AI/data services as **external infrastructure** (independent of the trading chain — see `lib/zerog/config.ts`):
- **Mantle Chain** — EVM execution layer for all trading (chainId 5000 / 5003), config in `lib/chain-registry/chains/mantle.ts`
- **0G Storage** — decentralized KV + Log blobs for persistent agent memory (`lib/zerog/storage.ts`)
- **0G Compute** — decentralized AI inference for agent reasoning (`lib/zerog/compute.ts`), models: `qwen3-8b`, `qwen3.6-plus` (sealed ZK), `GLM-5-FP8`
- **0G DA** — data availability layer for high-throughput agent output (`lib/zerog/da.ts`)

### Route Groups

| Group | Path | Purpose |
|-------|------|---------|
| `(app)` | `/trade`, `/terminal`, `/portfolio`, `/explore`, `/transactions`, `/marketplace`, `/creator`, `/library`, `/admin` | Main authenticated DEX |
| `(builder)` | `/agent-builder` | Visual bot workflow editor |
| `(landing)` | `/` | Marketing landing page |
| `(userform)` | `/onboarding` | Wallet-based onboarding |

The `(app)` layout wraps everything in the wallet provider (`components/providers/wallet-provider.tsx`, connects to Mantle via the chain registry) → `OnboardingGuard` → `ChatProvider`. `OnboardingGuard` redirects new wallets to onboarding; `DisconnectOverlay` handles wallet-switch detection.

### API Routes (`app/api/`)

| Route | Purpose |
|-------|---------|
| `/api/onboarding` | Wallet onboarding, creator registration |
| `/api/activations/[id]` | Bot activation lifecycle — pause, evaluate, execute, receipts |
| `/api/creator/strategies/[id]` | Strategy CRUD + validate / backtest / publish pipeline |
| `/api/creator/indicators/[id]` | User indicator CRUD |
| `/api/creator/dashboard` | Creator stats |
| `/api/marketplace` | Public strategy/indicator listings |
| `/api/token/[id]/analysis` | Token analysis (CoinGecko + Supabase) |
| `/api/crypto` | Generic price/market data proxy |
| `/api/receipts/[id]` | Trade receipt lookup |
| `/api/admin` | Admin-only wallet management |

Auth is header-based: `requireWallet()` (`lib/marketplace/wallet-header.ts`) extracts the wallet address; `isAdminWallet()` gates admin routes.

### Chain Registry (`lib/chain-registry/`)

Single source of truth for all chain config (RPC URLs, contract addresses, tokens, DEX routers). All other files import from here — never hardcode addresses elsewhere.

To add a new chain: create `lib/chain-registry/chains/<chain>.ts` exporting a `ChainConfig`, import it in `lib/chain-registry/index.ts`, and add to `REGISTRY`. The wallet provider, swap hooks, and agent nodes pick it up automatically.

Currently registered: **Mantle** (chainId 5000 mainnet / 5003 Sepolia testnet, selected via `NEXT_PUBLIC_MANTLE_NETWORK`). Config file: `lib/chain-registry/chains/mantle.ts`.

### 0G SDK Layer (`lib/zerog/`)

External AI/data infrastructure — **intentionally remains on 0G** regardless of the Mantle trading chain (see `lib/zerog/config.ts`). Three wrappers for the 0G protocol primitives:
- **`storage.ts`** — `saveAgentMemory()`, `loadAgentMemory()`, `appendLog()` — persistent agent memory on 0G Storage
- **`compute.ts`** — `computeInference()`, `agentReason()`, `streamComputeInference()` — AI inference via 0G Compute
- **`da.ts`** — `submitToDA()`, `postSwarmMessage()`, `postInferenceResult()` — data availability via 0G DA
- Import everything from `@/lib/zerog` (barrel re-export)

### Contract Layer (`contracts/`)

`contracts/config.ts` is a backward-compatible shim that re-exports from the chain registry. The OmeSwap custom AMM (`MultiTokenLiquidityPools` + `MultiHopSwapRouter`, source in `0g-contract/`) deploys to Mantle Sepolia — set `omeswapPools` and `omeswapRouter` in the testnet branch of `lib/chain-registry/chains/mantle.ts` after deploying. The live app does not require them: swaps route through the third-party Mantle DEX routers below.

Mantle DEX routers are configured in the chain registry (`fusionx_v3`, `agni_v3`, `merchant_moe`).

### State Management (`store/`)

Zustand stores — no Redux:
- `agent-builder.ts` — canvas nodes/edges, workflow save/load (localStorage key `avax-agent-workflows`), bot run logs, backtest results; persistent memory backed by 0G Storage
- `terminal.ts` — active symbol, watchlist, tile layout (react-grid-layout), bot run state
- `chart.ts` — chart-level state
- `transaction-store.ts` — transaction history

### Marketplace & Creator System (`lib/marketplace/`)

Strategy/indicator marketplace backed by Supabase:

- **`creator.ts`** — `ensureCreator()` upserts a row in the `creators` table (required FK before any strategy/indicator write).
- **`validate-strategy.ts`** — payload validation for strategy creation.
- **`risk-check.ts`** — `computeRiskScore()` / `getRiskCategory()` used in onboarding and strategy publish.
- **`wallet-header.ts`** — `requireWallet()` extracts wallet address from request headers; all creator/marketplace API routes call this first.
- Publish pipeline: validate → backtest → publish (each a separate API sub-route under `creator/strategies/[id]`).

### Agent Builder (`lib/agent-builder/`)

Visual DAG-based trading bot editor. Key concepts:

- **`BaseNode`** (`nodes/BaseNode.ts`) — abstract class all nodes extend. Implement `execute(inputs, context): Promise<Record<string, unknown>>`.
- **Node categories**: `data` (PriceFeed, WalletBalance, DEXPrice), `logic` (Condition, Math, MovingAverage, Threshold, Delay, Variable, Accumulator, PreviousValue), `action` (Swap, LimitOrder, Notification, AddChartMarker), `flow` (Start, End, Merge, ScheduleTrigger).
- **`BotRunner`** (`engine/BotRunner.ts`) — executes the DAG via topological sort. Receives callbacks for logging, status updates, and chart markers.
- **`BacktestRunner`** (`engine/BacktestRunner.ts`) — replays OHLCV candles through the bot, mocking blockchain action nodes.
- **`IndicatorCompiler`** (`engine/IndicatorCompiler.ts`) — compiles custom indicator code.
- **Indicator registry** (`lib/indicators/`) — pub/sub registry for built-in and user-defined indicators. Indicators expose `builtins/` math primitives.
- **`ExecutionContext`** (`types/agent-builder-canvas.ts`) — runtime context injected into nodes: wallet address, provider/signer, logger, toast, chart access.
- **`AgentStorageManager`** (`lib/agent-builder/storage.ts`) — localStorage persistence for the simplified agent system (keys: `omeswap_agents`, `omeswap_active_agent`). Distinct from the visual DAG canvas, which uses the Zustand store (`store/agent-builder.ts`, key `avax-agent-workflows`).

### Trading Terminal (`/(app)/terminal`)

Resizable tile grid (react-grid-layout). Tiles: `chart`, `watchlist`, `trades`, `depth`, `info`, `order`, `copilot`. Charts use `lightweight-charts` v5. The copilot tile integrates OpenAI.

Components live in `components/terminal/`. Tile layout is persisted in the terminal Zustand store.

### Web3 Stack

- **wagmi v2 + viem v2** for contract reads/writes
- **RainbowKit** for wallet modal (WalletConnect, MetaMask, etc.)
- **ethers v6** used in some hooks alongside viem
- Custom hooks in `hooks/` — `use-dex-swap.tsx`, `use-dex-aggregator.tsx`, `use-liquidity.tsx`, `use-token-balances.tsx`, `use-wallet-analysis.tsx`, etc.

### UI

shadcn/ui components (Radix primitives + Tailwind). Component aliases configured in `tsconfig.paths.json` — import as `@/components/ui/...`. Dark theme by default via `next-themes`.

### Supabase

`supabase/` contains migrations. Client initialized in `lib/supabase/`. Used for persistent user data and wallet analysis.

### `avax-agent/` Sub-project

A standalone Next.js app in `avax-agent/` — separate `package.json`, `next.config.ts`, and `tsconfig.json`. Contains its own `app/`, `components/`, `lib/`, `store/`, and `types/`. Run independently of the main app; do not import from or into the root project.

### Graphify

A knowledge graph of this codebase lives in `graphify-out/`. Before answering architecture questions, check `graphify-out/GRAPH_REPORT.md`. After modifying code files, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Key Conventions

- Path alias `@/` maps to the project root — use it everywhere instead of relative imports.
- All contract addresses must come from the chain registry (`lib/chain-registry/chains/mantle.ts`), not be hardcoded in components or hooks.
- 0G protocol access (Storage, Compute, DA) must go through `lib/zerog/` — never call 0G endpoints directly in components.
- Node.js v25+ `localStorage` shim is injected via webpack BannerPlugin in `next.config.ts` — do not add another localStorage polyfill.
- `export const dynamic = "force-dynamic"` is set on the `(app)` layout to prevent static rendering of wallet-dependent pages.
- 0G Compute `sealed: true` must be used for any AI call that influences an on-chain transaction.
