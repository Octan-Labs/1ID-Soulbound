// SPDX-License-Identifier: None
pragma solidity ^0.8.0;

import "./ISoulBound.sol";

interface IERC721Metadata is ISoulBound {
    /**
     * @dev Returns the SoulBound Token name.
     */
    function name() external view returns (string memory);

    /**
     * @dev Returns the SoulBound Token symbol.
     */
    function symbol() external view returns (string memory);

    /**
     * @dev Returns the Uniform Resource Identifier (URI) for `tokenId` token.
     */
    function tokenURI(uint256 tokenId) external view returns (string memory);
}
