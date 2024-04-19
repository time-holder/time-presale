// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Gov} from "@timeholder/time-holder/contracts/base/Gov.sol";
import {ITimePresale} from "./interface/ITimePresale.sol";

contract TimePresale is ITimePresale, Gov {
  function name()
  external pure virtual override
  returns (string memory) {
    return "TimePresale";
  }

  function version()
  external pure virtual override
  returns (string memory) {
    return "1.0.0";
  }

  error AmountIsTooLow();
  error AlreadyClaimed();
  error DeadlineHasPassed();
  error DeadlineHasNotPassedYet();
  error InvalidReferrer();
  error NoPoints();
  error ReferrerCannotBeOneself();
  error PresaleLimitHasBeenExceeded();

  /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
  uint256 private immutable AMOUNT_PER_POINT = 0.0000001 ether;
  /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
  uint256 private immutable MIN_CONTRIBUTE_AMOUNT = 0.01 ether;
  /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
  uint256 private immutable MIN_REFERRER_AMOUNT = 1 ether;
  /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
  uint256 private immutable MIN_REMAINING_AMOUNT = 1 ether;
  /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
  uint256 private immutable EARLY_BIRD_REWARD_RATE = 1; // 1%
  /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
  uint256 private immutable REFERRAL_BONUS_RATE = 10; // 10%
  /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
  uint256 private immutable MAX_REWARD_MULTIPLE = 3;

  uint256 private _deadline;
  Contribution[] private _contribution;
  mapping(address => uint256[]) private _referrals;
  uint256 private _totalReferrerBonus;
  mapping(address => uint256) private _referrerBonus;
  mapping(address => bool) private _claimed;

  function initialize(address initialGovToken, uint256 duration)
  public initializer {
    Gov.initialize(initialGovToken);
    _setDeadline(block.timestamp + duration);
  }

  function deadline()
  external view
  returns (uint256) {
    return _deadline;
  }

  function extendDeadline(uint256 duration)
  external
  onlyOwner {
    _setDeadline(_deadline + duration);
  }

  function _setDeadline(uint256 newDeadline)
  private {
    _deadline = newDeadline;
    emit SetDeadline(newDeadline);
  }

  function isDeadlinePassed()
  public view
  returns (bool) {
    return block.timestamp > _deadline;
  }

  function contribute()
  external payable override {
    _contribute(msg.sender, msg.value, address(0), 0);
  }

  function contribute(address referrer)
  external payable override {
    uint256 _bonus = calcBonus(msg.value);
    if (!isReferrer(referrer)) {
      revert InvalidReferrer();
    } else if (referrer == msg.sender) {
      revert ReferrerCannotBeOneself();
    }
    unchecked {
      _referrerBonus[referrer] += _bonus;
      _totalReferrerBonus += _bonus;
    }
    _contribute(msg.sender, msg.value, referrer, _bonus);
  }

  function contribution()
  external view
  returns (Contribution[] memory) {
    return _contribution;
  }

  function contributedAmount(address contributor)
  public view
  returns (uint256) {
    uint256 _amount = 0;
    for (uint256 i = 0; i < _contribution.length; i++) {
      if (_contribution[i].contributor == contributor) {
        _amount += _contribution[i].amount;
      }
    }
    return _amount;
  }

  function isContributed(address sender)
  public view
  returns (bool) {
    return contributedAmount(sender) > 0;
  }

  function isReferrer(address contributor)
  public view
  returns (bool) {
    return contributedAmount(contributor) >= MIN_REFERRER_AMOUNT;
  }

  function referrals(address referrer)
  external view
  returns (uint256[] memory) {
    return _referrals[referrer];
  }

  function referrerBonus(address referrer)
  external view
  returns (uint256) {
    return _referrerBonus[referrer];
  }

  function calcPoints(uint256 amount)
  public pure
  returns (uint256) {
    return amount / AMOUNT_PER_POINT;
  }

  function calcBonus(uint256 amount)
  public pure
  returns (uint256) {
    return calcPoints(amount) * EARLY_BIRD_REWARD_RATE / 100;
  }

  function points(address contributor)
  public view
  returns (uint256) {
    uint256 _points = 0;
    if (_contribution.length > 0) {
      uint256 _max = _contribution.length - 1;
      for (uint256 i = 0; i <= _max; i++) {
        if (_contribution[i].contributor == contributor) {
          _points += _getPoints(_contribution[i].amount, _max - i) + _contribution[i].bonus;
        }
      }
    }
    _points += _referrerBonus[contributor];
    return _points;
  }

  function sumPoints()
  public view
  returns (uint256) {
    uint256 _points = 0;
    if (_contribution.length > 0) {
      uint256 _max = _contribution.length - 1;
      for (uint256 i = 0; i <= _max; i++) {
        _points += _getPoints(_contribution[i].amount, _max - i) + _contribution[i].bonus;
      }
    }
    _points += _totalReferrerBonus;
    return _points;
  }

  function _getPoints(uint256 amount, uint256 length)
  private pure
  returns (uint256) {
    uint256 _basePoints = calcPoints(amount);
    uint256 _rewardPoints = _basePoints * length * EARLY_BIRD_REWARD_RATE / 100;
    uint256 _maxRewardPoints = _basePoints * MAX_REWARD_MULTIPLE;
    if (_rewardPoints > _maxRewardPoints) {
      _rewardPoints = _maxRewardPoints;
    }
    return _basePoints + _rewardPoints;
  }

  function claim()
  external {
    if (!isDeadlinePassed()) {
      revert DeadlineHasNotPassedYet();
    }
    uint256 _points = points(msg.sender);
    if (_points == 0) {
      revert NoPoints();
    }
    if (isClaimed(msg.sender)) {
      revert AlreadyClaimed();
    }
    _claimed[msg.sender] = true;
    uint256 quantity = _getTokenQuantity(_points);
    IERC20(govToken()).transfer(msg.sender, quantity);
    emit Claimed(msg.sender, quantity);
  }

  function isClaimed(address contributor)
  public view
  returns (bool) {
    return _claimed[contributor];
  }

  function _contribute(address contributor, uint256 amount, address referrer, uint256 bonus)
  private {
    if (isDeadlinePassed()) {
      revert DeadlineHasPassed();
    }

    if (amount < MIN_CONTRIBUTE_AMOUNT) {
      revert AmountIsTooLow();
    }

    if (referrer != address(0)) {
      _referrals[referrer].push(_contribution.length);
    }
    _contribution.push(Contribution(contributor, amount, referrer, bonus));

    uint256 _totalTokenQuantity = _getTokenQuantity(sumPoints());
    uint256 _maxTokenQuantity = IERC20(govToken()).balanceOf(address(this));

    if (_totalTokenQuantity > _maxTokenQuantity) {
      revert PresaleLimitHasBeenExceeded();
    }

    emit Contributed(contributor, amount, referrer, bonus);

    if (_maxTokenQuantity - _totalTokenQuantity < _getTokenQuantity(calcPoints(MIN_REMAINING_AMOUNT))) {
      _setDeadline(block.timestamp);
    }
  }

  function _getTokenQuantity(uint256 _points)
  private view
  returns (uint256) {
    return _points * 10 ** govTokenDecimals();
  }

  receive() external payable override {
    _contribute(msg.sender, msg.value, address(0), 0);
  }
}
