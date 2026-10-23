// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice BNB Smart Chain testnet gateway, wtPOTv3 test representation, and mock stock market.
/// @dev Test-only. A trusted relayer attests to source events; no trustless proof is verified on-chain.
contract BnbTestnetGateway {
    string public constant name = "PASTX Testnet Wrapped tPOTv3";
    string public constant symbol = "wtPOTv3";
    uint8 public constant decimals = 14;
    uint256 public constant SHARE_SCALE = 1_000_000;
    uint256 public constant UNIT = 10 ** 14;
    uint256 public constant MAX_TEST_MARKET_LIQUIDITY = 1_000_000 * UNIT;
    uint256 public immutable maxDepositRaw;

    address public owner;
    address public immutable relayer;
    uint256 public immutable expectedSourceChainId;
    address public immutable expectedSourceEscrow;

    uint256 public totalSupply;
    uint256 public totalBridgedIn;
    uint256 public totalWithdrawalRequested;
    uint256 public nextWithdrawalNonce;
    uint256 public testMarketLiquiditySeeded;
    bool public testMarketLiquidityWasSeeded;

    mapping(address => uint256) public balanceOf;
    /// @notice Portion of an account's fungible balance eligible for a return to PortalDOT.
    /// @dev Mock liquidity and profit are not credited; this follows backed tokens through transfers.
    mapping(address => uint256) public bridgeBackedBalanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(bytes32 => bool) public processedDepositIds;
    mapping(bytes32 => bool) public processedSourceEvents;
    mapping(bytes32 => uint256) public stockPricePerShareTestUnits;
    mapping(bytes32 => bool) public stockListed;
    mapping(address => mapping(bytes32 => uint256)) public stockPositions;
    /// @notice Per-position principal paid using bridge-backed units; profits are never added to backing.
    mapping(address => mapping(bytes32 => uint256)) public stockBackingBasis;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event DepositCompleted(bytes32 indexed depositId, address indexed recipient, uint256 amount, bytes32 indexed sourceTxHash, uint256 sourceLogIndex);
    event BridgeBackedBalanceUpdated(address indexed account, uint256 availableAmount);
    event WithdrawalRequested(bytes32 indexed withdrawalId, address indexed sender, address indexed portalRecipient, uint256 amount, uint256 nonce);
    event StockListed(bytes32 indexed symbol, uint256 pricePerShareTestUnits);
    event TestStockPriceUpdated(bytes32 indexed symbol, uint256 oldPrice, uint256 newPrice);
    event TestMarketLiquiditySeeded(uint256 amount);
    event TradeExecuted(address indexed trader, bytes32 indexed symbol, bool isBuy, uint256 shareUnits, uint256 paymentAmount, uint256 pricePerShareTestUnits);

    error Unauthorized();
    error WrongDestinationChain();
    error InvalidAddress();
    error InvalidAmount();
    error DepositExceedsDemoCap();
    error WrongSourceChain();
    error WrongSourceEscrow();
    error SourceEvidenceMissing();
    error DepositIdMismatch();
    error DuplicateDeposit();
    error DuplicateSourceEvent();
    error DuplicateWithdrawalLimit();
    error InsufficientBridgeBackedBalance();
    error InsufficientBalance();
    error InsufficientAllowance();
    error InvalidStock();
    error InsufficientPosition();
    error InsufficientMarketLiquidity();
    error LiquidityAlreadySeeded();
    error LiquiditySeedTooLarge();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyRelayer() {
        if (msg.sender != relayer) revert Unauthorized();
        _;
    }

    constructor(address relayer_, uint256 sourceChainId_, address sourceEscrow_, uint256 maxDepositRaw_) {
        if (block.chainid != 97) revert WrongDestinationChain();
        if (relayer_ == address(0) || sourceEscrow_ == address(0)) revert InvalidAddress();
        if (sourceChainId_ != 420420777) revert WrongSourceChain();
        if (maxDepositRaw_ == 0) revert InvalidAmount();

        owner = msg.sender;
        relayer = relayer_;
        expectedSourceChainId = sourceChainId_;
        expectedSourceEscrow = sourceEscrow_;
        maxDepositRaw = maxDepositRaw_;

        _listStock(bytes32("AAPL-TEST"), 200 * UNIT);
        _listStock(bytes32("TSLA-TEST"), 250 * UNIT);
        _listStock(bytes32("NVDA-TEST"), 180 * UNIT);
        _listStock(bytes32("MSFT-TEST"), 400 * UNIT);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        if (spender == address(0)) revert InvalidAddress();
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
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

    /// @notice Mint a 1:1 raw-unit test representation after the configured relayer attests to a source event.
    /// @dev This validates event fields and identifiers but does not independently prove the source event exists.
    function completeDeposit(
        bytes32 depositId,
        address sourceSender,
        address recipient,
        uint256 amount,
        uint256 sourceChainId,
        address sourceEscrow,
        uint256 destinationChainId,
        uint256 nonce,
        bytes32 sourceTxHash,
        uint256 sourceLogIndex
    ) external onlyRelayer {
        if (block.chainid != 97) revert WrongDestinationChain();
        if (sourceSender == address(0) || recipient == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (amount > maxDepositRaw) revert DepositExceedsDemoCap();
        if (sourceChainId != expectedSourceChainId || destinationChainId != block.chainid) revert WrongSourceChain();
        if (sourceEscrow != expectedSourceEscrow) revert WrongSourceEscrow();
        if (sourceTxHash == bytes32(0)) revert SourceEvidenceMissing();

        bytes32 computedDepositId = keccak256(
            abi.encode(sourceChainId, sourceEscrow, sourceSender, recipient, destinationChainId, nonce, amount)
        );
        if (depositId != computedDepositId) revert DepositIdMismatch();
        if (processedDepositIds[depositId]) revert DuplicateDeposit();

        bytes32 sourceEventKey = keccak256(abi.encode(sourceChainId, sourceEscrow, sourceTxHash, sourceLogIndex));
        if (processedSourceEvents[sourceEventKey]) revert DuplicateSourceEvent();

        processedDepositIds[depositId] = true;
        processedSourceEvents[sourceEventKey] = true;
        totalBridgedIn += amount;
        totalSupply += amount;
        balanceOf[recipient] += amount;
        bridgeBackedBalanceOf[recipient] += amount;

        emit Transfer(address(0), recipient, amount);
        emit BridgeBackedBalanceUpdated(recipient, bridgeBackedBalanceOf[recipient]);
        emit DepositCompleted(depositId, recipient, amount, sourceTxHash, sourceLogIndex);
    }

    function requestWithdrawal(uint256 amount, address portalRecipient) external returns (bytes32 withdrawalId) {
        if (portalRecipient == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (balanceOf[msg.sender] < amount) revert InsufficientBalance();
        if (bridgeBackedBalanceOf[msg.sender] < amount) revert InsufficientBridgeBackedBalance();
        if (totalWithdrawalRequested + amount > totalBridgedIn) revert DuplicateWithdrawalLimit();

        uint256 nonce = nextWithdrawalNonce++;
        withdrawalId = keccak256(abi.encode(block.chainid, address(this), msg.sender, portalRecipient, amount, nonce));

        balanceOf[msg.sender] -= amount;
        bridgeBackedBalanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        totalWithdrawalRequested += amount;
        emit Transfer(msg.sender, address(0), amount);
        emit BridgeBackedBalanceUpdated(msg.sender, bridgeBackedBalanceOf[msg.sender]);
        emit WithdrawalRequested(withdrawalId, msg.sender, portalRecipient, amount, nonce);
    }

    /// @notice Seeds simulated market liquidity on BNB testnet; it is not bridge-backed and cannot be redeemed.
    function seedTestMarketLiquidity(uint256 amount) external onlyOwner {
        if (testMarketLiquidityWasSeeded) revert LiquidityAlreadySeeded();
        if (amount == 0) revert InvalidAmount();
        if (amount > MAX_TEST_MARKET_LIQUIDITY) revert LiquiditySeedTooLarge();

        testMarketLiquidityWasSeeded = true;
        testMarketLiquiditySeeded = amount;
        totalSupply += amount;
        balanceOf[address(this)] += amount;
        emit Transfer(address(0), address(this), amount);
        emit TestMarketLiquiditySeeded(amount);
    }

    /// @notice Owner-controlled test price only; not a live oracle or executable market quote.
    function setStockPrice(bytes32 stockSymbol, uint256 newPricePerShareTestUnits) external onlyOwner {
        if (!stockListed[stockSymbol]) revert InvalidStock();
        if (newPricePerShareTestUnits == 0) revert InvalidAmount();
        uint256 oldPrice = stockPricePerShareTestUnits[stockSymbol];
        stockPricePerShareTestUnits[stockSymbol] = newPricePerShareTestUnits;
        emit TestStockPriceUpdated(stockSymbol, oldPrice, newPricePerShareTestUnits);
    }

    function stockInfo(bytes32 stockSymbol) external view returns (bool listed, uint256 pricePerShareTestUnits) {
        return (stockListed[stockSymbol], stockPricePerShareTestUnits[stockSymbol]);
    }

    function buyStock(bytes32 stockSymbol, uint256 shareUnits) external returns (uint256 paymentAmount) {
        if (!stockListed[stockSymbol]) revert InvalidStock();
        if (shareUnits == 0) revert InvalidAmount();

        uint256 price = stockPricePerShareTestUnits[stockSymbol];
        paymentAmount = (price * shareUnits) / SHARE_SCALE;
        if (paymentAmount == 0) revert InvalidAmount();
        if (balanceOf[msg.sender] < paymentAmount) revert InsufficientBalance();

        balanceOf[msg.sender] -= paymentAmount;
        balanceOf[address(this)] += paymentAmount;
        uint256 backedPayment = paymentAmount < bridgeBackedBalanceOf[msg.sender]
            ? paymentAmount
            : bridgeBackedBalanceOf[msg.sender];
        bridgeBackedBalanceOf[msg.sender] -= backedPayment;
        stockBackingBasis[msg.sender][stockSymbol] += backedPayment;
        stockPositions[msg.sender][stockSymbol] += shareUnits;
        emit Transfer(msg.sender, address(this), paymentAmount);
        emit BridgeBackedBalanceUpdated(msg.sender, bridgeBackedBalanceOf[msg.sender]);
        emit TradeExecuted(msg.sender, stockSymbol, true, shareUnits, paymentAmount, price);
    }

    function sellStock(bytes32 stockSymbol, uint256 shareUnits) external returns (uint256 payoutAmount) {
        if (!stockListed[stockSymbol]) revert InvalidStock();
        if (shareUnits == 0) revert InvalidAmount();

        uint256 position = stockPositions[msg.sender][stockSymbol];
        if (position < shareUnits) revert InsufficientPosition();

        uint256 price = stockPricePerShareTestUnits[stockSymbol];
        payoutAmount = (price * shareUnits) / SHARE_SCALE;
        if (payoutAmount == 0) revert InvalidAmount();
        if (balanceOf[address(this)] < payoutAmount) revert InsufficientMarketLiquidity();

        uint256 positionBasis = stockBackingBasis[msg.sender][stockSymbol];
        uint256 releasedBasis = shareUnits == position
            ? positionBasis
            : (positionBasis * shareUnits) / position;
        stockPositions[msg.sender][stockSymbol] = position - shareUnits;
        stockBackingBasis[msg.sender][stockSymbol] = positionBasis - releasedBasis;
        // Restore only original backed principal, capped by the actual sale payout. Gains stay unbacked.
        uint256 restoredBacking = payoutAmount < releasedBasis ? payoutAmount : releasedBasis;
        bridgeBackedBalanceOf[msg.sender] += restoredBacking;

        balanceOf[address(this)] -= payoutAmount;
        balanceOf[msg.sender] += payoutAmount;
        emit Transfer(address(this), msg.sender, payoutAmount);
        emit BridgeBackedBalanceUpdated(msg.sender, bridgeBackedBalanceOf[msg.sender]);
        emit TradeExecuted(msg.sender, stockSymbol, false, shareUnits, payoutAmount, price);
    }

    function _listStock(bytes32 stockSymbol, uint256 initialPrice) private {
        stockListed[stockSymbol] = true;
        stockPricePerShareTestUnits[stockSymbol] = initialPrice;
        emit StockListed(stockSymbol, initialPrice);
    }

    function _transfer(address from, address to, uint256 amount) private {
        if (to == address(0)) revert InvalidAddress();
        if (balanceOf[from] < amount) revert InsufficientBalance();
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        uint256 backedAmount = amount < bridgeBackedBalanceOf[from]
            ? amount
            : bridgeBackedBalanceOf[from];
        bridgeBackedBalanceOf[from] -= backedAmount;
        bridgeBackedBalanceOf[to] += backedAmount;
        emit Transfer(from, to, amount);
        if (backedAmount > 0) {
            emit BridgeBackedBalanceUpdated(from, bridgeBackedBalanceOf[from]);
            emit BridgeBackedBalanceUpdated(to, bridgeBackedBalanceOf[to]);
        }
    }
}
