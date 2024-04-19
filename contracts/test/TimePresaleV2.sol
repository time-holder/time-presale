// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TimePresale} from "../TimePresale.sol";

contract TimePresaleV2 is TimePresale {
  function version ()
  external pure virtual override
  returns (string memory) {
    return "2.0.0";
  }
}
