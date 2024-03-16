// SPDX-License-Identifier: None
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../interfaces/IReputation.sol";
import "../interfaces/IManagement.sol";
import "../utils/Signer.sol";

contract Minter is Signer {
    using SafeERC20 for IERC20;
    using Address for address;

    bytes32 private constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 private constant AUTHORIZER_ROLE = keccak256("AUTHORIZER_ROLE");
    bytes32 private constant ISSUE_OPT = keccak256("ISSUE");
    bytes32 private constant REVOKE_OPT = keccak256("REVOKE");
    uint256 private constant GENERAL_TYPE = 1;

    //  Address of Reputation SoulBound contract
    IReputation private immutable _REPUTATION;

    //  Address of Management contract
    IManagement private _management;

    //  Address of Fee Payment Token
    address public paymentToken;

    //  Amount of payment fee
    uint256 public fee;

    //  mapping of address -> number of requests
    mapping(address => uint256) public nonces;

    modifier isExpired(uint256 expiry) {
        require(expiry > block.timestamp, "Signature is expired");
        _;
    }

    constructor(
        IManagement management_,
        IReputation reputation_
    ) Signer("Reputation Minter", "Version 1") {
        _management = management_;
        _REPUTATION = reputation_;
    }

    /**
       	@notice Get address of Reputation SoulBound contract
       	@dev  Caller can be ANY
    */
    function reputation() public view returns (IReputation) {
        return _REPUTATION;
    }

    /**
       	@notice Get address of Management contract
       	@dev  Caller can be ANY
    */
    function management() public view returns (IManagement) {
        return _management;
    }

    /**
       	@notice Update Address of Management contract
       	@dev  Caller must have MANAGER_ROLE
		    @param	management_				Address of new Management contract
    */
    function setManagement(address management_) external {
        _isAuthorized(msg.sender, MANAGER_ROLE);
        require(management_.isContract(), "Must be a contract");
        _management = IManagement(management_);
    }

    /**
       	@notice Update Payment Token and Payment Fee
       	@dev  Caller must have MANAGER_ROLE
		    @param	token				  Address of Payment Token (native coin = 0x00)
        @param	amount				Amount of payment fee
    */
    function setPayment(address token, uint256 amount) external {
        _isAuthorized(msg.sender, MANAGER_ROLE);
        paymentToken = token;
        fee = amount;
    }

    /**
       	@notice Assign `soulboundId` to `msg.sender`
       	@dev  Caller can be ANY, but requires authorizing signature
		    @param	soulboundId				    Assigning SoulBound ID to `msg.sender`
        @param	expiry				        Expiring time of authorizing signature
        @param	signature				      Authorizing signature that provided by MINTER_ROLE
    */
    function issue(
        uint256 soulboundId,
        uint256 expiry,
        bytes calldata signature
    ) external payable isExpired(expiry) {
        address sender = msg.sender;
        _action(soulboundId, expiry, ISSUE_OPT, signature);
        _makePayment(sender);

        IReputation reputation_ = reputation();
        reputation_.issue(sender, soulboundId);
    }

    /**
       	@notice Unlink `soulboundId` to `msg.sender`
       	@dev  Caller can be ANY, but requires authorizing signature
		    @param	soulboundId				  SoulBound ID will be unlinked with `msg.sender`
        @param	expiry				      Expiring time of authorizing signature
        @param	signature				    Authorizing signature that provided by MINTER_ROLE
    */
    function revoke(
        uint256 soulboundId,
        uint256 expiry,
        bytes calldata signature
    ) external isExpired(expiry) {
        IReputation reputation_ = reputation();
        require(
            reputation_.ownerOf(soulboundId) == msg.sender,
            "Soulbound not owned"
        );
        _action(soulboundId, expiry, REVOKE_OPT, signature);
        reputation().revoke(soulboundId);
    }

    /**
       	@notice Change `soulboundId` to a new owner
       	@dev  Caller can be ANY, but requires authorizing signature
		    @param	soulboundId				  SoulBound ID will be unlinked with `msg.sender`, and linked to `to`
        @param	soulboundId				  Address of account that link to `soulboundId`
        @param	expiry				      Expiring time of authorizing signature
        @param	signature				    Authorizing signature that provided by MINTER_ROLE

        Note: Change address from `from` to `to` does not mean ownership transfer
        Instead, it indicates which account is currently set as Primary
        Using `linkedAccounts()` can query all accounts that are linked to `soulboundId`
    */
    function change(
        uint256 soulboundId,
        address to,
        uint256 expiry,
        bytes calldata signature
    ) external isExpired(expiry) {
        address from = msg.sender;
        IReputation reputation_ = reputation();
        require(
            reputation_.ownerOf(soulboundId) == from,
            "Soulbound not owned"
        );
        address signer = Signer._getSignerOfChange(
            soulboundId,
            from,
            to,
            nonces[from],
            expiry,
            signature
        );
        _isAuthorized(signer, AUTHORIZER_ROLE);
        nonces[from]++;
        reputation_.change(soulboundId, from, to);
    }

    function _action(
        uint256 soulboundId,
        uint256 expiry,
        bytes32 option,
        bytes calldata signature
    ) private {
        address caller = msg.sender;
        address signer;
        if (option == ISSUE_OPT)
            signer = Signer._getSignerOfIssue(
                option,
                caller,
                soulboundId,
                nonces[caller],
                expiry,
                signature
            );
        else
            signer = Signer._getSignerOfRevoke(
                option,
                caller,
                soulboundId,
                nonces[caller],
                expiry,
                signature
            );
        _isAuthorized(signer, AUTHORIZER_ROLE);
        nonces[caller]++;
    }

    function _makePayment(address from) private {
        address treasury = management().treasury();
        address token = paymentToken;
        uint256 amount = fee;
        if (amount != 0) {
            if (token == address(0)) {
                require(msg.value == amount, "Invalid payment");
                Address.sendValue(payable(treasury), amount);
            } else IERC20(token).safeTransferFrom(from, treasury, amount);
        }
    }

    function _isAuthorized(address account, bytes32 role) private view {
        require(management().hasRole(role, account), "Unauthorized");
    }
}
