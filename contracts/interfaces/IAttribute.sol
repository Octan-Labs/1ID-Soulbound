// SPDX-License-Identifier: None
pragma solidity ^0.8.0;

interface IAttribute {
    /**
     * @dev Emitted when `attributedId` is registered for one `soulbound`
     */
    event Set(address indexed soulbound, uint256 indexed attributeId);

    /**
     * @dev Emitted when `attributedId` is removed out of one `soulbound`
     */
    event Removed(address indexed soulbound, uint256 indexed attributeId);

    /**
       	@notice Check whether `_attributeId` exists
       	@dev  Caller can be ANY
        @param	attributeId				    Number ID of Attribute type
    */
    function isValidAttribute(uint256 attributeId) external view returns (bool);

    /**
       	@notice Get size of Attributes currently available
       	@dev  Caller can be ANY
    */
    function numOfAttributes() external view returns (uint256);

    /**
       	@notice Get a list of available Attributes
       	@dev  Caller can be ANY
        @param	fromIdx				    Starting index in a list
        @param	toIdx				        Ending index in a list
    */
    function listOfAttributes(
        uint256 fromIdx,
        uint256 toIdx
    ) external view returns (uint256[] memory attributeIds);

    /**
       	@notice Retrieve Attribute's URI of `_soulboundId`
       	@dev  Caller can be ANY
        @param	soulboundId				    Soulbound Id
        @param	attributeId				    Number ID of Attribute type
    */
    function attributeURI(
        uint256 soulboundId,
        uint256 attributeId
    ) external view returns (string memory);
}
