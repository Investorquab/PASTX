// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../common/PastxSecurity.sol";

interface IPastxTestStock {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice Fixed-price testnet synthetic-stock market paid in native Portaldot EVM value.
/// @dev Synthetic test assets only. Not equity, not an order book, and not an oracle-priced market.
contract PortalDotNativeMarket is PastxReentrancyGuard {
    using PastxSafeToken for address;
    uint256 public constant SHARE = 1e18;
    address public owner;
    bool public paused;
    uint256 public reservedNativeLiquidity;

    struct Listing { address stockToken; uint256 pricePerShare; bool enabled; }
    mapping(bytes32 => Listing) public listings;
    mapping(address => mapping(bytes32 => uint256)) public positions;
    mapping(bytes32 => uint256) public totalPositionShares;

    error NotOwner(); error Paused(); error InvalidAddress(); error InvalidAmount();
    error InvalidListing(); error InsufficientPosition(); error InsufficientStockInventory();
    error InsufficientNativeLiquidity(); error TransferFailed(); error IncorrectPayment();
    error OutstandingPositions(); error ReservedLiquidity();

    event ListingConfigured(bytes32 indexed symbol, address indexed stockToken, uint256 pricePerShare, bool enabled);
    event TradeExecuted(address indexed trader, bytes32 indexed symbol, bool isBuy, uint256 shares, uint256 nativeAmount, uint256 pricePerShare);
    event LiquidityAdded(address indexed provider, uint256 amount);
    event LiquidityWithdrawn(address indexed owner, address indexed to, uint256 amount);
    event PauseChanged(bool paused);

    constructor(address owner_) { if (owner_ == address(0)) revert InvalidAddress(); owner = owner_; }
    modifier onlyOwner() { if (msg.sender != owner) revert NotOwner(); _; }

    function configureListing(bytes32 symbol, address stockToken, uint256 pricePerShare, bool enabled) external onlyOwner {
        if (stockToken == address(0)) revert InvalidAddress();
        if (pricePerShare == 0) revert InvalidAmount();
        Listing memory old = listings[symbol];
        if (totalPositionShares[symbol] != 0 && (old.stockToken != stockToken || old.pricePerShare != pricePerShare)) revert OutstandingPositions();
        listings[symbol] = Listing(stockToken, pricePerShare, enabled);
        emit ListingConfigured(symbol, stockToken, pricePerShare, enabled);
    }
    function setPaused(bool value) external onlyOwner { paused = value; emit PauseChanged(value); }
    function addLiquidity() external payable { if (msg.value == 0) revert InvalidAmount(); emit LiquidityAdded(msg.sender, msg.value); }

    function withdrawLiquidity(uint256 amount, address payable to) external onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        uint256 balance = address(this).balance;
        if (amount == 0 || amount > balance) revert InsufficientNativeLiquidity();
        if (balance - amount < reservedNativeLiquidity) revert ReservedLiquidity();
        (bool ok,) = to.call{value: amount}(""); if (!ok) revert TransferFailed();
        emit LiquidityWithdrawn(msg.sender, to, amount);
    }

    function buy(bytes32 symbol, uint256 shares) external payable nonReentrant {
        if (paused) revert Paused();
        Listing memory item = listings[symbol];
        if (!item.enabled || item.stockToken == address(0)) revert InvalidListing();
        if (shares == 0) revert InvalidAmount();
        uint256 cost = item.pricePerShare * shares / SHARE;
        if (cost == 0 || msg.value != cost) revert IncorrectPayment();
        if (IPastxTestStock(item.stockToken).balanceOf(address(this)) < shares) revert InsufficientStockInventory();
        positions[msg.sender][symbol] += shares; totalPositionShares[symbol] += shares; reservedNativeLiquidity += cost;
        if (!IPastxTestStock(item.stockToken).transfer(msg.sender, shares)) revert TransferFailed();
        emit TradeExecuted(msg.sender, symbol, true, shares, cost, item.pricePerShare);
    }

    function sell(bytes32 symbol, uint256 shares) external nonReentrant {
        Listing memory item = listings[symbol];
        if (item.stockToken == address(0)) revert InvalidListing();
        if (shares == 0) revert InvalidAmount();
        uint256 position = positions[msg.sender][symbol]; if (position < shares) revert InsufficientPosition();
        uint256 payout = item.pricePerShare * shares / SHARE;
        if (payout == 0) revert InvalidAmount();
        if (address(this).balance < payout || reservedNativeLiquidity < payout) revert InsufficientNativeLiquidity();
        positions[msg.sender][symbol] = position - shares; totalPositionShares[symbol] -= shares; reservedNativeLiquidity -= payout;
        if (!IPastxTestStock(item.stockToken).transferFrom(msg.sender, address(this), shares)) revert TransferFailed();
        (bool ok,) = payable(msg.sender).call{value: payout}(""); if (!ok) revert TransferFailed();
        emit TradeExecuted(msg.sender, symbol, false, shares, payout, item.pricePerShare);
    }
    receive() external payable { emit LiquidityAdded(msg.sender, msg.value); }
}
