// SPDX-License-Identifier: MIT
// contracts/CustomMinHeapLibTest.sol
pragma solidity ^0.8.0;
// pragma experimental ABIEncoderV2;

import "./CustomMinHeapLib.sol";

contract CustomMinHeapLibTest {
    using CustomMinHeapLib for CustomMinHeapLib.Heap;
    CustomMinHeapLib.Heap private heap;

function insert(uint256 price, uint256 tokenId) public {
    CustomMinHeapLib.PriceToken memory newToken = CustomMinHeapLib.PriceToken({
        price: price,
        tokenId: tokenId
    });
    heap.insert(newToken);
}

    function remove(uint256 tokenId) public {
        heap.remove(tokenId);
    }

    // Modify the function to return struct components individually
    function getMin() public view returns (CustomMinHeapLib.PriceToken memory) {
        return heap.getMin();
    }
    
    function size() public view returns (uint256) {
        return heap.size();
    }
}