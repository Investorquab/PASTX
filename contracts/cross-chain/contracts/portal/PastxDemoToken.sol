// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
/// @notice Faucet-funded PASTX demo stablecoin. It is not USDC/USDT and has no monetary or redemption value.
contract PastxDemoToken {
    string public name = "PASTX Demo Dollar"; string public symbol = "pUSD"; uint8 public constant decimals = 18;
    uint256 public immutable cap; uint256 public totalSupply; address public owner;
    mapping(address => bool) public minters; mapping(address => uint256) public balanceOf; mapping(address => mapping(address => uint256)) public allowance;
    error Unauthorized(); error InvalidAddress(); error InvalidAmount(); error CapExceeded(); error InsufficientBalance(); error InsufficientAllowance();
    event Transfer(address indexed from, address indexed to, uint256 amount); event Approval(address indexed owner, address indexed spender, uint256 amount); event MinterUpdated(address indexed account, bool enabled);
    constructor(uint256 cap_) { if (cap_ == 0) revert InvalidAmount(); owner = msg.sender; cap = cap_; minters[msg.sender] = true; }
    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
    function setMinter(address account, bool enabled) external onlyOwner { if (account == address(0)) revert InvalidAddress(); minters[account] = enabled; emit MinterUpdated(account, enabled); }
    function mint(address to, uint256 amount) external { if (!minters[msg.sender]) revert Unauthorized(); if (to == address(0)) revert InvalidAddress(); if (amount == 0) revert InvalidAmount(); if (totalSupply + amount > cap) revert CapExceeded(); totalSupply += amount; balanceOf[to] += amount; emit Transfer(address(0), to, amount); }
    function approve(address spender, uint256 amount) external returns (bool) { if (spender == address(0)) revert InvalidAddress(); allowance[msg.sender][spender] = amount; emit Approval(msg.sender, spender, amount); return true; }
    function transfer(address to, uint256 amount) external returns (bool) { _transfer(msg.sender, to, amount); return true; }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) { uint256 allowed = allowance[from][msg.sender]; if (allowed < amount) revert InsufficientAllowance(); if (allowed != type(uint256).max) { allowance[from][msg.sender] = allowed - amount; emit Approval(from, msg.sender, allowance[from][msg.sender]); } _transfer(from, to, amount); return true; }
    function _transfer(address from, address to, uint256 amount) internal { if (to == address(0)) revert InvalidAddress(); if (balanceOf[from] < amount) revert InsufficientBalance(); balanceOf[from] -= amount; balanceOf[to] += amount; emit Transfer(from, to, amount); }
}