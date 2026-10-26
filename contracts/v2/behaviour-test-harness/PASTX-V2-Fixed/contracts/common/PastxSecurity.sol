// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Minimal guard for external-call entry points. Do not use as a substitute for tests.
abstract contract PastxReentrancyGuard {
    uint256 private _guard = 1;
    error ReentrantCall();
    modifier nonReentrant() {
        if (_guard != 1) revert ReentrantCall();
        _guard = 2;
        _;
        _guard = 1;
    }
}

library PastxSafeToken {
    error TokenCallFailed(address token);
    function safeTransfer(address token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSignature("transfer(address,uint256)", to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenCallFailed(token);
    }
    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenCallFailed(token);
    }
}
