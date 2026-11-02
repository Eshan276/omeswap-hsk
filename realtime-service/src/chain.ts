/**
 * viem clients for Mantle. The WebSocket client powers real-time subscriptions
 * (eth_subscribe) and must be a pure webSocket transport — a fallback transport
 * can silently downgrade watchEvent to HTTP polling. The HTTP client is used for
 * batched reads (multicall) at startup and on resync.
 */

import { createPublicClient, http, webSocket } from "viem";
import { mantleChain, MANTLE_RPC, MANTLE_WSS } from "./config.js";

/** Pure WebSocket client — real-time push via eth_subscribe. */
export const wsClient = createPublicClient({
  chain: mantleChain,
  transport: webSocket(MANTLE_WSS),
});

/** Pure HTTP client for batched/multicall reads at startup and resync. */
export const httpClient = createPublicClient({
  chain: mantleChain,
  transport: http(MANTLE_RPC),
  batch: { multicall: true },
});
