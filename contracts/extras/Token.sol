// SPDX-License-Identifier: None

pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// contract Token is ERC20, Pausable, Ownable {
contract Token is ERC20 {
  constructor(
    string memory name,
    string memory symbol,
    uint256 initialSupply
  ) public ERC20(name, symbol) {
    _mint(msg.sender, initialSupply);
  }

  // function mint(address to, uint256 amount) public onlyOwner {
  function mint(address to, uint256 amount) public {
    _mint(to, amount);
  }
}
