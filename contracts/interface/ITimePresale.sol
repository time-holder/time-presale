// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITimePresale {
  struct Contribution {
    address contributor;
    uint256 amount;
    address referrer;
    uint256 bonus;
  }

  /**
   * @dev Record the setting deadline.
   */
  event SetDeadline(uint256 deadline);

  /**
   * @dev Record the amount of ETH contributed by contributor.
   */
  event Contributed(address indexed contributor, uint256 amount, address indexed referrer, uint256 bonus);

  /**
   * @dev Records the quantity of contributor claims.
   */
  event Claimed(address indexed contributor, uint256 quantity);

  /**
   * @dev Returns the deadline.
   */
  function deadline() external view returns (uint256);

  /**
   * @dev Extend the deadline.
   */
  function extendDeadline(uint256 duration) external;

  /**
   * @dev Returns whether the deadline has passed.
   */
  function isDeadlinePassed() external view returns (bool);

  /**
   * @dev Contribute.
   */
  function contribute() external payable;

  /**
   * @dev Contribute.
   * @param referrer Referrer address.
   */
  function contribute(address referrer) external payable;

  /**
   * @dev Returns the contributed people.
   */
  function contribution() external view returns (Contribution[] memory);

  /**
   * @dev Returns the amount the contributor has contributed.
   */
  function contributedAmount(address contributor) external view returns (uint256);

  /**
   * @dev Return whether the contributor contributor already contributed.
   */
  function isContributed(address contributor) external view returns (bool);

  /**
   * @dev Returns whether the contributor qualifies as a referrer.
   */
  function isReferrer(address contributor) external view returns (bool);

  /**
   * @dev Returns the referrals of referrer.
   */
  function referrals(address referrer) external view returns (uint256[] memory);

  /**
   * @dev Returns the bonus earned by referrer.
   */
  function referrerBonus(address referrer) external view returns (uint256);

  /**
   * @dev Calculate the points that can be earned from this amount.
   */
  function calcPoints(uint256 amount) external pure returns (uint256);

  /**
   * @dev Calculate the bonus that can be earned from this amount.
   */
  function calcBonus(uint256 amount) external pure returns (uint256);

  /**
   * @dev Returns the contributor's current points.
   */
  function points(address contributor) external view returns (uint256);

  /**
   * @dev Returns the total points earned by contributors
   */
  function sumPoints() external view returns (uint256);

  /**
   * @dev Contributor claim tokens.
   */
  function claim() external;

  /**
   * @dev Return whether the contributor has already withdrawn.
   */
  function isClaimed(address contributor) external view returns (bool);
}
