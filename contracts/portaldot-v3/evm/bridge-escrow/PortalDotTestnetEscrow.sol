// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice TESTNET-ONLY source escrow for the PASTX cross-chain prototype.
/// @dev The relayer is trusted. This is not a production bridge or trustless light client.
contract PortalDotTestnetEscrow {
    uint256 public constant EXPECTED_SOURCE_CHAIN_ID = 420420777;
    address public immutable relayer;
    uint256 public immutable destinationChainId;
    uint256 public immutable maxDepositRaw;
    uint256 public nextDepositNonce;
    uint256 public totalDeposited;
    uint256 public totalReleased;

    mapping(bytes32 => bool) public processedWithdrawals;

    event DepositInitiated(
        bytes32 indexed depositId,
        address indexed sender,
        address indexed destinationRecipient,
        uint256 amount,
        uint256 sourceChainId,
        uint256 destinationChainId,
        uint256 nonce
    );
    event WithdrawalReleased(bytes32 indexed withdrawalId, address indexed recipient, uint256 amount);

    error UnauthorizedRelayer();
    error InvalidRelayer();
    error InvalidSourceChain();
    error InvalidDestinationChain();
    error InvalidRecipient();
    error InvalidAmount();
    error DepositExceedsDemoCap();
    error DuplicateWithdrawal();
    error InsufficientEscrowBalance();
    error ReleaseExceedsDeposits();
    error NativeTransferFailed();

    modifier onlyRelayer() {
        if (msg.sender != relayer) revert UnauthorizedRelayer();
        _;
    }

    constructor(address relayer_, uint256 destinationChainId_, uint256 maxDepositRaw_) {
        if (block.chainid != EXPECTED_SOURCE_CHAIN_ID) revert InvalidSourceChain();
        if (relayer_ == address(0)) revert InvalidRelayer();
        if (destinationChainId_ != 97) revert InvalidDestinationChain();
        if (maxDepositRaw_ == 0) revert InvalidAmount();
        relayer = relayer_;
        destinationChainId = destinationChainId_;
        maxDepositRaw = maxDepositRaw_;
    }

    /// @notice Lock native PortalDOT V3 testnet value and request a matching BNB-testnet representation.
    /// @dev EVM native-value and tPOTv3 decimal semantics must be validated before testnet use.
    function deposit(address destinationRecipient) external payable returns (bytes32 depositId) {
        if (destinationRecipient == address(0)) revert InvalidRecipient();
        if (msg.value == 0) revert InvalidAmount();
        if (msg.value > maxDepositRaw) revert DepositExceedsDemoCap();

        uint256 nonce = nextDepositNonce++;
        totalDeposited += msg.value;
        depositId = keccak256(
            abi.encode(
                block.chainid,
                address(this),
                msg.sender,
                destinationRecipient,
                destinationChainId,
                nonce,
                msg.value
            )
        );

        emit DepositInitiated(
            depositId,
            msg.sender,
            destinationRecipient,
            msg.value,
            block.chainid,
            destinationChainId,
            nonce
        );
    }

    /// @notice Release escrowed testnet value after observing a BNB-testnet burn request.
    /// @dev A compromised relayer can still steal escrow up to deposited value. Never use valuable funds.
    function releaseWithdrawal(bytes32 withdrawalId, address payable recipient, uint256 amount)
        external
        onlyRelayer
    {
        if (withdrawalId == bytes32(0)) revert DuplicateWithdrawal();
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();
        if (processedWithdrawals[withdrawalId]) revert DuplicateWithdrawal();
        if (totalReleased + amount > totalDeposited) revert ReleaseExceedsDeposits();
        if (address(this).balance < amount) revert InsufficientEscrowBalance();

        processedWithdrawals[withdrawalId] = true;
        totalReleased += amount;
        (bool sent, ) = recipient.call{value: amount}("");
        if (!sent) revert NativeTransferFailed();

        emit WithdrawalReleased(withdrawalId, recipient, amount);
    }
}
