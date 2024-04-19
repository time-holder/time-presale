import { isAddress, parseEther } from 'viem'
import { deployProxy } from '@timeholder/time-holder/dist/utils'

const GOV_TOKEN_CONTRACT_ADDRESS = process.env
  .GOV_TOKEN_CONTRACT_ADDRESS as string

async function main() {
  if (!GOV_TOKEN_CONTRACT_ADDRESS) {
    throw new Error('Please set the `GOV_TOKEN_CONTRACT_ADDRESS` environment variable.')
  } else if (!isAddress(GOV_TOKEN_CONTRACT_ADDRESS)) {
    throw new Error(
      `\`${GOV_TOKEN_CONTRACT_ADDRESS}\` is not a valid Ethereum address.`,
    )
  }

  const duration = 3600 * 24 * 90
  const TimePresale = await deployProxy(
    'TimePresale',
    [GOV_TOKEN_CONTRACT_ADDRESS, duration],
    {
      initializer: 'initialize(address,uint256)',
      kind: 'uups',
    },
  )
  console.log(`TimePresale deployed to: ${TimePresale.address}`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
