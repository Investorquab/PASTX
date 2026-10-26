// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../common/PastxSecurity.sol";

/// @notice Portaldot EVM native-value escrow for a trusted-relayer testnet bridge prototype.
/// @dev Does NOT verify BNB consensus or prove the corresponding burn on-chain.
contract PortalDotBridgeEscrow is PastxReentrancyGuard {
    address public owner; address public relayer; uint256 public immutable destinationChainId;
    uint256 public totalDeposited; uint256 public totalReleased; uint256 public nextDepositNonce;
    mapping(bytes32=>bool) public processedWithdrawalIds;
    error NotOwner(); error NotRelayer(); error InvalidAddress(); error InvalidAmount(); error WrongDestinationChain(); error DuplicateWithdrawal(); error ExceedsEscrowBalance(); error TransferFailed();
    event DepositInitiated(bytes32 indexed depositId,address indexed sender,address indexed recipient,uint256 amount,uint256 sourceChainId,uint256 destinationChainId,uint256 nonce);
    event WithdrawalReleased(bytes32 indexed withdrawalId,address indexed recipient,uint256 amount); event RelayerChanged(address indexed previousRelayer,address indexed newRelayer);
    constructor(address owner_,address relayer_,uint256 destinationChainId_){if(owner_==address(0)||relayer_==address(0)||destinationChainId_==0)revert InvalidAddress();owner=owner_;relayer=relayer_;destinationChainId=destinationChainId_;}
    modifier onlyOwner(){if(msg.sender!=owner)revert NotOwner();_;} modifier onlyRelayer(){if(msg.sender!=relayer)revert NotRelayer();_;}
    function setRelayer(address next) external onlyOwner {if(next==address(0))revert InvalidAddress();emit RelayerChanged(relayer,next);relayer=next;}
    function deposit(address bnbRecipient) external payable returns(bytes32 depositId){
        if(block.chainid!=420420777)revert WrongDestinationChain();if(bnbRecipient==address(0))revert InvalidAddress();if(msg.value==0)revert InvalidAmount();
        uint256 nonce=nextDepositNonce++;depositId=keccak256(abi.encode(block.chainid,address(this),msg.sender,bnbRecipient,destinationChainId,nonce,msg.value));totalDeposited+=msg.value;
        emit DepositInitiated(depositId,msg.sender,bnbRecipient,msg.value,block.chainid,destinationChainId,nonce);
    }
    function release(bytes32 withdrawalId,address payable recipient,uint256 amount) external onlyRelayer nonReentrant {
        if(block.chainid!=420420777)revert WrongDestinationChain();if(withdrawalId==bytes32(0)||recipient==address(0))revert InvalidAddress();if(amount==0)revert InvalidAmount();
        if(processedWithdrawalIds[withdrawalId])revert DuplicateWithdrawal();if(totalReleased+amount>totalDeposited||address(this).balance<amount)revert ExceedsEscrowBalance();
        processedWithdrawalIds[withdrawalId]=true;totalReleased+=amount;(bool ok,)=recipient.call{value:amount}("");if(!ok)revert TransferFailed();emit WithdrawalReleased(withdrawalId,recipient,amount);
    }
    receive() external payable {revert InvalidAmount();}
}
