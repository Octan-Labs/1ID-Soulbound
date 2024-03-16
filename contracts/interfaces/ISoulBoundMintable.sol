// SPDX-License-Identifier: None
pragma solidity ^0.8.0;

interface ISoulBoundMintable {
    /**
       	@notice Assign `soulboundId` to `owner`
       	@dev  Caller must have Minter role
		    @param	owner				        Address of soulbound's owner
        @param	soulboundId				Soulbound id

        Note: One `owner` is assigned ONLY one `soulboundId` that binds to off-chain profile
    */
    function issue(address owner, uint256 soulboundId) external;

    /**
       	@notice Unlink `soulboundId` to its `owner`
       	@dev  Caller must have Minter role
        @param	soulboundId				Soulbound id

        Note: After revoke, the update is:
        - `soulboundId` -> `owner` is unlinked, but
        - `owner` -> `soulboundId` is still linked
    */
    function revoke(uint256 soulboundId) external;

    /**
       	@notice Change `soulboundId` to new `owner`
       	@dev  Caller must have Minter role
        @param	soulboundId				Soulbound id
        @param	from				        Address of a current `owner`
        @param	to				            Address of a new `owner`

        Note: Change address from `from` to `to` does not mean ownership transfer
        Instead, it indicates which account is currently set as Primary
        Using `linkedAccounts()` can query all accounts that are linked to `soulboundId`
    */
    function change(uint256 soulboundId, address from, address to) external;
}
