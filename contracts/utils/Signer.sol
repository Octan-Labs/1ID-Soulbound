// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract Signer is EIP712 {
    using ECDSA for bytes32;

    bytes32 private constant _UPDATE_RS =
        keccak256(
            "UpdateRS(address caller,address soulbound,uint256 soulboundId,address paymentToken,uint256 fee,bytes32 data,uint128 nonce,uint128 expiry)"
        );
    bytes32 private constant _ISSUE =
        keccak256(
            "Issue(bytes32 option,address caller,uint256 soulboundId,uint128 nonce,uint128 expiry)"
        );
    bytes32 private constant _REVOKE =
        keccak256(
            "Revoke(bytes32 option,address caller,uint256 soulboundId,uint128 nonce,uint128 expiry)"
        );
    bytes32 private constant _CHANGE =
        keccak256(
            "Change(uint256 soulboundId,address from,address to,uint128 nonce,uint128 expiry)"
        );

    constructor(
        string memory name,
        string memory version
    ) EIP712(name, version) {}

    function _getSignerOfUpdateRS(
        address caller,
        address soulbound,
        uint256 soulboundId,
        address paymentToken,
        uint256 fee,
        bytes32 data,
        uint256 nonce,
        uint256 expiry,
        bytes calldata signature
    ) internal view returns (address signer) {
        signer = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    _UPDATE_RS,
                    caller,
                    soulbound,
                    soulboundId,
                    paymentToken,
                    fee,
                    data,
                    uint128(nonce),
                    uint128(expiry)
                )
            )
        ).recover(signature);
    }

    function _getSignerOfIssue(
        bytes32 option,
        address caller,
        uint256 soulboundId,
        uint256 nonce,
        uint256 expiry,
        bytes calldata signature
    ) internal view returns (address signer) {
        signer = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    _ISSUE,
                    option,
                    caller,
                    soulboundId,
                    uint128(nonce),
                    uint128(expiry)
                )
            )
        ).recover(signature);
    }

    function _getSignerOfRevoke(
        bytes32 option,
        address caller,
        uint256 soulboundId,
        uint256 nonce,
        uint256 expiry,
        bytes calldata signature
    ) internal view returns (address signer) {
        signer = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    _REVOKE,
                    option,
                    caller,
                    soulboundId,
                    uint128(nonce),
                    uint128(expiry)
                )
            )
        ).recover(signature);
    }

    function _getSignerOfChange(
        uint256 soulboundId,
        address from,
        address to,
        uint256 nonce,
        uint256 expiry,
        bytes calldata signature
    ) internal view returns (address signer) {
        signer = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    _CHANGE,
                    soulboundId,
                    from,
                    to,
                    uint128(nonce),
                    uint128(expiry)
                )
            )
        ).recover(signature);
    }
}
