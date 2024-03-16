// SPDX-License-Identifier: None
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Address.sol";
import "../interfaces/IManagement.sol";
import "../interfaces/IReputation.sol";

contract Helper {
    using Address for address;

    bytes32 private constant VERSION = keccak256("Version 1");
    bytes32 private constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 private constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    uint256 private constant GENERAL_TYPE = 1;

    //  Address of Reputation SoulBound contract
    IReputation private _reputation;

    //  Address of Management contract
    IManagement public management;

    modifier hasRole(bytes32 role) {
        require(management.hasRole(role, msg.sender), "Unauthorized");
        _;
    }

    constructor(IManagement management_, IReputation reputation_) {
        management = management_;
        _reputation = reputation_;
    }

    /**
       	@notice Get address of Reputation SoulBound contract
       	@dev  Caller can be ANY
    */
    function reputation() public view returns (IReputation) {
        return _reputation;
    }

    /**
       	@notice Update Address of Management contract
       	@dev  Caller must have MANAGER_ROLE
		    @param	management_				Address of new Management contract
    */
    function setManagement(address management_) external hasRole(MANAGER_ROLE) {
        require(management_.isContract(), "Must be a contract");
        management = IManagement(management_);
    }

    /**
       	@notice Update new Address of Reputation SoulBound contract
       	@dev  Caller must have MANAGER_ROLE
		    @param	reputation_				Address of new Reputation contract
    */
    function setReputation(address reputation_) external hasRole(MANAGER_ROLE) {
        require(reputation_.isContract(), "Must be a contract");
        _reputation = IReputation(reputation_);
    }

    /**
       	@notice Assign `soulboundId` to `owner`
       	@dev  Caller must have Minter role
		    @param	owners				        A list of SoulBound's receivers
        @param	soulboundIds				  A list of minting `soulboundIds`

        Note: One `owner` is assigned ONLY one `soulboundId` that binds to off-chain profile
    */
    function issueBatch(
        address[] calldata owners,
        uint256[] calldata soulboundIds
    ) external hasRole(MINTER_ROLE) {
        uint256 len = owners.length;
        require(soulboundIds.length == len, "Length mismatch");

        IReputation reputation_ = reputation();
        for (uint256 i; i < len; i++)
            reputation_.issue(owners[i], soulboundIds[i]);
    }

    /**
       	@notice Unlink `soulboundId` to its `owner`
       	@dev  Caller must have Minter role
        @param	soulboundIds				A list of SoulBound IDs

        Note: After revoke, the update is:
        - `soulboundId` -> `owner` is unlinked, but
        - `owner` -> `soulboundId` is still linked
    */
    function revokeBatch(
        uint256[] calldata soulboundIds
    ) external hasRole(MINTER_ROLE) {
        uint256 len = soulboundIds.length;

        IReputation reputation_ = reputation();
        for (uint256 i; i < len; i++) reputation_.revoke(soulboundIds[i]);
    }

    /**
       	@notice Change `soulboundId` to new `owner`
       	@dev  Caller must have Minter role
        @param	soulboundIds				A list of SoulBound IDs
        @param	sources				      A list of current SoulBound's Owners
        @param	destinations				A list of new SoulBound's Owners

        Note: Change address from `source` to `destination` does not mean ownership transfer
        Instead, it indicates which account is currently set as Primary
        Using `linkedAccounts()` can query all accounts that are linked to `soulboundId`
    */
    function changeBatch(
        uint256[] calldata soulboundIds,
        address[] calldata sources,
        address[] calldata destinations
    ) external hasRole(MINTER_ROLE) {
        uint256 len = soulboundIds.length;
        require(
            sources.length == len && destinations.length == len,
            "Length mismatch"
        );

        IReputation reputation_ = reputation();
        for (uint256 i; i < len; i++)
            reputation_.change(soulboundIds[i], sources[i], destinations[i]);
    }
}
