// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
interface IPastxFaucetToken { function mint(address to, uint256 amount) external; }
/// @notice Rate-limited faucet for PASTX demo tokens. Claims are test-only and have no monetary value.
contract PastxFaucet {
    IPastxFaucetToken public immutable token; uint256 public immutable claimAmount; uint256 public immutable cooldown; mapping(address => uint256) public lastClaimAt;
    error InvalidAddress(); error InvalidAmount(); error CooldownActive();
    event TokensClaimed(address indexed account, uint256 amount, uint256 nextClaimAt);
    constructor(address token_, uint256 claimAmount_, uint256 cooldown_) { if (token_ == address(0)) revert InvalidAddress(); if (claimAmount_ == 0) revert InvalidAmount(); token = IPastxFaucetToken(token_); claimAmount = claimAmount_; cooldown = cooldown_; }
    function claim() external { uint256 last = lastClaimAt[msg.sender]; if (last != 0 && block.timestamp < last + cooldown) revert CooldownActive(); lastClaimAt[msg.sender] = block.timestamp; token.mint(msg.sender, claimAmount); emit TokensClaimed(msg.sender, claimAmount, block.timestamp + cooldown); }
}