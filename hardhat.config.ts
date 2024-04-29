import type { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox-viem'
import '@nomicfoundation/hardhat-verify'
import '@openzeppelin/hardhat-upgrades'
import 'dotenv/config'
import * as chains from 'viem/chains'
import type { Chain } from 'viem'
import blockExplorerApiKeys from './blockExplorerApiKeys.json'

const accounts = [
  process.env.WALLET_PRIVATE_KEY as string
].filter(Boolean)

const config: HardhatUserConfig = {
  solidity: '0.8.20',
  etherscan: {
    apiKey: blockExplorerApiKeys,
    customChains: Object.keys(blockExplorerApiKeys)
      .map((key: string) => {
        const chain: Chain = chains[key as keyof typeof chains]
        if (chain) {
          return {
            network: key,
            chainId: chain.id,
            urls: {
              apiURL: chain.blockExplorers?.default?.apiUrl,
              browserURL: chain.blockExplorers?.default?.url
            }
          }
        } else {
          return null
        }
      })
      .filter(Boolean) as []
  },
  sourcify: {
    enabled: true
  },
  networks: Object.fromEntries(
    Object.keys(blockExplorerApiKeys)
      .map((key: string) => {
        const chain: Chain = chains[key as keyof typeof chains]
        if (chain) {
          return [
            key,
            {
              chainId: chain.id,
              url: chain.rpcUrls.default.http[0],
              accounts,
            }
          ]
        } else {
          return null
        }
      })
      .filter(Boolean) as []
  ),
}

export default config
