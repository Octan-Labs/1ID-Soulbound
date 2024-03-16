// SPDX-License-Identifier: None
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../interfaces/IReputation.sol";
import "../interfaces/IManagement.sol";
import "../utils/Signer.sol";

contract Updater is Signer {
    using SafeERC20 for IERC20;
    using Address for address;

    struct Data {
        address soulbound;
        uint256 soulboundId;
        address paymentToken;
        uint256 fee;
        uint256 expiry;
        uint256[] attributeIds;
        uint256[] scores;
        bytes signature;
    }

    bytes32 private constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 private constant AUTHORIZER_ROLE = keccak256("AUTHORIZER_ROLE");

    //  Address of Management contract
    IManagement public management;

    //  mapping of address -> number of requests
    mapping(address => uint256) public nonces;

    /**
     * @dev Emitted when `msg.sender` completely update latest Reputation Scores of `soulboundId`
     */
    event Updated(
        address indexed sender,
        address indexed soulbound,
        uint256 indexed soulboundId,
        uint256 nonce,
        address paymentToken,
        uint256 fee
    );

    constructor(IManagement _management) Signer("Reputation Updater", "Version 1") {
        management = _management;
    }

    /**
       	@notice Update Address of Management contract
       	@dev  Caller must have MANAGER_ROLE
		    @param	_management				Address of new Management contract
    */
    function setManagement(address _management) external {
        _isAuthorized(msg.sender, MANAGER_ROLE);
        require(_management.isContract(), "Must be a contract");

        management = IManagement(_management);
    }

    /**
       	@notice Update Reputation Score by `msg.sender`
       	@dev  Caller can be ANY
		    @param	data				Data struct
          Data :
            soulbound           ddress of SoulBound/Reputation contract
            soulboundId         ID of the Soulbound Token
            paymentToken        Address of the payment token contract
            fee                 Payment fee
            expiry              Signature expiring time
            attributeIds        A list of `attributeIds` to be updated a score
            scores              A list of updating `scores`
            signature           Signature from AUTHORIZER  
    */
    function update(Data calldata data) external payable {
        //  Check `soulboundId` must be owned by `msg.sender`
        //  and authorized signature shouldn't be expired
        //  if `soulboundId` is revoked, revert likely when calling `ownerOf()`
        IReputation reputation = IReputation(data.soulbound);
        require(data.scores.length == data.attributeIds.length, "Length mismatch");
        require(data.expiry > block.timestamp, "Signature is expired");
        require(
            reputation.ownerOf(data.soulboundId) == msg.sender,
            "Soulbound not owned"
        );

        uint256 nonce = nonces[msg.sender];
        address signer =  Signer._getSignerOfUpdateRS(
            msg.sender,
            data.soulbound,
            data.soulboundId,
            data.paymentToken,
            data.fee,
            keccak256(abi.encodePacked(data.attributeIds, data.scores)),
            nonce,
            data.expiry,
            data.signature
        );
        _isAuthorized(signer, AUTHORIZER_ROLE);

        //  make a payment
        if (data.paymentToken == address(0))
            require(msg.value == data.fee, "Invalid payment fee");
        _makePayment(data.paymentToken, msg.sender, data.fee);

        uint256 attributeId;
        uint256 len = data.attributeIds.length;
        for (uint256 i; i < len; i++) {
            attributeId = data.attributeIds[i];
            //  A batch of `attributeIds` might contain a first-time-request attribute
            //  - If yes -> request to register and initialize an attribute
            //  Does not need to check whether `attributeId` is valid
            //  - If `attributeId` not yet added, calling `addAttributeOf()` also validate
            //  - If `attributeId` already added, calling to update RS also check its validity
            if (!reputation.existAttributeOf(data.soulboundId, attributeId))
                reputation.addAttributeOf(data.soulboundId, attributeId);

            reputation.updateRS(data.soulboundId, attributeId, data.scores[i]);
        }

        emit Updated(msg.sender, data.soulbound, data.soulboundId, nonce, data.paymentToken, data.fee);
    }

    function _makePayment(address token, address from, uint256 amount) private {
        address treasury = management.treasury();
        if (amount != 0) {
            if (token == address(0))
                Address.sendValue(payable(treasury), amount);
            else IERC20(token).safeTransferFrom(from, treasury, amount);
        }
    }

    function _isAuthorized(address account, bytes32 role) private view {
        require(management.hasRole(role, account), "Unauthorized");
    }
}
