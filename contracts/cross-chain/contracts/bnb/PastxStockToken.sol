// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
/// @notice Synthetic stock token for testnet demos; it is not a security or claim on an issuer.
contract PastxStockToken {
    string public name; string public symbol; uint8 public constant decimals = 18; uint256 public totalSupply; address public immutable market;
    mapping(address => uint256) public balanceOf; mapping(address => mapping(address => uint256)) public allowance;
    error Unauthorized(); error InvalidAddress(); error InvalidAmount(); error InsufficientBalance(); error InsufficientAllowance();
    event Transfer(address indexed from, address indexed to, uint256 amount); event Approval(address indexed owner, address indexed spender, uint256 amount);
    constructor(string memory name_, string memory symbol_, address market_) { if (market_ == address(0)) revert InvalidAddress(); name = name_; symbol = symbol_; market = market_; }
    function mint(address to, uint256 amount) external { if (msg.sender != market) revert Unauthorized(); if (to == address(0) || amount == 0) revert InvalidAddress(); totalSupply += amount; balanceOf[to] += amount; emit Transfer(address(0), to, amount); }
    function burnFromMarket(uint256 amount) external { if (msg.sender != market) revert Unauthorized(); if (balanceOf[market] < amount) revert InsufficientBalance(); balanceOf[market] -= amount; totalSupply -= amount; emit Transfer(market, address(0), amount); }
    function approve(address spender, uint256 amount) external returns (bool) { if (spender == address(0)) revert InvalidAddress(); allowance[msg.sender][spender] = amount; emit Approval(msg.sender, spender, amount); return true; }
    function transfer(address to, uint256 amount) external returns (bool) { _transfer(msg.sender, to, amount); return true; }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) { uint256 allowed = allowance[from][msg.sender]; if (allowed < amount) revert InsufficientAllowance(); if (allowed != type(uint256).max) { allowance[from][msg.sender] = allowed - amount; emit Approval(from, msg.sender, allowance[from][msg.sender]); } _transfer(from, to, amount); return true; }
    function _transfer(address from, address to, uint256 amount) internal { if (to == address(0)) revert InvalidAddress(); if (balanceOf[from] < amount) revert InsufficientBalance(); balanceOf[from] -= amount; balanceOf[to] += amount; emit Transfer(from, to, amount); }
}