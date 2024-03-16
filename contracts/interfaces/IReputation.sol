// SPDX-License-Identifier: None
pragma solidity ^0.8.0;

import "./IERC721Metadata.sol";
import "./ISoulBoundMintable.sol";
import "./IAttribute.sol";

interface IReputation is IERC721Metadata, ISoulBoundMintable, IAttribute {
    /**
       	@notice Add new `attributeId` as Reputation Score of `soulboundId`
       	@dev  Caller must have OPERATOR_ROLE
        @param	soulboundId				Soulbound Id
        @param	attributeId				Attribute ID of Reputation Score

        Note: 
        - This method is designed to be called by Service/Minter/Helper contract
            + In Service contract:
                Owner of `soulboundId` requests to add Category Reputation Score in his/her profile.
                However, for easy extendability and flexibility, Service contract can be set as OPERATOR_ROLE
                so that authorized clients could also call this method
            + In Minter/Helper contract:
                General Reputation Score will be added in the `soulboundId` profile (as default)
        - Validity of `attributeId` and ownership of `soulboundId` must be checked prior calling this method
    */
    function addAttributeOf(uint256 soulboundId, uint256 attributeId) external;

    /**
       	@notice Update latest General/Category Reputation Scores of `soulboundId`
       	@dev  Caller must have OPERATOR_ROLE
        @param	soulboundId				  ID of the Soulbound
        @param	attributeId				  Attribute ID of Reputation Score
        @param	score				        New value of Reputation Score (GRS or CRS)
    */
    function updateRS(
        uint256 soulboundId,
        uint256 attributeId,
        uint256 score
    ) external;

    /**
       	@notice Get size of Reputation Score list that `soulboundId` has
       	@dev  Caller can be ANY
        @param	soulboundId				Soulbound Id
    */
    function sizeOf(uint256 soulboundId) external view returns (uint256);

    /**
       	@notice Get Reputation Score list that `soulboundId` has
       	@dev  Caller can be ANY
        @param	soulboundId				  Soulbound Id
        @param	fromIdx				      Starting index in a list
        @param	toIdx				        Ending index in a list
    */
    function listOf(
        uint256 soulboundId,
        uint256 fromIdx,
        uint256 toIdx
    ) external view returns (uint256[] memory attributeIds);

    /**
       	@notice Get latest Reputation Scores of `soulboundId`
       	@dev  Caller can be ANY
        @param	soulboundId				Soulbound Id
        @param	attributeId				Attribute ID of Reputation Score
    */
    function latestAnswer(
        uint256 soulboundId,
        uint256 attributeId
    ) external view returns (uint256 _score, uint256 _lastUpdate);

    /**
       	@notice Check whether a list of `soulboundIds` exists
       	@dev  Caller can be ANY
        @param	soulboundIds				A list of `soulboundId`
    */
    function exist(
        uint256[] calldata soulboundIds
    ) external view returns (bool);

    /**
       	@notice Check whether `soulboundId` contains `attributeId` as the Reputation Score
       	@dev  Caller can be ANY
        @param	soulboundId				Soulbound Id
        @param	attributeId				Attribute ID of Reputation Score
    */
    function existAttributeOf(
        uint256 soulboundId,
        uint256 attributeId
    ) external view returns (bool);
}
