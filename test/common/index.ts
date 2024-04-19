import type { TestTypes as BaseTestTypes } from '@timeholder/time-holder/dist/test/common'
import type { GetContractReturnType } from '@nomicfoundation/hardhat-viem/types'
import type { ArtifactsMap } from 'hardhat/types'

export interface TestTypes extends BaseTestTypes {
  TimePresale: GetContractReturnType<ArtifactsMap['TimePresale']['abi']>
}
