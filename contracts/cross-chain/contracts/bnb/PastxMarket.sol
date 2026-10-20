// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IPastxPaymentToken { function transfer(address to, uint256 amount) external returns (bool); function transferFrom(address from, address to, uint256 amount) external returns (bool); }
interface IPastxStockToken { function mint(address to, uint256 amount) external; function burnFromMarket(uint256 amount) external; function transfer(address to, uint256 amount) external returns (bool); function transferFrom(address from, address to, uint256 amount) external returns (bool); }

/// @notice Fixed-price synthetic testnet market. It does not represent or confer real-world equity ownership.
/// @dev Owner-set prices are demo prices, not oracle quotes. Market proceeds fund sell-side liquidity.
contract PastxMarket {
    uint256 public constant SHARE_UNIT = 1e18;
    address public owner;
    struct Listing { address stockToken; address paymentToken; uint256 pricePerShare; bool enabled; }
    struct Order { address trader; bytes32 symbol; bool isBuy; uint256 shares; uint256 limitPrice; address paymentToken; uint256 escrowAmount; bool active; }
    mapping(bytes32 => Listing) public listings;
    bytes32[] private listedSymbols;
    mapping(uint256 => Order) public orders;
    uint256 public nextOrderId;
    error Unauthorized(); error InvalidAddress(); error InvalidAmount(); error InvalidListing(); error InvalidPayment(); error InvalidOrder(); error LimitNotReached(); error InsufficientLiquidity(); error TransferFailed(); error ValueMismatch();
    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
    constructor() { owner = msg.sender; }
    function listStock(bytes32 symbol, address stockToken, uint256 pricePerShare, address paymentToken) external onlyOwner {
        if (symbol == bytes32(0) || stockToken == address(0) || pricePerShare == 0) revert InvalidAddress();
        if (listings[symbol].stockToken == address(0)) listedSymbols.push(symbol);
        listings[symbol] = Listing(stockToken, paymentToken, pricePerShare, true);
        emit StockListed(symbol, stockToken, paymentToken, pricePerShare);
    }
    function setStockEnabled(bytes32 symbol, bool enabled) external onlyOwner { Listing storage item = listings[symbol]; if (item.stockToken == address(0)) revert InvalidListing(); item.enabled = enabled; }
    function setPrice(bytes32 symbol, uint256 newPrice) external onlyOwner { Listing storage item = listings[symbol]; if (item.stockToken == address(0) || newPrice == 0) revert InvalidListing(); uint256 oldPrice = item.pricePerShare; item.pricePerShare = newPrice; emit PriceUpdated(symbol, oldPrice, newPrice); }
    function listingCount() external view returns (uint256) { return listedSymbols.length; }
    function symbolAt(uint256 index) external view returns (bytes32) { return listedSymbols[index]; }
    function getListing(bytes32 symbol) external view returns (address stockToken, address paymentToken, uint256 pricePerShare, bool enabled) { Listing storage item = listings[symbol]; return (item.stockToken, item.paymentToken, item.pricePerShare, item.enabled); }
    function buyMarket(bytes32 symbol, uint256 shares) external payable { Listing storage item = _listing(symbol); if (shares == 0) revert InvalidAmount(); uint256 total = item.pricePerShare * shares; _collect(item.paymentToken, total); IPastxStockToken(item.stockToken).mint(msg.sender, shares * SHARE_UNIT); emit MarketTrade(msg.sender, symbol, true, shares, item.pricePerShare, item.paymentToken, total); }
    function sellMarket(bytes32 symbol, uint256 shares) external { Listing storage item = _listing(symbol); if (shares == 0) revert InvalidAmount(); if (!IPastxStockToken(item.stockToken).transferFrom(msg.sender, address(this), shares * SHARE_UNIT)) revert TransferFailed(); IPastxStockToken(item.stockToken).burnFromMarket(shares * SHARE_UNIT); uint256 total = item.pricePerShare * shares; _pay(item.paymentToken, msg.sender, total); emit MarketTrade(msg.sender, symbol, false, shares, item.pricePerShare, item.paymentToken, total); }
    function placeLimitOrder(bytes32 symbol, bool isBuy, uint256 shares, uint256 limitPrice) external payable returns (uint256 orderId) {
        Listing storage item = _listing(symbol); if (shares == 0 || limitPrice == 0) revert InvalidAmount(); uint256 escrow = shares * limitPrice;
        if (isBuy) _collect(item.paymentToken, escrow); else { if (msg.value != 0) revert ValueMismatch(); if (!IPastxStockToken(item.stockToken).transferFrom(msg.sender, address(this), shares * SHARE_UNIT)) revert TransferFailed(); }
        orderId = nextOrderId++; orders[orderId] = Order(msg.sender, symbol, isBuy, shares, limitPrice, item.paymentToken, isBuy ? escrow : shares * SHARE_UNIT, true);
        emit LimitOrderPlaced(orderId, msg.sender, symbol, isBuy, shares, limitPrice);
    }
    function executeLimitOrder(uint256 orderId) external {
        Order storage order = orders[orderId]; if (!order.active) revert InvalidOrder(); Listing storage item = _listing(order.symbol); uint256 price = item.pricePerShare;
        if ((order.isBuy && price > order.limitPrice) || (!order.isBuy && price < order.limitPrice)) revert LimitNotReached();
        uint256 total = price * order.shares; order.active = false;
        if (order.isBuy) { IPastxStockToken(item.stockToken).mint(order.trader, order.shares * SHARE_UNIT); uint256 refund = order.escrowAmount - total; if (refund != 0) _pay(order.paymentToken, order.trader, refund); }
        else { IPastxStockToken(item.stockToken).burnFromMarket(order.escrowAmount); _pay(order.paymentToken, order.trader, total); }
        emit LimitOrderExecuted(orderId, order.trader, price, total);
    }
    function cancelLimitOrder(uint256 orderId) external {
        Order storage order = orders[orderId]; if (!order.active || order.trader != msg.sender) revert InvalidOrder(); order.active = false;
        if (order.isBuy) _pay(order.paymentToken, order.trader, order.escrowAmount);
        else { Listing storage item = listings[order.symbol]; if (!IPastxStockToken(item.stockToken).transfer(order.trader, order.escrowAmount)) revert TransferFailed(); }
        emit LimitOrderCancelled(orderId, msg.sender);
    }
    function _listing(bytes32 symbol) internal view returns (Listing storage item) { item = listings[symbol]; if (item.stockToken == address(0) || !item.enabled) revert InvalidListing(); }
    function _collect(address paymentToken, uint256 amount) internal { if (paymentToken == address(0)) { if (msg.value != amount) revert ValueMismatch(); } else { if (msg.value != 0) revert ValueMismatch(); if (!IPastxPaymentToken(paymentToken).transferFrom(msg.sender, address(this), amount)) revert TransferFailed(); } }
    function _pay(address paymentToken, address to, uint256 amount) internal { if (paymentToken == address(0)) { (bool ok,) = to.call{value: amount}(""); if (!ok) revert TransferFailed(); } else if (!IPastxPaymentToken(paymentToken).transfer(to, amount)) revert TransferFailed(); }
    event StockListed(bytes32 indexed symbol, address indexed stockToken, address indexed paymentToken, uint256 pricePerShare);
    event PriceUpdated(bytes32 indexed symbol, uint256 oldPrice, uint256 newPrice);
    event MarketTrade(address indexed trader, bytes32 indexed symbol, bool isBuy, uint256 shares, uint256 pricePerShare, address paymentToken, uint256 total);
    event LimitOrderPlaced(uint256 indexed orderId, address indexed trader, bytes32 indexed symbol, bool isBuy, uint256 shares, uint256 limitPrice);
    event LimitOrderExecuted(uint256 indexed orderId, address indexed trader, uint256 executionPrice, uint256 total);
    event LimitOrderCancelled(uint256 indexed orderId, address indexed trader);
    receive() external payable {}
}