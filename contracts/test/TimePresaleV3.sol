// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TimePresale} from "../TimePresale.sol";

contract TimePresaleV3 is TimePresale {
  function version ()
  external pure virtual override
  returns (string memory) {
    return "3.0.0";
  }
}
