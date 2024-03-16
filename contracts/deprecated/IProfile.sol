// SPDX-License-Identifier: None
pragma solidity ^0.8.0;

interface IProfile {
    /**
     * @dev Emitted when `soulboundId` is updated a list of proof hashes of a profile
     */
    event UpdatedProof(uint256 indexed soulboundId, bytes32[] proof);

    /**
     * @dev Emitted when `soulboundId` is updated a single proof at one `index`
     */
    event UpdatedProofAt(
        uint256 indexed soulboundId,
        uint256 indexed index,
        bytes32 oProof,
        bytes32 nProof
    );

    /**
       	@notice Update proof hashes of `_soulboundId`
       	@dev  Caller must have Operator role
        @param	_soulboundId				Soulbound id
        @param	_proof				        A list of proof hashes
    */
    function updateProof(
        uint256 _soulboundId,
        bytes32[] calldata _proof
    ) external;

    /**
       	@notice Update proof hash of `_soulboundId` at `_index`
       	@dev  Caller must have Operator role
        @param	_soulboundId				Soulbound id
        @param	_index				        Position index that needs to be updated
        @param	_proof				        A single proof hash

        Note: Proof hashes must be updated before calling this function
    */
    function updateProofAt(
        uint256 _soulboundId,
        uint256 _index,
        bytes32 _proof
    ) external;

    /**
       	@notice Query a list of proof hashes of `_soulboundId`
       	@dev  Caller can be ANY
        @param	_soulboundId				Soulbound id
    */
    function getProof(
        uint256 _soulboundId
    ) external view returns (bytes32[] memory);

    /**
       	@notice Query a single proof hash of `_soulboundId` at `_index`
       	@dev  Caller can be ANY
        @param	_soulboundId		    Soulbound id
        @param	_index				    Position index to get data
    */
    function getProofAt(
        uint256 _soulboundId,
        uint256 _index
    ) external view returns (bytes32);

    /**
       	@notice Query proof size of `_soulboundId`
       	@dev  Caller can be ANY
        @param	_soulboundId		    Soulbound id
    */
    function size(uint256 _soulboundId) external view returns (uint256);
}
