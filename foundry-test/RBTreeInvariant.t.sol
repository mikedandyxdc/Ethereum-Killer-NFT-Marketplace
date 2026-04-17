// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "contracts/RBTreeInvariantChecker.sol";

contract RBTreeInvariantTest is Test {
    RBTreeInvariantChecker public checker;

    function setUp() public {
        checker = new RBTreeInvariantChecker();
        checker.initializeTree();
    }

    // ════════════════════════════════════════════════════
    // INVARIANT HELPERS
    // ════════════════════════════════════════════════════

    function _assertAllInvariants(string memory context) internal {
        (
            bool rootBlack,
            bool noConsecutiveRed,
            bool equalBlackHeight,
            bool bstOrdering,
            bool sizeCorrect,
            bool parentPointersCorrect
        ) = checker.checkAllInvariants();

        assertTrue(rootBlack, string(abi.encodePacked(context, ": root must be black")));
        assertTrue(noConsecutiveRed, string(abi.encodePacked(context, ": no consecutive red nodes")));
        assertTrue(equalBlackHeight, string(abi.encodePacked(context, ": equal black-height on all paths")));
        assertTrue(bstOrdering, string(abi.encodePacked(context, ": BST ordering violated")));
        assertTrue(sizeCorrect, string(abi.encodePacked(context, ": size bookkeeping wrong")));
        assertTrue(parentPointersCorrect, string(abi.encodePacked(context, ": parent pointers inconsistent")));
    }

    // ════════════════════════════════════════════════════
    // FUZZ: INSERT SEQUENCES
    // ════════════════════════════════════════════════════

    /// @dev Insert up to 50 random tokens, check invariants after each
    function testFuzz_InsertSequence(uint256 seed) public {
        uint256 count = (seed % 50) + 1;
        uint256[] memory inserted = new uint256[](count);
        uint256 insertedCount = 0;

        for (uint256 i = 0; i < count; i++) {
            uint256 tokenId = uint256(keccak256(abi.encodePacked(seed, i))) % 10000;

            // Skip duplicates
            bool duplicate = false;
            for (uint256 j = 0; j < insertedCount; j++) {
                if (inserted[j] == tokenId) { duplicate = true; break; }
            }
            if (duplicate) continue;

            checker.insert(tokenId);
            inserted[insertedCount] = tokenId;
            insertedCount++;

            _assertAllInvariants(string(abi.encodePacked("after insert #", vm.toString(insertedCount))));
        }

        assertEq(checker.size(), insertedCount, "final size mismatch");
    }

    /// @dev Insert then remove all, check invariants after each operation
    function testFuzz_InsertThenRemoveAll(uint256 seed) public {
        uint256 count = (seed % 30) + 1;
        uint256[] memory inserted = new uint256[](count);
        uint256 insertedCount = 0;

        // Insert phase
        for (uint256 i = 0; i < count; i++) {
            uint256 tokenId = uint256(keccak256(abi.encodePacked(seed, i))) % 10000;

            bool duplicate = false;
            for (uint256 j = 0; j < insertedCount; j++) {
                if (inserted[j] == tokenId) { duplicate = true; break; }
            }
            if (duplicate) continue;

            checker.insert(tokenId);
            inserted[insertedCount] = tokenId;
            insertedCount++;
        }

        _assertAllInvariants("after all inserts");

        // Remove phase — remove in random order
        for (uint256 i = 0; i < insertedCount; i++) {
            // Pick a random remaining element
            uint256 remaining = insertedCount - i;
            uint256 idx = uint256(keccak256(abi.encodePacked(seed, "remove", i))) % remaining;

            checker.remove(inserted[idx]);

            // Swap removed with last remaining
            inserted[idx] = inserted[remaining - 1];

            if (remaining > 1) {
                _assertAllInvariants(string(abi.encodePacked("after remove #", vm.toString(i + 1))));
            }
        }

        assertEq(checker.size(), 0, "tree should be empty after removing all");
    }

    /// @dev Interleaved insert and remove operations
    function testFuzz_InterleavedInsertRemove(uint256 seed) public {
        uint256 ops = (seed % 60) + 10;
        uint256[] memory present = new uint256[](ops);
        uint256 presentCount = 0;

        for (uint256 i = 0; i < ops; i++) {
            uint256 action = uint256(keccak256(abi.encodePacked(seed, "action", i))) % 3;

            if (action < 2 || presentCount == 0) {
                // Insert (2/3 probability, or forced if tree is empty)
                uint256 tokenId = uint256(keccak256(abi.encodePacked(seed, "token", i))) % 10000;

                bool duplicate = false;
                for (uint256 j = 0; j < presentCount; j++) {
                    if (present[j] == tokenId) { duplicate = true; break; }
                }
                if (duplicate) continue;

                checker.insert(tokenId);
                present[presentCount] = tokenId;
                presentCount++;
            } else {
                // Remove (1/3 probability)
                uint256 idx = uint256(keccak256(abi.encodePacked(seed, "rmidx", i))) % presentCount;
                checker.remove(present[idx]);
                present[idx] = present[presentCount - 1];
                presentCount--;
            }

            _assertAllInvariants(string(abi.encodePacked("after op #", vm.toString(i + 1))));
        }

        assertEq(checker.size(), presentCount, "final size mismatch");
    }

    // ════════════════════════════════════════════════════
    // FUZZ: ASCENDING & DESCENDING INSERT PATTERNS
    // ════════════════════════════════════════════════════

    /// @dev Worst case for naive BST: ascending insertion
    function testFuzz_AscendingInsert(uint256 seed) public {
        uint256 count = (seed % 100) + 5;
        uint256 start = seed % 5000;

        for (uint256 i = 0; i < count; i++) {
            checker.insert(start + i);
        }

        _assertAllInvariants("after ascending insert");
        assertEq(checker.size(), count);
    }

    /// @dev Worst case for naive BST: descending insertion
    function testFuzz_DescendingInsert(uint256 seed) public {
        uint256 count = (seed % 100) + 5;
        uint256 start = (seed % 5000) + 200;

        for (uint256 i = 0; i < count; i++) {
            checker.insert(start - i);
        }

        _assertAllInvariants("after descending insert");
        assertEq(checker.size(), count);
    }

    // ════════════════════════════════════════════════════
    // FUZZ: HEAVY REMOVAL PATTERNS
    // ════════════════════════════════════════════════════

    /// @dev Insert many, remove from the middle (stresses rebalancing)
    function testFuzz_RemoveMiddleElements(uint256 seed) public {
        uint256 count = (seed % 40) + 10;

        // Insert 0..count-1
        for (uint256 i = 0; i < count; i++) {
            checker.insert(i);
        }

        _assertAllInvariants("after initial insert");

        // Remove the middle third
        uint256 removeStart = count / 3;
        uint256 removeEnd = (count * 2) / 3;
        for (uint256 i = removeStart; i < removeEnd; i++) {
            checker.remove(i);
            _assertAllInvariants(string(abi.encodePacked("after removing ", vm.toString(i))));
        }

        assertEq(checker.size(), count - (removeEnd - removeStart));
    }

    /// @dev Remove root repeatedly (forces root rebalancing)
    function testFuzz_RepeatedRootRemoval(uint256 seed) public {
        uint256 count = (seed % 30) + 10;

        for (uint256 i = 0; i < count; i++) {
            checker.insert(i);
        }

        // Remove the root node count/2 times
        for (uint256 i = 0; i < count / 2; i++) {
            uint256 currentRoot = checker.root();
            if (currentRoot == type(uint256).max) break; // NULL_NODE
            checker.remove(currentRoot);
            _assertAllInvariants(string(abi.encodePacked("after root removal #", vm.toString(i + 1))));
        }
    }

    // ════════════════════════════════════════════════════
    // FUZZ: LARGE TREE
    // ════════════════════════════════════════════════════

    /// @dev Insert 200 elements (simulates moderate-size tree)
    function testFuzz_LargeTree(uint256 seed) public {
        uint256 count = 200;
        uint256[] memory inserted = new uint256[](count);
        uint256 insertedCount = 0;

        for (uint256 i = 0; i < count; i++) {
            uint256 tokenId = uint256(keccak256(abi.encodePacked(seed, i))) % 50000;

            bool duplicate = false;
            for (uint256 j = 0; j < insertedCount; j++) {
                if (inserted[j] == tokenId) { duplicate = true; break; }
            }
            if (duplicate) continue;

            checker.insert(tokenId);
            inserted[insertedCount] = tokenId;
            insertedCount++;
        }

        _assertAllInvariants("after 200 inserts");

        // Remove half randomly
        for (uint256 i = 0; i < insertedCount / 2; i++) {
            uint256 remaining = insertedCount - i;
            uint256 idx = uint256(keccak256(abi.encodePacked(seed, "rm", i))) % remaining;
            checker.remove(inserted[idx]);
            inserted[idx] = inserted[remaining - 1];
        }

        _assertAllInvariants("after removing half");
    }

    // ════════════════════════════════════════════════════
    // DETERMINISTIC EDGE CASES
    // ════════════════════════════════════════════════════

    function test_EmptyTree() public {
        _assertAllInvariants("empty tree");
        assertEq(checker.size(), 0);
    }

    function test_SingleElement() public {
        checker.insert(42);
        _assertAllInvariants("single element");
        assertEq(checker.size(), 1);

        checker.remove(42);
        assertEq(checker.size(), 0);
    }

    function test_TwoElements() public {
        checker.insert(10);
        checker.insert(20);
        _assertAllInvariants("two elements");

        checker.remove(10);
        _assertAllInvariants("after removing first");
        assertEq(checker.size(), 1);
    }

    function test_ThreeElements_AllRotationCases() public {
        // Left-left case
        checker.insert(30);
        checker.insert(20);
        checker.insert(10);
        _assertAllInvariants("left-left rotation");

        // Clean up
        checker.remove(10);
        checker.remove(20);
        checker.remove(30);

        // Right-right case
        checker.insert(10);
        checker.insert(20);
        checker.insert(30);
        _assertAllInvariants("right-right rotation");

        checker.remove(10);
        checker.remove(20);
        checker.remove(30);

        // Left-right case
        checker.insert(30);
        checker.insert(10);
        checker.insert(20);
        _assertAllInvariants("left-right rotation");

        checker.remove(10);
        checker.remove(20);
        checker.remove(30);

        // Right-left case
        checker.insert(10);
        checker.insert(30);
        checker.insert(20);
        _assertAllInvariants("right-left rotation");
    }

    function test_InsertRemoveInsertSameId() public {
        checker.insert(100);
        _assertAllInvariants("first insert");
        checker.remove(100);
        assertEq(checker.size(), 0);
        checker.insert(100);
        _assertAllInvariants("re-insert after remove");
        assertEq(checker.size(), 1);
    }
}
