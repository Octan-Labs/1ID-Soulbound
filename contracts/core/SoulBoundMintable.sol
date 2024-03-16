// SPDX-License-Identifier: None
pragma solidity ^0.8.0;

import "../interfaces/ISoulBoundMintable.sol";
import "../interfaces/IManagement.sol";
import "./SoulBound.sol";
import "./Attribute.sol";

contract SoulBoundMintable is SoulBound, Attribute, ISoulBoundMintable {
    bytes32 internal constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 internal constant MINTER_ROLE = keccak256("MINTER_ROLE");

    //  Address of Management contract
    IManagement public management;

    string private _uri;

    modifier hasRole(bytes32 role) {
        require(management.hasRole(role, _msgSender()), "Unauthorized");
        _;
    }

    modifier whenNotPause() {
        require(!management.paused(), "Paused");
        _;
    }

    constructor(
        IManagement management_,
        string memory name,
        string memory symbol,
        string memory uri
    ) SoulBound(name, symbol) Attribute() {
        management = management_;
        _uri = uri;
    }

    /**
       	@notice Update Address of Management contract
       	@dev  Caller must have MANAGER_ROLE
		    @param	management_				Address of new Management contract
    */
    function setManagement(
        address management_
    ) external virtual hasRole(MANAGER_ROLE) {
        require(Address.isContract(management_), "Must be a contract");
        management = IManagement(management_);
    }

    /**
       	@notice Update new string of `baseURI`
       	@dev  Caller must have MANAGER_ROLE
		    @param	uri				New string of `baseURI`
    */
    function setBaseURI(string calldata uri) external hasRole(MANAGER_ROLE) {
        _uri = uri;
    }

    /**
       	@notice Add/Remove the supporting Attributes in the SoulBound contract
       	@dev  Caller must have MANAGER_ROLE
		    @param	attributeId				  Number ID of Attribute type
        @param	isRemoved				    Boolean (Remove = true, Add = false)
    */
    function setAttribute(
        uint256 attributeId,
        bool isRemoved
    ) external hasRole(MANAGER_ROLE) {
        if (!isRemoved) _setAttribute(attributeId);
        else _removeAttribute(attributeId);
    }

    /**
       	@notice Assign `soulboundId` to `owner`
       	@dev  Caller must have MINTER_ROLE
		    @param	owner				        Address of soulbound's owner
        @param	soulboundId				  Soulbound id

        Note: One `owner` is assigned ONLY one `soulboundId` that binds to an off-chain profile
    */
    function issue(
        address owner,
        uint256 soulboundId
    ) external virtual override hasRole(MINTER_ROLE) {
        _issue(owner, soulboundId);
    }

    /**
       	@notice Unlink `soulboundId` to its `owner`
       	@dev  Caller must have MINTER_ROLE
        @param	soulboundId				Soulbound id

        Note: After revoke, the update is:
        - `soulboundId` -> `owner` is unlinked, but
        - `owner` -> `soulboundId` is still linked
    */
    function revoke(
        uint256 soulboundId
    ) external virtual override hasRole(MINTER_ROLE) {
        _revoke(soulboundId);
    }

    /**
       	@notice Change `soulboundId` to new `owner`
       	@dev  Caller must have MINTER_ROLE
        @param	soulboundId				Soulbound id
        @param	from				        Address of a current `owner`
        @param	to				          Address of a new `owner`

        Note: Change address from `from` to `to` does not mean ownership transfer
        Instead, it indicates which account is currently set as Primary
        Using `linkedAccounts()` can query all accounts that are linked to `soulboundId`
    */
    function change(
        uint256 soulboundId,
        address from,
        address to
    ) external virtual override hasRole(MINTER_ROLE) {
        _change(soulboundId, from, to);
    }

    function _baseURI()
        internal
        view
        override(SoulBound, Attribute)
        returns (string memory)
    {
        return _uri;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 soulboundId
    ) internal virtual override whenNotPause {
        super._beforeTokenTransfer(from, to, soulboundId);
    }
}
