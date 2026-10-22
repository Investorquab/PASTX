// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPastxNativeMarketIdentity {
    function owner() external view returns (address);
}

/// @title PastxStockToken
/// @notice Transferable synthetic shares for the native Portaldot V3 testnet demo.
/// @dev These tokens are not securities and do not represent issuer equity.
contract PastxStockToken {
    uint8 public constant decimals = 18;
    string public name;
    string public symbol;
    uint256 public totalSupply;
    address public immutable market;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error InsufficientBalance();
    error InsufficientAllowance();

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed tokenOwner, address indexed spender, uint256 amount);

    modifier onlyMarket() {
        if (msg.sender != market) revert Unauthorized();
        _;
    }

    constructor(string memory name_, string memory symbol_, address market_) {
        if (bytes(name_).length == 0 || bytes(symbol_).length == 0) revert InvalidAmount();
        if (market_ == address(0)) revert InvalidAddress();
        // Replace EVM-only address.code.length checks with an interface call. A
        // missing or incompatible market contract makes this constructor revert.
        if (IPastxNativeMarketIdentity(market_).owner() == address(0)) revert InvalidAddress();
        name = name_;
        symbol = symbol_;
        market = market_;
    }

    function mint(address to, uint256 amount) external onlyMarket {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function burnFromMarket(uint256 amount) external onlyMarket {
        if (amount == 0) revert InvalidAmount();
        if (balanceOf[market] < amount) revert InsufficientBalance();
        balanceOf[market] -= amount;
        totalSupply -= amount;
        emit Transfer(market, address(0), amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        if (spender == address(0)) revert InvalidAddress();
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed < amount) revert InsufficientAllowance();
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
            emit Approval(from, msg.sender, allowance[from][msg.sender]);
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (to == address(0)) revert InvalidAddress();
        if (balanceOf[from] < amount) revert InsufficientBalance();
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
