// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract Authentication is EIP712 {
    using ECDSA for bytes32;

    bytes32 private constant _PROOF =
        keccak256(
            "Proof(bytes32 hashProof1, bytes32 hashProof2, bytes32 hashProof3)"
        );
    bytes32 private constant _AUTHENTICATE =
        keccak256(
            "Authenticate(uint256 soulboundId,uint256 random,uint256 expiry,Proof hash)Proof(bytes32 hashProof1, bytes32 hashProof2, bytes32 hashProof3)"
        );

    constructor(
        string memory name,
        string memory version
    ) EIP712(name, version) {}

    function _hashProof(
        bytes32[3] calldata _proof
    ) private pure returns (bytes32) {
        return keccak256(abi.encode(_PROOF, _proof[0], _proof[1], _proof[2]));
    }

    function _getSigner(
        uint256 _soulboundId,
        uint256 _random,
        uint256 _expiry,
        bytes32[3] calldata _proof,
        bytes calldata _signature
    ) internal view returns (address _signer) {
        _signer = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    _AUTHENTICATE,
                    _soulboundId,
                    _random,
                    _expiry,
                    _hashProof(_proof)
                )
            )
        ).recover(_signature);
    }
}
