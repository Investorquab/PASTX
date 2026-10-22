// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IPastxPaymentToken {
    function decimals() external view returns (uint8);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}
interface IPastxStockToken {
    function market() external view returns (address);
    function mint(address to, uint256 amount) external;
    function burnFromMarket(uint256 amount) external;
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title PastxMarket
/// @notice Fixed-price synthetic market for PASTX Portaldot V3 testnet.
/// @dev All listings use 18-decimal pUSD. Native tPOTv3 is for gas only.
contract PastxMarket {
    uint256 public constant EXPECTED_CHAIN_ID = 420420777;
    uint256 public constant SHARE_UNIT = 1e18;
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    address public owner;
    address public immutable paymentToken;

    struct Listing { address stockToken; address paymentToken; uint256 pricePerShare; bool enabled; }
    mapping(bytes32 => Listing) public listings;
    bytes32[] private listedSymbols;
    uint256 private _guard = NOT_ENTERED;

    error WrongChain();
    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidListing();
    error InvalidPaymentToken();
    error StockMarketMismatch();
    error AlreadyListed();
    error InsufficientLiquidity();
    error TokenTransferFailed();
    error ReentrantCall();

    event StockListed(bytes32 indexed symbol, address indexed stockToken, address indexed paymentToken, uint256 pricePerShare);
    event StockEnabledUpdated(bytes32 indexed symbol, bool enabled);
    event PriceUpdated(bytes32 indexed symbol, uint256 oldPrice, uint256 newPrice);
    event MarketTrade(address indexed trader, bytes32 indexed symbol, bool isBuy, uint256 shares, uint256 pricePerShare, address paymentToken, uint256 total);

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }
    modifier nonReentrant() {
        if (_guard == ENTERED) revert ReentrantCall();
        _guard = ENTERED;
        _;
        _guard = NOT_ENTERED;
    }

    constructor(address paymentToken_) {
        if (block.chainid != EXPECTED_CHAIN_ID) revert WrongChain();
        if (paymentToken_ == address(0) || paymentToken_.code.length == 0) revert InvalidPaymentToken();
        if (IPastxPaymentToken(paymentToken_).decimals() != 18) revert InvalidPaymentToken();
        owner = msg.sender;
        paymentToken = paymentToken_;
    }

    function listStock(bytes32 symbol, address stockToken, uint256 pricePerShare, address paymentToken_) external onlyOwner {
        if (symbol == bytes32(0) || stockToken == address(0) || stockToken.code.length == 0) revert InvalidAddress();
        if (pricePerShare == 0) revert InvalidAmount();
        if (paymentToken_ != paymentToken) revert InvalidPaymentToken();
        if (IPastxStockToken(stockToken).market() != address(this)) revert StockMarketMismatch();
        if (listings[symbol].stockToken != address(0)) revert AlreadyListed();
        listings[symbol] = Listing(stockToken, paymentToken, pricePerShare, true);
        listedSymbols.push(symbol);
        emit StockListed(symbol, stockToken, paymentToken, pricePerShare);
    }

    function setStockEnabled(bytes32 symbol, bool enabled) external onlyOwner {
        Listing storage item = listings[symbol];
        if (item.stockToken == address(0)) revert InvalidListing();
        item.enabled = enabled;
        emit StockEnabledUpdated(symbol, enabled);
    }

    function setPrice(bytes32 symbol, uint256 newPrice) external onlyOwner {
        Listing storage item = listings[symbol];
        if (item.stockToken == address(0)) revert InvalidListing();
        if (newPrice == 0) revert InvalidAmount();
        uint256 oldPrice = item.pricePerShare;
        item.pricePerShare = newPrice;
        emit PriceUpdated(symbol, oldPrice, newPrice);
    }

    function listingCount() external view returns (uint256) { return listedSymbols.length; }
    function symbolAt(uint256 index) external view returns (bytes32) { return listedSymbols[index]; }
    function getListing(bytes32 symbol) external view returns (address stockToken, address paymentToken_, uint256 pricePerShare, bool enabled) {
        Listing storage item = listings[symbol];
        return (item.stockToken, item.paymentToken, item.pricePerShare, item.enabled);
    }

    function buyMarket(bytes32 symbol, uint256 shares) external nonReentrant {
        Listing storage item = _activeListing(symbol);
        if (shares == 0) revert InvalidAmount();
        uint256 total = item.pricePerShare * shares;
        uint256 shareAmount = shares * SHARE_UNIT;
        if (!IPastxPaymentToken(paymentToken).transferFrom(msg.sender, address(this), total)) revert TokenTransferFailed();
        IPastxStockToken(item.stockToken).mint(msg.sender, shareAmount);
        emit MarketTrade(msg.sender, symbol, true, shares, item.pricePerShare, paymentToken, total);
    }

    function sellMarket(bytes32 symbol, uint256 shares) external nonReentrant {
        Listing storage item = _activeListing(symbol);
        if (shares == 0) revert InvalidAmount();
        uint256 total = item.pricePerShare * shares;
        uint256 shareAmount = shares * SHARE_UNIT;
        if (IPastxPaymentToken(paymentToken).balanceOf(address(this)) < total) revert InsufficientLiquidity();
        if (!IPastxStockToken(item.stockToken).transferFrom(msg.sender, address(this), shareAmount)) revert TokenTransferFailed();
        IPastxStockToken(item.stockToken).burnFromMarket(shareAmount);
        if (!IPastxPaymentToken(paymentToken).transfer(msg.sender, total)) revert TokenTransferFailed();
        emit MarketTrade(msg.sender, symbol, false, shares, item.pricePerShare, paymentToken, total);
    }

    function _activeListing(bytes32 symbol) internal view returns (Listing storage item) {
        item = listings[symbol];
        if (item.stockToken == address(0) || !item.enabled) revert InvalidListing();
    }
}
