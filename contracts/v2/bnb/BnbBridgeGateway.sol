// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../common/PastxSecurity.sol";
interface IWrappedPot { function mint(address to,uint256 amount) external; function burnFrom(address from,uint256 amount) external; }

/// @notice BNB testnet bridge endpoint. Relayer-attested; NOT a trustless bridge.
/// @dev sourceNativeDecimals must be verified against the source EVM value denomination before deployment.
contract BnbBridgeGateway is PastxReentrancyGuard {
    IWrappedPot public immutable wrappedPot; address public owner; address public relayer;
    uint256 public immutable sourceChainId; address public immutable sourceEscrow; uint8 public immutable sourceNativeDecimals;
    uint256 public nextWithdrawalNonce; mapping(bytes32=>bool) public processedDepositIds; mapping(bytes32=>bool) public processedSourceEvents;
    error NotOwner();error NotRelayer();error InvalidAddress();error InvalidAmount();error WrongChain();error WrongSource();error MissingEvidence();error DepositIdMismatch();error DuplicateDeposit();error DuplicateSourceEvent();error UnsupportedDecimals();error UnrepresentableAmount();
    event DepositCompleted(bytes32 indexed depositId,address indexed recipient,uint256 sourceAmount,uint256 wrappedAmount,bytes32 sourceTxHash,uint256 sourceLogIndex);
    event WithdrawalRequested(bytes32 indexed withdrawalId,address indexed requester,address indexed portalRecipient,uint256 wrappedAmount,uint256 sourceAmount,uint256 nonce);
    event RelayerChanged(address indexed previousRelayer,address indexed newRelayer);
    constructor(address owner_,address relayer_,address wrappedPot_,uint256 sourceChainId_,address sourceEscrow_,uint8 sourceNativeDecimals_){
        if(owner_==address(0)||relayer_==address(0)||wrappedPot_==address(0)||sourceEscrow_==address(0)||sourceChainId_==0)revert InvalidAddress();
        if(sourceNativeDecimals_>18)revert UnsupportedDecimals();owner=owner_;relayer=relayer_;wrappedPot=IWrappedPot(wrappedPot_);sourceChainId=sourceChainId_;sourceEscrow=sourceEscrow_;sourceNativeDecimals=sourceNativeDecimals_;
    }
    modifier onlyOwner(){if(msg.sender!=owner)revert NotOwner();_;}modifier onlyRelayer(){if(msg.sender!=relayer)revert NotRelayer();_;}
    function setRelayer(address next) external onlyOwner {if(next==address(0))revert InvalidAddress();emit RelayerChanged(relayer,next);relayer=next;}
    function _toWrapped(uint256 sourceAmount) internal view returns(uint256){return sourceAmount*(10**(18-sourceNativeDecimals));}
    function _toSource(uint256 wrappedAmount) internal view returns(uint256){uint256 scale=10**(18-sourceNativeDecimals);if(wrappedAmount%scale!=0)revert UnrepresentableAmount();return wrappedAmount/scale;}
    function completeDeposit(bytes32 depositId,address sourceSender,address recipient,uint256 sourceAmount,uint256 sourceChain,address escrow,uint256 destinationChain,uint256 nonce,bytes32 sourceTxHash,uint256 sourceLogIndex) external onlyRelayer nonReentrant {
        if(block.chainid!=97)revert WrongChain();if(sourceSender==address(0)||recipient==address(0))revert InvalidAddress();if(sourceAmount==0)revert InvalidAmount();
        if(sourceChain!=sourceChainId||destinationChain!=block.chainid)revert WrongSource();if(escrow!=sourceEscrow)revert WrongSource();if(sourceTxHash==bytes32(0))revert MissingEvidence();
        bytes32 expected=keccak256(abi.encode(sourceChain,escrow,sourceSender,recipient,destinationChain,nonce,sourceAmount));if(expected!=depositId)revert DepositIdMismatch();
        if(processedDepositIds[depositId])revert DuplicateDeposit();bytes32 eventKey=keccak256(abi.encode(sourceChain,escrow,sourceTxHash,sourceLogIndex));if(processedSourceEvents[eventKey])revert DuplicateSourceEvent();
        uint256 wrappedAmount=_toWrapped(sourceAmount);if(wrappedAmount==0)revert InvalidAmount();processedDepositIds[depositId]=true;processedSourceEvents[eventKey]=true;wrappedPot.mint(recipient,wrappedAmount);
        emit DepositCompleted(depositId,recipient,sourceAmount,wrappedAmount,sourceTxHash,sourceLogIndex);
    }
    function requestWithdrawal(uint256 wrappedAmount,address portalRecipient) external nonReentrant returns(bytes32 withdrawalId){
        if(block.chainid!=97)revert WrongChain();if(portalRecipient==address(0))revert InvalidAddress();if(wrappedAmount==0)revert InvalidAmount();uint256 sourceAmount=_toSource(wrappedAmount);if(sourceAmount==0)revert InvalidAmount();
        uint256 nonce=nextWithdrawalNonce++;withdrawalId=keccak256(abi.encode(block.chainid,address(this),msg.sender,portalRecipient,wrappedAmount,nonce));wrappedPot.burnFrom(msg.sender,wrappedAmount);
        emit WithdrawalRequested(withdrawalId,msg.sender,portalRecipient,wrappedAmount,sourceAmount,nonce);
    }
}
