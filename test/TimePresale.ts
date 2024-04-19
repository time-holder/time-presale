import {
  loadFixture,
  time,
} from '@nomicfoundation/hardhat-toolbox-viem/network-helpers'
import { viem } from 'hardhat'
import { assert } from 'chai'
import { getAddress, parseEther, zeroAddress } from 'viem'
import { deployContracts } from '@timeholder/time-holder/dist/test/common'
import { testGov } from '@timeholder/time-holder/dist/test/asserts/Gov'
import { deployProxy } from '@timeholder/time-holder/dist/utils'
import type {
  PublicClient,
  WalletClient,
} from '@nomicfoundation/hardhat-viem/types'
import type { TestTypes } from './common'

describe('TimePresale', () => {
  async function deployFixture() {
    const publicClient = (await viem.getPublicClient()) as PublicClient
    const [owner, user, hacker] =
      (await viem.getWalletClients()) as WalletClient[]

    const { TIME } = await deployContracts()

    const duration = 3600 * 24 * 90
    const TimePresale = (await deployProxy(
      'TimePresale',
      [TIME.address, duration],
      {
        initializer: 'initialize(address,uint256)',
        kind: 'uups',
      },
    )) as unknown as TestTypes['TimePresale']

    const deadline = (await time.latest()) + duration

    await owner.writeContract({
      address: TIME.address,
      abi: TIME.abi,
      functionName: 'transfer',
      args: [TimePresale.address, ((await TIME.read.totalSupply()) * 7n) / 10n],
    })

    return {
      TIME,
      TimePresale,
      publicClient,
      owner,
      user,
      hacker,
      deadline,
    }
  }

  function getPoints(amount: bigint, length: bigint) {
    const basePoints = amount / parseEther('0.0000001')
    let rewardPoints = (basePoints * length) / 100n
    if (rewardPoints > basePoints * 3n) {
      rewardPoints = basePoints * 3n
    }
    return basePoints + rewardPoints
  }

  testGov(
    'TimePresale',
    async () => {
      const { TIME, TimePresale, owner } = await deployFixture()
      return {
        TIME,
        Gov: TimePresale as unknown as TestTypes['Gov'],
        owner,
      }
    },
    {
      stateTest: {
        extra: () => {
          it('#deadline()', async () => {
            const { TimePresale, deadline } = await loadFixture(deployFixture)
            assert.equal(await TimePresale.read.deadline(), BigInt(deadline))
          })

          it('#isDeadlinePassed()', async () => {
            const { TimePresale, deadline } = await loadFixture(deployFixture)
            assert.equal(await TimePresale.read.isDeadlinePassed(), false)
            await time.increaseTo(deadline + 1)
            assert.equal(await TimePresale.read.isDeadlinePassed(), true)
          })
        },
      },
      securityTest: {
        extra: () => {
          it('#extendDeadline()', async () => {
            const { TimePresale, owner, hacker, deadline } =
              await loadFixture(deployFixture)

            const extendDuration = 3600 * 24 * 30
            await assert.isRejected(
              hacker.writeContract({
                address: TimePresale.address,
                abi: TimePresale.abi,
                functionName: 'extendDeadline',
                args: [BigInt(extendDuration)],
              }),
              'OwnableUnauthorizedAccount',
            )

            await owner.writeContract({
              address: TimePresale.address,
              abi: TimePresale.abi,
              functionName: 'extendDeadline',
              args: [BigInt(extendDuration)],
            })
            assert.equal(
              await TimePresale.read.deadline(),
              BigInt(deadline + extendDuration),
            )
          })
        },
      },
    },
  )

  describe('Functions', () => {
    it('Receive', async () => {
      const {
        TimePresale,
        publicClient,
        user,
        hacker,
      } = await loadFixture(deployFixture)
      await assert.isRejected(
        user.sendTransaction({
          to: TimePresale.address,
          value: parseEther('0.009'),
        }),
        'AmountIsTooLow',
      )
      assert.equal(await TimePresale.read.isContributed([user.account.address]), false)
      assert.equal(await TimePresale.read.isContributed([hacker.account.address]), false)
      assert.equal(await TimePresale.read.isReferrer([user.account.address]), false)
      assert.equal(await TimePresale.read.isReferrer([hacker.account.address]), false)

      await user.sendTransaction({
        to: TimePresale.address,
        value: parseEther('0.01'),
      })
      await hacker.sendTransaction({
        to: TimePresale.address,
        value: parseEther('0.1'),
      })
      await user.sendTransaction({
        to: TimePresale.address,
        value: parseEther('0.5'),
      })
      await hacker.sendTransaction({
        to: TimePresale.address,
        value: parseEther('1'),
      })

      const contribution = await TimePresale.read.contribution()
      assert.equal(contribution.length, 4)
      assert.deepEqual(contribution, [
        {
          contributor: getAddress(user.account.address),
          amount: parseEther('0.01'),
          referrer: zeroAddress,
          bonus: 0n,
        },
        {
          contributor: getAddress(hacker.account.address),
          amount: parseEther('0.1'),
          referrer: zeroAddress,
          bonus: 0n,
        },
        {
          contributor: getAddress(user.account.address),
          amount: parseEther('0.5'),
          referrer: zeroAddress,
          bonus: 0n,
        },
        {
          contributor: getAddress(hacker.account.address),
          amount: parseEther('1'),
          referrer: zeroAddress,
          bonus: 0n,
        },
      ])
      assert.equal(await TimePresale.read.contributedAmount([user.account.address]), parseEther('0.51'))
      assert.equal(await TimePresale.read.contributedAmount([hacker.account.address]), parseEther('1.1'))

      assert.equal(await TimePresale.read.isContributed([user.account.address]), true)
      assert.equal(await TimePresale.read.isContributed([hacker.account.address]), true)
      assert.equal(await TimePresale.read.isReferrer([user.account.address]), false)
      assert.equal(await TimePresale.read.isReferrer([hacker.account.address]), true)

      assert.equal(
        await publicClient.getBalance({
          address: TimePresale.address,
        }),
        parseEther('1.61'),
      )
    })

    it('Referral Bonus', async () => {
      const {
        TimePresale,
        publicClient,
        user,
        hacker,
      } = await loadFixture(deployFixture)
      await assert.isRejected(
        hacker.writeContract({
          address: TimePresale.address,
          abi: TimePresale.abi,
          functionName: 'contribute',
          args: [],
          value: parseEther('0.009'),
        }),
        'AmountIsTooLow',
      )
      assert.equal(await TimePresale.read.isReferrer([hacker.account.address]), false)

      const hackerContribution = parseEther('1')
      const hackerPoints = await TimePresale.read.calcPoints([hackerContribution])
      await assert.isRejected(
        hacker.writeContract({
          address: TimePresale.address,
          abi: TimePresale.abi,
          functionName: 'contribute',
          args: [user.account.address],
          value: hackerContribution,
        }),
        'InvalidReferrer',
      )
      await hacker.writeContract({
        address: TimePresale.address,
        abi: TimePresale.abi,
        functionName: 'contribute',
        args: [],
        value: hackerContribution,
      })
      await assert.isRejected(
        hacker.writeContract({
          address: TimePresale.address,
          abi: TimePresale.abi,
          functionName: 'contribute',
          args: [hacker.account.address],
          value: hackerContribution,
        }),
        'ReferrerCannotBeOneself',
      )
      assert.equal(await TimePresale.read.isReferrer([hacker.account.address]), true)

      const userContribution = parseEther('1.5')
      const userPoints = await TimePresale.read.calcPoints([userContribution])
      const bonus = await TimePresale.read.calcBonus([userContribution])
      await user.writeContract({
        address: TimePresale.address,
        abi: TimePresale.abi,
        functionName: 'contribute',
        args: [hacker.account.address],
        value: userContribution,
      })

      assert.equal(await TimePresale.read.points([user.account.address]), userPoints + bonus)
      assert.equal(await TimePresale.read.points([hacker.account.address]), hackerPoints + (hackerPoints / 100n) + bonus)
      assert.equal(
        await publicClient.getBalance({
          address: TimePresale.address,
        }),
        hackerContribution + userContribution,
      )

      await user.writeContract({
        address: TimePresale.address,
        abi: TimePresale.abi,
        functionName: 'contribute',
        args: [hacker.account.address],
        value: userContribution,
      })
      const referrals = await TimePresale.read.referrals([hacker.account.address])
      assert.equal(referrals.length, 2)
      assert.deepEqual(referrals, [1n, 2n])
      assert.equal(await TimePresale.read.referrerBonus([hacker.account.address]), bonus * 2n)
    })

    it('Early Bird Reward', async () => {
      const {
        TimePresale,
        publicClient,
        user,
        hacker,
        deadline,
      } = await loadFixture(deployFixture)

      // User contribute
      assert.equal(await TimePresale.read.points([user.account.address]), 0n)

      const userContributionETH = parseEther('1')
      {
        await user.sendTransaction({
          to: TimePresale.address,
          value: userContributionETH,
        })
        const expectPoints = getPoints(userContributionETH, 0n)
        assert.equal(
          await TimePresale.read.points([user.account.address]),
          expectPoints,
        )
        assert.equal((await TimePresale.read.contribution()).length, 1)
      }

      // Hacker contribute
      assert.equal(await TimePresale.read.points([hacker.account.address]), 0n)

      const hackerContributionETH = parseEther('0.5')
      {
        await hacker.sendTransaction({
          to: TimePresale.address,
          value: hackerContributionETH,
        })
        const expectPoints = getPoints(hackerContributionETH, 0n)
        assert.equal(
          await TimePresale.read.points([hacker.account.address]),
          expectPoints,
        )
        assert.equal((await TimePresale.read.contribution()).length, 2)
      }

      // User points have been increased
      {
        const expectPoints = getPoints(userContributionETH, 1n)
        assert.equal(
          await TimePresale.read.points([user.account.address]),
          expectPoints,
        )
      }

      // User contribute again
      const userContributionETHAgain = parseEther('2')
      {
        await user.sendTransaction({
          to: TimePresale.address,
          value: userContributionETHAgain,
        })
        const expectPoints =
          getPoints(userContributionETH, 2n) +
          getPoints(userContributionETHAgain, 0n)
        assert.equal(
          await TimePresale.read.points([user.account.address]),
          expectPoints,
        )
        assert.equal((await TimePresale.read.contribution()).length, 3)
      }

      // Hacker points have been increased
      {
        const expectPoints = getPoints(hackerContributionETH, 1n)
        assert.equal(
          await TimePresale.read.points([hacker.account.address]),
          expectPoints,
        )
      }

      // Hacker contribute again
      const hackerContributionETHAgain = parseEther('8888')
      {
        const contributionCount = (await TimePresale.read.contribution()).length
        const ETHBalance = await publicClient.getBalance({
          address: TimePresale.address,
        })
        await assert.isRejected(
          user.sendTransaction({
            to: TimePresale.address,
            value: hackerContributionETHAgain,
          }),
          'PresaleLimitHasBeenExceeded',
        )
        assert.equal((await TimePresale.read.contribution()).length, contributionCount)
        assert.equal(
          await publicClient.getBalance({ address: TimePresale.address }),
          ETHBalance,
        )
      }

      await time.increaseTo(deadline + 1)
      await assert.isRejected(
        user.sendTransaction({
          to: TimePresale.address,
          value: hackerContributionETHAgain,
        }),
        'DeadlineHasPassed',
      )
    })

    it('Claim', async () => {
      const { TIME, TimePresale, user, hacker, deadline } =
        await loadFixture(deployFixture)

      await user.sendTransaction({
        to: TimePresale.address,
        value: parseEther('0.01'),
      })
      await hacker.sendTransaction({
        to: TimePresale.address,
        value: parseEther('0.1'),
      })
      await user.sendTransaction({
        to: TimePresale.address,
        value: parseEther('1'),
      })
      await hacker.sendTransaction({
        to: TimePresale.address,
        value: parseEther('2'),
      })
      await time.increaseTo(deadline + 1)
      assert.equal(await TimePresale.read.isClaimed([user.account.address]), false)
      assert.equal(await TimePresale.read.isClaimed([hacker.account.address]), false)

      const decimals = await TimePresale.read.govTokenDecimals()

      {
        const points = await TimePresale.read.points([user.account.address])
        const expectTokenQuantity = points * BigInt(10 ** decimals)
        await user.writeContract({
          address: TimePresale.address,
          abi: TimePresale.abi,
          functionName: 'claim',
          args: [],
        })
        assert.equal(
          await TIME.read.balanceOf([user.account.address]),
          expectTokenQuantity,
        )
        assert.equal(await TimePresale.read.isClaimed([user.account.address]), true)
      }

      {
        const points = await TimePresale.read.points([hacker.account.address])
        const expectTokenQuantity = points * BigInt(10 ** decimals)
        await hacker.writeContract({
          address: TimePresale.address,
          abi: TimePresale.abi,
          functionName: 'claim',
          args: [],
        })
        assert.equal(
          await TIME.read.balanceOf([hacker.account.address]),
          expectTokenQuantity,
        )
        assert.equal(await TimePresale.read.isClaimed([hacker.account.address]), true)
      }
    })
  })
})
