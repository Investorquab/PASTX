// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title PortalValueSemanticsProbe
/// @notice Test-only payable probe for confirming Portaldot V3 EVM msg.value units.
/// @dev Use only on PortalDOT V3 testnet; it can return the deposited native test value to its deployer.
contract PortalValueSemanticsProbe {
    uint256 public constant EXPECTED_CHAIN_ID = 420420777;
    address public immutable owner;

    event ValueObserved(address indexed sender, uint256 msgValue, uint256 contractBalance);
    event ValueReturned(address indexed recipient, uint256 amount);

    error WrongChain();
    error Unauthorized();
    error EmptyValue();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor() {
        if (block.chainid != EXPECTED_CHAIN_ID) revert WrongChain();
        owner = msg.sender;
    }

    function observeValue() external payable returns (uint256 observed) {
        if (msg.value == 0) revert EmptyValue();
        observed = msg.value;
        emit ValueObserved(msg.sender, observed, address(this).balance);
    }

    function returnAllToOwner() external onlyOwner returns (uint256 amount) {
        amount = address(this).balance;
        if (amount == 0) revert EmptyValue();
        (bool ok, ) = payable(owner).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit ValueReturned(owner, amount);
    }
}
