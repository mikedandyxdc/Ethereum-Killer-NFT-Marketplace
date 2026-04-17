// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.0;
// // pragma experimental ABIEncoderV2;


// library CustomMinHeapLib {
//     struct PriceToken {
//         uint256 price;
//         uint256 tokenId;
//     }

//     struct Heap {
//         PriceToken[] data;
//         mapping(uint256 => uint256) tokenIdToIndex;
//     }

//     function insert(Heap storage self, PriceToken memory element) external {
//         require(self.data.length == 0 || (self.tokenIdToIndex[element.tokenId] == 0 && self.data[0].tokenId != element.tokenId), "TokenId already exists in the heap");
//         self.data.push(element);
//         uint256 index = self.data.length - 1;
//         self.tokenIdToIndex[element.tokenId] = index;
//         _heapifyUp(self, index);
//     }

//     function remove(Heap storage self, uint256 tokenId) external {
//         uint256 index = self.tokenIdToIndex[tokenId];
//         uint256 lastIndex = self.data.length - 1;

//         if (index != lastIndex) {
//             _swap(self, index, lastIndex);
//         }

//         self.data.pop();
//         delete self.tokenIdToIndex[tokenId];

//         // if (index < self.data.length) {
//         //     _heapifyDown(self, index);
//         //     if (index > 0) {
//         //         _heapifyUp(self, index);
//         //     }
//         // }
//         if (index < self.data.length) {
//             if (index > 0 && _compare(self.data[index], self.data[(index - 1) / 2]) < 0) {
//                 _heapifyUp(self, index);
//             } else {
//                 _heapifyDown(self, index);
//             }
//         }
//     }

//     function getMin(Heap storage self) external view returns (PriceToken memory) {
//         require(self.data.length > 0, "Heap is empty");
//         return self.data[0];
//     }

//     function size(Heap storage self) external view returns (uint256) {
//         return self.data.length;
//     }

//     function _heapifyUp(Heap storage self, uint256 index) internal {
//         uint256 parentIndex;
//         PriceToken memory element = self.data[index];
//         while (index > 0) {
//             parentIndex = (index - 1) / 2;
//             if (_compare(element, self.data[parentIndex]) < 0) {
//                 // _swapWithParent(self, index, parentIndex);
//                 _swap(self, index, parentIndex);  // Changed from _swapWithParent to _swap
//                 index = parentIndex;
//             } else {
//                 break;
//             }
//         }
//     }

//     function _heapifyDown(Heap storage self, uint256 index) internal {
//         uint256 length = self.data.length;
//         uint256 leftChildIndex;
//         uint256 rightChildIndex;
//         uint256 smallest;
//         PriceToken memory element = self.data[index];

//         while (true) {
//             leftChildIndex = 2 * index + 1;
//             rightChildIndex = 2 * index + 2;
//             smallest = index;

//             if (leftChildIndex < length && _compare(self.data[leftChildIndex], element) < 0) {
//                 smallest = leftChildIndex;
//             }

//             if (rightChildIndex < length && _compare(self.data[rightChildIndex], self.data[smallest]) < 0) {
//                 smallest = rightChildIndex;
//             }

//             if (smallest != index) {
//                 // _swapWithParent(self, smallest, index);
//                 _swap(self, smallest, index);
//                 index = smallest;
//             } else {
//                 break;
//             }
//         }
//     }

//     function _compare(PriceToken memory a, PriceToken memory b) internal pure returns (int) {
//         if (a.price < b.price) {
//             return -1;
//         } else if (a.price > b.price) {
//             return 1;
//         } else {
//             if (a.tokenId < b.tokenId) {
//                 return -1;
//             } else if (a.tokenId > b.tokenId) {
//                 return 1;
//             } else {
//                 return 0;
//             }
//         }
//     }

//     function _swap(Heap storage self, uint256 i, uint256 j) internal {
//         if (i == j) return;

//         PriceToken memory temp = self.data[i];
//         self.data[i] = self.data[j];
//         self.data[j] = temp;

//         self.tokenIdToIndex[self.data[i].tokenId] = i;
//         self.tokenIdToIndex[self.data[j].tokenId] = j;
//     }

//     // function _swapWithParent(Heap storage self, uint256 childIndex, uint256 parentIndex) internal {
//     //     PriceToken memory temp = self.data[childIndex];
//     //     self.data[childIndex] = self.data[parentIndex];
//     //     self.data[parentIndex] = temp;

//     //     self.tokenIdToIndex[self.data[childIndex].tokenId] = childIndex;
//     //     self.tokenIdToIndex[self.data[parentIndex].tokenId] = parentIndex;
//     // }
// // function _swapWithParent(Heap storage self, uint256 childIndex, uint256 parentIndex) internal {
// //     console.log("SP1. Starting swap. Child index:", childIndex, "Parent index:", parentIndex);
// //     console.log("SP2. Child token before:", self.data[childIndex].tokenId);
// //     console.log("SP3. Parent token before:", self.data[parentIndex].tokenId);
// //     console.log("SP4. Child index in mapping before:", self.tokenIdToIndex[self.data[childIndex].tokenId]);
// //     console.log("SP5. Parent index in mapping before:", self.tokenIdToIndex[self.data[parentIndex].tokenId]);

// //     PriceToken memory temp = self.data[childIndex];
// //     self.data[childIndex] = self.data[parentIndex];
// //     self.data[parentIndex] = temp;
// //     console.log("SP6. Swapped array elements");

// //     console.log("SP7. Updating tokenIdToIndex mapping");
// //     console.log("SP8. Setting", self.data[childIndex].tokenId, "index to", childIndex);
// //     console.log("SP9. Setting", self.data[parentIndex].tokenId, "index to", parentIndex);
    
// //     self.tokenIdToIndex[self.data[childIndex].tokenId] = childIndex;
// //     self.tokenIdToIndex[self.data[parentIndex].tokenId] = parentIndex;
    
// //     console.log("SP10. Indices in mapping after update:");
// //     console.log("SP11. New child index in mapping:", self.tokenIdToIndex[self.data[childIndex].tokenId]);
// //     console.log("SP12. New parent index in mapping:", self.tokenIdToIndex[self.data[parentIndex].tokenId]);
// //     console.log("SP13. Swap complete");
// // }

// }




// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library CustomMinHeapLib {
    struct PriceToken {
        uint256 price;
        uint256 tokenId;
    }

    struct Heap {
        PriceToken[] data;
        mapping(uint256 => uint256) tokenIdToIndex;
    }

    function insert(Heap storage self, PriceToken memory element) external {
        require(self.data.length == 0 || (self.tokenIdToIndex[element.tokenId] == 0 && self.data[0].tokenId != element.tokenId), "TokenId already exists in the heap");
        
        self.data.push(element);
        uint256 index = self.data.length - 1;
        self.tokenIdToIndex[element.tokenId] = index;
        _heapifyUp(self, index);
    }

    function remove(Heap storage self, uint256 tokenId) external {
        // Get index from mapping
        uint256 index = self.tokenIdToIndex[tokenId];
        
        // Verify token exists by checking if it's actually at that index
        require(
            index < self.data.length && 
            self.data[index].tokenId == tokenId,
            "TokenId not found"
        );
        
        uint256 lastIndex = self.data.length - 1;
        
        // If removing last element
        if (index == lastIndex) {
            self.data.pop();
            delete self.tokenIdToIndex[tokenId];
            return;
        }

        // Swap with last element
        _swap(self, index, lastIndex);
        self.data.pop();
        delete self.tokenIdToIndex[tokenId];
        
        // After removal, check if we need to heapifyUp or heapifyDown
        if (index < self.data.length) {
            if (index > 0 && _compare(self.data[index], self.data[(index - 1) / 2]) < 0) {
                _heapifyUp(self, index);
            } else {
                _heapifyDown(self, index);
            }
        }
    }

    function getMin(Heap storage self) external view returns (PriceToken memory) {
        require(self.data.length > 0, "Heap is empty");
        return self.data[0];
    }

    function size(Heap storage self) external view returns (uint256) {
        return self.data.length;
    }

    function _heapifyUp(Heap storage self, uint256 index) internal {
        // require(index < self.data.length, "Index out of bounds");
        
        while (index > 0) {
            uint256 parentIndex = (index - 1) / 2;
            if (_compare(self.data[index], self.data[parentIndex]) < 0) {
                _swap(self, index, parentIndex);
                index = parentIndex;
            } else {
                break;
            }
        }
    }

    function _heapifyDown(Heap storage self, uint256 index) internal {
        uint256 length = self.data.length;
        if (length <= 1) return;
        
        while (true) {
            uint256 smallest = index;
            uint256 leftChildIndex = 2 * index + 1;
            uint256 rightChildIndex = 2 * index + 2;

            if (leftChildIndex < length && _compare(self.data[leftChildIndex], self.data[smallest]) < 0) {
                smallest = leftChildIndex;
            }

            if (rightChildIndex < length && _compare(self.data[rightChildIndex], self.data[smallest]) < 0) {
                smallest = rightChildIndex;
            }

            if (smallest == index) {
                break;
            }

            _swap(self, index, smallest);
            index = smallest;
        }
    }

    function _compare(PriceToken memory a, PriceToken memory b) internal pure returns (int) {
        if (a.price < b.price) {
            return -1;
        } else if (a.price > b.price) {
            return 1;
        } else {
            if (a.tokenId < b.tokenId) {
                return -1;
            } else if (a.tokenId > b.tokenId) {
                return 1;
            } else {
                return 0;
            }
        }
    }

    function _swap(Heap storage self, uint256 i, uint256 j) internal {
        if (i == j) return;

        PriceToken memory temp = self.data[i];
        self.data[i] = self.data[j];
        self.data[j] = temp;

        self.tokenIdToIndex[self.data[i].tokenId] = i;
        self.tokenIdToIndex[self.data[j].tokenId] = j;
    }
}