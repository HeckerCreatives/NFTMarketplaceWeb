import { http, createConfig } from 'wagmi'
import { base, mainnet, optimism, sepolia, bsc, polygon, arbitrum, saigon, bscTestnet } from 'wagmi/chains'
import { metaMask } from 'wagmi/connectors'

const projectId = '5a745229b3242fa8ed61865f6119416c'

export const config = createConfig({
  chains: [
    // mainnet, 
    // sepolia, 
    // polygon, arbitrum, saigon, base, optimism, 
    bscTestnet],
  connectors: [metaMask()],
  transports: {
    [bscTestnet.id]: http(),
    // [mainnet.id]: http(),
    // [sepolia.id]: http(),
    // [polygon.id]: http(),
    // [arbitrum.id]: http(),
    // [saigon.id]: http(),
    // [base.id]: http(),
    // [optimism.id]: http(),
  },
})