// SPDX-License-Identifier: MIT
// contracts/RedBlackTreeLibTest.sol
pragma solidity ^0.8.0;
// pragma experimental ABIEncoderV2;

import "./OrderStatisticsTree.sol";

contract OrderStatisticsTreeTest {
    using OrderStatisticsTree for OrderStatisticsTree.Tree;
    OrderStatisticsTree.Tree private tree;

    function initializeTree(OrderStatisticsTree.ComparatorType comparatorType) public {
        tree.initializeTree(comparatorType);
    }

    function insert(uint256 price, uint256 tokenId) public {
        OrderStatisticsTree.PriceToken memory newToken = OrderStatisticsTree.PriceToken({
            price: price,
            tokenId: tokenId
        });
        // tree.insert(newToken, tokenId);
        tree.insertPriceToken(newToken);
    }

    // function printTree() public view returns (string memory) {
    //     return tree.getTreeStructure();
    // }

    function remove(uint256 tokenId) public {
        tree.remove(tokenId);
    }

    function getPriceTokenByIndex(uint256 index) public view returns (OrderStatisticsTree.PriceToken memory) {
        return tree.select(index + 1).priceToken;
    }

    function getPriceTokenByIndexZero() public view returns (OrderStatisticsTree.PriceToken memory) {
        return tree.select(0).priceToken;
    }

    function getNodeByTokenId(uint256 tokenId) public view returns (OrderStatisticsTree.Node memory) {
        return tree.nodes[tokenId];
    }

    function getPriceTokenByTokenId(uint256 tokenId) public view returns (OrderStatisticsTree.PriceToken memory) {
        return tree.nodes[tokenId].priceToken;
    }

    function getMin() public view returns (OrderStatisticsTree.PriceToken memory) {
        return getPriceTokenByTokenId(tree.minimum(tree.root));
    }

    // function getMax() public view returns (RedBlackTreeLib.PriceToken memory) {
    //     return tree.getPriceTokenByTokenId(tree.last());
    // }

    function size() public view returns (uint256) {
        return tree.nodes[tree.root].size;
    }

    function root() public view returns (uint256) {
        return tree.root;
    }

        function height() public view returns (uint256) {
        return tree.getTreeHeight();
    }

    function getPriceTokenRange(uint256 start, uint256 count) 
        public view returns (OrderStatisticsTree.PriceToken[] memory)
    {
        // return tree.getPriceTokenRange_PriceTokenId(start, count);
        return tree.getPriceTokenRange_PriceTokenId(start, count, true);
    }

    function getPriceTokenRangeReverse(uint256 start, uint256 count) 
        public view returns (OrderStatisticsTree.PriceToken[] memory)
    {
        // return tree.getPriceTokenRange_PriceTokenIdReverse(start, count);
        return tree.getPriceTokenRange_PriceTokenId(start, count, false);
    }
}