// SPDX-License-Identifier: None
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract Management is AccessControlEnumerable, Pausable {
    //  Declare Roles - MANAGER_ROLE and MINTER_ROLE
    //  There are three roles:
    //     - Top Gun = DEFAULT_ADMIN_ROLE:
    //         + Manages governance settings
    //         + Has an authority to grant/revoke other roles
    //         + Has an authority to set him/herself other roles
    //     - MANAGER_ROLE
    //         + Has an authority to do special tasks, i.e. settings
    //     - MINTER_ROLE
    //         + Has an authority to issue/burn SoulBound tokens
    //     - OPERATOR_ROLE
    //         + Grant a special privilege to submit responses
    //     - AUTHORIZER_ROLE
    //         + Has an authority to sign and to provide authorized signatures
    bytes32 private constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 private constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 private constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 private constant AUTHORIZER_ROLE = keccak256("AUTHORIZER_ROLE");

    address public treasury;

    //  A mapping of blacklisted `_account`
    mapping(address => bool) public blacklist;

    //  A mapping of whitelisted `_account`
    mapping(address => bool) public whitelist;

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /**
       	@notice Set `paused = true`
       	@dev  Caller must have MANAGER_ROLE
    */
    function pause() external onlyRole(MANAGER_ROLE) {
        _pause();
    }

    /**
       	@notice Set `paused = false`
       	@dev  Caller must have MANAGER_ROLE
    */
    function unpause() external onlyRole(MANAGER_ROLE) {
        _unpause();
    }

    /**
        @notice Change new address of Treasury
        @dev  Caller must have DEFAULT_ADMIN_ROLE
        @param treasury_    Address of new Treasury
    */
    function setTreasury(
        address treasury_
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(treasury_ != address(0), "AddressZero");

        treasury = treasury_;
    }

    /**
       	@notice Add a list of `_account` into whitelist/blacklist
       	@dev  Caller must have MANAGER_ROLE
		    @param	option				  Request option 
            option = 1: add whitelist
            option = 2: remove whitelist
            option = 3: add blacklist
            option = 4: remove blacklist
        @param	accounts				A list of `_account`
    */
    function addToList(
        uint256 option,
        address[] calldata accounts
    ) external onlyRole(MANAGER_ROLE) {
        if (option == 1) _setWhitelist(accounts, false);
        else if (option == 2) _setWhitelist(accounts, true);
        else if (option == 3) _setBlacklist(accounts, false);
        else if (option == 4) _setBlacklist(accounts, true);
        else revert("Invalid option");
    }

    function _setBlacklist(
        address[] calldata accounts,
        bool isRemoved
    ) private {
        uint256 len = accounts.length;
        for (uint256 i; i < len; i++) _blacklist(accounts[i], isRemoved);
    }

    function _setWhitelist(
        address[] calldata accounts,
        bool isRemoved
    ) private {
        uint256 len = accounts.length;
        for (uint256 i; i < len; i++) _whitelist(accounts[i], isRemoved);
    }

    function _blacklist(address account, bool isRemoved) private {
        if (isRemoved) delete blacklist[account];
        else blacklist[account] = true;
    }

    function _whitelist(address account, bool isRemoved) private {
        if (isRemoved) delete whitelist[account];
        else whitelist[account] = true;
    }
}
