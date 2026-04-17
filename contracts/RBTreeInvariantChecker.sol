// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./OrderStatisticsTree.sol";

/// @dev Test-only contract that exposes red-black tree internals for invariant verification
contract RBTreeInvariantChecker {
    using OrderStatisticsTree for OrderStatisticsTree.Tree;
    OrderStatisticsTree.Tree private tree;

    uint256 private constant NULL_NODE = 2**256 - 1;

    function initializeTree() public {
        tree.initializeTree(OrderStatisticsTree.ComparatorType.TOKENID);
    }

    function insert(uint256 tokenId) public {
        tree.insertTokenId(tokenId);
    }

    function remove(uint256 tokenId) public {
        tree.remove(tokenId);
    }

    function size() public view returns (uint256) {
        return tree.nodes[tree.root].size;
    }

    function root() public view returns (uint256) {
        return tree.root;
    }

    function getNode(uint256 id) public view returns (
        uint256 left, uint256 right, uint256 parent,
        uint256 nodeSize, bool isRed, bool initialized
    ) {
        OrderStatisticsTree.Node storage n = tree.nodes[id];
        return (n.left, n.right, n.parent, n.size, n.color == OrderStatisticsTree.Color.RED, n.initialized);
    }

    // ── Invariant 1: Root is black ──
    function checkRootIsBlack() public view returns (bool) {
        if (tree.root == NULL_NODE) return true;
        return tree.nodes[tree.root].color == OrderStatisticsTree.Color.BLACK;
    }

    // ── Invariant 2: No two consecutive red nodes ──
    // Returns true if valid, false if a red node has a red child
    function checkNoConsecutiveRed() public view returns (bool) {
        if (tree.root == NULL_NODE) return true;
        return _checkNoConsecutiveRed(tree.root);
    }

    function _checkNoConsecutiveRed(uint256 nodeId) private view returns (bool) {
        if (nodeId == NULL_NODE) return true;

        OrderStatisticsTree.Node storage node = tree.nodes[nodeId];

        if (node.color == OrderStatisticsTree.Color.RED) {
            // Red node's children must be black
            if (node.left != NULL_NODE && tree.nodes[node.left].color == OrderStatisticsTree.Color.RED) {
                return false;
            }
            if (node.right != NULL_NODE && tree.nodes[node.right].color == OrderStatisticsTree.Color.RED) {
                return false;
            }
        }

        return _checkNoConsecutiveRed(node.left) && _checkNoConsecutiveRed(node.right);
    }

    // ── Invariant 3: Equal black-height on all paths ──
    // Returns the black-height if valid, or 2**256-1 if invalid
    function checkBlackHeight() public view returns (bool) {
        if (tree.root == NULL_NODE) return true;
        return _blackHeight(tree.root) != NULL_NODE;
    }

    function _blackHeight(uint256 nodeId) private view returns (uint256) {
        if (nodeId == NULL_NODE) return 1; // NULL nodes are black

        uint256 leftBH = _blackHeight(tree.nodes[nodeId].left);
        uint256 rightBH = _blackHeight(tree.nodes[nodeId].right);

        // If either subtree is invalid, propagate failure
        if (leftBH == NULL_NODE || rightBH == NULL_NODE) return NULL_NODE;
        // Left and right black-heights must match
        if (leftBH != rightBH) return NULL_NODE;

        // Add 1 if this node is black
        if (tree.nodes[nodeId].color == OrderStatisticsTree.Color.BLACK) {
            return leftBH + 1;
        }
        return leftBH;
    }

    // ── Invariant 4: BST ordering (for TOKENID comparator: left < node < right) ──
    function checkBSTOrdering() public view returns (bool) {
        if (tree.root == NULL_NODE) return true;
        return _checkBST(tree.root, 0, NULL_NODE - 1);
    }

    function _checkBST(uint256 nodeId, uint256 minVal, uint256 maxVal) private view returns (bool) {
        if (nodeId == NULL_NODE) return true;

        uint256 tokenId = tree.nodes[nodeId].tokenId;
        if (tokenId < minVal || tokenId > maxVal) return false;

        // Left subtree: all values < tokenId
        // Right subtree: all values > tokenId
        // Guard against underflow: if tokenId == 0, left subtree must be empty
        bool leftOk = (tokenId == 0)
            ? (tree.nodes[nodeId].left == NULL_NODE)
            : _checkBST(tree.nodes[nodeId].left, minVal, tokenId - 1);

        bool rightOk = (tokenId == NULL_NODE - 1)
            ? (tree.nodes[nodeId].right == NULL_NODE)
            : _checkBST(tree.nodes[nodeId].right, tokenId + 1, maxVal);

        return leftOk && rightOk;
    }

    // ── Invariant 5: Size bookkeeping (node.size = left.size + right.size + 1) ──
    function checkSizeBookkeeping() public view returns (bool) {
        if (tree.root == NULL_NODE) return true;
        return _checkSize(tree.root);
    }

    function _checkSize(uint256 nodeId) private view returns (bool) {
        if (nodeId == NULL_NODE) return true;

        OrderStatisticsTree.Node storage node = tree.nodes[nodeId];
        uint256 leftSize = (node.left == NULL_NODE) ? 0 : tree.nodes[node.left].size;
        uint256 rightSize = (node.right == NULL_NODE) ? 0 : tree.nodes[node.right].size;

        if (node.size != leftSize + rightSize + 1) return false;

        return _checkSize(node.left) && _checkSize(node.right);
    }

    // ── Invariant 6: Parent pointers are consistent ──
    function checkParentPointers() public view returns (bool) {
        if (tree.root == NULL_NODE) return true;
        // Root's parent should be NULL_NODE
        if (tree.nodes[tree.root].parent != NULL_NODE) return false;
        return _checkParent(tree.root);
    }

    function _checkParent(uint256 nodeId) private view returns (bool) {
        if (nodeId == NULL_NODE) return true;

        OrderStatisticsTree.Node storage node = tree.nodes[nodeId];

        if (node.left != NULL_NODE) {
            if (tree.nodes[node.left].parent != nodeId) return false;
        }
        if (node.right != NULL_NODE) {
            if (tree.nodes[node.right].parent != nodeId) return false;
        }

        return _checkParent(node.left) && _checkParent(node.right);
    }

    // ── All invariants at once ──
    function checkAllInvariants() public view returns (
        bool rootBlack,
        bool noConsecutiveRed,
        bool equalBlackHeight,
        bool bstOrdering,
        bool sizeCorrect,
        bool parentPointersCorrect
    ) {
        rootBlack = checkRootIsBlack();
        noConsecutiveRed = checkNoConsecutiveRed();
        equalBlackHeight = checkBlackHeight();
        bstOrdering = checkBSTOrdering();
        sizeCorrect = checkSizeBookkeeping();
        parentPointersCorrect = checkParentPointers();
    }
}
