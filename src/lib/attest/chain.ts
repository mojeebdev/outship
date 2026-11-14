// Server-side view of the chain attestations live on. The browser uses wagmi
// (src/lib/web3/config.ts); the server only reads receipts and attestations,
// through BASE_RPC_URL when it's set and Base's public endpoint otherwise.
import { createPublicClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";

export const attestationChain = process.env.NEXT_PUBLIC_CHAIN === "base-sepolia" ? baseSepolia : base;

const PUBLIC_RPC = {
  [base.id]: "https://mainnet.base.org",
  [baseSepolia.id]: "https://sepolia.base.org",
} as const;

export function attestationPublicClient(rpcUrl: string | undefined) {
  return createPublicClient({
    chain: attestationChain,
    transport: http(rpcUrl || PUBLIC_RPC[attestationChain.id], { timeout: 10_000, retryCount: 2 }),
  });
}
