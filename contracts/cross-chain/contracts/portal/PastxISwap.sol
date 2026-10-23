// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IPastxISwapToken {
    function decimals() external view returns (uint8);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
}

/// @title PastxISwap
/// @notice Small, fixed-rate iSwap demonstration between faucet pUSD and native Portaldot test value.
/// @dev Testnet-only. All native payouts are limited by the contract's actual native balance and a per-swap cap.
///      pUSD has no fiat value. This is not an oracle-priced market or a production on/off-ramp.
contract PastxISwap {
    uint256 public constant EXPECTED_CHAIN_ID = 420420777;
    uint256 public constant PUSD_UNIT = 1e18;
    uint256 public constant FAUCET_CLAIM = 1_000 * PUSD_UNIT;

    address public immutable owner;
    IPastxISwapToken public immutable token;
    /// @notice Number of raw native-value units paid for one whole pUSD (pUSD has 18 decimals).
    uint256 public immutable nativeRawPerWholePusd;
    /// @notice Hard cap on native value entering or leaving through one swap; configure as 0.01 tPOT after unit verification.
    uint256 public immutable maxNativePerSwapRaw;

    uint256 private _guard = 1;
    uint256 public totalPusdBurned;
    uint256 public totalPusdMinted;
    uint256 public totalNativeReceived;
    uint256 public totalNativePaid;

    error WrongChain();
    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidConfiguration();
    error WrongToken();
    error QuoteRoundsToZero();
    error SwapLimitExceeded();
    error InsufficientNativeLiquidity();
    error TokenTransferFailed();
    error NativeTransferFailed();
    error ReentrantCall();

    event NativeLiquidityFunded(address indexed funder, uint256 amount);
    event NativeLiquidityWithdrawn(address indexed recipient, uint256 amount);
    event SwappedPusdForNative(address indexed account, uint256 pusdIn, uint256 nativeOut);
    event SwappedNativeForPusd(address indexed account, uint256 nativeIn, uint256 pusdOut);

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (_guard != 1) revert ReentrantCall();
        _guard = 2;
        _;
        _guard = 1;
    }

    constructor(address token_, uint256 nativeRawPerWholePusd_, uint256 maxNativePerSwapRaw_) {
        if (block.chainid != EXPECTED_CHAIN_ID) revert WrongChain();
        if (token_ == address(0) || token_.code.length == 0) revert InvalidAddress();
        if (nativeRawPerWholePusd_ == 0 || maxNativePerSwapRaw_ == 0) revert InvalidConfiguration();
        if (IPastxISwapToken(token_).decimals() != 18) revert WrongToken();
        // The configured rate must exchange exactly one 1,000 pUSD faucet claim for the native swap cap.
        if ((FAUCET_CLAIM * nativeRawPerWholePusd_) / PUSD_UNIT != maxNativePerSwapRaw_) {
            revert InvalidConfiguration();
        }

        owner = msg.sender;
        token = IPastxISwapToken(token_);
        nativeRawPerWholePusd = nativeRawPerWholePusd_;
        maxNativePerSwapRaw = maxNativePerSwapRaw_;
    }

    function quoteNativeForPusd(uint256 pusdAmount) public view returns (uint256) {
        return (pusdAmount * nativeRawPerWholePusd) / PUSD_UNIT;
    }

    function quotePusdForNative(uint256 nativeAmountRaw) public view returns (uint256) {
        return (nativeAmountRaw * PUSD_UNIT) / nativeRawPerWholePusd;
    }

    /// @notice Burn pUSD and pay a matching bounded amount of native Portaldot test value.
    function swapPusdForNative(uint256 pusdAmount) external nonReentrant returns (uint256 nativeOut) {
        if (pusdAmount == 0) revert InvalidAmount();
        nativeOut = quoteNativeForPusd(pusdAmount);
        if (nativeOut == 0) revert QuoteRoundsToZero();
        if (nativeOut > maxNativePerSwapRaw) revert SwapLimitExceeded();
        if (address(this).balance < nativeOut) revert InsufficientNativeLiquidity();

        if (!token.transferFrom(msg.sender, address(this), pusdAmount)) revert TokenTransferFailed();
        token.burn(pusdAmount);
        totalPusdBurned += pusdAmount;
        totalNativePaid += nativeOut;

        (bool sent, ) = payable(msg.sender).call{value: nativeOut}("");
        if (!sent) revert NativeTransferFailed();
        emit SwappedPusdForNative(msg.sender, pusdAmount, nativeOut);
    }

    /// @notice Deposit native test value to the pool and mint pUSD at the same fixed demo rate.
    function swapNativeForPusd() external payable nonReentrant returns (uint256 pusdOut) {
        if (msg.value == 0) revert InvalidAmount();
        if (msg.value > maxNativePerSwapRaw) revert SwapLimitExceeded();
        pusdOut = quotePusdForNative(msg.value);
        if (pusdOut == 0) revert QuoteRoundsToZero();

        totalNativeReceived += msg.value;
        totalPusdMinted += pusdOut;
        token.mint(msg.sender, pusdOut);
        emit SwappedNativeForPusd(msg.sender, msg.value, pusdOut);
    }

    /// @notice Seed/replenish the demo pool. Only native test value is held; no production assets.
    function fundNativeLiquidity() external payable onlyOwner {
        if (msg.value == 0) revert InvalidAmount();
        emit NativeLiquidityFunded(msg.sender, msg.value);
    }

    /// @notice Owner can withdraw only the pool's available balance after the demo.
    function withdrawNativeLiquidity(uint256 amount, address payable recipient) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (amount > address(this).balance) revert InsufficientNativeLiquidity();
        (bool sent, ) = recipient.call{value: amount}("");
        if (!sent) revert NativeTransferFailed();
        emit NativeLiquidityWithdrawn(recipient, amount);
    }
}
