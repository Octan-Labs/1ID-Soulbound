// SPDX-License-Identifier: None
pragma solidity ^0.8.0;

import "../core/SoulBoundMintable.sol";
import "../interfaces/IManagement.sol";
import "../core/Attribute.sol";

contract ReputationV1 is SoulBoundMintable {
    using EnumerableSet for EnumerableSet.UintSet;
    using Strings for uint256;

    struct Score {
        uint128 score;
        uint32 timestamp;
    }

    bytes32 private constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    uint256 private constant GENERAL_TYPE = 1;

    //  mapping of latest Reputation Scores (General + Category) per `soulboundId`
    mapping(uint256 => mapping(uint256 => Score)) private _latestAnswers;

    //  A list of Reputation Scores that `soulboundId` has (General Reputation Score by default)
    mapping(uint256 => EnumerableSet.UintSet) private _archives;

    /**
     * @dev Emitted when `operator` update latest Reputation Scores of `soulboundIds` by `attributeId`
     */
    event Respond(
        address indexed operator,
        uint256 indexed attributeId,
        uint256[] soulboundIds
    );

    /**
     * @dev Emitted when `operator` adds more type of Reputation Score, as new attribute, in a profile of `soulboundId`
     */
    event AttributeTo(
        address indexed operator,
        uint256 indexed soulboundId,
        uint256 indexed attributeId
    );

    modifier onlyWhitelist() {
        require(management.whitelist(_msgSender()), "Only whitelist");
        _;
    }

    modifier hasAttribute(uint256 soulboundId, uint256 attributeId) {
        require(
            isValidAttribute(attributeId) &&
                existAttributeOf(soulboundId, attributeId),
            "Attribute not exist in this soulbound"
        );
        _;
    }

    constructor(
        IManagement management_,
        string memory name,
        string memory symbol,
        string memory uri
    ) SoulBoundMintable(management_, name, symbol, uri) {
        _setAttribute(GENERAL_TYPE);
    }

    /**
       	@notice Assign `soulboundId` to `owner`
       	@dev  Caller must have MINTER_ROLE
		    @param	owner				        Address of soulbound's owner
        @param	soulboundId				  Soulbound id

        Note: 
        - One `owner` is assigned ONLY one `soulboundId` that binds to an off-chain profile
        - Override the method of `SoulBoundMintable` to add General Reputation Score as the default attribute to `soulboundId`
    */
    function issue(
        address owner,
        uint256 soulboundId
    ) external virtual override(SoulBoundMintable) hasRole(MINTER_ROLE) {
        _getArchiveOf(soulboundId).add(GENERAL_TYPE);
        super._issue(owner, soulboundId);
    }

    /**
       	@notice Add new `attributeId` into the `soulboundId`
       	@dev  Caller must have OPERATOR_ROLE
        @param	soulboundId				Soulbound Id
        @param	attributeId				Attribute ID of Reputation Score
    */
    function addAttributeOf(
        uint256 soulboundId,
        uint256 attributeId
    ) external hasRole(OPERATOR_ROLE) {
        _requireMinted(soulboundId);
        require(isValidAttribute(attributeId), "Attribute not supported");
        require(
            !existAttributeOf(soulboundId, attributeId),
            "Attribute added already to the Soulbound"
        );

        _getArchiveOf(soulboundId).add(attributeId);

        emit AttributeTo(_msgSender(), soulboundId, attributeId);
    }

    /**
       	@notice Update latest General/Category Reputation Scores of `soulboundIds`
       	@dev  Caller must have OPERATOR_ROLE
        @param	attributeId				  Attribute ID of Reputation Score
        @param	soulboundIds				A list of `soulboundId`
        @param	scores				      A list of latest scores that corresponding to each `soulboundId` respectively

        Note: 
        - Make sure OPERATOR_ROLE check that Reputation Score, `attributeId`, exists in each of the `soulboundId`
    */
    function fulfill(
        uint256 attributeId,
        uint256[] calldata soulboundIds,
        uint256[] calldata scores
    ) external hasRole(OPERATOR_ROLE) {
        uint256 len = soulboundIds.length;
        require(scores.length == len, "Length mismatch");
        require(isValidAttribute(attributeId), "Attribute not supported");

        uint32 timestamp = uint32(block.timestamp);
        uint256 soulboundId;
        for (uint256 i; i < len; i++) {
            soulboundId = soulboundIds[i];
            _requireMinted(soulboundId);
            _latestAnswers[soulboundId][attributeId] = Score({
                score: uint128(scores[i]),
                timestamp: timestamp
            });
        }

        emit Respond(_msgSender(), attributeId, soulboundIds);
    }

    /**
       	@notice Get an overall count of types of Reputation Scores that `soulboundId` has
       	@dev  Caller can be ANY
        @param	soulboundId				Soulbound Id
    */
    function sizeOf(uint256 soulboundId) external view returns (uint256) {
        return _getArchiveOf(soulboundId).length();
    }

    /**
       	@notice Get all types of Reputation Scores that `soulboundId` has
       	@dev  Caller can be ANY
        @param	soulboundId				  Soulbound Id
        @param	fromIdx				      Starting index in a list
        @param	toIdx				        Ending index in a list
    */
    function listOf(
        uint256 soulboundId,
        uint256 fromIdx,
        uint256 toIdx
    ) external view returns (uint256[] memory attributeIds) {
        EnumerableSet.UintSet storage _list = _getArchiveOf(soulboundId);
        uint256 len = toIdx - fromIdx + 1;
        attributeIds = new uint256[](len);

        for (uint256 i; i < len; i++) attributeIds[i] = _list.at(fromIdx + i);
    }

    /**
       	@notice Query URL link to retrieve Reputation Score's metadata (General and Category)
       	@dev  Caller can be ANY
        @param	soulboundId				Soulbound Id
        @param	attributeId				Attribute ID of Reputation Score
    */
    function attributeURI(
        uint256 soulboundId,
        uint256 attributeId
    )
        external
        view
        override(Attribute)
        hasAttribute(soulboundId, attributeId)
        returns (string memory)
    {
        //  If soulbound not yet minted -> hasAttribute throws error
        //  If soulbound minted, but not configured `attributeId` -> hasAttribute throws error
        //  If soulbound minted and configured `attributeId`, then revoked -> hasAttribute would not throw error
        //  thus, must check `_requireMinted()` to make sure `soulboundId` is currently available
        _requireMinted(soulboundId);

        return
            string(
                abi.encodePacked(
                    _baseURI(),
                    soulboundId.toString(),
                    "/",
                    attributeId.toString()
                )
            );
    }

    /**
       	@notice Get latest Reputation Score of `soulboundId`
       	@dev  Caller can be ANY
        @param	soulboundId				Soulbound Id
        @param	attributeId				Attribute ID of Reputation Score
    */
    function latestAnswer(
        uint256 soulboundId,
        uint256 attributeId
    )
        external
        view
        hasAttribute(soulboundId, attributeId)
        returns (uint256 score, uint256 lastUpdate)
    {
        //  Similarly as attributeURI(), must check `_requireMinted()` to make sure `soulboundId` is currently available
        _requireMinted(soulboundId);

        score = _latestAnswers[soulboundId][attributeId].score;
        lastUpdate = _latestAnswers[soulboundId][attributeId].timestamp;
    }

    /**
       	@notice Check whether a list of `soulboundIds` exists
       	@dev  Caller can be ANY
        @param	soulboundIds				A list of `soulboundId`
    */
    function exist(
        uint256[] calldata soulboundIds
    ) external view returns (bool) {
        uint256 len = soulboundIds.length;
        for (uint256 i; i < len; i++) {
            if (!_exists(soulboundIds[i])) return false;
        }
        return true;
    }

    /**
       	@notice Check whether `soulboundId` contains `attributeId` as the Reputation Score
       	@dev  Caller can be ANY
        @param	soulboundId				Soulbound Id
        @param	attributeId				Attribute ID of Reputation Score
    */
    function existAttributeOf(
        uint256 soulboundId,
        uint256 attributeId
    ) public view returns (bool) {
        return _getArchiveOf(soulboundId).contains(attributeId);
    }

    function _getArchiveOf(
        uint256 soulboundId
    ) private view returns (EnumerableSet.UintSet storage) {
        return _archives[soulboundId];
    }
}