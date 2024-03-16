// SPDX-License-Identifier: None
pragma solidity ^0.8.0;

interface IManagement {
    /**
       	@notice Get address of Treasury
       	@dev  Caller can be ANY
    */
    function treasury() external view returns (address);

    /**
       	@notice Verify `role` of `account`
       	@dev  Caller can be ANY
        @param	role				    Bytes32 hash role
        @param	account				Address of `account` that needs to check `role`
    */
    function hasRole(
        bytes32 role,
        address account
    ) external view returns (bool);

    /**
       	@notice Get status of `paused`
       	@dev  Caller can be ANY
    */
    function paused() external view returns (bool);

    /**
       	@notice Checking whether `account` is blacklisted
       	@dev  Caller can be ANY
        @param	account				Address of `account` that needs to check
    */
    function blacklist(address account) external view returns (bool);

    /**
       	@notice Checking whether `account` is whitelisted
       	@dev  Caller can be ANY
        @param	account				Address of `account` that needs to check
    */
    function whitelist(address account) external view returns (bool);
}
