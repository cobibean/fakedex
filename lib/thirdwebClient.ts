import { createThirdwebClient } from "thirdweb";
import { defineChain } from "thirdweb/chains";

const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

if (!clientId) {
  throw new Error("No NEXT_PUBLIC_THIRDWEB_CLIENT_ID provided");
}

export const client = createThirdwebClient({
  clientId: clientId,
});

// Ethereum Sepolia testnet configuration
export const sepoliaChain = defineChain({
  id: 11155111,
  name: "Ethereum Sepolia",
  nativeCurrency: {
    name: "Sepolia Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpc: "https://ethereum-sepolia-rpc.publicnode.com",
  blockExplorers: [
    {
      name: "Etherscan",
      url: "https://sepolia.etherscan.io",
    },
  ],
  testnet: true,
});

