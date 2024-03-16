// SPDX-License-Identifier: None
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "../interfaces/IAttribute.sol";

contract Attribute is IAttribute {
    using EnumerableSet for EnumerableSet.UintSet;
    using Strings for uint256;

    //  A set of available Attributes
    EnumerableSet.UintSet private attributes_;

    /**
       	@notice Check whether `_attributeId` exists
       	@dev  Caller can be ANY
        @param	attributeId				    Number ID of Attribute type
    */
    function isValidAttribute(
        uint256 attributeId
    ) public view virtual override returns (bool) {
        return _attribute().contains(attributeId);
    }

    /**
       	@notice Get size of Attributes currently available
       	@dev  Caller can be ANY
    */
    function numOfAttributes()
        external
        view
        virtual
        override
        returns (uint256)
    {
        return _attribute().length();
    }

    /**
       	@notice Get a list of available Attributes
       	@dev  Caller can be ANY
        @param	fromIdx				    Starting index in a list
        @param	toIdx				        Ending index in a list
    */
    function listOfAttributes(
        uint256 fromIdx,
        uint256 toIdx
    ) external view virtual override returns (uint256[] memory attributeIds) {
        EnumerableSet.UintSet storage list = _attribute();
        uint256 len = toIdx - fromIdx + 1;
        attributeIds = new uint256[](len);

        for (uint256 i; i < len; i++) attributeIds[i] = list.at(fromIdx + i);
    }

    /**
       	@notice Retrieve Attribute's URI of `_soulboundId`
       	@dev  Caller can be ANY
        @param	soulboundId				    Soulbound Id
        @param	attributeId				    Number ID of Attribute type
    */
    function attributeURI(
        uint256 soulboundId,
        uint256 attributeId
    ) external view virtual override returns (string memory) {
        require(isValidAttribute(attributeId), "Attribute not recorded");

        string memory baseURI = _baseURI();
        return
            bytes(baseURI).length > 0
                ? string(
                    abi.encodePacked(
                        _baseURI(),
                        soulboundId.toString(),
                        "/",
                        attributeId.toString()
                    )
                )
                : "";
    }

    function _setAttribute(uint256 attributeId) internal virtual {
        require(!isValidAttribute(attributeId), "Attribute already set");
        _attribute().add(attributeId);

        emit Set(address(this), attributeId);
    }

    function _removeAttribute(uint256 attributeId) internal virtual {
        require(isValidAttribute(attributeId), "Attribute not recorded");
        _attribute().remove(attributeId);

        emit Removed(address(this), attributeId);
    }

    function _baseURI() internal view virtual returns (string memory) {
        return "";
    }

    function _attribute() private view returns (EnumerableSet.UintSet storage) {
        return attributes_;
    }
}
