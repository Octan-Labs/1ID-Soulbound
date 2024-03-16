// SPDX-License-Identifier: None
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface ISoulBound is IERC165 {
    /**
     * @dev Emitted when `soulboundId` of a soulbound token is minted and linked to `owner`
     */
    event Issued(uint256 indexed soulboundId, address indexed owner);

    /**
     * @dev Emitted when `soulboundId` of a soulbound token is unlinked from `owner`
     */
    event Revoked(uint256 indexed soulboundId, address indexed owner);

    /**
     * @dev Emitted when `soulboundId` of a soulbound token is:
     * unlinked with `from` and linked to `to`
     */
    event Changed(
        uint256 indexed soulboundId,
        address indexed from,
        address indexed to
    );

    /**
     * @dev Emitted when `soulboundId` of a soulbound token is transferred from:
     * address(0) to `to` OR `to` to address(0)
     */
    event Transfer(
        address indexed from,
        address indexed to,
        uint256 indexed soulboundId
    );

    /**
     * @dev Returns the total number of SoulBound tokens has been released
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the owner of the `soulboundId` token.
     * Requirements:
     * - `soulboundId` must exist.
     */
    function ownerOf(uint256 soulboundId) external view returns (address owner);

    /**
     * @dev Returns the soulboundId of the `owner`.
     * Requirements:
     * - `owner` must own a soulbound token.
     */
    function tokenOf(address owner) external view returns (uint256);

    /**
       	@notice Get total number of accounts that linked to `soulboundId`
       	@dev  Caller can be ANY
        @param	soulboundId				Soulbound Id
    */
    function numOfLinkedAccounts(
        uint256 soulboundId
    ) external view returns (uint256);

    /**
       	@notice Get accounts that linked to `soulboundId`
       	@dev  Caller can be ANY
        @param	soulboundId				Soulbound Id
        @param	fromIndex				Starting index of query range
        @param	toIndex				    Ending index of query range
    */
    function linkedAccounts(
        uint256 soulboundId,
        uint256 fromIndex,
        uint256 toIndex
    ) external view returns (address[] memory accounts);

    /**
       	@notice Checking if `soulboundId` is assigned, but revoked
       	@dev  Caller can be ANY
        @param	soulboundId				Soulbound Id
    */
    function isRevoked(uint256 soulboundId) external view returns (bool);
}
