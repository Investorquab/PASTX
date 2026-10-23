// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPastxFaucetToken {
    function mint(address to, uint256 amount) external;
    function decimals() external view returns (uint8);
}

/// @title PastxFaucet
/// @notice Native Substrate-target faucet for the PASTX pUSD test token.
/// @dev Native tPOT is still needed separately to pay contract transaction fees.
contract PastxFaucet {
    IPastxFaucetToken public immutable token;
    uint256 public immutable claimAmount;
    uint256 public immutable cooldown;
    mapping(address => uint256) public lastClaimAt;
    mapping(address => bool) private hasClaimed;

    error InvalidAddress();
    error InvalidAmount();
    error InvalidCooldown();
    error CooldownActive();

    event TokensClaimed(address indexed account, uint256 amount, uint256 nextClaimAt);

    constructor(address token_, uint256 claimAmount_, uint256 cooldown_) {
        if (token_ == address(0)) revert InvalidAddress();
        if (claimAmount_ == 0) revert InvalidAmount();
        if (cooldown_ == 0) revert InvalidCooldown();
        if (IPastxFaucetToken(token_).decimals() != 18) revert InvalidAddress();
        token = IPastxFaucetToken(token_);
        claimAmount = claimAmount_;
        cooldown = cooldown_;
    }

    function claim() external {
        if (hasClaimed[msg.sender] && block.timestamp < lastClaimAt[msg.sender] + cooldown) {
            revert CooldownActive();
        }
        hasClaimed[msg.sender] = true;
        lastClaimAt[msg.sender] = block.timestamp;
        token.mint(msg.sender, claimAmount);
        emit TokensClaimed(msg.sender, claimAmount, block.timestamp + cooldown);
    }
}
