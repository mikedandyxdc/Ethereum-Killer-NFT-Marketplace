pragma solidity ^0.8.0;
// pragma experimental ABIEncoderV2;

library OrderStatisticsTree {
    enum Color { RED, BLACK }
    enum ComparatorType { TOKENID, PRICETOKEN_PRICE_TOKENID, OFFER_TOKENID, OFFER_PRICE_TOKENID, SALE_PRICE_TOKENID }

    struct PriceToken {
        uint256 price;
        uint256 tokenId;
    }

    struct Offer {
        uint256 tokenId;
        address bidder;
        uint256 price;
    }

    struct Sale {
        uint256 salesId;
        uint256 tokenId;
        address seller;
        address buyer;
        uint256 price;
        uint256 timestamp;
    }

    struct Node {
        // uint256 tokenId;
        // uint256 price;
        uint256 tokenId;
        PriceToken priceToken;
        Offer offer;
        Sale sale;
        uint256 size;
        Color color;
        uint256 left;
        uint256 right;
        uint256 parent;
        bool initialized;
    }

    struct Tree {
        mapping(uint256 => Node) nodes;
        uint256 root;
        bool initialized;
        ComparatorType comparatorType;
    }

    uint256 private constant NULL_NODE = 2**256 - 1;

    function initializeTree(Tree storage self, ComparatorType comparatorType) external {
        require(!self.initialized, "Tree is already initialized");
        // self.nodes[NULL_NODE] = Node(PriceToken({
        //     price: 0,
        //     tokenId: NULL_NODE
        // }), 0, Color.BLACK, NULL_NODE, NULL_NODE, NULL_NODE, true);
        
        // self.nodes[NULL_NODE].priceToken = PriceToken({
        //     price: 0,
        //     tokenId: NULL_NODE
        // });
        self.nodes[NULL_NODE].size = 0;
        self.nodes[NULL_NODE].color = Color.BLACK;
        self.nodes[NULL_NODE].left = NULL_NODE;
        self.nodes[NULL_NODE].right = NULL_NODE;
        self.nodes[NULL_NODE].parent = NULL_NODE;
        self.initialized = true;
        self.comparatorType = comparatorType;
        self.root = NULL_NODE;
    }

    function compare(Tree storage self, uint256 aId, uint256 bId) private view returns (int) {
        Node storage a = self.nodes[aId];
        Node storage b = self.nodes[bId];

        if (self.comparatorType == ComparatorType.TOKENID) {
            return compareTokenId(a.tokenId, b.tokenId);
        } else if (self.comparatorType == ComparatorType.PRICETOKEN_PRICE_TOKENID) {
            return comparePriceTokenByPriceTokenId(a.priceToken, b.priceToken);
        } else if (self.comparatorType == ComparatorType.OFFER_TOKENID) {
            return compareOfferByTokenId(a.offer, b.offer);
        } else if (self.comparatorType == ComparatorType.OFFER_PRICE_TOKENID) {
            return compareOfferByPriceTokenId(a.offer, b.offer);
        } else if (self.comparatorType == ComparatorType.SALE_PRICE_TOKENID) {
            return compareSaleByPriceTokenId(a.sale, b.sale);
        }
        revert("Invalid comparator type");
    }

    function compareTokenId(uint256 a, uint256 b) private pure returns (int) {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    }

    function comparePriceTokenByPriceTokenId(PriceToken memory a, PriceToken memory b) private pure returns (int) {
        if (a.price < b.price) return -1;
        if (a.price > b.price) return 1;
        if (a.tokenId < b.tokenId) return -1;
        if (a.tokenId > b.tokenId) return 1;
        return 0;
    }

    function compareOfferByTokenId(Offer memory a, Offer memory b) private pure returns (int) {
        if (a.tokenId < b.tokenId) return -1;
        if (a.tokenId > b.tokenId) return 1;
        return 0;
    }

    function compareOfferByPriceTokenId(Offer memory a, Offer memory b) private pure returns (int) {
        if (a.price < b.price) return -1;
        if (a.price > b.price) return 1;
        if (a.tokenId < b.tokenId) return -1;
        if (a.tokenId > b.tokenId) return 1;
        return 0;
    }

    function compareSaleByPriceTokenId(Sale memory a, Sale memory b) private pure returns (int) {
        if (a.price < b.price) return -1;
        if (a.price > b.price) return 1;
        if (a.tokenId < b.tokenId) return -1;
        if (a.tokenId > b.tokenId) return 1;
        return 0;
    }

    function insertTokenId(Tree storage self, uint256 tokenId) external {
        require(self.initialized, "Tree is not initialized");
        require(self.comparatorType == ComparatorType.TOKENID, "Invalid comparator type");
        require(!self.nodes[tokenId].initialized, "TokenId already exists");

        self.nodes[tokenId].tokenId = tokenId;
        insertNode(self, tokenId);
    }

    function insertPriceToken(Tree storage self, PriceToken calldata priceToken) external {
        require(self.initialized, "Tree is not initialized");
        require(self.comparatorType == ComparatorType.PRICETOKEN_PRICE_TOKENID, "Invalid comparator type");
        require(!self.nodes[priceToken.tokenId].initialized, "TokenId already exists");

        self.nodes[priceToken.tokenId].priceToken = priceToken;
        insertNode(self, priceToken.tokenId);
    }

    function insertOffer(Tree storage self, Offer calldata offer, bool allowSameBidderMultipleUniqueTokenOffers) external {
        require(self.initialized, "Tree is not initialized");
        require(self.comparatorType == ComparatorType.OFFER_TOKENID || 
                self.comparatorType == ComparatorType.OFFER_PRICE_TOKENID, "Invalid comparator type");
        // require(!self.nodes[offer.tokenId].initialized, "TokenId already exists");

        if(self.comparatorType == ComparatorType.OFFER_TOKENID) {
            require(!self.nodes[offer.tokenId].initialized, "TokenId already exists");
            self.nodes[offer.tokenId].offer = offer;
            insertNode(self, offer.tokenId);
        } else if(self.comparatorType == ComparatorType.OFFER_PRICE_TOKENID) {
            if (allowSameBidderMultipleUniqueTokenOffers) {
                //for globalOffers
                //check if tokenID is different
                uint256 newHash = uint256(keccak256(abi.encodePacked(offer.bidder, ":", offer.tokenId)));
                require(!self.nodes[newHash].initialized, "Bidder already bid for this token");
                self.nodes[newHash].offer = offer;
                insertNode(self, newHash);
            } else {
                uint256 newNodeIdUint256 = uint256(uint160(offer.bidder));
                require(!self.nodes[newNodeIdUint256].initialized, "Bidder already exists");
                self.nodes[newNodeIdUint256].offer = offer;
                insertNode(self, offer.bidder);
            }
        }
    }

    //for globalSalesHistory
    function insertSale(Tree storage self, Sale calldata sale) external {
        require(self.initialized, "Tree is not initialized");
        require(self.comparatorType == ComparatorType.SALE_PRICE_TOKENID, "Invalid comparator type");
        uint256 newHash = uint256(keccak256(abi.encodePacked(sale.tokenId, sale.seller, sale.buyer, sale.price, sale.timestamp)));
        require(!self.nodes[newHash].initialized, "Sale already recorded");

        self.nodes[newHash].sale = sale;
        insertNode(self, newHash);
    }

    // function insert(Tree storage self, PriceToken memory key) external {
    //     if (!self.initialized) {
    //         initializeTree(self);
    //     }

    //     require(!self.nodes[key.tokenId].initialized, "TokenId already exists");

    //     uint256 newNodeId = key.tokenId;
    //     self.nodes[newNodeId] = Node(key, 1, Color.RED, NULL_NODE, NULL_NODE, NULL_NODE, true);

    //     uint256 y = NULL_NODE;
    //     uint256 x = self.root;

    //     while (x != NULL_NODE) {
    //         y = x;
    //         self.nodes[x].size++;
    //         if (compare(key, PriceToken(self.nodes[x].key.tokenId, self.nodes[x].key.price)) < 0) {
    //             x = self.nodes[x].left;
    //         } else {
    //             x = self.nodes[x].right;
    //         }
    //     }

    //     self.nodes[newNodeId].parent = y;
    //     if (y == NULL_NODE) {
    //         self.root = newNodeId;
    //     } else if (compare(key, PriceToken(self.nodes[y].key.tokenId, self.nodes[y].key.price)) < 0) {
    //         self.nodes[y].left = newNodeId;
    //     } else {
    //         self.nodes[y].right = newNodeId;
    //     }

    //     insertFixup(self, newNodeId);
    // }

    function insertNode(Tree storage self, address newNodeId) private {
        uint256 newNodeIdUint256 = uint256(uint160(newNodeId));
        insertNode(self, newNodeIdUint256);
    }
    function insertNode(Tree storage self, uint256 newNodeId) private {
        self.nodes[newNodeId].size = 1;
        self.nodes[newNodeId].color = Color.RED;
        self.nodes[newNodeId].left = NULL_NODE;
        self.nodes[newNodeId].right = NULL_NODE;
        self.nodes[newNodeId].parent = NULL_NODE;
        self.nodes[newNodeId].initialized = true;

        uint256 y = NULL_NODE;
        uint256 x = self.root;

        while (x != NULL_NODE) {
            y = x;
            self.nodes[x].size++;
            if (compare(self, newNodeId, x) < 0) {
                x = self.nodes[x].left;
            } else {
                x = self.nodes[x].right;
            }
        }

        self.nodes[newNodeId].parent = y;
        if (y == NULL_NODE) {
            self.root = newNodeId;
        } else if (compare(self, newNodeId, y) < 0) {
            self.nodes[y].left = newNodeId;
        } else {
            self.nodes[y].right = newNodeId;
        }

        insertFixup(self, newNodeId);
    }

    function remove(Tree storage self, address nodeId) external {
        uint256 nodeIdUint256 = uint256(uint160(nodeId));
        remove(self, nodeIdUint256);
    }

    function remove(Tree storage self, uint256 tokenId) public {
        require(self.initialized, "Tree is not initialized");
        require(self.nodes[tokenId].initialized, "TokenId not found");

        uint256 z = tokenId;
        uint256 x;
        uint256 y = z;
        Color yOriginalColor = self.nodes[y].color;

        if (self.nodes[z].left == NULL_NODE) {
            x = self.nodes[z].right;
            transplant(self, z, self.nodes[z].right);
        } else if (self.nodes[z].right == NULL_NODE) {
            x = self.nodes[z].left;
            transplant(self, z, self.nodes[z].left);
        } else {
            y = minimum(self, self.nodes[z].right);
            yOriginalColor = self.nodes[y].color;
            x = self.nodes[y].right;
            if (self.nodes[y].parent == z) {
                self.nodes[x].parent = y;
            } else {
                transplant(self, y, self.nodes[y].right);
                self.nodes[y].right = self.nodes[z].right;
                self.nodes[self.nodes[y].right].parent = y;
            }
            transplant(self, z, y);
            self.nodes[y].left = self.nodes[z].left;
            self.nodes[self.nodes[y].left].parent = y;
            self.nodes[y].color = self.nodes[z].color;
        }

        // //updates all sizes
        // uint256 current = self.nodes[x].parent;
        // while (current != NULL_NODE) {
        //     self.nodes[current].size--;
        //     current = self.nodes[current].parent;
        // }
        
        // // Ensure size is updated correctly after removal
        // uint256 current = self.nodes[x].parent;
        // while (current != NULL_NODE) {
        //     self.nodes[current].size = 1 + self.nodes[self.nodes[current].left].size + self.nodes[self.nodes[current].right].size;
        //     current = self.nodes[current].parent;
        // }


        if (yOriginalColor == Color.BLACK) {
            removeFixup(self, x);
        }

        // Ensure size is updated correctly after removal
        uint256 current = self.nodes[x].parent;
        while (current != NULL_NODE) {
            self.nodes[current].size = 1 + self.nodes[self.nodes[current].left].size + self.nodes[self.nodes[current].right].size;
            current = self.nodes[current].parent;
        }

        delete self.nodes[z];
    }

    // function select(Tree storage self, uint256 i) external view returns (PriceToken memory) {
    //     require(self.initialized, "Tree is not initialized");
    //     require(i > 0 && i <= self.nodes[self.root].size, "Index out of range");
        
    //     uint256 x = self.root;
    //     while (true) {
    //         uint256 leftSize = self.nodes[self.nodes[x].left].size;
    //         if (i == leftSize + 1) {
    //             return PriceToken(self.nodes[x].key.tokenId, self.nodes[x].key.price);
    //         } else if (i <= leftSize) {
    //             x = self.nodes[x].left;
    //         } else {
    //             i = i - leftSize - 1;
    //             x = self.nodes[x].right;
    //         }
    //     }
    // }

    // function rank(Tree storage self, PriceToken memory key) external view returns (uint256) {
    //     require(self.initialized, "Tree is not initialized");
        
    //     uint256 x = self.root;
    //     uint256 r = 0;
    //     while (x != NULL_NODE) {
    //         int compResult = compare(key, PriceToken(self.nodes[x].key.tokenId, self.nodes[x].key.price));
    //         if (compResult == 0) {
    //             return r + self.nodes[self.nodes[x].left].size + 1;
    //         } else if (compResult < 0) {
    //             x = self.nodes[x].left;
    //         } else {
    //             r = r + self.nodes[self.nodes[x].left].size + 1;
    //             x = self.nodes[x].right;
    //         }
    //     }
    //     return r;
    // }

    // Select functions
    function select(Tree storage self, uint256 k) external view returns (Node memory) {
        // require(self.comparatorType == ComparatorType.TOKENID, "Invalid comparator type");
        return self.nodes[selectHelper(self, k)];
    }

    // Rank functions
    function rankTokenId(Tree storage self, uint256 tokenId) external view returns (uint256) {
        require(self.comparatorType == ComparatorType.TOKENID, "Invalid comparator type");
        return rankHelper(self, tokenId);
    }

    function rankPriceToken_PriceTokenId(Tree storage self, PriceToken calldata priceToken) external view returns (uint256) {
        require(self.comparatorType == ComparatorType.PRICETOKEN_PRICE_TOKENID, "Invalid comparator type");
        return rankHelper(self, priceToken);
    }

    function rankOffer_TokenId(Tree storage self, Offer calldata offer) external view returns (uint256) {
        require(self.comparatorType == ComparatorType.OFFER_TOKENID, "Invalid comparator type");
        return rankHelper(self, offer);
    }

    function rankOffer_PriceTokenId(Tree storage self, Offer calldata offer) external view returns (uint256) {
        require(self.comparatorType == ComparatorType.OFFER_PRICE_TOKENID, "Invalid comparator type");
        return rankHelper(self, offer);
    }

    function rankSale_PriceTokenId(Tree storage self, Sale calldata sale) external view returns (uint256) {
        require(self.comparatorType == ComparatorType.SALE_PRICE_TOKENID, "Invalid comparator type");
        return rankHelper(self, sale);
    }

    function insertFixup(Tree storage self, uint256 z) private {
        while (self.nodes[self.nodes[z].parent].color == Color.RED) {
            if (self.nodes[z].parent == self.nodes[self.nodes[self.nodes[z].parent].parent].left) {
                uint256 y = self.nodes[self.nodes[self.nodes[z].parent].parent].right;
                if (self.nodes[y].color == Color.RED) {
                    self.nodes[self.nodes[z].parent].color = Color.BLACK;
                    self.nodes[y].color = Color.BLACK;
                    self.nodes[self.nodes[self.nodes[z].parent].parent].color = Color.RED;
                    z = self.nodes[self.nodes[z].parent].parent;
                } else {
                    if (z == self.nodes[self.nodes[z].parent].right) {
                        z = self.nodes[z].parent;
                        leftRotate(self, z);
                    }
                    self.nodes[self.nodes[z].parent].color = Color.BLACK;
                    self.nodes[self.nodes[self.nodes[z].parent].parent].color = Color.RED;
                    rightRotate(self, self.nodes[self.nodes[z].parent].parent);
                }
            } else {
                uint256 y = self.nodes[self.nodes[self.nodes[z].parent].parent].left;
                if (self.nodes[y].color == Color.RED) {
                    self.nodes[self.nodes[z].parent].color = Color.BLACK;
                    self.nodes[y].color = Color.BLACK;
                    self.nodes[self.nodes[self.nodes[z].parent].parent].color = Color.RED;
                    z = self.nodes[self.nodes[z].parent].parent;
                } else {
                    if (z == self.nodes[self.nodes[z].parent].left) {
                        z = self.nodes[z].parent;
                        rightRotate(self, z);
                    }
                    self.nodes[self.nodes[z].parent].color = Color.BLACK;
                    self.nodes[self.nodes[self.nodes[z].parent].parent].color = Color.RED;
                    leftRotate(self, self.nodes[self.nodes[z].parent].parent);
                }
            }
        }
        self.nodes[self.root].color = Color.BLACK;
    }

    function removeFixup(Tree storage self, uint256 x) private {
        while (x != self.root && self.nodes[x].color == Color.BLACK) {
            if (x == self.nodes[self.nodes[x].parent].left) {
                uint256 w = self.nodes[self.nodes[x].parent].right;
                if (self.nodes[w].color == Color.RED) {
                    self.nodes[w].color = Color.BLACK;
                    self.nodes[self.nodes[x].parent].color = Color.RED;
                    leftRotate(self, self.nodes[x].parent);
                    w = self.nodes[self.nodes[x].parent].right;
                }
                if (self.nodes[self.nodes[w].left].color == Color.BLACK && self.nodes[self.nodes[w].right].color == Color.BLACK) {
                    self.nodes[w].color = Color.RED;
                    x = self.nodes[x].parent;
                } else {
                    if (self.nodes[self.nodes[w].right].color == Color.BLACK) {
                        self.nodes[self.nodes[w].left].color = Color.BLACK;
                        self.nodes[w].color = Color.RED;
                        rightRotate(self, w);
                        w = self.nodes[self.nodes[x].parent].right;
                    }
                    self.nodes[w].color = self.nodes[self.nodes[x].parent].color;
                    self.nodes[self.nodes[x].parent].color = Color.BLACK;
                    self.nodes[self.nodes[w].right].color = Color.BLACK;
                    leftRotate(self, self.nodes[x].parent);
                    x = self.root;
                }
            } else {
                uint256 w = self.nodes[self.nodes[x].parent].left;
                if (self.nodes[w].color == Color.RED) {
                    self.nodes[w].color = Color.BLACK;
                    self.nodes[self.nodes[x].parent].color = Color.RED;
                    rightRotate(self, self.nodes[x].parent);
                    w = self.nodes[self.nodes[x].parent].left;
                }
                if (self.nodes[self.nodes[w].right].color == Color.BLACK && self.nodes[self.nodes[w].left].color == Color.BLACK) {
                    self.nodes[w].color = Color.RED;
                    x = self.nodes[x].parent;
                } else {
                    if (self.nodes[self.nodes[w].left].color == Color.BLACK) {
                        self.nodes[self.nodes[w].right].color = Color.BLACK;
                        self.nodes[w].color = Color.RED;
                        leftRotate(self, w);
                        w = self.nodes[self.nodes[x].parent].left;
                    }
                    self.nodes[w].color = self.nodes[self.nodes[x].parent].color;
                    self.nodes[self.nodes[x].parent].color = Color.BLACK;
                    self.nodes[self.nodes[w].left].color = Color.BLACK;
                    rightRotate(self, self.nodes[x].parent);
                    x = self.root;
                }
            }
        }
        self.nodes[x].color = Color.BLACK;
    }

    function leftRotate(Tree storage self, uint256 x) private {
        uint256 y = self.nodes[x].right;
        self.nodes[x].right = self.nodes[y].left;
        // require(y != NULL_NODE, "Cannot rotate with NULL_NODE");
        if (self.nodes[y].left != NULL_NODE) {
            self.nodes[self.nodes[y].left].parent = x;
        }
        self.nodes[y].parent = self.nodes[x].parent;
        if (self.nodes[x].parent == NULL_NODE) {
            self.root = y;
        } else if (x == self.nodes[self.nodes[x].parent].left) {
            self.nodes[self.nodes[x].parent].left = y;
        } else {
            self.nodes[self.nodes[x].parent].right = y;
        }
        self.nodes[y].left = x;
        self.nodes[x].parent = y;

        self.nodes[y].size = self.nodes[x].size;
        self.nodes[x].size = 1 + self.nodes[self.nodes[x].left].size + self.nodes[self.nodes[x].right].size;
    }

    function rightRotate(Tree storage self, uint256 y) private {
        uint256 x = self.nodes[y].left;
        self.nodes[y].left = self.nodes[x].right;
        // require(x != NULL_NODE, "Cannot rotate with NULL_NODE");
        if (self.nodes[x].right != NULL_NODE) {
            self.nodes[self.nodes[x].right].parent = y;
        }
        self.nodes[x].parent = self.nodes[y].parent;
        if (self.nodes[y].parent == NULL_NODE) {
            self.root = x;
        } else if (y == self.nodes[self.nodes[y].parent].right) {
            self.nodes[self.nodes[y].parent].right = x;
        } else {
            self.nodes[self.nodes[y].parent].left = x;
        }
        self.nodes[x].right = y;
        self.nodes[y].parent = x;

        self.nodes[x].size = self.nodes[y].size;
        self.nodes[y].size = 1 + self.nodes[self.nodes[y].left].size + self.nodes[self.nodes[y].right].size;
    }

    function transplant(Tree storage self, uint256 u, uint256 v) private {
        if (self.nodes[u].parent == NULL_NODE) {
            self.root = v;
        } else if (u == self.nodes[self.nodes[u].parent].left) {
            self.nodes[self.nodes[u].parent].left = v;
        } else {
            self.nodes[self.nodes[u].parent].right = v;
        }
        self.nodes[v].parent = self.nodes[u].parent;
    }

    function minimum(Tree storage self, uint256 x) public view returns (uint256) {
        require(self.nodes[self.root].size > 0, "RedBlackTree: tree is empty");
        while (self.nodes[x].left != NULL_NODE) {
            x = self.nodes[x].left;
        }
        return x;
    }

    function compare(PriceToken memory a, PriceToken memory b) private pure returns (int) {
        if (a.price < b.price) return -1;
        if (a.price > b.price) return 1;
        if (a.tokenId < b.tokenId) return -1;
        if (a.tokenId > b.tokenId) return 1;
        return 0;
    }

    function getTreeHeight(Tree storage self) external view returns (uint256) {
        return _getHeight(self, self.root);
    }

    function _getHeight(Tree storage self, uint256 nodeId) private view returns (uint256) {
        if (nodeId == NULL_NODE || !self.nodes[nodeId].initialized) {
            return 0; // Height of a NULL_NODE or uninitialized node is 0
        }

        uint256 leftHeight = _getHeight(self, self.nodes[nodeId].left);
        uint256 rightHeight = _getHeight(self, self.nodes[nodeId].right);

        return 1 + (leftHeight > rightHeight ? leftHeight : rightHeight);
    }

    function size(Tree storage self) external view returns (uint256) {
        return self.nodes[self.root].size;
    }

    

// function getPriceTokenRange(Tree storage self, uint256 start, uint256 count) 
//         external view returns (PriceToken[] memory)
//     {
//         require(count > 0, "count must be greater than zero");
//         uint256 nodesCount = self.nodes[self.root].size;
        
//         //returns empty list if starting index is past nodes count
//         if (start >= nodesCount) {
//             return new PriceToken[](0);
//         }
        
//         uint256 availableCount = self.nodes[self.root].size - start;
//         uint256 actualCount = count < availableCount ? count : availableCount;
        
//         PriceToken[] memory result = new PriceToken[](actualCount);
        
//         // uint256 currentNode = findNodeAtIndex(self, self.root, start + 1); // +1 because tree is 1-indexed
//         uint256 currentNode = findNodeAtIndex(self, start + 1); // +1 because tree is 1-indexed
//         uint256 collected = 0;
        
//         while (collected < actualCount && currentNode != NULL_NODE) {
//             result[collected++] = self.nodes[currentNode].key;
//             currentNode = findSuccessor(self, currentNode);
//         }
        
//         return result;
//     }

//     function getPriceTokenRangeReverse(Tree storage self, uint256 start, uint256 count) 
//         external view returns (PriceToken[] memory)
//     {
//         require(count > 0, "count must be greater than zero");
//         uint256 nodesCount = self.nodes[self.root].size;
        
//         //returns empty list if starting index is past nodes count
//         if (start >= nodesCount) {
//             return new PriceToken[](0);
//         }
        
//         uint256 availableCount = start + 1; // +1 because start is 0-indexed
//         uint256 actualCount = count < availableCount ? count : availableCount;
        
//         PriceToken[] memory result = new PriceToken[](actualCount);
        
//         // uint256 currentNode = findNodeAtIndex(self, self.root, start + 1); // +1 because tree is 1-indexed
//         uint256 currentNode = findNodeAtIndex(self, start + 1); // +1 because tree is 1-indexed
//         uint256 collected = 0;
        
//         while (collected < actualCount && currentNode != NULL_NODE) {
//             result[collected++] = self.nodes[currentNode].key;
//             currentNode = findPredecessor(self, currentNode);
//         }
        
//         return result;
//     }

//     // function findNodeAtIndex(Tree storage self, uint256 nodeId, uint256 index) private view returns (uint256) {
//     //     uint256 leftSize = self.nodes[self.nodes[nodeId].left].size;
        
//     //     if (index == leftSize + 1) {
//     //         return nodeId;
//     //     } else if (index <= leftSize) {
//     //         return findNodeAtIndex(self, self.nodes[nodeId].left, index);
//     //     } else {
//     //         return findNodeAtIndex(self, self.nodes[nodeId].right, index - leftSize - 1);
//     //     }
//     // }
//     function findNodeAtIndex(Tree storage self, uint256 index) external view returns (uint256) {
//             require(index > 0 && index <= self.nodes[self.root].size, "Index out of range");
            
//             uint256 currentNode = self.root;
//             uint256 currentIndex = index;

//             while (true) {
//                 uint256 leftSize = self.nodes[self.nodes[currentNode].left].size;
                
//                 if (currentIndex == leftSize + 1) {
//                     return currentNode;
//                 } else if (currentIndex <= leftSize) {
//                     currentNode = self.nodes[currentNode].left;
//                 } else {
//                     currentNode = self.nodes[currentNode].right;
//                     currentIndex = currentIndex - leftSize - 1;
//                 }
//             }
//         }

//     function findSuccessor(Tree storage self, uint256 nodeId) private view returns (uint256) {
//         if (self.nodes[nodeId].right != NULL_NODE) {
//             return findMinimum(self, self.nodes[nodeId].right);
//         }

//         uint256 y = self.nodes[nodeId].parent;
//         uint256 x = nodeId;
//         while (y != NULL_NODE && x == self.nodes[y].right) {
//             x = y;
//             y = self.nodes[y].parent;
//         }
//         return y;
//     }

//     function findPredecessor(Tree storage self, uint256 nodeId) private view returns (uint256) {
//         if (self.nodes[nodeId].left != NULL_NODE) {
//             return findMaximum(self, self.nodes[nodeId].left);
//         }

//         uint256 y = self.nodes[nodeId].parent;
//         uint256 x = nodeId;
//         while (y != NULL_NODE && x == self.nodes[y].left) {
//             x = y;
//             y = self.nodes[y].parent;
//         }
//         return y;
//     }

//     function findMinimum(Tree storage self, uint256 nodeId) private view returns (uint256) {
//         while (self.nodes[nodeId].left != NULL_NODE) {
//             nodeId = self.nodes[nodeId].left;
//         }
//         return nodeId;
//     }

//     function findMaximum(Tree storage self, uint256 nodeId) private view returns (uint256) {
//         while (self.nodes[nodeId].right != NULL_NODE) {
//             nodeId = self.nodes[nodeId].right;
//         }
//         return nodeId;
//     }

    // // Range functions
    // function getTokenIdRange(Tree storage self, uint256 start, uint256 count, bool ascending) external view returns (uint256[] memory) {
    //     if(self.nodes[self.root].size == 0) {
    //         //in case tree hasn't been initialized yet, we return empty string
    //         return new uint256[](0);
    //     }
    //     require(self.comparatorType == ComparatorType.TOKENID, "Invalid comparator type");
    //     return getTokenIdRangeHelper(self, start, count, true);
    // }
    // function getTokenIdRangeReverse(Tree storage self, uint256 start, uint256 count) external view returns (uint256[] memory) {
    //     if(self.nodes[self.root].size == 0) {
    //         //in case tree hasn't been initialized yet, we return empty string
    //         return new uint256[](0);
    //     }
    //     require(self.comparatorType == ComparatorType.TOKENID, "Invalid comparator type");
    //     return getTokenIdRangeHelper(self, start, count, false);
    // }
    function getTokenIdRange(Tree storage self, uint256 start, uint256 count, bool ascending) external view returns (uint256[] memory) {
        if(self.nodes[self.root].size == 0) {
            //in case tree hasn't been initialized yet, we return empty string
            return new uint256[](0);
        }
        require(self.comparatorType == ComparatorType.TOKENID, "Invalid comparator type");
        return getTokenIdRangeHelper(self, start, count, ascending);
    }

    // function getPriceTokenRange_PriceTokenId(Tree storage self, uint256 start, uint256 count) external view returns (PriceToken[] memory) {
    //     if(self.nodes[self.root].size == 0) {
    //         //in case tree hasn't been initialized yet, we return empty string
    //         return new PriceToken[](0);
    //     }
    //     require(self.comparatorType == ComparatorType.PRICETOKEN_PRICE_TOKENID, "Invalid comparator type");
    //     return getPriceTokenRange_PriceTokenIdHelper(self, start, count, true);
    // }
    // function getPriceTokenRange_PriceTokenIdReverse(Tree storage self, uint256 start, uint256 count) external view returns (PriceToken[] memory) {
    //     if(self.nodes[self.root].size == 0) {
    //         //in case tree hasn't been initialized yet, we return empty string
    //         return new PriceToken[](0);
    //     }
    //     require(self.comparatorType == ComparatorType.PRICETOKEN_PRICE_TOKENID, "Invalid comparator type");
    //     return getPriceTokenRange_PriceTokenIdHelper(self, start, count, false);
    // }
    function getPriceTokenRange_PriceTokenId(Tree storage self, uint256 start, uint256 count, bool ascending) external view returns (PriceToken[] memory) {
        if(self.nodes[self.root].size == 0) {
            //in case tree hasn't been initialized yet, we return empty string
            return new PriceToken[](0);
        }
        require(self.comparatorType == ComparatorType.PRICETOKEN_PRICE_TOKENID, "Invalid comparator type");
        return getPriceTokenRange_PriceTokenIdHelper(self, start, count, ascending);
    }

    // function getOfferRange_TokenId(Tree storage self, uint256 start, uint256 count) external view returns (Offer[] memory) {
    //     if(self.nodes[self.root].size == 0) {
    //         //in case tree hasn't been initialized yet, we return empty string
    //         return new Offer[](0);
    //     }
    //     require(self.comparatorType == ComparatorType.OFFER_TOKENID, "Invalid comparator type");
    //     return getOfferRangeHelper(self, start, count, true);
    // }
    // function getOfferRange_TokenIdReverse(Tree storage self, uint256 start, uint256 count) external view returns (Offer[] memory) {
    //     if(self.nodes[self.root].size == 0) {
    //         //in case tree hasn't been initialized yet, we return empty string
    //         return new Offer[](0);
    //     }
    //     require(self.comparatorType == ComparatorType.OFFER_TOKENID, "Invalid comparator type");
    //     return getOfferRangeHelper(self, start, count, false);
    // }
    function getOfferRange_TokenId(Tree storage self, uint256 start, uint256 count, bool ascending) external view returns (Offer[] memory) {
        if(self.nodes[self.root].size == 0) {
            //in case tree hasn't been initialized yet, we return empty string
            return new Offer[](0);
        }
        require(self.comparatorType == ComparatorType.OFFER_TOKENID, "Invalid comparator type");
        return getOfferRangeHelper(self, start, count, ascending);
    }

    // function getOfferRange_PriceTokenId(Tree storage self, uint256 start, uint256 count) external view returns (Offer[] memory) {
    //     if(self.nodes[self.root].size == 0) {
    //         //in case tree hasn't been initialized yet, we return empty string
    //         return new Offer[](0);
    //     }
    //     require(self.comparatorType == ComparatorType.OFFER_PRICE_TOKENID, "Invalid comparator type");
    //     return getOfferRangeHelper(self, start, count, true);
    // }
    // function getOfferRange_PriceTokenIdReverse(Tree storage self, uint256 start, uint256 count) external view returns (Offer[] memory) {
    //     if(self.nodes[self.root].size == 0) {
    //         //in case tree hasn't been initialized yet, we return empty string
    //         return new Offer[](0);
    //     }
    //     require(self.comparatorType == ComparatorType.OFFER_PRICE_TOKENID, "Invalid comparator type");
    //     return getOfferRangeHelper(self, start, count, false);
    // }
    function getOfferRange_PriceTokenId(Tree storage self, uint256 start, uint256 count, bool ascending) external view returns (Offer[] memory) {
        if(self.nodes[self.root].size == 0) {
            //in case tree hasn't been initialized yet, we return empty string
            return new Offer[](0);
        }
        require(self.comparatorType == ComparatorType.OFFER_PRICE_TOKENID, "Invalid comparator type");
        return getOfferRangeHelper(self, start, count, ascending);
    }

    // function getSaleRange_PriceTokenId(Tree storage self, uint256 start, uint256 count) external view returns (Sale[] memory) {
    //     if(self.nodes[self.root].size == 0) {
    //         //in case tree hasn't been initialized yet, we return empty string
    //         return new Sale[](0);
    //     }
    //     require(self.comparatorType == ComparatorType.SALE_PRICE_TOKENID, "Invalid comparator type");
    //     return getSaleRangeHelper(self, start, count, true);
    // }

    // function getSaleRange_PriceTokenIdReverse(Tree storage self, uint256 start, uint256 count) external view returns (Sale[] memory) {
    //     if(self.nodes[self.root].size == 0) {
    //         //in case tree hasn't been initialized yet, we return empty string
    //         return new Sale[](0);
    //     }
    //     require(self.comparatorType == ComparatorType.SALE_PRICE_TOKENID, "Invalid comparator type");
    //     return getSaleRangeHelper(self, start, count, false);
    // }
    function getSaleRange_PriceTokenId(Tree storage self, uint256 start, uint256 count, bool ascending) external view returns (Sale[] memory) {
        if(self.nodes[self.root].size == 0) {
            //in case tree hasn't been initialized yet, we return empty string
            return new Sale[](0);
        }
        require(self.comparatorType == ComparatorType.SALE_PRICE_TOKENID, "Invalid comparator type");
        return getSaleRangeHelper(self, start, count, ascending);
    }

    // Helper functions for range operations
    function getTokenIdRangeHelper(Tree storage self, uint256 start, uint256 count, bool ascending) private view returns (uint256[] memory) {
        require(count > 0, "count must be greater than zero");

        uint256 nodesCount = self.nodes[self.root].size;
        
        //returns empty list if starting index is past nodes count
        if (start >= nodesCount) {
            return new uint256[](0);
        }

        uint256 availableCount = ascending ? self.nodes[self.root].size - start : start + 1;
        uint256 actualCount = count < availableCount ? count : availableCount;
        
        uint256[] memory result = new uint256[](actualCount);
        uint256 currentNode = selectHelper(self, start + 1);
        
        for (uint256 i = 0; i < actualCount; i++) {
            result[i] = self.nodes[currentNode].tokenId;
            currentNode = ascending ? findSuccessor(self, currentNode) : findPredecessor(self, currentNode);
        }
        
        return result;
    }

    function getPriceTokenRange_PriceTokenIdHelper(Tree storage self, uint256 start, uint256 count, bool ascending) private view returns (PriceToken[] memory) {
        require(count > 0, "count must be greater than zero");

        uint256 nodesCount = self.nodes[self.root].size;
        
        //returns empty list if starting index is past nodes count
        if (start >= nodesCount) {
            return new PriceToken[](0);
        }

        uint256 availableCount = ascending ? self.nodes[self.root].size - start : start + 1;
        uint256 actualCount = count < availableCount ? count : availableCount;
        
        PriceToken[] memory result = new PriceToken[](actualCount);
        uint256 currentNode = selectHelper(self, start + 1);
        
        for (uint256 i = 0; i < actualCount; i++) {
            result[i] = self.nodes[currentNode].priceToken;
            currentNode = ascending ? findSuccessor(self, currentNode) : findPredecessor(self, currentNode);
        }
        
        return result;
    }

    function getOfferRangeHelper(Tree storage self, uint256 start, uint256 count, bool ascending) private view returns (Offer[] memory) {
        require(count > 0, "count must be greater than zero");

        uint256 nodesCount = self.nodes[self.root].size;
        
        //returns empty list if starting index is past nodes count
        if (start >= nodesCount) {
            return new Offer[](0);
        }

        uint256 availableCount = ascending ? self.nodes[self.root].size - start : start + 1;
        uint256 actualCount = count < availableCount ? count : availableCount;

        
        Offer[] memory result = new Offer[](actualCount);
        uint256 currentNode = selectHelper(self, start + 1);
        
        for (uint256 i = 0; i < actualCount; i++) {
            result[i] = self.nodes[currentNode].offer;
            currentNode = ascending ? findSuccessor(self, currentNode) : findPredecessor(self, currentNode);
        }
        
        return result;
    }

    function getSaleRangeHelper(Tree storage self, uint256 start, uint256 count, bool ascending) private view returns (Sale[] memory) {
        require(count > 0, "count must be greater than zero");

        uint256 nodesCount = self.nodes[self.root].size;
        
        //returns empty list if starting index is past nodes count
        if (start >= nodesCount) {
            return new Sale[](0);
        }

        uint256 availableCount = ascending ? self.nodes[self.root].size - start : start + 1;
        uint256 actualCount = count < availableCount ? count : availableCount;
        
        Sale[] memory result = new Sale[](actualCount);
        uint256 currentNode = selectHelper(self, start + 1);
        
        for (uint256 i = 0; i < actualCount; i++) {
            result[i] = self.nodes[currentNode].sale;
            currentNode = ascending ? findSuccessor(self, currentNode) : findPredecessor(self, currentNode);
        }
        
        return result;
    }

    function selectHelper(Tree storage self, uint256 k) private view returns (uint256) {
        require(k > 0 && k <= self.nodes[self.root].size, "Index out of range");
        
        uint256 x = self.root;
        while (true) {
            uint256 leftSize = self.nodes[self.nodes[x].left].size;
            if (k == leftSize + 1) {
                return x;
            } else if (k <= leftSize) {
                x = self.nodes[x].left;
            } else {
                k = k - leftSize - 1;
                x = self.nodes[x].right;
            }
        }
    }

    function findSuccessor(Tree storage self, uint256 x) private view returns (uint256) {
        if (self.nodes[x].right != NULL_NODE) {
            return findMinimum(self, self.nodes[x].right);
        }
        uint256 y = self.nodes[x].parent;
        while (y != NULL_NODE && x == self.nodes[y].right) {
            x = y;
            y = self.nodes[y].parent;
        }
        return y;
    }

    function findPredecessor(Tree storage self, uint256 x) private view returns (uint256) {
        if (self.nodes[x].left != NULL_NODE) {
            return findMaximum(self, self.nodes[x].left);
        }
        uint256 y = self.nodes[x].parent;
        while (y != NULL_NODE && x == self.nodes[y].left) {
            x = y;
            y = self.nodes[y].parent;
        }
        return y;
    }

    function findMinimum(Tree storage self, uint256 x) private view returns (uint256) {
        while (self.nodes[x].left != NULL_NODE) {
            x = self.nodes[x].left;
        }
        return x;
    }

    function findMaximum(Tree storage self, uint256 x) private view returns (uint256) {
        while (self.nodes[x].right != NULL_NODE) {
            x = self.nodes[x].right;
        }
        return x;
    }

    function rankHelper(Tree storage self, uint256 tokenId) private view returns (uint256) {
        uint256 x = self.root;
        uint256 r = 0;
        while (x != NULL_NODE) {
            if (tokenId < self.nodes[x].tokenId) {
                x = self.nodes[x].left;
            } else if (tokenId > self.nodes[x].tokenId) {
                r = r + self.nodes[self.nodes[x].left].size + 1;
                x = self.nodes[x].right;
            } else {
                return r + self.nodes[self.nodes[x].left].size + 1;
            }
        }
        return r;
    }

    function rankHelper(Tree storage self, PriceToken memory priceToken) private view returns (uint256) {
        uint256 x = self.root;
        uint256 r = 0;
        while (x != NULL_NODE) {
            if (comparePriceTokenByPriceTokenId(priceToken, self.nodes[x].priceToken) < 0) {
                x = self.nodes[x].left;
            } else if (comparePriceTokenByPriceTokenId(priceToken, self.nodes[x].priceToken) > 0) {
                r = r + self.nodes[self.nodes[x].left].size + 1;
                x = self.nodes[x].right;
            } else {
                return r + self.nodes[self.nodes[x].left].size + 1;
            }
        }
        return r;
    }

    function rankHelper(Tree storage self, Offer memory offer) private view returns (uint256) {
        uint256 x = self.root;
        uint256 r = 0;
        while (x != NULL_NODE) {
            int compResult;
            if (self.comparatorType == ComparatorType.OFFER_TOKENID) {
                compResult = compareOfferByTokenId(offer, self.nodes[x].offer);
            } else {
                compResult = compareOfferByPriceTokenId(offer, self.nodes[x].offer);
            }
            
            if (compResult < 0) {
                x = self.nodes[x].left;
            } else if (compResult > 0) {
                r = r + self.nodes[self.nodes[x].left].size + 1;
                x = self.nodes[x].right;
            } else {
                return r + self.nodes[self.nodes[x].left].size + 1;
            }
        }
        return r;
    }

    function rankHelper(Tree storage self, Sale memory sale) private view returns (uint256) {
        uint256 x = self.root;
        uint256 r = 0;
        while (x != NULL_NODE) {
            if (compareSaleByPriceTokenId(sale, self.nodes[x].sale) < 0) {
                x = self.nodes[x].left;
            } else if (compareSaleByPriceTokenId(sale, self.nodes[x].sale) > 0) {
                r = r + self.nodes[self.nodes[x].left].size + 1;
                x = self.nodes[x].right;
            } else {
                return r + self.nodes[self.nodes[x].left].size + 1;
            }
        }
        return r;
    }
}























// /* 
// Hitchens Order Statistics Tree v0.99

// A Solidity Red-Black Tree library to store and maintain a sorted data
// structure in a Red-Black binary search tree, with O(log 2n) insert, remove
// and search time (and gas, approximately)

// https://github.com/rob-Hitchens/OrderStatisticsTree

// Copyright (c) Rob Hitchens. the MIT License

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// Significant portions from BokkyPooBahsRedBlackTreeLibrary, 
// https://github.com/bokkypoobah/BokkyPooBahsRedBlackTreeLibrary

// THIS SOFTWARE IS NOT TESTED OR AUDITED. DO NOT USE FOR PRODUCTION.
// */


// pragma solidity ^0.8.0;

// // library HitchensOrderStatisticsTreeLib {
// library RedBlackTreeLib {
//     uint private constant EMPTY = 2**256 - 1;

//     struct PriceToken {
//         uint tokenId;
//         uint price;
//     }

//     struct Node {
//         uint parent;
//         uint left;
//         uint right;
//         bool red;
//         PriceToken key;  // Single PriceToken per node
//         uint count;
//     }

//     struct Tree {
//         uint root;
//         mapping(uint => Node) nodes;
//         uint size;
//     }

//     function getNodeByTokenId(Tree storage self, uint value) external view returns (Node memory) {
//         require(exists(self, value), "OrderStatisticsTree - Value does not exist.");
//         return self.nodes[value];
//     }

//     function getPriceTokenByTokenId(Tree storage self, uint value) external view returns (PriceToken memory) {
//         require(exists(self, value), "OrderStatisticsTree - Value does not exist.");
//         return self.nodes[value].key;
//     }

//     function getPriceTokenByIndex(Tree storage self, uint index) external view returns (PriceToken memory) {
//         return getPriceTokenAtRank(self, index + 1);
//     }

//     function getPriceTokenAtRank(Tree storage self, uint rank) external view returns (PriceToken memory) {
//         require(rank > 0 && rank <= count(self), "OrderStatisticsTree - Rank is out of bounds.");
        
//         uint cursor = self.root;
//         while (cursor != EMPTY) {
//             Node storage node = self.nodes[cursor];
//             uint leftCount = getNodeCount(self, node.left);
            
//             if (rank <= leftCount) {
//                 cursor = node.left; // Move to the left subtree
//             } else if (rank == leftCount + 1) {
//                 return node.key; // Found the node at the exact rank
//             } else {
//                 rank -= (leftCount + 1); // Adjust rank and move to the right subtree
//                 cursor = node.right;
//             }
//         }
        
//         revert("OrderStatisticsTree - Rank not found."); // This should never be reached if the rank is valid
//     }


//     function first(Tree storage self) external view returns (uint _value) {
//         _value = self.root;
//         if (_value == EMPTY) return EMPTY;
//         while (self.nodes[_value].left != EMPTY) {
//             _value = self.nodes[_value].left;
//         }
//     }

//     function last(Tree storage self) external view returns (uint _value) {
//         _value = self.root;
//         if (_value == EMPTY) return EMPTY;
//         while (self.nodes[_value].right != EMPTY) {
//             _value = self.nodes[_value].right;
//         }
//     }

//     function next(Tree storage self, uint value) external view returns (uint _cursor) {
//         require(value != EMPTY, "OrderStatisticsTree(401) - Starting value cannot be EMPTY");
//         if (self.nodes[value].right != EMPTY) {
//             _cursor = treeMinimum(self, self.nodes[value].right);
//         } else {
//             _cursor = self.nodes[value].parent;
//             while (_cursor != EMPTY && value == self.nodes[_cursor].right) {
//                 value = _cursor;
//                 _cursor = self.nodes[_cursor].parent;
//             }
//         }
//     }

//     function prev(Tree storage self, uint value) external view returns (uint _cursor) {
//         require(value != EMPTY, "OrderStatisticsTree(402) - Starting value cannot be EMPTY");
//         if (self.nodes[value].left != EMPTY) {
//             _cursor = treeMaximum(self, self.nodes[value].left);
//         } else {
//             _cursor = self.nodes[value].parent;
//             while (_cursor != EMPTY && value == self.nodes[_cursor].left) {
//                 value = _cursor;
//                 _cursor = self.nodes[_cursor].parent;
//             }
//         }
//     }

//     function exists(Tree storage self, uint value) external view returns (bool _exists) {
//         if (value == EMPTY) return false;
//         if (value == self.root) return true;
//         if (self.nodes[value].parent != EMPTY) return true;
//         return false;
//     }

//     function getNode(Tree storage self, uint value) external view returns (uint _parent, uint _left, uint _right, bool _red, PriceToken memory _key, uint count) {
//         require(exists(self, value), "OrderStatisticsTree(403) - Value does not exist.");
//         Node storage gn = self.nodes[value];
//         return (gn.parent, gn.left, gn.right, gn.red, gn.key, gn.count);
//     }

//     function getNodeCount(Tree storage self, uint value) external view returns (uint count) {
//         Node storage gn = self.nodes[value];
//         return gn.count;
//     }

//     function count(Tree storage self) external view returns (uint _count) {
//         return getNodeCount(self, self.root);
//     }

//     function percentile(Tree storage self, uint value) external view returns (uint _percentile) {
//         uint denominator = count(self);
//         uint numerator = rank(self, value);
//         _percentile = ((uint(1000) * numerator) / denominator + uint(5)) / uint(10);
//     }

//     function permil(Tree storage self, uint value) external view returns (uint _permil) {
//         uint denominator = count(self);
//         uint numerator = rank(self, value);
//         _permil = ((uint(10000) * numerator) / denominator + uint(5)) / uint(10);
//     }

//     function atPercentile(Tree storage self, uint _percentile) external view returns (uint _value) {
//         uint findRank = (((_percentile * count(self)) / uint(10)) + uint(5)) / uint(10);
//         return atRank(self, findRank);
//     }

//     function atPermil(Tree storage self, uint _permil) external view returns (uint _value) {
//         uint findRank = (((_permil * count(self)) / uint(100)) + uint(5)) / uint(10);
//         return atRank(self, findRank);
//     }

//     function median(Tree storage self) external view returns (uint value) {
//         return atPercentile(self, 50);
//     }

//     function below(Tree storage self, uint value) public view returns (uint _below) {
//         if (count(self) > 0 && value > 0) _below = rank(self, value) - uint(1);
//     }

//     function above(Tree storage self, uint value) public view returns (uint _above) {
//         if (count(self) > 0) _above = count(self) - rank(self, value);
//     }

//     function rank(Tree storage self, uint value) external view returns (uint _rank) {
//         if (count(self) > 0) {
//             bool finished;
//             uint cursor = self.root;
//             Node storage c = self.nodes[cursor];
//             uint smaller = getNodeCount(self, c.left);
//             while (!finished) {
//                 if (cursor == value) {
//                     finished = true;
//                 } else {
//                     if (_compare(c.key, PriceToken(0, value)) < 0) {
//                         cursor = c.right;
//                         c = self.nodes[cursor];
//                         smaller += getNodeCount(self, c.left);
//                     } else {
//                         cursor = c.left;
//                         c = self.nodes[cursor];
//                         smaller -= getNodeCount(self, c.right);
//                     }
//                 }
//                 if (!exists(self, cursor)) {
//                     finished = true;
//                 }
//             }
//             return smaller + 1;
//         }
//     }

//     function atRank(Tree storage self, uint _rank) external view returns (uint _value) {
//         bool finished;
//         uint cursor = self.root;
//         Node storage c = self.nodes[cursor];
//         uint smaller = getNodeCount(self, c.left);
//         while (!finished) {
//             _value = cursor;
//             c = self.nodes[cursor];
//             if (smaller + 1 == _rank) {
//                 _value = cursor;
//                 finished = true;
//             } else {
//                 if (smaller + 1 < _rank) {
//                     cursor = c.right;
//                     c = self.nodes[cursor];
//                     smaller += getNodeCount(self, c.left);
//                 } else {
//                     cursor = c.left;
//                     c = self.nodes[cursor];
//                     smaller -= getNodeCount(self, c.right);
//                 }
//             }
//             if (!exists(self, cursor)) {
//                 finished = true;
//             }
//         }
//     }

//     function insert(Tree storage self, PriceToken memory key, uint value) external {
//         require(value != EMPTY, "OrderStatisticsTree(405) - Value to insert cannot be EMPTY");
//         uint cursor = EMPTY;
//         uint probe = self.root;
//         //if tree is not empty
//         if(self.size != 0) {
//             while (probe != EMPTY) {
//                 cursor = probe;
//                 if (_compare(key, self.nodes[probe].key) < 0) {
//                     probe = self.nodes[probe].left;
//                 } else if (_compare(key, self.nodes[probe].key) > 0) {
//                     probe = self.nodes[probe].right;
//                 } else {
//                     revert("OrderStatisticsTree(406) - Duplicate PriceToken detected.");  // Prevent duplicates
//                 }
//                 self.nodes[cursor].count++;
//             }
//         }
//         Node storage nValue = self.nodes[value];
//         nValue.parent = cursor;
//         nValue.left = EMPTY;
//         nValue.right = EMPTY;
//         nValue.red = true;
//         nValue.key = key;  // Assign the key (PriceToken) to the node
//         nValue.count++;
//         if (cursor == EMPTY) {
//             self.root = value;
//         } else if (_compare(key, self.nodes[cursor].key) < 0) {
//             self.nodes[cursor].left = value;
//         } else {
//             self.nodes[cursor].right = value;
//         }
//         insertFixup(self, value);

//         self.size++;
//     }

//     function remove(Tree storage self, uint value) external {
//         require(value != EMPTY, "OrderStatisticsTree(407) - Value to delete cannot be EMPTY");
//         require(exists(self, value), "OrderStatisticsTree(408) - Value to delete does not exist.");
//         Node storage nValue = self.nodes[value];
//         uint probe;
//         uint cursor;
//         if (self.nodes[value].left == EMPTY || self.nodes[value].right == EMPTY) {
//             cursor = value;
//         } else {
//             cursor = self.nodes[value].right;
//             while (self.nodes[cursor].left != EMPTY) { 
//                 cursor = self.nodes[cursor].left;
//             }
//         } 
//         if (self.nodes[cursor].left != EMPTY) {
//             probe = self.nodes[cursor].left; 
//         } else {
//             probe = self.nodes[cursor].right; 
//         }
//         uint cursorParent = self.nodes[cursor].parent;
//         self.nodes[probe].parent = cursorParent;
//         if (cursorParent != EMPTY) {
//             if (cursor == self.nodes[cursorParent].left) {
//                 self.nodes[cursorParent].left = probe;
//             } else {
//                 self.nodes[cursorParent].right = probe;
//             }
//         } else {
//             self.root = probe;
//         }
//         bool doFixup = !self.nodes[cursor].red;
//         if (cursor != value) {
//             replaceParent(self, cursor, value); 
//             self.nodes[cursor].left = self.nodes[value].left;
//             self.nodes[self.nodes[cursor].left].parent = cursor;
//             self.nodes[cursor].right = self.nodes[value].right;
//             self.nodes[self.nodes[cursor].right].parent = cursor;
//             self.nodes[cursor].red = self.nodes[value].red;
//             (cursor, value) = (value, cursor);
//             fixCountRecurse(self, value);
//         }
//         if (doFixup) {
//             removeFixup(self, probe);
//         }
//         fixCountRecurse(self, cursorParent);
//         delete self.nodes[cursor];

//         self.size--;
//     }

//     function fixCountRecurse(Tree storage self, uint value) private {
//         while (value != EMPTY) {
//             self.nodes[value].count = getNodeCount(self, self.nodes[value].left) + getNodeCount(self, self.nodes[value].right);
//             value = self.nodes[value].parent;
//         }
//     }

//     function treeMinimum(Tree storage self, uint value) private view returns (uint) {
//         while (self.nodes[value].left != EMPTY) {
//             value = self.nodes[value].left;
//         }
//         return value;
//     }

//     function treeMaximum(Tree storage self, uint value) private view returns (uint) {
//         while (self.nodes[value].right != EMPTY) {
//             value = self.nodes[value].right;
//         }
//         return value;
//     }

//     function rotateLeft(Tree storage self, uint value) private {
//         uint cursor = self.nodes[value].right;
//         uint parent = self.nodes[value].parent;
//         uint cursorLeft = self.nodes[cursor].left;
//         self.nodes[value].right = cursorLeft;
//         if (cursorLeft != EMPTY) {
//             self.nodes[cursorLeft].parent = value;
//         }
//         self.nodes[cursor].parent = parent;
//         if (parent == EMPTY) {
//             self.root = cursor;
//         } else if (value == self.nodes[parent].left) {
//             self.nodes[parent].left = cursor;
//         } else {
//             self.nodes[parent].right = cursor;
//         }
//         self.nodes[cursor].left = value;
//         self.nodes[value].parent = cursor;
//         self.nodes[value].count = getNodeCount(self, self.nodes[value].left) + getNodeCount(self, self.nodes[value].right);
//         self.nodes[cursor].count = getNodeCount(self, self.nodes[cursor].left) + getNodeCount(self, self.nodes[cursor].right);
//     }

//     function rotateRight(Tree storage self, uint value) private {
//         uint cursor = self.nodes[value].left;
//         uint parent = self.nodes[value].parent;
//         uint cursorRight = self.nodes[cursor].right;
//         self.nodes[value].left = cursorRight;
//         if (cursorRight != EMPTY) {
//             self.nodes[cursorRight].parent = value;
//         }
//         self.nodes[cursor].parent = parent;
//         if (parent == EMPTY) {
//             self.root = cursor;
//         } else if (value == self.nodes[parent].right) {
//             self.nodes[parent].right = cursor;
//         } else {
//             self.nodes[parent].left = cursor;
//         }
//         self.nodes[cursor].right = value;
//         self.nodes[value].parent = cursor;
//         self.nodes[value].count = getNodeCount(self, self.nodes[value].left) + getNodeCount(self, self.nodes[value].right);
//         self.nodes[cursor].count = getNodeCount(self, self.nodes[cursor].left) + getNodeCount(self, self.nodes[cursor].right);
//     }

//     function insertFixup(Tree storage self, uint value) private {
//         uint cursor;
//         while (value != self.root && self.nodes[self.nodes[value].parent].red) {
//             uint valueParent = self.nodes[value].parent;
//             if (valueParent == self.nodes[self.nodes[valueParent].parent].left) {
//                 cursor = self.nodes[self.nodes[valueParent].parent].right;
//                 if (self.nodes[cursor].red) {
//                     self.nodes[valueParent].red = false;
//                     self.nodes[cursor].red = false;
//                     self.nodes[self.nodes[valueParent].parent].red = true;
//                     value = self.nodes[valueParent].parent;
//                 } else {
//                     if (value == self.nodes[valueParent].right) {
//                         value = valueParent;
//                         rotateLeft(self, value);
//                     }
//                     valueParent = self.nodes[value].parent;
//                     self.nodes[valueParent].red = false;
//                     self.nodes[self.nodes[valueParent].parent].red = true;
//                     rotateRight(self, self.nodes[valueParent].parent);
//                 }
//             } else {
//                 cursor = self.nodes[self.nodes[valueParent].parent].left;
//                 if (self.nodes[cursor].red) {
//                     self.nodes[valueParent].red = false;
//                     self.nodes[cursor].red = false;
//                     self.nodes[self.nodes[valueParent].parent].red = true;
//                     value = self.nodes[valueParent].parent;
//                 } else {
//                     if (value == self.nodes[valueParent].left) {
//                         value = valueParent;
//                         rotateRight(self, value);
//                     }
//                     valueParent = self.nodes[value].parent;
//                     self.nodes[valueParent].red = false;
//                     self.nodes[self.nodes[valueParent].parent].red = true;
//                     rotateLeft(self, self.nodes[valueParent].parent);
//                 }
//             }
//         }
//         self.nodes[self.root].red = false;
//     }

//     function replaceParent(Tree storage self, uint a, uint b) private {
//         uint bParent = self.nodes[b].parent;
//         self.nodes[a].parent = bParent;
//         if (bParent == EMPTY) {
//             self.root = a;
//         } else {
//             if (b == self.nodes[bParent].left) {
//                 self.nodes[bParent].left = a;
//             } else {
//                 self.nodes[bParent].right = a;
//             }
//         }
//     }

//     function removeFixup(Tree storage self, uint value) private {
//         uint cursor;
//         while (value != self.root && !self.nodes[value].red) {
//             uint valueParent = self.nodes[value].parent;
//             if (value == self.nodes[valueParent].left) {
//                 cursor = self.nodes[valueParent].right;
//                 if (self.nodes[cursor].red) {
//                     self.nodes[cursor].red = false;
//                     self.nodes[valueParent].red = true;
//                     rotateLeft(self, valueParent);
//                     cursor = self.nodes[valueParent].right;
//                 }
//                 if (!self.nodes[self.nodes[cursor].left].red && !self.nodes[self.nodes[cursor].right].red) {
//                     self.nodes[cursor].red = true;
//                     value = valueParent;
//                 } else {
//                     if (!self.nodes[self.nodes[cursor].right].red) {
//                         self.nodes[self.nodes[cursor].left].red = false;
//                         self.nodes[cursor].red = true;
//                         rotateRight(self, cursor);
//                         cursor = self.nodes[valueParent].right;
//                     }
//                     self.nodes[cursor].red = self.nodes[valueParent].red;
//                     self.nodes[valueParent].red = false;
//                     self.nodes[self.nodes[cursor].right].red = false;
//                     rotateLeft(self, valueParent);
//                     value = self.root;
//                 }
//             } else {
//                 cursor = self.nodes[valueParent].left;
//                 if (self.nodes[cursor].red) {
//                     self.nodes[cursor].red = false;
//                     self.nodes[valueParent].red = true;
//                     rotateRight(self, valueParent);
//                     cursor = self.nodes[valueParent].left;
//                 }
//                 if (!self.nodes[self.nodes[cursor].right].red && !self.nodes[self.nodes[cursor].left].red) {
//                     self.nodes[cursor].red = true;
//                     value = valueParent;
//                 } else {
//                     if (!self.nodes[self.nodes[cursor].left].red) {
//                         self.nodes[self.nodes[cursor].right].red = false;
//                         self.nodes[cursor].red = true;
//                         rotateLeft(self, cursor);
//                         cursor = self.nodes[valueParent].left;
//                     }
//                     self.nodes[cursor].red = self.nodes[valueParent].red;
//                     self.nodes[valueParent].red = false;
//                     self.nodes[self.nodes[cursor].left].red = false;
//                     rotateRight(self, valueParent);
//                     value = self.root;
//                 }
//             }
//         }
//         self.nodes[value].red = false;
//     }

//     function _compare(PriceToken memory a, PriceToken memory b) private pure returns (int) {
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
// }

















// // library RedBlackTreeLib {
// //     struct PriceToken {
// //         uint256 price;
// //         uint256 tokenId;
// //     }

// //     struct Node {
// //         PriceToken data;
// //         uint256 parent;
// //         uint256 left;
// //         uint256 right;
// //         bool red;
// //         uint256 size; // Number of nodes in the subtree rooted at this node
// //     }

// //     struct Tree {
// //         uint256 root;
// //         mapping(uint256 => Node) nodes;
// //         // mapping(uint256 => uint256) indexToTokenId;
// //         // mapping(uint256 => uint256) tokenIdToIndex;
// //         uint256 size;
// //     }

// // function getTreeStructure(Tree storage self) external view returns (string memory) {
// //     if (self.size == 0) {
// //         return "Tree is empty";
// //     }
// //     return _printTree(self, self.root, 0);
// // }

// // function _printTree(Tree storage self, uint256 nodeIndex, uint256 depth) private view returns (string memory) {
// //     if (nodeIndex == NULL_INDEX) {
// //         return "";
// //     }

// //     Node storage node = self.nodes[nodeIndex];
// //     string memory color = node.red ? "R" : "B";
// //     string memory indent = _repeat(" ", depth * 2);

// //     string memory result = string(
// //         abi.encodePacked(
// //             indent,
// //             "Node (Price: ", _uint2str(node.data.price),
// //             ", TokenId: ", _uint2str(node.data.tokenId),
// //             ", Color: ", color,
// //             ", Size: ", _uint2str(node.size),
// //             ")\n"
// //         )
// //     );

// //     string memory leftTree = _printTree(self, node.left, depth + 1);
// //     string memory rightTree = _printTree(self, node.right, depth + 1);

// //     return string(abi.encodePacked(result, leftTree, rightTree));
// // }

// // function _repeat(string memory str, uint256 times) private pure returns (string memory) {
// //     string memory repeated = "";
// //     for (uint256 i = 0; i < times; i++) {
// //         repeated = string(abi.encodePacked(repeated, str));
// //     }
// //     return repeated;
// // }

// // function _uint2str(uint256 _i) private pure returns (string memory) {
// //     if (_i == 0) {
// //         return "0";
// //     }
// //     uint256 j = _i;
// //     uint256 len;
// //     while (j != 0) {
// //         len++;
// //         j /= 10;
// //     }
// //     bytes memory bstr = new bytes(len);
// //     uint256 k = len - 1;
// //     while (_i != 0) {
// //         bstr[k--] = bytes1(uint8(48 + _i % 10));
// //         _i /= 10;
// //     }
// //     return string(bstr);
// // }

// //     uint256 constant NULL_INDEX = 2**256 - 1; // Sentinel value for null pointers

// //         function uint2str(uint _i) external pure returns (string memory) {
// //         if (_i == 0) {
// //             return "0";
// //         }
// //         uint j = _i;
// //         uint len;
// //         while (j != 0) {
// //             len++;
// //             j /= 10;
// //         }
// //         bytes memory bstr = new bytes(len);
// //         uint k = len - 1;
// //         while (_i != 0) {
// //             bstr[k--] = byte(uint8(48 + _i % 10));
// //             _i /= 10;
// //         }
// //         return string(bstr);
// //     }

// //     // function insert(Tree storage self, PriceToken memory data) external {
// //     //     uint256 newNodeIndex = data.tokenId;
// //     //     require(newNodeIndex != NULL_INDEX, "RedBlackTree: tokenId cannot be the sentinel value");
// //     //     require(self.size == 0 || (self.tokenIdToIndex[data.tokenId] == 0 && self.nodes[_min(self, self.root)].data.tokenId != data.tokenId), "RedBlackTree: tokenId already exists in the RB Tree");
        
// //     //     self.nodes[newNodeIndex] = Node({data: data, parent: NULL_INDEX, left: NULL_INDEX, right: NULL_INDEX, red: true, size: 1});
// //     //     self.size++;
        
// //     //     uint256 y = NULL_INDEX;
// //     //     uint256 x = self.root;

// //     //     // If the tree is empty, insert the first node as the root
// //     //     if (self.size == 0) {
// //     //         self.root = newNodeIndex;  // Set the root to the new node's index
// //     //         self.nodes[newNodeIndex] = Node({
// //     //             data: data,
// //     //             parent: NULL_INDEX,
// //     //             left: NULL_INDEX,
// //     //             right: NULL_INDEX,
// //     //             red: false,  // Root is always black in a Red-Black Tree
// //     //             size: 1
// //     //         });
// //     //         self.size = 1;  // Update the size of the tree
// //     //         self.tokenIdToIndex[data.tokenId] = newNodeIndex;  // Update the index map
// //     //         _updateIndexes(self, newNodeIndex);  // Update any other indexing or bookkeeping
// //     //         return;  // Exit the function after inserting the first node
// //     //     }
        
// //     //     while (x != NULL_INDEX) {
// //     //         y = x;
// //     //         self.nodes[x].size++; // Update size during insertion
// //     //         if (_compare(data, self.nodes[x].data) < 0) {
// //     //             x = self.nodes[x].left;
// //     //         } else {
// //     //             x = self.nodes[x].right;
// //     //         }

// //     //                 // Logic to check for infinite loop
// //     //         require(x != y, string(abi.encodePacked("Infinite loop detected during insertion: ", uint2str(x), ":", uint2str(y))));

// //     //     }

// //     //     self.nodes[newNodeIndex].parent = y;

// //     //     if (y == NULL_INDEX) {
// //     //         self.root = newNodeIndex;
// //     //     } else if (_compare(data, self.nodes[y].data) < 0) {
// //     //         self.nodes[y].left = newNodeIndex;
// //     //     } else {
// //     //         self.nodes[y].right = newNodeIndex;
// //     //     }

// //     //     _insertFixup(self, newNodeIndex);

// //     //     // Update indexing maps
// //     //     self.tokenIdToIndex[data.tokenId] = newNodeIndex;
// //     //     _updateIndexes(self, newNodeIndex);
// //     // }

// // function insert(Tree storage self, PriceToken memory data) external {
// //     uint256 newNodeIndex = data.tokenId;
// //     require(newNodeIndex != NULL_INDEX, "RedBlackTree: tokenId cannot be the sentinel value");
// //     require(self.size == 0 || (self.nodes[data.tokenId].data.tokenId == 0 && self.nodes[_min(self, self.root)].data.tokenId != data.tokenId), "RedBlackTree: tokenId already exists in the RB Tree");

// //     // If the tree is empty, insert the first node as the root
// //     if (self.size == 0) {
// //         self.root = newNodeIndex;  // Set the root to the new node's index
// //         self.nodes[newNodeIndex] = Node({
// //             data: data,
// //             parent: NULL_INDEX,
// //             left: NULL_INDEX,
// //             right: NULL_INDEX,
// //             red: false,  // Root is always black in a Red-Black Tree
// //             size: 1
// //         });
// //         self.size = 1;  // Update the size of the tree
// //         // self.tokenIdToIndex[data.tokenId] = newNodeIndex;  // Update the index map
// //         // _updateIndexes(self, newNodeIndex);  // Update any other indexing or bookkeeping
// //         return;  // Exit the function after inserting the first node
// //     }

// //     // For subsequent insertions, we need to find the correct position in the tree
// //     uint256 y = NULL_INDEX;
// //     uint256 x = self.root;  // Start traversal from the root

// //     while (x != NULL_INDEX) {
// //         y = x;
// //         self.nodes[x].size++; // Update size during insertion

// //         if (_compare(data, self.nodes[x].data) < 0) {
// //             x = self.nodes[x].left;
// //         } else {
// //             x = self.nodes[x].right;
// //         }
// //     }

// //     // y is now the parent node where the new node should be inserted as a child
// //     self.nodes[newNodeIndex] = Node({
// //         data: data,
// //         parent: y,
// //         left: NULL_INDEX,
// //         right: NULL_INDEX,
// //         red: true,  // New nodes are red initially
// //         size: 1
// //     });

// //     if (_compare(data, self.nodes[y].data) < 0) {
// //         self.nodes[y].left = newNodeIndex;  // Insert as the left child
// //     } else {
// //         self.nodes[y].right = newNodeIndex; // Insert as the right child
// //     }

// //     _insertFixup(self, newNodeIndex);  // Fix up the tree to maintain red-black properties

// //     self.size++;

// //     // Update indexing maps
// //     // self.tokenIdToIndex[data.tokenId] = newNodeIndex;
// //     // _updateIndexes(self, newNodeIndex);
// // }

// //     function remove(Tree storage self, uint256 tokenId) external {

// //             // require(false, string(abi.encodePacked("spongebob ", uint2str(self.tokenIdToIndex[tokenId]), ":", uint2str(self.tokenIdToIndex[tokenId]))));

// //         // uint256 nodeIndex = self.tokenIdToIndex[tokenId];
// //         uint256 nodeIndex = tokenId;
// //         require(nodeIndex != NULL_INDEX, "RedBlackTree: node not found");

// //         // require(false, string(abi.encodePacked("APPLEBEES ", uint2str(self.size), ":", uint2str(self.size))));
// //         _delete(self, nodeIndex);

// //         // Update indexing maps
// //         // delete self.tokenIdToIndex[tokenId];
// //         // _updateIndexes(self, self.root);
// //         self.size--;

// //     }

// //     function getByIndex(Tree storage self, uint256 index) external view returns (PriceToken memory) {
// //         require(index < self.size, "RedBlackTree: index out of bounds");
// //         // uint256 nodeIndex = _findByIndex(self, self.root, index);
// //         // return self.nodes[nodeIndex].data;
// //         return _findByIndex(self, index);
// //     }

// //     function getByTokenId(Tree storage self, uint256 tokenId) external view returns (Node memory) {
// //         uint256 nodeIndex = tokenId; // Assuming tokenId is directly used as the index in the nodes mapping
// //         require(nodeIndex != NULL_INDEX, "RedBlackTree: invalid tokenId");
// //         require(self.nodes[nodeIndex].parent != NULL_INDEX || nodeIndex == self.root, "RedBlackTree: node not found");

// //         return self.nodes[nodeIndex];
// //     }

// //     function getMin(Tree storage self) external view returns (PriceToken memory) {
// //         require(self.size > 0, "RedBlackTree: tree is empty");
// //         uint256 nodeIndex = _min(self, self.root);
// //         return self.nodes[nodeIndex].data;
// //     }

// //     function getMax(Tree storage self) external view returns (PriceToken memory) {
// //         require(self.size > 0, "RedBlackTree: tree is empty");
// //         uint256 nodeIndex = _max(self, self.root);
// //         return self.nodes[nodeIndex].data;
// //     }

// //     function size(Tree storage self) external view returns (uint256) {
// //         return self.size;
// //     }

// //     function _findByIndex(Tree storage self, uint256 index) external view returns (PriceToken memory) {
// //         require(index < self.size, "RedBlackTree: index out of bounds");

// //         uint256 currentNodeIndex = self.root;

// //         while (currentNodeIndex != NULL_INDEX) {
// //             uint256 leftSize = self.nodes[self.nodes[currentNodeIndex].left].size;

// //             if (index < leftSize) {
// //                 // Move to the left child
// //                 currentNodeIndex = self.nodes[currentNodeIndex].left;
// //             } else if (index > leftSize) {
// //                 // Move to the right child and adjust the index
// //                 index = index - leftSize - 1;
// //                 currentNodeIndex = self.nodes[currentNodeIndex].right;
// //             } else {
// //                 // Current node is the one we're looking for
// //                 return self.nodes[currentNodeIndex].data;
// //             }
// //         }

// //         revert("RedBlackTree: node not found"); // This should never happen if the index is valid
// //     }

// //     // function _updateIndexes(Tree storage self, uint256 nodeIndex) private {
// //     //     if (nodeIndex == NULL_INDEX) return;

// //     //     uint256 leftSize = _subtreeSize(self, self.nodes[nodeIndex].left);
// //     //     self.indexToTokenId[leftSize] = nodeIndex;
// //     //     self.tokenIdToIndex[self.nodes[nodeIndex].data.tokenId] = leftSize;

// //     //     _updateIndexes(self, self.nodes[nodeIndex].left);
// //     //     _updateIndexes(self, self.nodes[nodeIndex].right);
// //     // }

// //     function _subtreeSize(Tree storage self, uint256 nodeIndex) private view returns (uint256) {
// //         if (nodeIndex == NULL_INDEX) return 0;
// //         return self.nodes[nodeIndex].size;
// //     }

// //     function _rotateLeft(Tree storage self, uint256 nodeIndex) private {
// //         uint256 rightNodeIndex = self.nodes[nodeIndex].right;
// //         self.nodes[nodeIndex].right = self.nodes[rightNodeIndex].left;

// //         if (self.nodes[rightNodeIndex].left != NULL_INDEX) {
// //             self.nodes[self.nodes[rightNodeIndex].left].parent = nodeIndex;
// //         }

// //         self.nodes[rightNodeIndex].parent = self.nodes[nodeIndex].parent;

// //         if (self.nodes[nodeIndex].parent == NULL_INDEX) {
// //             self.root = rightNodeIndex;
// //         } else if (nodeIndex == self.nodes[self.nodes[nodeIndex].parent].left) {
// //             self.nodes[self.nodes[nodeIndex].parent].left = rightNodeIndex;
// //         } else {
// //             self.nodes[self.nodes[nodeIndex].parent].right = rightNodeIndex;
// //         }

// //         self.nodes[rightNodeIndex].left = nodeIndex;
// //         self.nodes[nodeIndex].parent = rightNodeIndex;

// //         // Update size
// //         self.nodes[nodeIndex].size = _subtreeSize(self, self.nodes[nodeIndex].left) + _subtreeSize(self, self.nodes[nodeIndex].right) + 1;
// //         self.nodes[rightNodeIndex].size = _subtreeSize(self, self.nodes[rightNodeIndex].left) + _subtreeSize(self, self.nodes[rightNodeIndex].right) + 1;
// //     }

// //     function _rotateRight(Tree storage self, uint256 nodeIndex) private {
// //         uint256 leftNodeIndex = self.nodes[nodeIndex].left;
// //         self.nodes[nodeIndex].left = self.nodes[leftNodeIndex].right;

// //         if (self.nodes[leftNodeIndex].right != NULL_INDEX) {
// //             self.nodes[self.nodes[leftNodeIndex].right].parent = nodeIndex;
// //         }

// //         self.nodes[leftNodeIndex].parent = self.nodes[nodeIndex].parent;

// //         if (self.nodes[nodeIndex].parent == NULL_INDEX) {
// //             self.root = leftNodeIndex;
// //         } else if (nodeIndex == self.nodes[self.nodes[nodeIndex].parent].left) {
// //             self.nodes[self.nodes[nodeIndex].parent].left = leftNodeIndex;
// //         } else {
// //             self.nodes[self.nodes[nodeIndex].parent].right = leftNodeIndex;
// //         }

// //         self.nodes[leftNodeIndex].right = nodeIndex;
// //         self.nodes[nodeIndex].parent = leftNodeIndex;

// //         // Update size
// //         self.nodes[nodeIndex].size = _subtreeSize(self, self.nodes[nodeIndex].left) + _subtreeSize(self, self.nodes[nodeIndex].right) + 1;
// //         self.nodes[leftNodeIndex].size = _subtreeSize(self, self.nodes[leftNodeIndex].left) + _subtreeSize(self, self.nodes[leftNodeIndex].right) + 1;
// //     }

// //     // function _insertFixup(Tree storage self, uint256 nodeIndex) private {
// //     //     uint256 parentNodeIndex;

// //     //     while (nodeIndex != self.root && self.nodes[nodeIndex].red && self.nodes[self.nodes[nodeIndex].parent].red) {
// //     //         parentNodeIndex = self.nodes[nodeIndex].parent;
// //     //         if (parentNodeIndex == self.nodes[self.nodes[parentNodeIndex].parent].left) {
// //     //             uint256 uncleIndex = self.nodes[self.nodes[parentNodeIndex].parent].right;
// //     //             if (self.nodes[uncleIndex].red) {
// //     //                 self.nodes[parentNodeIndex].red = false;
// //     //                 self.nodes[uncleIndex].red = false;
// //     //                 self.nodes[self.nodes[parentNodeIndex].parent].red = true;
// //     //                 nodeIndex = self.nodes[parentNodeIndex].parent;
// //     //             } else {
// //     //                 if (nodeIndex == self.nodes[parentNodeIndex].right) {
// //     //                     nodeIndex = parentNodeIndex;
// //     //                     _rotateLeft(self, nodeIndex);
// //     //                 }
// //     //                 self.nodes[self.nodes[nodeIndex].parent].red = false;
// //     //                 self.nodes[self.nodes[self.nodes[nodeIndex].parent].parent].red = true;
// //     //                 _rotateRight(self, self.nodes[self.nodes[nodeIndex].parent].parent);
// //     //             }
// //     //         } else {
// //     //             uint256 uncleIndex = self.nodes[self.nodes[parentNodeIndex].parent].left;
// //     //             if (self.nodes[uncleIndex].red) {
// //     //                 self.nodes[parentNodeIndex].red = false;
// //     //                 self.nodes[uncleIndex].red = false;
// //     //                 self.nodes[self.nodes[parentNodeIndex].parent].red = true;
// //     //                 nodeIndex = self.nodes[parentNodeIndex].parent;
// //     //             } else {
// //     //                 if (nodeIndex == self.nodes[parentNodeIndex].left) {
// //     //                     nodeIndex = parentNodeIndex;
// //     //                     _rotateRight(self, nodeIndex);
// //     //                 }
// //     //                 self.nodes[self.nodes[nodeIndex].parent].red = false;
// //     //                 self.nodes[self.nodes[self.nodes[nodeIndex].parent].parent].red = true;
// //     //                 _rotateLeft(self, self.nodes[self.nodes[nodeIndex].parent].parent);
// //     //             }
// //     //         }
// //     //     }
// //     //     self.nodes[self.root].red = false;
// //     // }
// // function _insertFixup(Tree storage self, uint256 nodeIndex) private {
// //     while (self.nodes[self.nodes[nodeIndex].parent].red) {
// //         uint256 parentIndex = self.nodes[nodeIndex].parent;
// //         uint256 grandparentIndex = self.nodes[parentIndex].parent;

// //         if (parentIndex == self.nodes[grandparentIndex].left) {
// //             uint256 uncleIndex = self.nodes[grandparentIndex].right;

// //             if (self.nodes[uncleIndex].red) {
// //                 self.nodes[parentIndex].red = false;
// //                 self.nodes[uncleIndex].red = false;
// //                 self.nodes[grandparentIndex].red = true;
// //                 nodeIndex = grandparentIndex;
// //             } else {
// //                 if (nodeIndex == self.nodes[parentIndex].right) {
// //                     nodeIndex = parentIndex;
// //                     _rotateLeft(self, nodeIndex);
// //                 }
// //                 self.nodes[self.nodes[nodeIndex].parent].red = false;
// //                 self.nodes[grandparentIndex].red = true;
// //                 _rotateRight(self, grandparentIndex);
// //             }
// //         } else {
// //             uint256 uncleIndex = self.nodes[grandparentIndex].left;

// //             if (self.nodes[uncleIndex].red) {
// //                 self.nodes[parentIndex].red = false;
// //                 self.nodes[uncleIndex].red = false;
// //                 self.nodes[grandparentIndex].red = true;
// //                 nodeIndex = grandparentIndex;
// //             } else {
// //                 if (nodeIndex == self.nodes[parentIndex].left) {
// //                     nodeIndex = parentIndex;
// //                     _rotateRight(self, nodeIndex);
// //                 }
// //                 self.nodes[self.nodes[nodeIndex].parent].red = false;
// //                 self.nodes[grandparentIndex].red = true;
// //                 _rotateLeft(self, grandparentIndex);
// //             }
// //         }
// //     }
// //     self.nodes[self.root].red = false;
// // }



// //     function _delete(Tree storage self, uint256 nodeIndex) private {

// //         uint256 y = nodeIndex;
// //         uint256 x;
// //         bool originalRed = self.nodes[y].red;

// //     // require(false, string(abi.encodePacked("qwefweqfqwefqf ", uint2str(nodeIndex), ":", uint2str(nodeIndex))));


// //         if (self.nodes[nodeIndex].left == NULL_INDEX) {
// //             x = self.nodes[nodeIndex].right;
// //             _transplant(self, nodeIndex, self.nodes[nodeIndex].right);
// //         } else if (self.nodes[nodeIndex].right == NULL_INDEX) {
// //             x = self.nodes[nodeIndex].left;
// //             _transplant(self, nodeIndex, self.nodes[nodeIndex].left);
// //         } else {
// //             y = _min(self, self.nodes[nodeIndex].right);
// //             originalRed = self.nodes[y].red;
// //             x = self.nodes[y].right;

// //             if (self.nodes[y].parent == nodeIndex) {
// //                 self.nodes[x].parent = y;
// //             } else {
// //                 _transplant(self, y, self.nodes[y].right);
// //                 self.nodes[y].right = self.nodes[nodeIndex].right;
// //                 self.nodes[self.nodes[y].right].parent = y;
// //             }

// //             _transplant(self, nodeIndex, y);
// //             self.nodes[y].left = self.nodes[nodeIndex].left;
// //             self.nodes[self.nodes[y].left].parent = y;
// //             self.nodes[y].red = self.nodes[nodeIndex].red;

// //             // Update size
// //             self.nodes[y].size = self.nodes[nodeIndex].size;
// //         }

// //         if (!originalRed) {
// //             _deleteFixup(self, x);
// //         }
// //     }
// // // function _delete(Tree storage self, uint256 nodeIndex) private {
// // //     uint256 y = nodeIndex;
// // //     uint256 x;
// // //     bool originalRed = self.nodes[y].red;

// // //     require(false, string(abi.encodePacked("qwefweqfqwefqf ", uint2str(nodeIndex), ":", uint2str(nodeIndex))));


// // //     if (self.nodes[nodeIndex].left == NULL_INDEX) {
// // //         require(false, "1");
// // //         x = self.nodes[nodeIndex].right;
// // //         _transplant(self, nodeIndex, self.nodes[nodeIndex].right);
// // //     } else if (self.nodes[nodeIndex].right == NULL_INDEX) {
// // //         require(false, "2");
// // //         x = self.nodes[nodeIndex].left;
// // //         _transplant(self, nodeIndex, self.nodes[nodeIndex].left);
// // //     } else {
// // //         y = _min(self, self.nodes[nodeIndex].right);  // Find the minimum node on the right subtree
// // //         require(false, "3");
// // //         originalRed = self.nodes[y].red;
// // //         x = self.nodes[y].right;

// // //         if (self.nodes[y].parent == nodeIndex) {
// // //             if (x != NULL_INDEX) {
// // //                 self.nodes[x].parent = y;
// // //             }
// // //         } else {
// // //             _transplant(self, y, self.nodes[y].right);
// // //             self.nodes[y].right = self.nodes[nodeIndex].right;
// // //             self.nodes[self.nodes[y].right].parent = y;
// // //         }

// // //         _transplant(self, nodeIndex, y);
// // //         self.nodes[y].left = self.nodes[nodeIndex].left;
// // //         self.nodes[self.nodes[y].left].parent = y;
// // //         self.nodes[y].red = self.nodes[nodeIndex].red;

// // //         // Update size correctly
// // //         self.nodes[y].size = self.nodes[self.nodes[y].left].size + self.nodes[self.nodes[y].right].size + 1;
// // //     }

// // //     if (!originalRed) {
// // //         _deleteFixup(self, x);
// // //     }
// // // }

// //     // function _deleteFixup(Tree storage self, uint256 x) private {
// //     //     while (x != self.root && !self.nodes[x].red) {
// //     //         if (x == self.nodes[self.nodes[x].parent].left) {
// //     //             uint256 w = self.nodes[self.nodes[x].parent].right;
// //     //             if (self.nodes[w].red) {
// //     //                 self.nodes[w].red = false;
// //     //                 self.nodes[self.nodes[x].parent].red = true;
// //     //                 _rotateLeft(self, self.nodes[x].parent);
// //     //                 w = self.nodes[self.nodes[x].parent].right;
// //     //             }
// //     //             if (!self.nodes[self.nodes[w].left].red && !self.nodes[self.nodes[w].right].red) {
// //     //                 self.nodes[w].red = true;
// //     //                 x = self.nodes[x].parent;
// //     //             } else {
// //     //                 if (!self.nodes[self.nodes[w].right].red) {
// //     //                     self.nodes[self.nodes[w].left].red = false;
// //     //                     self.nodes[w].red = true;
// //     //                     _rotateRight(self, w);
// //     //                     w = self.nodes[self.nodes[x].parent].right;
// //     //                 }
// //     //                 self.nodes[w].red = self.nodes[self.nodes[x].parent].red;
// //     //                 self.nodes[self.nodes[x].parent].red = false;
// //     //                 self.nodes[self.nodes[w].right].red = false;
// //     //                 _rotateLeft(self, self.nodes[x].parent);
// //     //                 x = self.root;
// //     //             }
// //     //         } else {
// //     //             uint256 w = self.nodes[self.nodes[x].parent].left;
// //     //             if (self.nodes[w].red) {
// //     //                 self.nodes[w].red = false;
// //     //                 self.nodes[self.nodes[x].parent].red = true;
// //     //                 _rotateRight(self, self.nodes[x].parent);
// //     //                 w = self.nodes[self.nodes[x].parent].left;
// //     //             }
// //     //             if (!self.nodes[self.nodes[w].right].red && !self.nodes[self.nodes[w].left].red) {
// //     //                 self.nodes[w].red = true;
// //     //                 x = self.nodes[x].parent;
// //     //             } else {
// //     //                 if (!self.nodes[self.nodes[w].left].red) {
// //     //                     self.nodes[self.nodes[w].right].red = false;
// //     //                     self.nodes[w].red = true;
// //     //                     _rotateLeft(self, w);
// //     //                     w = self.nodes[self.nodes[x].parent].left;
// //     //                 }
// //     //                 self.nodes[w].red = self.nodes[self.nodes[x].parent].red;
// //     //                 self.nodes[self.nodes[x].parent].red = false;
// //     //                 self.nodes[self.nodes[w].left].red = false;
// //     //                 _rotateRight(self, self.nodes[x].parent);
// //     //                 x = self.root;
// //     //             }
// //     //         }
// //     //     }
// //     //     if (x != NULL_INDEX) {
// //     //         self.nodes[x].red = false;
// //     //     }
// //     // }
// // function _deleteFixup(Tree storage self, uint256 x) private {
// //     while (x != self.root && !self.nodes[x].red) {
// //         if (x == self.nodes[self.nodes[x].parent].left) {
// //             uint256 w = self.nodes[self.nodes[x].parent].right;
// //             if (self.nodes[w].red) {
// //                 self.nodes[w].red = false;
// //                 self.nodes[self.nodes[x].parent].red = true;
// //                 _rotateLeft(self, self.nodes[x].parent);
// //                 w = self.nodes[self.nodes[x].parent].right;
// //             }
// //             if (!self.nodes[self.nodes[w].left].red && !self.nodes[self.nodes[w].right].red) {
// //                 self.nodes[w].red = true;
// //                 x = self.nodes[x].parent;
// //             } else {
// //                 if (!self.nodes[self.nodes[w].right].red) {
// //                     self.nodes[self.nodes[w].left].red = false;
// //                     self.nodes[w].red = true;
// //                     _rotateRight(self, w);
// //                     w = self.nodes[self.nodes[x].parent].right;
// //                 }
// //                 self.nodes[w].red = self.nodes[self.nodes[x].parent].red;
// //                 self.nodes[self.nodes[x].parent].red = false;
// //                 self.nodes[self.nodes[w].right].red = false;
// //                 _rotateLeft(self, self.nodes[x].parent);
// //                 x = self.root;
// //             }
// //         } else {
// //             uint256 w = self.nodes[self.nodes[x].parent].left;
// //             if (self.nodes[w].red) {
// //                 self.nodes[w].red = false;
// //                 self.nodes[self.nodes[x].parent].red = true;
// //                 _rotateRight(self, self.nodes[x].parent);
// //                 w = self.nodes[self.nodes[x].parent].left;
// //             }
// //             if (!self.nodes[self.nodes[w].right].red && !self.nodes[self.nodes[w].left].red) {
// //                 self.nodes[w].red = true;
// //                 x = self.nodes[x].parent;
// //             } else {
// //                 if (!self.nodes[self.nodes[w].left].red) {
// //                     self.nodes[self.nodes[w].right].red = false;
// //                     self.nodes[w].red = true;
// //                     _rotateLeft(self, w);
// //                     w = self.nodes[self.nodes[x].parent].left;
// //                 }
// //                 self.nodes[w].red = self.nodes[self.nodes[x].parent].red;
// //                 self.nodes[self.nodes[x].parent].red = false;
// //                 self.nodes[self.nodes[w].left].red = false;
// //                 _rotateRight(self, self.nodes[x].parent);
// //                 x = self.root;
// //             }
// //         }
// //     }
// //     if (x != NULL_INDEX) {
// //         self.nodes[x].red = false;
// //     }
// // }


// //     function _min(Tree storage self, uint256 nodeIndex) private view returns (uint256) {
// //         while (self.nodes[nodeIndex].left != NULL_INDEX) {
// //             // require(false, string(abi.encodePacked("Infinite loop detected during insertion: ", uint2str(self.nodes[nodeIndex].size), ":", uint2str(self.nodes[nodeIndex].size))));
// //             nodeIndex = self.nodes[nodeIndex].left;
// //         }
// //         return nodeIndex;
// //     }

// //     function _max(Tree storage self, uint256 nodeIndex) private view returns (uint256) {
// //         while (self.nodes[nodeIndex].right != NULL_INDEX) {
// //             nodeIndex = self.nodes[nodeIndex].right;
// //         }
// //         return nodeIndex;
// //     }

// //     function _transplant(Tree storage self, uint256 u, uint256 v) private {
// //         if (self.nodes[u].parent == NULL_INDEX) {
// //             self.root = v;
// //         } else if (u == self.nodes[self.nodes[u].parent].left) {
// //             self.nodes[self.nodes[u].parent].left = v;
// //         } else {
// //             self.nodes[self.nodes[u].parent].right = v;
// //         }
// //         if (v != NULL_INDEX) {
// //             self.nodes[v].parent = self.nodes[u].parent;
// //         }

// //         // Update size
// //         while (u != NULL_INDEX) {
// //             self.nodes[u].size = _subtreeSize(self, self.nodes[u].left) + _subtreeSize(self, self.nodes[u].right) + 1;
// //             u = self.nodes[u].parent;
// //         }
// //     }
// // // function _transplant(Tree storage self, uint256 u, uint256 v) private {
// // //     if (self.nodes[u].parent == NULL_INDEX) {
// // //         self.root = v;
// // //     } else if (u == self.nodes[self.nodes[u].parent].left) {
// // //         self.nodes[self.nodes[u].parent].left = v;
// // //     } else {
// // //         self.nodes[self.nodes[u].parent].right = v;
// // //     }
// // //     if (v != NULL_INDEX) {
// // //         self.nodes[v].parent = self.nodes[u].parent;
// // //     }

// // //     // Update size for the parent nodes correctly after the transplant
// // //     uint256 current = self.nodes[u].parent;
// // //     while (current != NULL_INDEX) {
// // //         self.nodes[current].size = _subtreeSize(self, self.nodes[current].left) + _subtreeSize(self, self.nodes[current].right) + 1;
// // //         current = self.nodes[current].parent;
// // //     }
// // // }



// //     function _compare(PriceToken memory a, PriceToken memory b) private pure returns (int) {
// //         if (a.price < b.price) {
// //             return -1;
// //         } else if (a.price > b.price) {
// //             return 1;
// //         } else {
// //             if (a.tokenId < b.tokenId) {
// //                 return -1;
// //             } else if (a.tokenId > b.tokenId) {
// //                 return 1;
// //             } else {
// //                 return 0;
// //             }
// //         }
// //     }
// // }






// // // // // SPDX-License-Identifier: MIT
// // // // pragma solidity ^0.8.0;

// // // library RedBlackTreeLib {
// // //     struct PriceToken {
// // //         uint256 price;
// // //         uint256 tokenId;
// // //     }

// // //     struct Node {
// // //         PriceToken data;
// // //         uint256 parent;
// // //         uint256 left;
// // //         uint256 right;
// // //         bool red;
// // //         uint256 size;
// // //     }

// // //     struct Tree {
// // //         uint256 root;
// // //         mapping(uint256 => Node) nodes;
// // //         mapping(uint256 => uint256) tokenIdToNodeId;
// // //         uint256 nextNodeId;
// // //         uint256 size;
// // //     }

// // //         uint256 constant NULL_NODE = 2**256 - 1; // Sentinel value for null pointers


// // // function getTreeStructure(Tree storage self) external view returns (string memory) {
// // //     if (self.size == 0) {
// // //         return "Tree is empty";
// // //     }
// // //     return _printTree(self, self.root, 0);
// // // }

// // // function _printTree(Tree storage self, uint256 nodeIndex, uint256 depth) private view returns (string memory) {
// // //     if (nodeIndex == NULL_NODE) {
// // //         return "";
// // //     }

// // //     Node storage node = self.nodes[nodeIndex];
// // //     string memory color = node.red ? "R" : "B";
// // //     string memory indent = _repeat(" ", depth * 2);

// // //     string memory result = string(
// // //         abi.encodePacked(
// // //             indent,
// // //             "Node (Price: ", _uint2str(node.data.price),
// // //             ", TokenId: ", _uint2str(node.data.tokenId),
// // //             ", Color: ", color,
// // //             ", Size: ", _uint2str(node.size),
// // //             ")\n"
// // //         )
// // //     );

// // //     string memory leftTree = _printTree(self, node.left, depth + 1);
// // //     string memory rightTree = _printTree(self, node.right, depth + 1);

// // //     return string(abi.encodePacked(result, leftTree, rightTree));
// // // }

// // // function _repeat(string memory str, uint256 times) private pure returns (string memory) {
// // //     string memory repeated = "";
// // //     for (uint256 i = 0; i < times; i++) {
// // //         repeated = string(abi.encodePacked(repeated, str));
// // //     }
// // //     return repeated;
// // // }

// // // function _uint2str(uint256 _i) private pure returns (string memory) {
// // //     if (_i == 0) {
// // //         return "0";
// // //     }
// // //     uint256 j = _i;
// // //     uint256 len;
// // //     while (j != 0) {
// // //         len++;
// // //         j /= 10;
// // //     }
// // //     bytes memory bstr = new bytes(len);
// // //     uint256 k = len - 1;
// // //     while (_i != 0) {
// // //         bstr[k--] = bytes1(uint8(48 + _i % 10));
// // //         _i /= 10;
// // //     }
// // //     return string(bstr);
// // // }

// // //     // uint256 constant NULL_NODE = 0;

// // //     event NodeInserted(uint256 indexed tokenId, uint256 price);
// // //     event NodeRemoved(uint256 indexed tokenId, uint256 price);

// // //     function insert(Tree storage self, PriceToken memory data) external {
// // //         require(self.tokenIdToNodeId[data.tokenId] == 0, "Token ID already exists");

// // //         uint256 newNodeId = ++self.nextNodeId;
// // //         self.tokenIdToNodeId[data.tokenId] = newNodeId;

// // //         Node storage newNode = self.nodes[newNodeId];
// // //         newNode.data = data;
// // //         newNode.red = true;
// // //         newNode.size = 1;

// // //         if (self.root == NULL_NODE) {
// // //             self.root = newNodeId;
// // //             newNode.red = false;
// // //         } else {
// // //             uint256 current = self.root;
// // //             while (true) {
// // //                 self.nodes[current].size++;
// // //                 if (_compare(data, self.nodes[current].data) < 0) {
// // //                     if (self.nodes[current].left == NULL_NODE) {
// // //                         self.nodes[current].left = newNodeId;
// // //                         newNode.parent = current;
// // //                         break;
// // //                     }
// // //                     current = self.nodes[current].left;
// // //                 } else {
// // //                     if (self.nodes[current].right == NULL_NODE) {
// // //                         self.nodes[current].right = newNodeId;
// // //                         newNode.parent = current;
// // //                         break;
// // //                     }
// // //                     current = self.nodes[current].right;
// // //                 }
// // //             }
// // //             _insertFixup(self, newNodeId);
// // //         }

// // //         self.size++;
// // //         emit NodeInserted(data.tokenId, data.price);
// // //     }

// // //     function remove(Tree storage self, uint256 tokenId) external {
// // //         uint256 nodeId = self.tokenIdToNodeId[tokenId];
// // //         require(nodeId != 0, "Node not found");

// // //         _delete(self, nodeId);
// // //         delete self.tokenIdToNodeId[tokenId];
// // //         self.size--;

// // //         emit NodeRemoved(tokenId, self.nodes[nodeId].data.price);
// // //     }

// // //     function getByTokenId(Tree storage self, uint256 tokenId) external view returns (Node memory) {
// // //         uint256 nodeId = self.tokenIdToNodeId[tokenId];
// // //         require(nodeId != 0, "Node not found");
// // //         return self.nodes[nodeId];
// // //     }

// // //     function getByIndex(Tree storage self, uint256 index) external view returns (PriceToken memory) {
// // //         require(index < self.size, "Index out of bounds");
// // //         return _findByIndex(self, self.root, index);
// // //     }

// // //     function getMin(Tree storage self) external view returns (PriceToken memory) {
// // //         require(self.root != NULL_NODE, "Tree is empty");
// // //         return self.nodes[_min(self, self.root)].data;
// // //     }

// // //     function getMax(Tree storage self) external view returns (PriceToken memory) {
// // //         require(self.root != NULL_NODE, "Tree is empty");
// // //         return self.nodes[_max(self, self.root)].data;
// // //     }

// // //     function size(Tree storage self) external view returns (uint256) {
// // //         return self.size;
// // //     }

// // //     function _findByIndex(Tree storage self, uint256 nodeId, uint256 index) private view returns (PriceToken memory) {
// // //         uint256 leftSize = self.nodes[self.nodes[nodeId].left].size;
// // //         if (index < leftSize) {
// // //             return _findByIndex(self, self.nodes[nodeId].left, index);
// // //         } else if (index > leftSize) {
// // //             return _findByIndex(self, self.nodes[nodeId].right, index - leftSize - 1);
// // //         }
// // //         return self.nodes[nodeId].data;
// // //     }

// // //     function _rotateLeft(Tree storage self, uint256 x) private {
// // //         uint256 y = self.nodes[x].right;
// // //         self.nodes[x].right = self.nodes[y].left;
// // //         if (self.nodes[y].left != NULL_NODE) {
// // //             self.nodes[self.nodes[y].left].parent = x;
// // //         }
// // //         self.nodes[y].parent = self.nodes[x].parent;
// // //         if (self.nodes[x].parent == NULL_NODE) {
// // //             self.root = y;
// // //         } else if (x == self.nodes[self.nodes[x].parent].left) {
// // //             self.nodes[self.nodes[x].parent].left = y;
// // //         } else {
// // //             self.nodes[self.nodes[x].parent].right = y;
// // //         }
// // //         self.nodes[y].left = x;
// // //         self.nodes[x].parent = y;

// // //         self.nodes[x].size = self.nodes[self.nodes[x].left].size + self.nodes[self.nodes[x].right].size + 1;
// // //         self.nodes[y].size = self.nodes[self.nodes[y].left].size + self.nodes[self.nodes[y].right].size + 1;
// // //     }

// // //     function _rotateRight(Tree storage self, uint256 y) private {
// // //         uint256 x = self.nodes[y].left;
// // //         self.nodes[y].left = self.nodes[x].right;
// // //         if (self.nodes[x].right != NULL_NODE) {
// // //             self.nodes[self.nodes[x].right].parent = y;
// // //         }
// // //         self.nodes[x].parent = self.nodes[y].parent;
// // //         if (self.nodes[y].parent == NULL_NODE) {
// // //             self.root = x;
// // //         } else if (y == self.nodes[self.nodes[y].parent].right) {
// // //             self.nodes[self.nodes[y].parent].right = x;
// // //         } else {
// // //             self.nodes[self.nodes[y].parent].left = x;
// // //         }
// // //         self.nodes[x].right = y;
// // //         self.nodes[y].parent = x;

// // //         self.nodes[y].size = self.nodes[self.nodes[y].left].size + self.nodes[self.nodes[y].right].size + 1;
// // //         self.nodes[x].size = self.nodes[self.nodes[x].left].size + self.nodes[self.nodes[x].right].size + 1;
// // //     }

// // //     function _insertFixup(Tree storage self, uint256 z) private {
// // //         while (self.nodes[self.nodes[z].parent].red) {
// // //             if (self.nodes[z].parent == self.nodes[self.nodes[self.nodes[z].parent].parent].left) {
// // //                 uint256 y = self.nodes[self.nodes[self.nodes[z].parent].parent].right;
// // //                 if (self.nodes[y].red) {
// // //                     self.nodes[self.nodes[z].parent].red = false;
// // //                     self.nodes[y].red = false;
// // //                     self.nodes[self.nodes[self.nodes[z].parent].parent].red = true;
// // //                     z = self.nodes[self.nodes[z].parent].parent;
// // //                 } else {
// // //                     if (z == self.nodes[self.nodes[z].parent].right) {
// // //                         z = self.nodes[z].parent;
// // //                         _rotateLeft(self, z);
// // //                     }
// // //                     self.nodes[self.nodes[z].parent].red = false;
// // //                     self.nodes[self.nodes[self.nodes[z].parent].parent].red = true;
// // //                     _rotateRight(self, self.nodes[self.nodes[z].parent].parent);
// // //                 }
// // //             } else {
// // //                 uint256 y = self.nodes[self.nodes[self.nodes[z].parent].parent].left;
// // //                 if (self.nodes[y].red) {
// // //                     self.nodes[self.nodes[z].parent].red = false;
// // //                     self.nodes[y].red = false;
// // //                     self.nodes[self.nodes[self.nodes[z].parent].parent].red = true;
// // //                     z = self.nodes[self.nodes[z].parent].parent;
// // //                 } else {
// // //                     if (z == self.nodes[self.nodes[z].parent].left) {
// // //                         z = self.nodes[z].parent;
// // //                         _rotateRight(self, z);
// // //                     }
// // //                     self.nodes[self.nodes[z].parent].red = false;
// // //                     self.nodes[self.nodes[self.nodes[z].parent].parent].red = true;
// // //                     _rotateLeft(self, self.nodes[self.nodes[z].parent].parent);
// // //                 }
// // //             }
// // //         }
// // //         self.nodes[self.root].red = false;
// // //     }

// // //     function _delete(Tree storage self, uint256 z) private {
// // //         uint256 x;
// // //         uint256 y = z;
// // //         bool yOriginallyRed = self.nodes[y].red;

// // //         if (self.nodes[z].left == NULL_NODE) {
// // //             x = self.nodes[z].right;
// // //             _transplant(self, z, self.nodes[z].right);
// // //         } else if (self.nodes[z].right == NULL_NODE) {
// // //             x = self.nodes[z].left;
// // //             _transplant(self, z, self.nodes[z].left);
// // //         } else {
// // //             y = _min(self, self.nodes[z].right);
// // //             yOriginallyRed = self.nodes[y].red;
// // //             x = self.nodes[y].right;
// // //             if (self.nodes[y].parent == z) {
// // //                 self.nodes[x].parent = y;
// // //             } else {
// // //                 _transplant(self, y, self.nodes[y].right);
// // //                 self.nodes[y].right = self.nodes[z].right;
// // //                 self.nodes[self.nodes[y].right].parent = y;
// // //             }
// // //             _transplant(self, z, y);
// // //             self.nodes[y].left = self.nodes[z].left;
// // //             self.nodes[self.nodes[y].left].parent = y;
// // //             self.nodes[y].red = self.nodes[z].red;
// // //         }

// // //         if (!yOriginallyRed) {
// // //             _deleteFixup(self, x);
// // //         }

// // //         _updateSizes(self, x);
// // //     }

// // //     function _deleteFixup(Tree storage self, uint256 x) private {
// // //         while (x != self.root && !self.nodes[x].red) {
// // //             if (x == self.nodes[self.nodes[x].parent].left) {
// // //                 uint256 w = self.nodes[self.nodes[x].parent].right;
// // //                 if (self.nodes[w].red) {
// // //                     self.nodes[w].red = false;
// // //                     self.nodes[self.nodes[x].parent].red = true;
// // //                     _rotateLeft(self, self.nodes[x].parent);
// // //                     w = self.nodes[self.nodes[x].parent].right;
// // //                 }
// // //                 if (!self.nodes[self.nodes[w].left].red && !self.nodes[self.nodes[w].right].red) {
// // //                     self.nodes[w].red = true;
// // //                     x = self.nodes[x].parent;
// // //                 } else {
// // //                     if (!self.nodes[self.nodes[w].right].red) {
// // //                         self.nodes[self.nodes[w].left].red = false;
// // //                         self.nodes[w].red = true;
// // //                         _rotateRight(self, w);
// // //                         w = self.nodes[self.nodes[x].parent].right;
// // //                     }
// // //                     self.nodes[w].red = self.nodes[self.nodes[x].parent].red;
// // //                     self.nodes[self.nodes[x].parent].red = false;
// // //                     self.nodes[self.nodes[w].right].red = false;
// // //                     _rotateLeft(self, self.nodes[x].parent);
// // //                     x = self.root;
// // //                 }
// // //             } else {
// // //                 uint256 w = self.nodes[self.nodes[x].parent].left;
// // //                 if (self.nodes[w].red) {
// // //                     self.nodes[w].red = false;
// // //                     self.nodes[self.nodes[x].parent].red = true;
// // //                     _rotateRight(self, self.nodes[x].parent);
// // //                     w = self.nodes[self.nodes[x].parent].left;
// // //                 }
// // //                 if (!self.nodes[self.nodes[w].right].red && !self.nodes[self.nodes[w].left].red) {
// // //                     self.nodes[w].red = true;
// // //                     x = self.nodes[x].parent;
// // //                 } else {
// // //                     if (!self.nodes[self.nodes[w].left].red) {
// // //                         self.nodes[self.nodes[w].right].red = false;
// // //                         self.nodes[w].red = true;
// // //                         _rotateLeft(self, w);
// // //                         w = self.nodes[self.nodes[x].parent].left;
// // //                     }
// // //                     self.nodes[w].red = self.nodes[self.nodes[x].parent].red;
// // //                     self.nodes[self.nodes[x].parent].red = false;
// // //                     self.nodes[self.nodes[w].left].red = false;
// // //                     _rotateRight(self, self.nodes[x].parent);
// // //                     x = self.root;
// // //                 }
// // //             }
// // //         }
// // //         self.nodes[x].red = false;
// // //     }

// // //     function _transplant(Tree storage self, uint256 u, uint256 v) private {
// // //         if (self.nodes[u].parent == NULL_NODE) {
// // //             self.root = v;
// // //         } else if (u == self.nodes[self.nodes[u].parent].left) {
// // //             self.nodes[self.nodes[u].parent].left = v;
// // //         } else {
// // //             self.nodes[self.nodes[u].parent].right = v;
// // //         }
// // //         self.nodes[v].parent = self.nodes[u].parent;
// // //     }

// // //     function _updateSizes(Tree storage self, uint256 x) private {
// // //         while (x != NULL_NODE) {
// // //             self.nodes[x].size = self.nodes[self.nodes[x].left].size + self.nodes[self.nodes[x].right].size + 1;
// // //             x = self.nodes[x].parent;
// // //         }
// // //     }

// // //     function _min(Tree storage self, uint256 x) private view returns (uint256) {
// // //         while (self.nodes[x].left != NULL_NODE) {
// // //             x = self.nodes[x].left;
// // //         }
// // //         return x;
// // //     }

// // //     function _max(Tree storage self, uint256 x) private view returns (uint256) {
// // //         while (self.nodes[x].right != NULL_NODE) {
// // //             x = self.nodes[x].right;
// // //         }
// // //         return x;
// // //     }

// // //     function _compare(PriceToken memory a, PriceToken memory b) private pure returns (int) {
// // //         if (a.price < b.price) return -1;
// // //         if (a.price > b.price) return 1;
// // //         if (a.tokenId < b.tokenId) return -1;
// // //         if (a.tokenId > b.tokenId) return 1;
// // //         return 0;
// // //     }
// // // }











