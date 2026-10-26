// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../common/PastxSecurity.sol";

interface IWrappedPotMarketToken { function balanceOf(address) external view returns (uint256); }
interface IStockToken { function balanceOf(address) external view returns (uint256); function transfer(address,uint256) external returns (bool); function transferFrom(address,address,uint256) external returns (bool); }

/// @notice Fixed-price BNB testnet synthetic-stock market paid in wtPOT.
contract BnbWrappedPotMarket is PastxReentrancyGuard {
    using PastxSafeToken for address;
    uint256 public constant SHARE = 1e18;
    address public owner; IWrappedPotMarketToken public immutable wrappedPot; bool public paused;
    uint256 public reservedWrappedLiquidity;
    struct Listing { address stockToken; uint256 pricePerShare; bool enabled; }
    mapping(bytes32 => Listing) public listings;
    mapping(address => mapping(bytes32 => uint256)) public positions;
    mapping(bytes32 => uint256) public totalPositionShares;
    error NotOwner(); error Paused(); error InvalidAddress(); error InvalidAmount(); error InvalidListing();
    error InsufficientPosition(); error InsufficientStockInventory(); error InsufficientMarketLiquidity();
    error OutstandingPositions(); error ReservedLiquidity();
    event ListingConfigured(bytes32 indexed symbol,address indexed stockToken,uint256 pricePerShare,bool enabled);
    event TradeExecuted(address indexed trader,bytes32 indexed symbol,bool isBuy,uint256 shares,uint256 paymentAmount,uint256 pricePerShare);
    event LiquidityAdded(address indexed provider,uint256 amount); event LiquidityWithdrawn(address indexed owner,address indexed to,uint256 amount); event PauseChanged(bool paused);
    constructor(address owner_,address wrappedPot_) { if(owner_==address(0)||wrappedPot_==address(0)) revert InvalidAddress(); owner=owner_; wrappedPot=IWrappedPotMarketToken(wrappedPot_); }
    modifier onlyOwner(){if(msg.sender!=owner)revert NotOwner();_;}
    function configureListing(bytes32 symbol,address stockToken,uint256 pricePerShare,bool enabled) external onlyOwner {
        if(stockToken==address(0))revert InvalidAddress(); if(pricePerShare==0)revert InvalidAmount();
        Listing memory old=listings[symbol]; if(totalPositionShares[symbol]!=0&&(old.stockToken!=stockToken||old.pricePerShare!=pricePerShare))revert OutstandingPositions();
        listings[symbol]=Listing(stockToken,pricePerShare,enabled); emit ListingConfigured(symbol,stockToken,pricePerShare,enabled);
    }
    function setPaused(bool value) external onlyOwner {paused=value;emit PauseChanged(value);}
    function addLiquidity(uint256 amount) external {if(amount==0)revert InvalidAmount();address(wrappedPot).safeTransferFrom(msg.sender,address(this),amount);emit LiquidityAdded(msg.sender,amount);}
    function withdrawLiquidity(uint256 amount,address to) external onlyOwner nonReentrant {
        if(to==address(0))revert InvalidAddress(); uint256 balance=wrappedPot.balanceOf(address(this));
        if(amount==0||balance<amount)revert InsufficientMarketLiquidity(); if(balance-amount<reservedWrappedLiquidity)revert ReservedLiquidity();
        address(wrappedPot).safeTransfer(to,amount);emit LiquidityWithdrawn(msg.sender,to,amount);
    }
    function buy(bytes32 symbol,uint256 shares) external nonReentrant returns(uint256 paymentAmount){
        if(paused)revert Paused(); Listing memory item=listings[symbol]; if(!item.enabled||item.stockToken==address(0))revert InvalidListing(); if(shares==0)revert InvalidAmount();
        paymentAmount=item.pricePerShare*shares/SHARE; if(paymentAmount==0)revert InvalidAmount();
        if(IStockToken(item.stockToken).balanceOf(address(this))<shares)revert InsufficientStockInventory();
        address(wrappedPot).safeTransferFrom(msg.sender,address(this),paymentAmount); positions[msg.sender][symbol]+=shares; totalPositionShares[symbol]+=shares; reservedWrappedLiquidity+=paymentAmount;
        if(!IStockToken(item.stockToken).transfer(msg.sender,shares))revert PastxSafeToken.TokenCallFailed(item.stockToken);
        emit TradeExecuted(msg.sender,symbol,true,shares,paymentAmount,item.pricePerShare);
    }
    function sell(bytes32 symbol,uint256 shares) external nonReentrant returns(uint256 payoutAmount){
        Listing memory item=listings[symbol]; if(item.stockToken == address(0))revert InvalidListing(); if(shares==0)revert InvalidAmount();
        uint256 position=positions[msg.sender][symbol]; if(position<shares)revert InsufficientPosition(); payoutAmount=item.pricePerShare*shares/SHARE; if(payoutAmount==0)revert InvalidAmount();
        if(wrappedPot.balanceOf(address(this))<payoutAmount||reservedWrappedLiquidity<payoutAmount)revert InsufficientMarketLiquidity();
        positions[msg.sender][symbol]=position-shares; totalPositionShares[symbol]-=shares; reservedWrappedLiquidity-=payoutAmount;
        if(!IStockToken(item.stockToken).transferFrom(msg.sender,address(this),shares))revert PastxSafeToken.TokenCallFailed(item.stockToken);
        address(wrappedPot).safeTransfer(msg.sender,payoutAmount); emit TradeExecuted(msg.sender,symbol,false,shares,payoutAmount,item.pricePerShare);
    }
}
