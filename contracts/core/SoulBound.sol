// SPDX-License-Identifier: None
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "../interfaces/IERC721Metadata.sol";
import "../interfaces/ISoulBound.sol";

contract SoulBound is Context, ERC165, ISoulBound, IERC721Metadata {
    using EnumerableSet for EnumerableSet.AddressSet;
    using Address for address;
    using Strings for uint256;

    //  Total SoulBound tokens have been released
    uint256 private _totalSupply;

    // Token name
    string private _name;

    // Token symbol
    string private _symbol;

    // Mapping from token ID to last owner address and its status
    mapping(uint256 => address) private _owners;

    // Mapping from owner address to token ID
    mapping(address => uint256) private _tokens;

    // Mapping a list of revoked token ID
    mapping(uint256 => bool) private _revoked;

    // Archive list of token ID to owner addresses
    mapping(uint256 => EnumerableSet.AddressSet) private _archives;

    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC165, IERC165) returns (bool) {
        return
            interfaceId == type(ISoulBound).interfaceId ||
            interfaceId == type(IERC721Metadata).interfaceId ||
            interfaceId == type(IERC721Receiver).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /**
       	@notice Get name of SoulBound Token
       	@dev  Caller can be ANY
    */
    function name() public view virtual override returns (string memory) {
        return _name;
    }

    /**
       	@notice Get symbol of SoulBound Token
       	@dev  Caller can be ANY
    */
    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

    /**
       	@notice Get total minted SoulBound tokens
       	@dev  Caller can be ANY
    */
    function totalSupply() public view virtual override returns (uint256) {
        return _totalSupply;
    }

    /**
       	@notice Get owner of `soulboundId`
       	@dev  Caller can be ANY
        @param	soulboundId				Soulbound Id
    */
    function ownerOf(
        uint256 soulboundId
    ) public view virtual override returns (address) {
        address owner = _ownerOf(soulboundId);
        require(owner != address(0), "SoulBound: invalid soulbound ID");

        return owner;
    }

    /**
       	@notice Get current `soulboundId` that is assigned to `owner`
       	@dev  Caller can be ANY
        @param	owner				Address of querying account
    */
    function tokenOf(
        address owner
    ) external view virtual override returns (uint256) {
        require(
            owner != address(0),
            "SoulBound: address zero is not a valid owner"
        );
        (uint256 soulboundId, bool assigned) = _isAssigned(owner);
        require(assigned, "SoulBound: account not yet assigned a soulbound");

        return soulboundId;
    }

    /**
       	@notice Get URI of `soulboundId`
       	@dev  Caller can be ANY
        @param	soulboundId				Soulbound Id
    */
    function tokenURI(
        uint256 soulboundId
    ) public view virtual override returns (string memory) {
        _requireMinted(soulboundId);

        string memory baseURI = _baseURI();
        return
            bytes(baseURI).length > 0
                ? string(abi.encodePacked(baseURI, soulboundId.toString()))
                : "";
    }

    /**
       	@notice Get total number of accounts that linked to `soulboundId`
       	@dev  Caller can be ANY
        @param	soulboundId				Soulbound Id
    */
    function numOfLinkedAccounts(
        uint256 soulboundId
    ) external view virtual override returns (uint256) {
        return _numOfLinkedAccounts(soulboundId);
    }

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
    ) external view virtual override returns (address[] memory accounts) {
        uint256 len = toIndex - fromIndex + 1;
        accounts = new address[](len);

        for (uint256 i; i < len; i++)
            accounts[i] = _linkedAccountAt(soulboundId, fromIndex + i);
    }

    /**
       	@notice Checking if `soulboundId` is assigned, but revoked
       	@dev  Caller can be ANY
        @param	soulboundId				Soulbound Id
    */
    function isRevoked(
        uint256 soulboundId
    ) public view virtual override returns (bool) {
        return _revoked[soulboundId];
    }

    function _issue(address owner, uint256 soulboundId) internal virtual {
        _safeMint(owner, soulboundId);

        emit Issued(soulboundId, owner);
    }

    function _revoke(uint256 soulboundId) internal virtual {
        address owner = ownerOf(soulboundId);
        _revokeOwnership(owner, soulboundId);

        emit Revoked(soulboundId, owner);
    }

    /**
        Requirements to change `soulboundId` between two accounts - `from` and `to`
        - `soulboundId` is currently active (minted and not revoked)
        - `soulboundId` must be owned by `from`
        - `to`:
            - Should not yet assigne to any soulbound
            - If assigned, that assigned soulbound, that linked to `to`, must have Id that matches `soulboundId`
        Note: 
            - Contract cannot verify that `from` and `to` has relationship to soulbound's owner
            thus, this operation must be executed by Authorizer and it must go through a process of verification
    */
    function _change(
        uint256 soulboundId,
        address from,
        address to
    ) internal virtual {
        address owner = ownerOf(soulboundId);
        require(owner == from, "SoulBound: soulbound not owned by owner");
        (uint256 prevId, bool assigned) = _isAssigned(to);
        require(
            !assigned || (assigned && prevId == soulboundId),
            "SoulBound: account already assigned a different soulbound"
        );
        _revokeOwnership(owner, soulboundId);
        _reset(soulboundId);

        require(
            _checkOnERC721Received(address(0), to, soulboundId, ""),
            "SoulBound: transfer to non ERC721Receiver implementer"
        );
        _setOwnership(to, soulboundId);

        emit Changed(soulboundId, from, to);
    }

    /**
     * @dev Safely mints `soulboundId` and transfers it to `to`.
     * Requirements:
     * - `soulboundId` must not exist.
     * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.
     * Emits a {Transfer} event.
     */
    function _safeMint(address to, uint256 soulboundId) internal virtual {
        _safeMint(to, soulboundId, "");
    }

    /**
     * @dev Same as {xref-ERC721-_safeMint-address-uint256-}[`_safeMint`], with an additional `data` parameter which is
     * forwarded in {IERC721Receiver-onERC721Received} to contract recipients.
     */
    function _safeMint(
        address to,
        uint256 soulboundId,
        bytes memory data
    ) internal virtual {
        _mint(to, soulboundId);
        require(
            _checkOnERC721Received(address(0), to, soulboundId, data),
            "SoulBound: transfer to non ERC721Receiver implementer"
        );
    }

    /**
     * @dev Mints `soulboundId` and transfers it to `to`.
     * WARNING: Usage of this method is discouraged, use {_safeMint} whenever possible
     * Requirements:
     * - `soulboundId` must not exist.
     * - `to` cannot be the zero address.
     * - `to` must not own any soulbound tokens or `soulboundId` must be the same as previous one
     * Emits a {Transfer} event.
     */
    function _mint(address to, uint256 soulboundId) internal virtual {
        require(to != address(0), "SoulBound: mint to the zero address");

        //  Two possible cases makes `!_exists(soulboundId) = true`:
        //  - `soulboundId` not minted yet
        //  - `soulboundId` has been revoked
        //  if revoked, must check whether `_archives[soulboundId]` contains `to`
        //  else, must check `to` not yet linked to any soulbound
        require(!_exists(soulboundId), "SoulBound: token already minted");
        if (isRevoked(soulboundId)) {
            require(
                _contain(soulboundId, to),
                "SoulBound: revoked soulbound not contain the account"
            );
            _reset(soulboundId);
        } else {
            (, bool assigned) = _isAssigned(to);
            require(
                !assigned,
                "SoulBound: account already assigned a soulbound"
            );
        }
        _setOwnership(to, soulboundId);
    }

    /**
     * @dev Destroys `soulboundId`.
     * Requirements:
     * - `soulboundId` must exist.
     * Emits a {Transfer} event.
     */
    function _burn(uint256 soulboundId) internal virtual {
        address owner = ownerOf(soulboundId);
        _revokeOwnership(owner, soulboundId);
    }

    function _setOwnership(address to, uint256 soulboundId) internal virtual {
        _beforeTokenTransfer(address(0), to, soulboundId);

        // update current ownership of `soulboundId`
        // link `soulboundId` to `to`. Unable to unlink even soulbound token is revoked/burned
        // update `archives` list
        _owners[soulboundId] = to;
        _tokens[to] = soulboundId;
        _getArchive(soulboundId).add(to);
        _totalSupply++;

        emit Transfer(address(0), to, soulboundId);

        _afterTokenTransfer(address(0), to, soulboundId);
    }

    function _revokeOwnership(
        address owner,
        uint256 soulboundId
    ) internal virtual {
        _beforeTokenTransfer(owner, address(0), soulboundId);

        //  when soulbound is revoked/burned, only remove connection between `soulboundId` and `owner` in the `_owners` mapping
        //  and mark `_revoked[soulboundId] = true`
        //  `_archives`, and `_tokens` mappings remain unchanged
        delete _owners[soulboundId];
        _totalSupply--;
        _revoked[soulboundId] = true;

        emit Transfer(owner, address(0), soulboundId);

        _afterTokenTransfer(owner, address(0), soulboundId);
    }

    function _baseURI() internal view virtual returns (string memory) {
        return "";
    }

    /**
     * @dev Reverts if the `soulboundId` has not been minted yet.
     */
    function _requireMinted(uint256 soulboundId) internal view virtual {
        require(_exists(soulboundId), "SoulBound: invalid soulbound ID");
    }

    function _exists(uint256 soulboundId) internal view virtual returns (bool) {
        return _ownerOf(soulboundId) != address(0);
    }

    function _tokenOf(address owner) internal view virtual returns (uint256) {
        return _tokens[owner];
    }

    function _ownerOf(
        uint256 soulboundId
    ) internal view virtual returns (address) {
        return _owners[soulboundId];
    }

    function _getArchive(
        uint256 soulboundId
    ) internal view virtual returns (EnumerableSet.AddressSet storage) {
        return _archives[soulboundId];
    }

    function _contain(
        uint256 soulboundId,
        address account
    ) internal view virtual returns (bool) {
        return _getArchive(soulboundId).contains(account);
    }

    function _reset(uint256 soulboundId) internal virtual {
        delete _revoked[soulboundId];
    }

    function _isAssigned(
        address account
    ) internal view virtual returns (uint256 soulboundId, bool assigned) {
        //  Note: `account` must be non-zero address
        //  If tokenOf() returns:
        //  - non-zero -> `account` already assigned a soulbound
        //  - zero -> check whether `_archives[soulboundId = 0] contains `account`:
        //      - If yes -> return true
        //      - Otherwise -> return false
        soulboundId = _tokenOf(account);
        assigned = soulboundId == 0 ? _contain(soulboundId, account) : true;
    }

    function _numOfLinkedAccounts(
        uint256 soulboundId
    ) internal view virtual returns (uint256) {
        return _getArchive(soulboundId).length();
    }

    function _linkedAccountAt(
        uint256 soulboundId,
        uint256 index
    ) internal view virtual returns (address) {
        uint256 _totalLinkedAccounts = _numOfLinkedAccounts(soulboundId);
        require(
            _totalLinkedAccounts != 0,
            "SoulBound: id not linked to any accounts"
        );
        require(
            index <= _totalLinkedAccounts - 1,
            "SoulBound: index out of bounds"
        );

        return _getArchive(soulboundId).at(index);
    }

    function _checkOnERC721Received(
        address from,
        address to,
        uint256 soulboundId,
        bytes memory data
    ) private returns (bool) {
        if (to.isContract()) {
            try
                IERC721Receiver(to).onERC721Received(
                    _msgSender(),
                    from,
                    soulboundId,
                    data
                )
            returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert(
                        "SoulBound: transfer to non ERC721Receiver implementer"
                    );
                } else {
                    /// @solidity memory-safe-assembly
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        } else {
            return true;
        }
    }

    /**
     * @dev Hook that is called before any token transfer. This includes minting
     * and burning.
     * Calling conditions:
     * - When `from` and `to` are both non-zero, ``from``'s `soulboundId` will be
     * transferred to `to`.
     * - When `from` is zero, `soulboundId` will be minted for `to`.
     * - When `to` is zero, ``from``'s `soulboundId` will be burned.
     * - `from` and `to` are never both zero.
     * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 soulboundId
    ) internal virtual {}

    /**
     * @dev Hook that is called after any transfer of tokens. This includes
     * minting and burning.
     * Calling conditions:
     * - when `from` and `to` are both non-zero.
     * - `from` and `to` are never both zero.
     * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
     */
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 soulboundId
    ) internal virtual {}
}
