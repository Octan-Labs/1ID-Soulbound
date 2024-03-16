// SPDX-License-Identifier: None
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "../interfaces/IReputation.sol";
import "../interfaces/IManagement.sol";

contract Service is Context {
    using SafeERC20 for IERC20;
    using Address for address;

    struct UpdateFee {
        uint256 fee;
        address paymentToken;
    }

    bytes32 private constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    uint256 private constant GENERAL_TYPE = 1;

    //  Address of Reputation contract
    IReputation private immutable _REPUTATION;

    //  Address of Management contract
    IManagement private _management;

    //  Time delay between two update requests
    uint256 public delayTime;

    //  Accepted Payment Token
    address public paymentToken;

    //  Amount Fee to pay per request
    uint256 public fee;

    modifier hasRole(bytes32 role) {
        require(management().hasRole(role, _msgSender()), "Unauthorized");
        _;
    }

    modifier onlyWhitelist() {
        require(management().whitelist(_msgSender()), "Only whitelist");
        _;
    }

    /**
     * @dev Emitted when `requestor` send a request to update latest reputation scores of `soulboundIds`
     */
    event Request(
        address indexed requestor,
        uint256 indexed attributeId,
        uint256[] soulboundIds
    );

    constructor(
        IManagement management_,
        IReputation reputation_,
        address paymentToken_,
        uint256 fee_,
        uint256 delayTime_
    ) {
        _REPUTATION = reputation_;
        _management = management_;
        paymentToken = paymentToken_;
        fee = fee_;
        delayTime = delayTime_;
    }

    /**
       	@notice Update Address of Management contract
       	@dev  Caller must have MANAGER_ROLE
		    @param	management_				Address of new Management contract
    */
    function setManagement(address management_) external hasRole(MANAGER_ROLE) {
        require(management_.isContract(), "Must be a contract");
        _management = IManagement(management_);
    }

    /**
       	@notice Set new `_updateFee`
       	@dev  Caller must have MANAGER_ROLE
        @param	paymentToken_		    Address of payment token (0x00 for native coin) 
		    @param	fee_		            New value of `fee` that `msg.sender` must pay for each update request                
    */
    function setFee(
        address paymentToken_,
        uint256 fee_
    ) external hasRole(MANAGER_ROLE) {
        paymentToken = paymentToken_;
        fee = fee_;
    }

    /**
       	@notice Set new `_delayTime`
       	@dev  Caller must have MANAGER_ROLE
		    @param	delayTime_		    New value of delay time between two update requests 
    */
    function setDelayTime(uint256 delayTime_) external hasRole(MANAGER_ROLE) {
        delayTime = delayTime_;
    }

    /**
       	@notice Request to update latest General Reputation Scores of `soulboundIds`
       	@dev  Caller can be ANY
        @param	soulboundIds				A list of `soulboundId`
    */
    function generalRequest(
        uint256[] calldata soulboundIds
    ) external onlyWhitelist {
        require(
            reputation().exist(soulboundIds),
            "Contain non-existed soulboundId"
        );

        emit Request(_msgSender(), GENERAL_TYPE, soulboundIds);
    }

    /**
       	@notice Request to update latest Category Reputation Score of `soulboundId`
       	@dev  Caller can be ANY
        @param	soulboundId				Soulbound Id to be requested
        @param	attributeId				Attribute ID of Reputation Score
    */
    function categoryRequest(
        uint256 soulboundId,
        uint256 attributeId
    ) external payable {
        //  Only owner of `soulboundId` can request to update Category Score
        //  And `attributeId` must be valid
        address caller = _msgSender();
        IReputation reputation_ = reputation();
        require(
            reputation_.ownerOf(soulboundId) == caller,
            "Soulbound not owned"
        );
        require(
            reputation_.isValidAttribute(attributeId) &&
                attributeId != GENERAL_TYPE,
            "Invalid attributeId"
        );

        //  Get Fee info that `msg.sender` must pay
        //  If `paymentToken = 0x00` -> `msg.value` must be equal to `_fee`
        address token = paymentToken; //  save gas
        uint256 paymentFee = fee; //  save gas
        if (token == address(0))
            require(msg.value == paymentFee, "Invalid payment");

        //  make a payment
        _makePayment(token, caller, paymentFee);

        //  For the first time, add `attributeId` of Category Reputation Score to `soulboundId`
        //  and let the request go through
        //  Others, must check `lastUpdate` to verify time constraint `_delayTime`
        if (!reputation_.existAttributeOf(soulboundId, attributeId))
            reputation_.addAttributeOf(soulboundId, attributeId);
        else {
            (, uint256 lastUpdate) = reputation_.latestAnswer(
                soulboundId,
                attributeId
            );
            require(
                block.timestamp - lastUpdate >= delayTime,
                "Request too close"
            );
        }

        uint256[] memory soulboundIds = _array1(soulboundId);
        emit Request(caller, attributeId, soulboundIds);
    }

    /**
       	@notice Get address of Reputation contract
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

    function _makePayment(address token, address from, uint256 amount) private {
        address treasury = management().treasury();
        if (amount != 0) {
            if (token == address(0))
                Address.sendValue(payable(treasury), amount);
            else IERC20(token).safeTransferFrom(from, treasury, amount);
        }
    }

    function _array1(
        uint256 soulboundId
    ) private pure returns (uint256[] memory array) {
        array = new uint256[](1);
        array[0] = soulboundId;
    }
}
