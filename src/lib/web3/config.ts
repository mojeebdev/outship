import { createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";

// Defaults to Base mainnet — set NEXT_PUBLIC_CHAIN=base-sepolia to test
// on testnet first without touching real funds.
const useTestnet = process.env.NEXT_PUBLIC_CHAIN === "base-sepolia";

export const activeChain = useTestnet ? baseSepolia : base;

export const wagmiConfig = useTestnet
  ? createConfig({
      chains: [baseSepolia],
      connectors: [injected(), coinbaseWallet({ appName: "outship" })],
      transports: { [baseSepolia.id]: http() },
    })
  : createConfig({
      chains: [base],
      connectors: [injected(), coinbaseWallet({ appName: "outship" })],
      transports: { [base.id]: http() },
    });
