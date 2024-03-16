// SPDX-License-Identifier: None
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token20 is ERC20 {
    constructor() ERC20("Token20", "T20") {}

    function mint(address _to, uint256 _amount) external {
        _mint(_to, _amount);
    }
}
