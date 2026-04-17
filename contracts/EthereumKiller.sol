// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
// pragma experimental ABIEncoderV2;

// import "hardhat/console.sol";


import "./external/IXRC721.sol";
import "./external/IXRC721Receiver.sol";
import "./external/SafeMath.sol";
import "./external/Address.sol";
import "./external/Counters.sol";
import "./external/XRC165.sol";
import "./external/Ownable.sol";
import "./external/ReentrancyGuard.sol";

import "./OrderStatisticsTree.sol";
import "./CustomMinHeapLib.sol";


// library CustomMinHeapLib {
//     struct PriceToken {
//         uint256 price;
//         uint256 tokenId;
//     }

//     struct Heap {
//         PriceToken[] data;
//         mapping(uint256 => uint256) tokenIdToIndex; // Map to track the index of each tokenId in the heap
//     }

//     function insert(Heap storage self, PriceToken memory element) internal {
//         self.data.push(element);
//         uint256 index = self.data.length - 1;
//         self.tokenIdToIndex[element.tokenId] = index;
//         _heapifyUp(self, index);
//     }

//     function remove(Heap storage self, uint256 tokenId) internal {
//         uint256 index = self.tokenIdToIndex[tokenId];
//         uint256 lastIndex = self.data.length - 1;

//         if (index != lastIndex) {
//             _swap(self, index, lastIndex);
//         }

//         self.data.pop();
//         delete self.tokenIdToIndex[tokenId];

//         if (index < self.data.length) {
//             _heapifyDown(self, index);
//             _heapifyUp(self, index);
//         }
//     }

//     function getMin(Heap storage self) internal view returns (PriceToken memory) {
//         require(self.data.length > 0, "Heap is empty");
//         return self.data[0];
//     }

//     function size(Heap storage self) internal view returns (uint256) {
//         return self.data.length;
//     }

//     function _heapifyUp(Heap storage self, uint256 index) private {
//         while (index > 0) {
//             uint256 parentIndex = (index - 1) / 2;
//             if (_compare(self.data[index], self.data[parentIndex]) < 0) {
//                 _swap(self, index, parentIndex);
//                 index = parentIndex;
//             } else {
//                 break;
//             }
//         }
//     }

//     function _heapifyDown(Heap storage self, uint256 index) private {
//         uint256 length = self.data.length;
//         uint256 smallest = index;

//         while (true) {
//             uint256 leftChildIndex = 2 * index + 1;
//             uint256 rightChildIndex = 2 * index + 2;

//             if (leftChildIndex < length && _compare(self.data[leftChildIndex], self.data[smallest]) < 0) {
//                 smallest = leftChildIndex;
//             }

//             if (rightChildIndex < length && _compare(self.data[rightChildIndex], self.data[smallest]) < 0) {
//                 smallest = rightChildIndex;
//             }

//             if (smallest != index) {
//                 _swap(self, index, smallest);
//                 index = smallest;
//             } else {
//                 break;
//             }
//         }
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

//     function _swap(Heap storage self, uint256 i, uint256 j) private {
//         PriceToken memory temp = self.data[i];
//         self.data[i] = self.data[j];
//         self.data[j] = temp;

//         self.tokenIdToIndex[self.data[i].tokenId] = i;
//         self.tokenIdToIndex[self.data[j].tokenId] = j;
//     }
// }


// library CustomMinHeapLib {
//     struct PriceToken {
//         uint256 price;
//         uint256 tokenId;
//     }

//     struct Heap {
//         PriceToken[] data;
//         mapping(uint256 => uint256) tokenIdToIndex;
//     }

//     function insert(Heap storage self, PriceToken memory element) internal {
//         require(self.data.length == 0 || (self.tokenIdToIndex[element.tokenId] == 0 && self.data[0].tokenId != element.tokenId), "TokenId already exists in the heap");
//         self.data.push(element);
//         uint256 index = self.data.length - 1;
//         self.tokenIdToIndex[element.tokenId] = index;
//         _heapifyUp(self, index);
//     }

//     function remove(Heap storage self, uint256 tokenId) internal {
//         uint256 index = self.tokenIdToIndex[tokenId];
//         uint256 lastIndex = self.data.length - 1;

//         if (index != lastIndex) {
//             _swap(self, index, lastIndex);
//         }

//         self.data.pop();
//         delete self.tokenIdToIndex[tokenId];

//         if (index < self.data.length) {
//             _heapifyDown(self, index);
//             if (index > 0) {
//                 _heapifyUp(self, index);
//             }
//         }
//     }

//     function getMin(Heap storage self) internal view returns (PriceToken memory) {
//         require(self.data.length > 0, "Heap is empty");
//         return self.data[0];
//     }

//     function size(Heap storage self) internal view returns (uint256) {
//         return self.data.length;
//     }

//     function _heapifyUp(Heap storage self, uint256 index) private {
//         uint256 parentIndex;
//         PriceToken memory element = self.data[index];
//         while (index > 0) {
//             parentIndex = (index - 1) / 2;
//             if (_compare(element, self.data[parentIndex]) < 0) {
//                 _swapWithParent(self, index, parentIndex);
//                 index = parentIndex;
//             } else {
//                 break;
//             }
//         }
//     }

//     function _heapifyDown(Heap storage self, uint256 index) private {
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
//                 _swapWithParent(self, smallest, index);
//                 index = smallest;
//             } else {
//                 break;
//             }
//         }
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

//     function _swap(Heap storage self, uint256 i, uint256 j) private {
//         if (i == j) return;

//         PriceToken memory temp = self.data[i];
//         self.data[i] = self.data[j];
//         self.data[j] = temp;

//         self.tokenIdToIndex[self.data[i].tokenId] = i;
//         self.tokenIdToIndex[self.data[j].tokenId] = j;
//     }

//     function _swapWithParent(Heap storage self, uint256 childIndex, uint256 parentIndex) private {
//         PriceToken memory temp = self.data[childIndex];
//         self.data[childIndex] = self.data[parentIndex];
//         self.data[parentIndex] = temp;

//         self.tokenIdToIndex[self.data[childIndex].tokenId] = childIndex;
//         self.tokenIdToIndex[self.data[parentIndex].tokenId] = parentIndex;
//     }
// }



// contract XRC721 is XRC165, IXRC721, Ownable, ReentrancyGuard {
contract EthereumKiller is XRC165, IXRC721, Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using Address for address;
    using Counters for Counters.Counter;
    using CustomMinHeapLib for CustomMinHeapLib.Heap;
    using OrderStatisticsTree for OrderStatisticsTree.Tree;

    // Custom errors (Solidity 0.8.4+) — saves ~2000-3000 bytes vs require strings
    // Access control
    error NotRoyaltyOwner();
    error SameRoyaltyOwner();
    error CallerIsOwner();
    error CallerNotOwner();
    error CallerNotBidder();
    error CallerNotOwnerNorApproved();
    error ApprovalToCurrentOwner();
    error ApproveToCaller();
    // Token existence
    error TokenNonexistent();
    error TokenAlreadyMinted();
    // Supply & pricing
    error MaxSupplyReached();
    error PriceBelowMinimum();
    error PriceChanged();
    error PriceMustBeDifferent();
    error InsufficientPayment();
    // Listing state
    error TokenNotForSale();
    error TokenAlreadyForSale();
    error NoTokensListed();
    // Offers
    error NoActiveOffer();
    error OfferMustBeGreater();
    // Transfers
    error TransferToZeroAddress();
    error TransferOfTokenNotOwn();
    error TransferToNonReceiver();
    error TransferFailed();
    // Query validation
    error ZeroAddress();
    error CountMustBePositive();
    error StartIndexOutOfBounds();

    bytes4 private constant _XRC721_RECEIVED = 0x150b7a02;
    bytes4 private constant _INTERFACE_ID_XRC721 = 0x80ac58cd;

    mapping(uint256 => address) private _tokenOwner;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => Counters.Counter) private _ownedTokensCount;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping(uint256 => uint256) private _tokenPrices;
    // mapping(address => uint256[]) private _ownedTokens;
    mapping(address => OrderStatisticsTree.Tree) private _ownedTokens;
    mapping(uint256 => mapping(address => OrderStatisticsTree.Offer)) private _tokenToBidderToOfferMap;
    mapping(uint256 => OrderStatisticsTree.Sale[]) private _tokenSalesHistory;
    mapping(uint256 => string) private _tokenURIs;
    // mapping(address => Offer[]) private bidderAddressToOffers;

    //bidderAddressToOffers Trees use tokenId as nodeId
    mapping(address => OrderStatisticsTree.Tree) private bidderAddressToOffers;
    // mapping(address => OrderStatisticsTree.Offer[]) private sellerAddressToOffers;
    // mapping(uint256 => OrderStatisticsTree.Offer[]) private tokenToOffers;

    //tokenToOffers Trees use bidder address as nodeId
    mapping(uint256 => OrderStatisticsTree.Tree) private tokenToOffers;

    uint256 private _uniqueOwnerCount;
    mapping(address => bool) private _uniqueOwners;

    OrderStatisticsTree.Tree private globalOffers;
    OrderStatisticsTree.Tree private globalSales;
    
    OrderStatisticsTree.Tree private forSaleTokens;
    OrderStatisticsTree.Tree private notForSaleTokens;


    // struct Offer {
    //     uint256 tokenId;
    //     address bidder;
    //     uint256 price;
    // }

    // struct Sale {
    //     uint256 tokenId;
    //     address seller;
    //     address buyer;
    //     uint256 price;
    //     uint256 timestamp;
    // }

    CustomMinHeapLib.Heap private floorPriceMinHeap;

    string private _name = "Ethereum Killer";
    string private _symbol = "ETHKILLER";
    string public x = "x.com/dandymike122";
    string public website = "xdc.art";
    string public description = "A collection of 10,000 Ethereum Killer NFTs minted only on XDC. 25 unique backgrounds. 400 NFTs each.\n\nXDC will kill Ethereum! XDC is the REAL Ethereum Killer!";
    string public ethereumLicense = "Ethereum Logo Creative Commons License Attribute\nDescription: The logo of the crypto currency Ethereum as of 2014\nDate: 2014\nSource: https://camo.githubusercontent.com/1b3d0063d6a8bcd56ca07b0ea2ef0f71b17a0fa8/687474703a2f2f737667706f726e2e636f6d2f6c6f676f732f657468657265756d2e737667\nAuthor: Ethereum Foundation\nPermission: \"All current Ethereum logos are under Creative Commons attribution 3.0.\" https://creativecommons.org/licenses/by/3.0/";
    string public xdcLicense = "XDC Logo licensed under Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0). Link to the license: https://creativecommons.org/licenses/by-sa/4.0/";

    Counters.Counter private _totalMintedTokens;
    Counters.Counter private _totalSalesCount;
    uint256 public constant MAX_TOKEN_SUPPLY = 10000;
    // uint256 public constant MIN_PRICE = 1 ether;
    uint256 public constant MIN_PRICE = 25000 ether;
    // uint256 public constant ROYALTY_PERCENTAGE = 12;
    // Using basis points (10,000 = 100%) for industry-standard precision (ERC-2981).
    uint256 public constant ROYALTY_FRACTION = 1200; // 12% = 1200 basis points
    uint256 private constant FEE_DENOMINATOR = 10000;
    uint256 public totalVolume;

    address public ROYALTY_OWNER;

    string public xdc_will_kill_ethereum_xdc_is_the_real_ethereum_killer = "XDC will kill Ethereum! XDC is the REAL Ethereum Killer!";

    // event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    // event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    // event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event WithdrawOffer(uint256 indexed tokenId, address indexed bidder, uint256 amount);
    event MakeOffer(uint256 indexed tokenId, address indexed bidder, uint256 amount);
    event TokenRemovedFromSale(uint256 indexed tokenId);
    event TokenListedForSale(uint256 indexed tokenId, uint256 price);
    event TokenPriceUpdated(uint256 indexed tokenId, uint256 newPrice);
    event TokenSold(uint256 salesId, uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price, uint256 timestamp);


    // constructor() public {
    constructor () {
        _registerInterface(_INTERFACE_ID_XRC721);
        ROYALTY_OWNER = owner();

        // Initialize new trees
        globalOffers.initializeTree(OrderStatisticsTree.ComparatorType.OFFER_PRICE_TOKENID);
        globalSales.initializeTree(OrderStatisticsTree.ComparatorType.SALE_PRICE_TOKENID);
        forSaleTokens.initializeTree(OrderStatisticsTree.ComparatorType.TOKENID);
        notForSaleTokens.initializeTree(OrderStatisticsTree.ComparatorType.TOKENID);
    }

    function setRoyaltyOwner(address newRoyaltyOwner) public {
        // require(msg.sender == ROYALTY_OWNER, "Only current ROYALTY_OWNER can change");
        if (msg.sender != ROYALTY_OWNER) revert NotRoyaltyOwner();
        // require(newRoyaltyOwner != ROYALTY_OWNER, "New address must be different from current ROYALTY_OWNER");
        if (newRoyaltyOwner == ROYALTY_OWNER) revert SameRoyaltyOwner();
        // require(newRoyaltyOwner != address(0), "Invalid address");
        if (newRoyaltyOwner == address(0)) revert ZeroAddress();

        ROYALTY_OWNER = newRoyaltyOwner;
    }

    // Removed: redundant getter. ROYALTY_OWNER is public, so Solidity auto-generates
    // a ROYALTY_OWNER() getter. Use that instead.
    // function getRoyaltyOwner() public view returns (address) {
    //     return ROYALTY_OWNER;
    // }

    function balanceOf(address owner) public view override returns (uint256) {
        // require(owner != address(0), "XRC721: balance query for the zero address");
        if (owner == address(0)) revert ZeroAddress();
        return _ownedTokensCount[owner].current();
    }

    function name() public view returns (string memory) {
        return _name;
    }

    function symbol() public view returns (string memory) {
        return _symbol;
    }

    function ownerOf(uint256 tokenId) public view override returns (address) {
        address owner = _tokenOwner[tokenId];
        // require(owner != address(0), "XRC721: owner query for nonexistent token");
        if (owner == address(0)) revert TokenNonexistent();
        return owner;
    }

    function approve(address to, uint256 tokenId) public override {
        address owner = ownerOf(tokenId);
        // require(to != owner, "XRC721: approval to current owner");
        if (to == owner) revert ApprovalToCurrentOwner();
        // require(msg.sender == owner || isApprovedForAll(owner, msg.sender), "XRC721: approve caller is not owner nor approved for all");
        if (msg.sender != owner && !isApprovedForAll(owner, msg.sender)) revert CallerNotOwnerNorApproved();
        _tokenApprovals[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }

    function getApproved(uint256 tokenId) public view override returns (address) {
        // require(_exists(tokenId), "XRC721: approved query for nonexistent token");
        if (!_exists(tokenId)) revert TokenNonexistent();
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address to, bool approved) public override {
        // require(to != msg.sender, "XRC721: approve to caller");
        if (to == msg.sender) revert ApproveToCaller();
        _operatorApprovals[msg.sender][to] = approved;
        emit ApprovalForAll(msg.sender, to, approved);
    }

    function isApprovedForAll(address owner, address operator) public view override returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public override {
        // require(_isApprovedOrOwner(msg.sender, tokenId), "XRC721: transfer caller is not owner nor approved");
        if (!_isApprovedOrOwner(msg.sender, tokenId)) revert CallerNotOwnerNorApproved();
        _transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) public override {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory _data) public override {
        transferFrom(from, to, tokenId);
        // require(_checkOnXRC721Received(from, to, tokenId, _data), "XRC721: transfer to non XRC721Receiver implementer");
        if (!_checkOnXRC721Received(from, to, tokenId, _data)) revert TransferToNonReceiver();
    }

    function _exists(uint256 tokenId) internal view returns (bool) {
        address owner = _tokenOwner[tokenId];
        return owner != address(0);
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        // require(_exists(tokenId), "XRC721: operator query for nonexistent token");
        if (!_exists(tokenId)) revert TokenNonexistent();
        address owner = ownerOf(tokenId);
        return (spender == owner || getApproved(tokenId) == spender || isApprovedForAll(owner, spender));
    }

    //commented out because i'm using tree instead of list now, log(n) complexity > o(n) complexity
    // function _findInsertPosition(uint256[] storage array, uint256 value) internal view returns (uint256) {
    //     if (array.length == 0) {
    //         return 0;
    //     }

    //     uint256 low = 0;
    //     uint256 high = array.length;

    //     while (low < high) {
    //         uint256 mid = (low.add(high)).div(2);
    //         if (array[mid] == value) {
    //             return mid;
    //         } else if (array[mid] < value) {
    //             low = mid.add(1);
    //         } else {
    //             high = mid;
    //         }
    //     }

    //     return low;
    // }

    // function _mint(address to, uint256 tokenId) internal onlyOwner {
    //     require(to != address(0), "XRC721: mint to the zero address");
    //     require(!_exists(tokenId), "XRC721: token already minted");
        
    //     _tokenOwner[tokenId] = to;
    //     _ownedTokensCount[to].increment();
    //     _totalMintedTokens.increment();

    //     if (!_uniqueOwners[to]) {
    //         _uniqueOwners[to] = true;
    //         _uniqueOwnerCount = _uniqueOwnerCount.add(1);
    //     }

    //     uint256 insertPosition = _findInsertPosition(_ownedTokens[to], tokenId);
    //     _ownedTokens[to].push(0);

    //     for (uint256 i = _ownedTokens[to].length.sub(1); i > insertPosition; i = i.sub(1)) {
    //         _ownedTokens[to][i] = _ownedTokens[to][i.sub(1)];
    //     }
    //     _ownedTokens[to][insertPosition] = tokenId;

    //     emit Transfer(address(0), to, tokenId);
    // }
    function _mint(address to, uint256 tokenId) internal onlyOwner {
        // require(to != address(0), "XRC721: mint to the zero address");
        if (to == address(0)) revert TransferToZeroAddress();
        // require(!_exists(tokenId), "XRC721: token already minted");
        if (_exists(tokenId)) revert TokenAlreadyMinted();
        
        _tokenOwner[tokenId] = to;
        _ownedTokensCount[to].increment();
        _totalMintedTokens.increment();

        if (!_uniqueOwners[to]) {
            _uniqueOwners[to] = true;
            _uniqueOwnerCount = _uniqueOwnerCount.add(1);
        }

        // Initialize the tree if it doesn't exist
        if (!_ownedTokens[to].initialized) {
            _ownedTokens[to].initializeTree(OrderStatisticsTree.ComparatorType.TOKENID);
        }
        
        // Insert the tokenId into the tree
        _ownedTokens[to].insertTokenId(tokenId);

        emit Transfer(address(0), to, tokenId);
    }

    // function _transferFrom(address from, address to, uint256 tokenId) internal {
    //     require(ownerOf(tokenId) == from, "XRC721: transfer of token that is not own");
    //     require(to != address(0), "XRC721: transfer to the zero address");

    //     _clearApproval(tokenId);

    //     _ownedTokensCount[from].decrement();
    //     if (_ownedTokensCount[from].current() == 0) {
    //         delete _ownedTokensCount[from];
    //         delete _ownedTokens[from];
    //     }
    //     if (_ownedTokensCount[from].current() == 0) {
    //         delete _uniqueOwners[from];
    //         _uniqueOwnerCount = _uniqueOwnerCount.sub(1);
    //     }
    //     _ownedTokensCount[to].increment();
    //     if (!_uniqueOwners[to]) {
    //         _uniqueOwners[to] = true;
    //         _uniqueOwnerCount = _uniqueOwnerCount.add(1);
    //     }

    //     _tokenOwner[tokenId] = to;

    //     uint256[] storage fromTokens = _ownedTokens[from];
    //     for (uint256 i = 0; i < fromTokens.length; i = i.add(1)) {
    //         if (fromTokens[i] == tokenId) {
    //             fromTokens[i] = fromTokens[fromTokens.length.sub(1)];
    //             fromTokens.length.sub(1);
    //             break;
    //         }
    //     }

    //     uint256 insertPosition = _findInsertPosition(_ownedTokens[to], tokenId);
    //     _ownedTokens[to].push(0);
    //     for (uint256 i = _ownedTokens[to].length.sub(1); i > insertPosition; i = i.sub(1)) {
    //         _ownedTokens[to][i] = _ownedTokens[to][i.sub(1)];
    //     }
    //     _ownedTokens[to][insertPosition] = tokenId;

    //     emit Transfer(from, to, tokenId);
    // }
    function _transferFrom(address from, address to, uint256 tokenId) internal {
        // require(ownerOf(tokenId) == from, "XRC721: transfer of token that is not own");
        if (ownerOf(tokenId) != from) revert TransferOfTokenNotOwn();
        // require(to != address(0), "XRC721: transfer to the zero address");
        if (to == address(0)) revert TransferToZeroAddress();

        _clearApproval(tokenId);

        // Auto-delist: if token is listed for sale, clean up all for-sale state.
        // This prevents the new owner from inheriting an unwanted listing and
        // stops anyone from buying the token at the old price without consent.
        // if (isTokenForSale(tokenId)) {
        //     _tokenPrices[tokenId] = 0;
        //     forSaleTokens.remove(tokenId);
        //     notForSaleTokens.insertTokenId(tokenId);
        //     floorPriceMinHeap.remove(tokenId);
        // }
        if (_tokenPrices[tokenId] > 0) {
            _tokenPrices[tokenId] = 0;
            forSaleTokens.remove(tokenId);
            notForSaleTokens.insertTokenId(tokenId);
            floorPriceMinHeap.remove(tokenId);
        }

        _ownedTokensCount[from].decrement();
        if (_ownedTokensCount[from].current() == 0) {
            delete _ownedTokensCount[from];
            delete _ownedTokens[from];
            delete _uniqueOwners[from];
            _uniqueOwnerCount = _uniqueOwnerCount.sub(1);
        } else {
            _ownedTokens[from].remove(tokenId);
        }
        
        _ownedTokensCount[to].increment();
        if (!_uniqueOwners[to]) {
            _uniqueOwners[to] = true;
            _uniqueOwnerCount = _uniqueOwnerCount.add(1);
        }

        _tokenOwner[tokenId] = to;

        // Initialize the tree if it doesn't exist
        if (!_ownedTokens[to].initialized) {
            _ownedTokens[to].initializeTree(OrderStatisticsTree.ComparatorType.TOKENID);
        }
        
        // Insert the tokenId into the tree
        _ownedTokens[to].insertTokenId(tokenId);

        emit Transfer(from, to, tokenId);
    }

    function _checkOnXRC721Received(address from, address to, uint256 tokenId, bytes memory _data) internal returns (bool) {
        if (!to.isContract()) {
            return true;
        }
        bytes4 retval = IXRC721Receiver(to).onXRC721Received(msg.sender, from, tokenId, _data);
        return (retval == _XRC721_RECEIVED);
    }

    function _clearApproval(uint256 tokenId) private {
        if (_tokenApprovals[tokenId] != address(0)) {
            _tokenApprovals[tokenId] = address(0);
        }
    }

    function _setTokenURI(uint256 tokenId, string memory uri) internal {
        // require(_exists(tokenId), "XRC721: URI set of nonexistent token");
        if (!_exists(tokenId)) revert TokenNonexistent();
        _tokenURIs[tokenId] = uri;
    }

    function tokenURI(uint256 tokenId) public view returns (string memory) {
        // require(_exists(tokenId), "XRC721: URI query for nonexistent token");
        if (!_exists(tokenId)) revert TokenNonexistent();
        return _tokenURIs[tokenId];
    }

    function mintAndListForSale(address to, uint256 tokenId, uint256 price, string memory uri) public onlyOwner {
        // require(!_exists(tokenId), "XRC721: token already exists");
        if (_exists(tokenId)) revert TokenAlreadyMinted();
        // require(_totalMintedTokens.current() < MAX_TOKEN_SUPPLY, "XRC721: maximum token supply reached");
        if (_totalMintedTokens.current() >= MAX_TOKEN_SUPPLY) revert MaxSupplyReached();
        // require(price >= MIN_PRICE, "XRC721: price must be at least 25,000 XDC");
        if (price < MIN_PRICE) revert PriceBelowMinimum();

        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);
        _tokenPrices[tokenId] = price;

        CustomMinHeapLib.PriceToken memory newToken = CustomMinHeapLib.PriceToken({
            price: price,
            tokenId: tokenId
        });

        floorPriceMinHeap.insert(newToken);

        // Add to forSaleTokens tree
        forSaleTokens.insertTokenId(tokenId);

        emit TokenListedForSale(tokenId, price);
    }

    function isTokenForSale(uint256 tokenId) public view returns (bool) {
        return _tokenPrices[tokenId] > 0;
    }

    // function buyToken(uint256 tokenId) public payable nonReentrant {
    // Added expectedPrice parameter to prevent front-running (mempool attack):
    // an owner could see a buyer's transaction in the mempool and front-run with
    // updateTokenPrice() to raise the price before the buy executes. With expectedPrice,
    // if the on-chain price doesn't match what the buyer agreed to, the transaction reverts.
    function buyToken(uint256 tokenId, uint256 expectedPrice) public payable nonReentrant {
        // require(_exists(tokenId), "XRC721: offer query for nonexistent token");
        // require(ownerOf(tokenId) != msg.sender, "XRC721: caller is the owner");
        if (ownerOf(tokenId) == msg.sender) revert CallerIsOwner();
        // require(isTokenForSale(tokenId), "XRC721: token not for sale");
        if (!isTokenForSale(tokenId)) revert TokenNotForSale();
        uint256 price = _tokenPrices[tokenId];
        // require(price == expectedPrice, "XRC721: price changed");
        if (price != expectedPrice) revert PriceChanged();
        // require(msg.value >= price, "XRC721: insufficient payment");
        if (msg.value < price) revert InsufficientPayment();

        address seller = ownerOf(tokenId);
        // uint256 royalty = price.mul(ROYALTY_PERCENTAGE).div(100);
        uint256 royalty = price.mul(ROYALTY_FRACTION).div(FEE_DENOMINATOR);
        uint256 sellerProceeds = price.sub(royalty);

        // floorPriceMinHeap.remove(tokenId);

        //If has existing offer, withdraw that
        OrderStatisticsTree.Offer memory existingOffer = _tokenToBidderToOfferMap[tokenId][msg.sender];
        if (existingOffer.price > 0) {
            // Bug fix: Previously only deleted from _tokenToBidderToOfferMap but NOT from
            // bidderAddressToOffers, tokenToOffers, and globalOffers trees, leaving stale
            // "ghost" offers that appeared in queries and blocked future offers with
            // "Bidder already exists" reverts. Now uses deleteOffer() to clean all trees.
            // payable(existingOffer.bidder).transfer(existingOffer.price);
            // delete _tokenToBidderToOfferMap[tokenId][msg.sender];
            deleteOffer(tokenId, msg.sender);

            // Moved offer refund below recordSale to follow CEI (Checks-Effects-Interactions)
            // pattern: all state updates before external calls.
            // // payable(existingOffer.bidder).transfer(existingOffer.price);
            // // Using .call instead of .transfer to avoid 2300 gas limit DoS risk.
            // (bool refundSuccess, ) = payable(existingOffer.bidder).call{value: existingOffer.price}("");
            // require(refundSuccess, "XRC721: offer refund failed");

            emit WithdrawOffer(tokenId, existingOffer.bidder, existingOffer.price);
        }

        // _transferFrom now handles auto-delist (clears _tokenPrices, forSaleTokens,
        // notForSaleTokens, floorPriceMinHeap) so no need to do it manually here.
        _transferFrom(seller, msg.sender, tokenId);

        // Removed: _tokenPrices, forSaleTokens, notForSaleTokens, floorPriceMinHeap
        // cleanup is now handled by _transferFrom auto-delist.
        // _tokenPrices[tokenId] = 0;
        // forSaleTokens.remove(tokenId);
        // notForSaleTokens.insertTokenId(tokenId);

        totalVolume = totalVolume.add(price);

        recordSale(tokenId, seller, msg.sender, price);

        // Offer refund moved here from above (CEI pattern: state updates before external calls).
        if (existingOffer.price > 0) {
            (bool refundSuccess, ) = payable(existingOffer.bidder).call{value: existingOffer.price}("");
            // require(refundSuccess, "XRC721: offer refund failed");
            if (!refundSuccess) revert TransferFailed();
        }

        // payable(ROYALTY_OWNER).transfer(royalty);
        // Using .call instead of .transfer to avoid 2300 gas limit DoS risk.
        (bool royaltySuccess, ) = payable(ROYALTY_OWNER).call{value: royalty}("");
        // require(royaltySuccess, "XRC721: royalty transfer failed");
        if (!royaltySuccess) revert TransferFailed();

        // payable(seller).transfer(sellerProceeds);
        // Using .call instead of .transfer to avoid 2300 gas limit DoS risk.
        (bool sellerSuccess, ) = payable(seller).call{value: sellerProceeds}("");
        // require(sellerSuccess, "XRC721: seller transfer failed");
        if (!sellerSuccess) revert TransferFailed();

        if (msg.value > price) {
            // payable(msg.sender).transfer(msg.value.sub(price));
            // Using .call instead of .transfer to avoid 2300 gas limit DoS risk.
            (bool overpaySuccess, ) = payable(msg.sender).call{value: msg.value.sub(price)}("");
            // require(overpaySuccess, "XRC721: overpayment refund failed");
            if (!overpaySuccess) revert TransferFailed();
        }

        emit TokenSold(_totalSalesCount.current() - 1, tokenId, seller, msg.sender, price, block.timestamp);
    }

    function listTokenForSale(uint256 tokenId, uint256 price) public {
        // require(ownerOf(tokenId) == msg.sender, "XRC721: caller is not the owner");
        if (ownerOf(tokenId) != msg.sender) revert CallerNotOwner();
        // require(ownerOf(tokenId) == msg.sender, "Not owner");
        // require(!isTokenForSale(tokenId), "XRC721: token already for sale");
        if (isTokenForSale(tokenId)) revert TokenAlreadyForSale();
        // require(price >= MIN_PRICE, "XRC721: price must be at least 25,000 XDC");
        if (price < MIN_PRICE) revert PriceBelowMinimum();

        _tokenPrices[tokenId] = price;

        CustomMinHeapLib.PriceToken memory newToken = CustomMinHeapLib.PriceToken({
            price: price,
            tokenId: tokenId
        });

        floorPriceMinHeap.insert(newToken);

        // Move from notForSale to forSale
        notForSaleTokens.remove(tokenId);
        forSaleTokens.insertTokenId(tokenId);

        emit TokenListedForSale(tokenId, price);
    }

    function removeTokenFromSale(uint256 tokenId) public {
        // require(ownerOf(tokenId) == msg.sender, "XRC721: caller is not the owner");
        if (ownerOf(tokenId) != msg.sender) revert CallerNotOwner();
        // require(ownerOf(tokenId) == msg.sender, "Not owner");
        // require(isTokenForSale(tokenId), "XRC721: token is not listed for sale");
        if (!isTokenForSale(tokenId)) revert TokenNotForSale();

        _tokenPrices[tokenId] = 0;

        // Move from forSale to notForSale
        forSaleTokens.remove(tokenId);
        notForSaleTokens.insertTokenId(tokenId);

        floorPriceMinHeap.remove(tokenId);

        emit TokenRemovedFromSale(tokenId);
    }

    // Place the updateTokenPrice function here
    function updateTokenPrice(uint256 tokenId, uint256 newPrice) public {
        // require(ownerOf(tokenId) == msg.sender, "XRC721: caller is not the owner");
        if (ownerOf(tokenId) != msg.sender) revert CallerNotOwner();
        // require(ownerOf(tokenId) == msg.sender, "Not owner");
        // Guard: without this, calling on an unlisted token would reach
        // floorPriceMinHeap.remove() which reverts with a confusing
        // "TokenId not found" error. This gives a clear error message instead.
        // require(isTokenForSale(tokenId), "XRC721: token is not listed for sale");
        if (!isTokenForSale(tokenId)) revert TokenNotForSale();
        // Guard: without this, owner could set price below MIN_PRICE (or even 0),
        // allowing someone to buy the NFT for essentially nothing.
        // listTokenForSale enforces MIN_PRICE but updateTokenPrice previously didn't.
        // require(newPrice >= MIN_PRICE, "XRC721: price must be at least 25,000 XDC");
        if (newPrice < MIN_PRICE) revert PriceBelowMinimum();
        // require(_tokenPrices[tokenId] != newPrice, "XRC721: new price must be different from the current price");
        if (_tokenPrices[tokenId] == newPrice) revert PriceMustBeDifferent();

        floorPriceMinHeap.remove(tokenId);

        CustomMinHeapLib.PriceToken memory updatedToken = CustomMinHeapLib.PriceToken({
            price: newPrice,
            tokenId: tokenId
        });

        floorPriceMinHeap.insert(updatedToken);
        _tokenPrices[tokenId] = newPrice;

        emit TokenPriceUpdated(tokenId, newPrice);
    }

    // function makeOffer(uint256 tokenId) public payable nonReentrant {
    //     require(_exists(tokenId), "XRC721: offer query for nonexistent token");
    //     require(msg.value >= MIN_PRICE, "XRC721: offer price must be at least 25,000 XDC");

    //     Offer memory existingOffer = _tokenToBidderToOfferMap[tokenId][msg.sender];

    //     uint256 offerAmount = existingOffer.price;

    //     if (offerAmount > 0) {
    //         require(msg.value > offerAmount, "XRC721: new offer must be greater than existing offer");

    //         // Update the offer
    //         _tokenToBidderToOfferMap[tokenId][msg.sender].price = msg.value;

    //         // Remove the old offer from bidderAddressToOffers
    //         Offer[] storage offers = bidderAddressToOffers[msg.sender];
    //         uint256 offersLength = offers.length;
    //         for (uint256 i = 0; i < offersLength; i = i.add(1)) {
    //             if (offers[i].tokenId == tokenId && offers[i].price == offerAmount) {
    //                 offers[i] = offers[offersLength.sub(1)];
    //                 offers.length = offersLength.sub(1); // Reduce the array length by one
    //                 break;
    //             }
    //         }

    //         if(offers.length == 0) {
    //             delete bidderAddressToOffers[msg.sender];
    //         }

    //         // Remove the offer from sellerAddressToOffers
    //         address seller = ownerOf(tokenId);
    //         Offer[] storage sellerOffers = sellerAddressToOffers[seller];
    //         uint256 sellerOffersLength = sellerOffers.length;
    //         for (uint256 i = 0; i < sellerOffersLength; i = i.add(1)) {
    //             if (sellerOffers[i].tokenId == tokenId && sellerOffers[i].bidder == msg.sender && sellerOffers[i].price == offerAmount) {
    //                 sellerOffers[i] = sellerOffers[sellerOffersLength.sub(1)];
    //                 sellerOffers.length = sellerOffersLength.sub(1); // Reduce the array length by one
    //                 break;
    //             }
    //         }

    //         if(sellerOffers.length == 0) {
    //             delete sellerAddressToOffers[seller];
    //         }

    //         // Remove the offer from tokenOffers
    //         Offer[] storage tokenOffers = tokenToOffers[tokenId];
    //         uint256 tokenOffersLength = tokenOffers.length;
    //         for (uint256 i = 0; i < tokenOffersLength; i = i.add(1)) {
    //             if (tokenOffers[i].bidder == msg.sender && tokenOffers[i].price == offerAmount) {
    //                 tokenOffers[i] = tokenOffers[tokenOffersLength.sub(1)];
    //                 tokenOffers.length = tokenOffersLength.sub(1); // Reduce the array length by one
    //                 break;
    //             }
    //         }

    //         if(tokenOffers.length == 0) {
    //             delete tokenToOffers[tokenId];
    //         }

    //         // Refund the previous offer amount
    //         address(uint160(existingOffer.bidder)).transfer(offerAmount);
    //         emit WithdrawOffer(tokenId, existingOffer.bidder, offerAmount);

    //     }

    //     // Add the offer
    //     _tokenToBidderToOfferMap[tokenId][msg.sender] = Offer({
    //         tokenId: tokenId,
    //         bidder: msg.sender,
    //         price: msg.value
    //     });

    //     // Add the new offer to bidderAddressToOffers
    //     bidderAddressToOffers[msg.sender].push(Offer({
    //         tokenId: tokenId,
    //         bidder: msg.sender,
    //         price: msg.value
    //     }));

    //     // Add the new offer to sellerAddressToOffers
    //     address seller = ownerOf(tokenId);
    //     sellerAddressToOffers[seller].push(Offer({
    //         tokenId: tokenId,
    //         bidder: msg.sender,
    //         price: msg.value
    //     }));

    //     // Add the new offer to tokenToOffers
    //     tokenToOffers[tokenId].push(Offer({
    //         tokenId: tokenId,
    //         bidder: msg.sender,
    //         price: msg.value
    //     }));
        
    //     emit MakeOffer(tokenId, msg.sender, msg.value);
    // }

    // // Function to withdraw an offer
    // function withdrawOffer(uint256 tokenId) public nonReentrant {
    //     Offer memory existingOffer = _tokenToBidderToOfferMap[tokenId][msg.sender];
    //     require(existingOffer.bidder == msg.sender, "XRC721: caller is not the bidder");

    //     uint256 offerAmount = existingOffer.price;

    //     // _tokenToBidderToOfferMap[tokenId][msg.sender] = Offer({
    //     //     tokenId: tokenId,
    //     //     bidder: address(0),
    //     //     price: 0
    //     // });
    //     delete _tokenToBidderToOfferMap[tokenId][msg.sender];

    //     // Remove the offer from bidderAddressToOffers
    //     Offer[] storage offers = bidderAddressToOffers[msg.sender];
    //     uint256 offersLength = offers.length;
    //     for (uint256 i = 0; i < offersLength; i = i.add(1)) {
    //         if (offers[i].tokenId == tokenId && offers[i].price == offerAmount) {
    //             offers[i] = offers[offersLength.sub(1)];
    //             offers.length = offersLength.sub(1); // Reduce the array length by one
    //             break;
    //         }
    //     }

    //     if(offers.length == 0) {
    //         delete bidderAddressToOffers[msg.sender];
    //     }

    //     // Remove the offer from sellerAddressToOffers
    //     address seller = ownerOf(tokenId);
    //     Offer[] storage sellerOffers = sellerAddressToOffers[seller];
    //     uint256 sellerOffersLength = sellerOffers.length;
    //     for (uint256 i = 0; i < sellerOffersLength; i = i.add(1)) {
    //         if (sellerOffers[i].tokenId == tokenId && sellerOffers[i].bidder == msg.sender && sellerOffers[i].price == offerAmount) {
    //             sellerOffers[i] = sellerOffers[sellerOffersLength.sub(1)];
    //             sellerOffers.length = sellerOffersLength.sub(1); // Reduce the array length by one
    //             break;
    //         }
    //     }

    //     if(sellerOffers.length == 0) {
    //         delete sellerAddressToOffers[seller];
    //     }

    //     // Remove the offer from tokenOffers
    //     Offer[] storage tokenOffers = tokenToOffers[tokenId];
    //     uint256 tokenOffersLength = tokenOffers.length;
    //     for (uint256 i = 0; i < tokenOffersLength; i = i.add(1)) {
    //         if (tokenOffers[i].bidder == msg.sender && tokenOffers[i].price == offerAmount) {
    //             tokenOffers[i] = tokenOffers[tokenOffersLength.sub(1)];
    //             tokenOffers.length = tokenOffersLength.sub(1); // Reduce the array length by one
    //             break;
    //         }
    //     }

    //     if(tokenOffers.length == 0) {
    //         delete tokenToOffers[tokenId];
    //     }

    //     address(uint160(msg.sender)).transfer(offerAmount);

    //     emit WithdrawOffer(tokenId, msg.sender, offerAmount);
    // }

    // // Function to accept an offer
    // function acceptOffer(uint256 tokenId, address bidder) public nonReentrant {
    //     require(ownerOf(tokenId) == msg.sender, "XRC721: caller is not the owner");

    //     Offer memory existingOffer = _tokenToBidderToOfferMap[tokenId][bidder];
    //     require(existingOffer.price > 0, "XRC721: no active offer");

    //     uint256 offerAmount = existingOffer.price;

    //     // _tokenToBidderToOfferMap[tokenId][bidder] = Offer({
    //     //     tokenId: tokenId,
    //     //     bidder: address(0),
    //     //     price: 0
    //     // });
    //     delete _tokenToBidderToOfferMap[tokenId][bidder];

    //     // Remove the offer from bidderAddressToOffers
    //     Offer[] storage offers = bidderAddressToOffers[bidder];
    //     uint256 offersLength = offers.length;
    //     for (uint256 i = 0; i < offersLength; i = i.add(1)) {
    //         if (offers[i].tokenId == tokenId && offers[i].bidder == bidder && offers[i].price == offerAmount) {
    //             offers[i] = offers[offersLength.sub(1)];
    //             offers.length = offersLength.sub(1); // Reduce the array length by one
    //             break;
    //         }
    //     }

    //     if(offers.length == 0) {
    //         delete bidderAddressToOffers[bidder];
    //     }

    //     // Remove the offer from sellerAddressToOffers
    //     address seller = msg.sender;
    //     Offer[] storage sellerOffers = sellerAddressToOffers[seller];
    //     uint256 sellerOffersLength = sellerOffers.length;
    //     for (uint256 i = 0; i < sellerOffersLength; i = i.add(1)) {
    //         if (sellerOffers[i].tokenId == tokenId && sellerOffers[i].bidder == bidder && sellerOffers[i].price == offerAmount) {
    //             sellerOffers[i] = sellerOffers[sellerOffersLength.sub(1)];
    //             sellerOffers.length = sellerOffersLength.sub(1); // Reduce the array length by one
    //             break;
    //         }
    //     }

    //     if(sellerOffers.length == 0) {
    //         delete sellerAddressToOffers[seller];
    //     }

    //     // Remove the offer from tokenOffers
    //     Offer[] storage tokenOffers = tokenToOffers[tokenId];
    //     uint256 tokenOffersLength = tokenOffers.length;
    //     for (uint256 i = 0; i < tokenOffersLength; i = i.add(1)) {
    //         if (tokenOffers[i].bidder == bidder && tokenOffers[i].price == offerAmount) {
    //             tokenOffers[i] = tokenOffers[tokenOffersLength.sub(1)];
    //             tokenOffers.length = tokenOffersLength.sub(1); // Reduce the array length by one
    //             break;
    //         }
    //     }

    //     if(tokenOffers.length == 0) {
    //         delete tokenToOffers[tokenId];
    //     }

    //     _transferFrom(msg.sender, bidder, tokenId);

    //     uint256 royalty = offerAmount.mul(ROYALTY_PERCENTAGE).div(100);
    //     uint256 sellerProceeds = offerAmount.sub(royalty);

    //     totalVolume = totalVolume.add(offerAmount);

    //     recordSale(tokenId, msg.sender, bidder, offerAmount);

    //     address(uint160(owner())).transfer(royalty);
    //     address(uint160(msg.sender)).transfer(sellerProceeds);

    //     emit WithdrawOffer(tokenId, bidder, offerAmount);

    //     emit TokenSold(tokenId, msg.sender, bidder, offerAmount, block.timestamp);
    // }
function makeOffer(uint256 tokenId) public payable nonReentrant {
    // require(_exists(tokenId), "XRC721: offer query for nonexistent token");
    // require(ownerOf(tokenId) != msg.sender, "XRC721: caller is the owner");
    if (ownerOf(tokenId) == msg.sender) revert CallerIsOwner();
    // require(msg.value >= MIN_PRICE, "XRC721: offer price must be at least 25,000 XDC");
    if (msg.value < MIN_PRICE) revert PriceBelowMinimum();

    OrderStatisticsTree.Offer memory existingOffer = _tokenToBidderToOfferMap[tokenId][msg.sender];

    uint256 offerAmount = existingOffer.price;

    if (offerAmount > 0) {
        // require(msg.value > offerAmount, "XRC721: new offer must be greater than existing offer");
        if (msg.value <= offerAmount) revert OfferMustBeGreater();

        // updateOffer(tokenId, msg.sender, offerAmount, msg.value);
        updateOffer(tokenId, msg.sender, msg.value);
        // refundPreviousOffer was here originally — moved below addNewOffer
        // to follow CEI (Checks-Effects-Interactions) pattern: update all state
        // before sending ETH, so if the recipient calls back into this contract
        // during the refund, all state is already correct.
        // refundPreviousOffer(existingOffer.bidder, tokenId, offerAmount);
    }

    addNewOffer(tokenId, msg.sender, msg.value);

    // Refund moved here: ETH sent after all state updates (CEI pattern).
    if (offerAmount > 0) {
        refundPreviousOffer(existingOffer.bidder, tokenId, offerAmount);
    }

    emit MakeOffer(tokenId, msg.sender, msg.value);
}

function withdrawOffer(uint256 tokenId) public nonReentrant {
    OrderStatisticsTree.Offer memory existingOffer = _tokenToBidderToOfferMap[tokenId][msg.sender];
    // require(existingOffer.bidder == msg.sender, "XRC721: caller is not the bidder");
    if (existingOffer.bidder != msg.sender) revert CallerNotBidder();

    uint256 offerAmount = existingOffer.price;
    
    // deleteOffer(tokenId, msg.sender, offerAmount);
    deleteOffer(tokenId, msg.sender);

    // payable(msg.sender).transfer(offerAmount);
    // Using .call instead of .transfer to avoid 2300 gas limit DoS risk.
    (bool success, ) = payable(msg.sender).call{value: offerAmount}("");
    // require(success, "XRC721: withdraw transfer failed");
    if (!success) revert TransferFailed();

    emit WithdrawOffer(tokenId, msg.sender, offerAmount);
}

function acceptOffer(uint256 tokenId, address bidder) public nonReentrant {
    // require(ownerOf(tokenId) == msg.sender, "XRC721: caller is not the owner");
    if (ownerOf(tokenId) != msg.sender) revert CallerNotOwner();
    // require(ownerOf(tokenId) == msg.sender, "Not owner");

    OrderStatisticsTree.Offer memory existingOffer = _tokenToBidderToOfferMap[tokenId][bidder];
    // require(existingOffer.price > 0, "XRC721: no active offer");
    if (existingOffer.price == 0) revert NoActiveOffer();

    uint256 offerAmount = existingOffer.price;
    
    // deleteOffer(tokenId, bidder, offerAmount);
    deleteOffer(tokenId, bidder);

    _transferFrom(msg.sender, bidder, tokenId);

    // uint256 royalty = offerAmount.mul(ROYALTY_PERCENTAGE).div(100);
    uint256 royalty = offerAmount.mul(ROYALTY_FRACTION).div(FEE_DENOMINATOR);
    uint256 sellerProceeds = offerAmount.sub(royalty);

    totalVolume = totalVolume.add(offerAmount);

    recordSale(tokenId, msg.sender, bidder, offerAmount);

    // payable(ROYALTY_OWNER).transfer(royalty);
    // Using .call instead of .transfer to avoid 2300 gas limit DoS risk.
    (bool royaltySuccess, ) = payable(ROYALTY_OWNER).call{value: royalty}("");
    // require(royaltySuccess, "XRC721: royalty transfer failed");
    if (!royaltySuccess) revert TransferFailed();

    // payable(msg.sender).transfer(sellerProceeds);
    // Using .call instead of .transfer to avoid 2300 gas limit DoS risk.
    (bool sellerSuccess, ) = payable(msg.sender).call{value: sellerProceeds}("");
    // require(sellerSuccess, "XRC721: seller transfer failed");
    if (!sellerSuccess) revert TransferFailed();

    // Removed below code: for-sale cleanup is now handled by _transferFrom auto-delist.
    // // Bug fix: Previously, these removals ran unconditionally, which caused
    // // "TokenId not found" reverts when accepting an offer on an unlisted token
    // // (e.g. token was already bought by someone else, so it's no longer in
    // // forSaleTokens or floorPriceMinHeap). Now we only remove if actually listed.
    // // This allows owners to accept offers on tokens that are not currently for sale,
    // // matching standard NFT marketplace behavior (OpenSea, Blur, etc.).
    // if (isTokenForSale(tokenId)) {
    //     // Set the price of the token to 0 so it's no longer listed for sale
    //     _tokenPrices[tokenId] = 0;

    //     // Move from forSale to notForSale
    //     forSaleTokens.remove(tokenId);
    //     notForSaleTokens.insertTokenId(tokenId);

    //     floorPriceMinHeap.remove(tokenId);
    // }

    emit WithdrawOffer(tokenId, bidder, offerAmount);
    emit TokenSold(_totalSalesCount.current() - 1, tokenId, msg.sender, bidder, offerAmount, block.timestamp);
}

// function updateOffer(uint256 tokenId, address bidder, uint256 oldPrice, uint256 newPrice) internal {
function updateOffer(uint256 tokenId, address bidder, uint256 newPrice) internal {
    _tokenToBidderToOfferMap[tokenId][bidder].price = newPrice;
    // removeOfferFromMapping(bidderAddressToOffers[bidder], tokenId, oldPrice, bidder);
    bidderAddressToOffers[bidder].remove(tokenId);
    // removeOfferFromMapping(sellerAddressToOffers[ownerOf(tokenId)], tokenId, oldPrice, bidder);
    // removeOfferFromMapping(tokenToOffers[tokenId], tokenId, oldPrice, bidder);
    tokenToOffers[tokenId].remove(bidder);

    // Update in global offers
    globalOffers.remove(uint256(keccak256(abi.encodePacked(bidder, ":", tokenId))));
}

function refundPreviousOffer(address previousBidder, uint256 tokenId, uint256 amount) internal {
    // payable(previousBidder).transfer(amount);
    // Using .call instead of .transfer to avoid 2300 gas limit DoS risk.
    (bool success, ) = payable(previousBidder).call{value: amount}("");
    // require(success, "XRC721: refund transfer failed");
    if (!success) revert TransferFailed();
    emit WithdrawOffer(tokenId, previousBidder, amount);
}

function addNewOffer(uint256 tokenId, address bidder, uint256 price) internal {
    OrderStatisticsTree.Offer memory newOffer = OrderStatisticsTree.Offer({
        tokenId: tokenId,
        bidder: bidder,
        price: price
    });

    _tokenToBidderToOfferMap[tokenId][bidder] = newOffer;
    // bidderAddressToOffers[bidder].push(newOffer);
    if (!bidderAddressToOffers[bidder].initialized) {
        bidderAddressToOffers[bidder].initializeTree(OrderStatisticsTree.ComparatorType.OFFER_TOKENID);
    }
    bidderAddressToOffers[bidder].insertOffer(newOffer, false);
    // sellerAddressToOffers[ownerOf(tokenId)].push(newOffer);
    // tokenToOffers[tokenId].push(newOffer);
    if (!tokenToOffers[tokenId].initialized) {
        tokenToOffers[tokenId].initializeTree(OrderStatisticsTree.ComparatorType.OFFER_PRICE_TOKENID);
    }
    tokenToOffers[tokenId].insertOffer(newOffer, false);

    // Add to global offers
    globalOffers.insertOffer(newOffer, true);
}

// function deleteOffer(uint256 tokenId, address bidder, uint256 offerAmount) internal {
function deleteOffer(uint256 tokenId, address bidder) internal {
    delete _tokenToBidderToOfferMap[tokenId][bidder];
    // removeOfferFromMapping(bidderAddressToOffers[bidder], tokenId, offerAmount, bidder);
    bidderAddressToOffers[bidder].remove(tokenId);
    if(bidderAddressToOffers[bidder].size() == 0) {
        delete bidderAddressToOffers[bidder];
    }
    // removeOfferFromMapping(sellerAddressToOffers[ownerOf(tokenId)], tokenId, offerAmount, bidder);
    // removeOfferFromMapping(tokenToOffers[tokenId], tokenId, offerAmount, bidder);
    tokenToOffers[tokenId].remove(bidder);

    // Remove from global offers
    globalOffers.remove(uint256(keccak256(abi.encodePacked(bidder, ":", tokenId))));
}

// function removeOfferFromMapping(OrderStatisticsTree.Offer[] storage offers, uint256 tokenId, uint256 price, address bidder) internal {
//     uint256 offersLength = offers.length;
//     for (uint256 i = 0; i < offersLength; i = i.add(1)) {
//         if (offers[i].tokenId == tokenId && offers[i].price == price && offers[i].bidder == bidder) {
//             offers[i] = offers[offersLength.sub(1)];
//             // offers.length = offersLength.sub(1);
//             offers.pop();
//             break;
//         }
//     }
// }

    function recordSale(uint256 tokenId, address seller, address buyer, uint256 price) internal {
        uint256 currentSalesId = _totalSalesCount.current();

        OrderStatisticsTree.Sale memory sale = OrderStatisticsTree.Sale({
            salesId: currentSalesId,
            tokenId: tokenId,
            seller: seller,
            buyer: buyer,
            price: price,
            timestamp: block.timestamp
        });

        _tokenSalesHistory[tokenId].push(sale);
        
        // Add to global sales history
        globalSales.insertSale(sale);

        // Increment the sales counter
        _totalSalesCount.increment();
    }

    function getTokenPrice(uint256 tokenId) public view returns (uint256) {
        // require(_exists(tokenId), "XRC721: price query for nonexistent token");
        // require(_exists(tokenId), "No token");
        if (!_exists(tokenId)) revert TokenNonexistent();
        // require(_tokenPrices[tokenId] > 0, "XRC721: token not for sale");
        if (_tokenPrices[tokenId] == 0) revert TokenNotForSale();
        return _tokenPrices[tokenId];
    }

    // Batch price lookup — returns price for each tokenId (0 if not for sale)
    function getTokenPrices(uint256[] calldata tokenIds) public view returns (uint256[] memory) {
        uint256[] memory result = new uint256[](tokenIds.length);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            result[i] = _tokenPrices[tokenIds[i]];
        }
        return result;
    }

    // function getOwnedTokens(address owner, uint256 start, uint256 count) public view returns (uint256[] memory) {
    //     require(owner != address(0), "XRC721: query for the zero address");
    //     // require(count > 0, "XRC721: count must be greater than zero");
    //     require(count > 0, "Count must be > 0");

    //     uint256[] storage ownedTokens = _ownedTokens[owner];
    //     uint256 ownedTokenCount = ownedTokens.length;

    //     // Returns empty list if starting index is past list length
    //     if (start >= ownedTokenCount) {
    //         return new uint256[](0);
    //     }

    //     uint256 end = start.add(count);
    //     if (end > ownedTokenCount) {
    //         end = ownedTokenCount;
    //     }

    //     uint256[] memory result = new uint256[](end.sub(start));
    //     for (uint256 i = start; i < end; i = i.add(1)) {
    //         result[i.sub(start)] = ownedTokens[i];
    //     }

    //     return result;
    // }
    function getOwnedTokens(address owner, uint256 start, uint256 count, bool ascending) public view returns (uint256[] memory) {
        // require(owner != address(0), "XRC721: query for the zero address");
        // require(owner != address(0), "Zero address");
        if (owner == address(0)) revert ZeroAddress();
        // require(count > 0, "XRC721: count must be greater than zero");
        // require(count > 0, "Count must be > 0");
        if (count == 0) revert CountMustBePositive();

        OrderStatisticsTree.Tree storage ownedTokensTree = _ownedTokens[owner];
        uint256 ownedTokenCount = _ownedTokensCount[owner].current();

        // Returns empty list if starting index is past list length
        if (start >= ownedTokenCount) {
            return new uint256[](0);
        }

        // Use getTokenIdRangeReverse if reverse is true, otherwise use getTokenIdRange
        // return ascending ? ownedTokensTree.getTokenIdRange(start, count) : ownedTokensTree.getTokenIdRangeReverse(start, count);
        return ownedTokensTree.getTokenIdRange(start, count, ascending);
    }

    function getOwnedTokensCount(address owner) public view returns (uint256) {
        // require(owner != address(0), "XRC721: query for the zero address");
        // require(owner != address(0), "Zero address");
        if (owner == address(0)) revert ZeroAddress();
        return _ownedTokensCount[owner].current();
    }

    // Removed: redundant getter. totalVolume is public, so Solidity auto-generates
    // a totalVolume() getter. Use that instead.
    // function getTotalVolume() public view returns (uint256) {
    //     return totalVolume;
    // }

    function getTokenSalesHistory(uint256 tokenId, uint256 start, uint256 count, bool ascending) public view returns (OrderStatisticsTree.Sale[] memory) {
        // require(_exists(tokenId), "XRC721: query for nonexistent token");
        if (!_exists(tokenId)) revert TokenNonexistent();
        // require(count > 0, "XRC721: count must be greater than zero");
        // require(count > 0, "Count must be > 0");
        if (count == 0) revert CountMustBePositive();
        
        OrderStatisticsTree.Sale[] storage salesHistory = _tokenSalesHistory[tokenId];
        uint256 salesCount = salesHistory.length;
        
        if (start >= salesCount) {
            return new OrderStatisticsTree.Sale[](0);
        }
        
        uint256 end = start.add(count);
        if (end > salesCount) {
            end = salesCount;
        }
        
        OrderStatisticsTree.Sale[] memory result = new OrderStatisticsTree.Sale[](end.sub(start));
        if (ascending) {
            for (uint256 i = start; i < end; i = i.add(1)) {
                result[i.sub(start)] = salesHistory[i];
            }
        } else {
            for (uint256 i = start; i < end; i = i.add(1)) {
                result[i.sub(start)] = salesHistory[salesCount.sub(i).sub(1)];
            }
        }
        
        return result;
    }

    function getTokenSalesHistoryCount(uint256 tokenId) public view returns (uint256) {
        // require(_exists(tokenId), "XRC721: query for nonexistent token");
        if (!_exists(tokenId)) revert TokenNonexistent();
        return _tokenSalesHistory[tokenId].length;
    }

    function getTokensMetadata(uint256 start, uint256 count) public view returns (string[] memory) {
        // require(start < MAX_TOKEN_SUPPLY, "XRC721: start index out of bounds");
        if (start >= MAX_TOKEN_SUPPLY) revert StartIndexOutOfBounds();
        // require(count > 0, "XRC721: count must be greater than zero");
        // require(count > 0, "Count must be > 0");
        if (count == 0) revert CountMustBePositive();

        // Removed: unreachable code — require above already reverts if start >= MAX_TOKEN_SUPPLY
        // if (start >= MAX_TOKEN_SUPPLY) {
        //     return new string[](0);
        // }

        uint256 end = start.add(count);
        if (end > MAX_TOKEN_SUPPLY) {
            end = MAX_TOKEN_SUPPLY;
        }

        string[] memory result = new string[](end.sub(start));
        for (uint256 i = start; i < end; i = i.add(1)) {
            result[i.sub(start)] = _tokenURIs[i];
        }

        return result;
    }

    // Added ascending parameter for consistency with all other tree-based paginated functions
    // function getOffersForBidderAddress(address bidder, uint256 start, uint256 count) public view returns (OrderStatisticsTree.Offer[] memory) {
    function getOffersForBidderAddress(address bidder, uint256 start, uint256 count, bool ascending) public view returns (OrderStatisticsTree.Offer[] memory) {
        // require(bidder != address(0), "XRC721: query for the zero address");
        // require(bidder != address(0), "Zero address");
        if (bidder == address(0)) revert ZeroAddress();
        // require(count > 0, "XRC721: count must be greater than zero");
        // require(count > 0, "Count must be > 0");
        if (count == 0) revert CountMustBePositive();

        // // Offer[] storage offers = bidderAddressToOffers[owner];
        // // uint256 totalOffers = offers.length;
        
        // // //returns empty list if starting index is past list length 
        // // if (start >= totalOffers) {
        // //     return new Offer[](0);
        // // }
        
        // // uint256 end = start.add(count);
        // // if (end > totalOffers) {
        // //     end = totalOffers;
        // // }
        
        // // Offer[] memory result = new Offer[](end.sub(start));
        // // for (uint256 i = start; i < end; i = i.add(1)) {
        // //     result[i.sub(start)] = offers[i];
        // // }
        
        // // return result;
        // return bidderAddressToOffers[bidder].getOfferRange_TokenId(start, count);
        // return bidderAddressToOffers[bidder].getOfferRange_TokenId(start, count, true);
        return bidderAddressToOffers[bidder].getOfferRange_TokenId(start, count, ascending);
    }

    function getOffersForBidderAddressCount(address bidder) public view returns (uint256) {
        // require(bidder != address(0), "XRC721: query for the zero address");
        // require(bidder != address(0), "Zero address");
        if (bidder == address(0)) revert ZeroAddress();
        // return bidderAddressToOffers[owner].length;
        return bidderAddressToOffers[bidder].size();
    }

    // function getOffersForSellerAddress(address seller, uint256 start, uint256 count) public view returns (OrderStatisticsTree.Offer[] memory) {
    //     require(seller != address(0), "XRC721: query for the zero address");
    //     // require(count > 0, "XRC721: count must be greater than zero");
    //     require(count > 0, "Count must be > 0");

    //     OrderStatisticsTree.Offer[] storage offers = sellerAddressToOffers[seller];
    //     uint256 totalOffers = offers.length;

    //     //returns empty list if starting index is past list length 
    //     if (start >= totalOffers) {
    //         return new OrderStatisticsTree.Offer[](0);
    //     }

    //     uint256 end = start.add(count);
    //     if (end > totalOffers) {
    //         end = totalOffers;
    //     }

    //     OrderStatisticsTree.Offer[] memory result = new OrderStatisticsTree.Offer[](end.sub(start));
    //     for (uint256 i = start; i < end; i = i.add(1)) {
    //         result[i.sub(start)] = offers[i];
    //     }

    //     return result;
    // }

    // function getOffersForSellerAddressCount(address seller) public view returns (uint256) {
    //     require(seller != address(0), "XRC721: query for the zero address");
    //     return sellerAddressToOffers[seller].length;
    // }

    // Function to get all offers for a specific token
    function getOffersForToken(uint256 tokenId, uint256 start, uint256 count, bool ascending) public view returns (OrderStatisticsTree.Offer[] memory) {
        // require(_exists(tokenId), "XRC721: offer query for nonexistent token");
        if (!_exists(tokenId)) revert TokenNonexistent();
        // require(count > 0, "XRC721: count must be greater than zero");
        // require(count > 0, "Count must be > 0");
        if (count == 0) revert CountMustBePositive();

        // // OrderStatisticsTree.Offer[] storage offers = tokenToOffers[tokenId];
        // // uint256 totalOffers = offers.length;

        // // //returns empty list if starting index is past list length 
        // // if (start >= totalOffers) {
        // //     return new OrderStatisticsTree.Offer[](0);
        // // }

        // // uint256 end = start.add(count);
        // // if (end > totalOffers) {
        // //     end = totalOffers;
        // // }

        // // OrderStatisticsTree.Offer[] memory result = new OrderStatisticsTree.Offer[](end.sub(start));
        // // for (uint256 i = start; i < end; i = i.add(1)) {
        // //     result[i.sub(start)] = offers[i];
        // // }

        // // return result;
        // if(ascending) {
        //     return tokenToOffers[tokenId].getOfferRange_PriceTokenId(start, count);
        // } else {
        //     return tokenToOffers[tokenId].getOfferRange_PriceTokenIdReverse(start, count);
        // }
        return tokenToOffers[tokenId].getOfferRange_PriceTokenId(start, count, ascending);
    }

    function getOffersForTokenCount(uint256 tokenId) public view returns (uint256) {
        // require(_exists(tokenId), "XRC721: offer query for nonexistent token");
        if (!_exists(tokenId)) revert TokenNonexistent();
        // return tokenToOffers[tokenId].length;
        return tokenToOffers[tokenId].size();
    }

// OrderStatisticsTree.Tree private globalOffers;
    function getGlobalOffers(uint256 start, uint256 count, bool ascending) public view returns (OrderStatisticsTree.Offer[] memory) {
        // require(_exists(tokenId), "XRC721: offer query for nonexistent token");
        // require(count > 0, "XRC721: count must be greater than zero");
        // require(count > 0, "Count must be > 0");
        if (count == 0) revert CountMustBePositive();

        // // OrderStatisticsTree.Offer[] storage offers = tokenToOffers[tokenId];
        // // uint256 totalOffers = offers.length;

        // // //returns empty list if starting index is past list length 
        // // if (start >= totalOffers) {
        // //     return new OrderStatisticsTree.Offer[](0);
        // // }

        // // uint256 end = start.add(count);
        // // if (end > totalOffers) {
        // //     end = totalOffers;
        // // }

        // // OrderStatisticsTree.Offer[] memory result = new OrderStatisticsTree.Offer[](end.sub(start));
        // // for (uint256 i = start; i < end; i = i.add(1)) {
        // //     result[i.sub(start)] = offers[i];
        // // }

        // // return result;
        // if(ascending) {
        //     return globalOffers.getOfferRange_PriceTokenId(start, count);
        // } else {
        //     return globalOffers.getOfferRange_PriceTokenIdReverse(start, count);
        // }
        return globalOffers.getOfferRange_PriceTokenId(start, count, ascending);
    }

    function getGlobalOffersCount() public view returns (uint256) {
        // require(_exists(tokenId), "XRC721: offer query for nonexistent token");
        // return tokenToOffers[tokenId].length;
        return globalOffers.size();
    }

// OrderStatisticsTree.Tree private globalSales;
    function getGlobalSales(uint256 start, uint256 count, bool ascending) public view returns (OrderStatisticsTree.Sale[] memory) {
        // require(_exists(tokenId), "XRC721: offer query for nonexistent token");
        // require(count > 0, "XRC721: count must be greater than zero");
        // require(count > 0, "Count must be > 0");
        if (count == 0) revert CountMustBePositive();

        // // OrderStatisticsTree.Offer[] storage offers = tokenToOffers[tokenId];
        // // uint256 totalOffers = offers.length;

        // // //returns empty list if starting index is past list length 
        // // if (start >= totalOffers) {
        // //     return new OrderStatisticsTree.Offer[](0);
        // // }

        // // uint256 end = start.add(count);
        // // if (end > totalOffers) {
        // //     end = totalOffers;
        // // }

        // // OrderStatisticsTree.Offer[] memory result = new OrderStatisticsTree.Offer[](end.sub(start));
        // // for (uint256 i = start; i < end; i = i.add(1)) {
        // //     result[i.sub(start)] = offers[i];
        // // }

        // // return result;
        // if(ascending) {
        //     return globalSales.getSaleRange_PriceTokenId(start, count);
        // } else {
        //     return globalSales.getSaleRange_PriceTokenIdReverse(start, count);
        // }
        return globalSales.getSaleRange_PriceTokenId(start, count, ascending);
    }

    function getGlobalSalesCount() public view returns (uint256) {
        // require(_exists(tokenId), "XRC721: offer query for nonexistent token");
        // return tokenToOffers[tokenId].length;
        return globalSales.size();
    }

// OrderStatisticsTree.Tree private forSaleTokens;
    function getForSaleTokens(uint256 start, uint256 count, bool ascending) public view returns (uint256[] memory) {
        // require(_exists(tokenId), "XRC721: offer query for nonexistent token");
        // require(count > 0, "XRC721: count must be greater than zero");
        // require(count > 0, "Count must be > 0");
        if (count == 0) revert CountMustBePositive();

        // // OrderStatisticsTree.Offer[] storage offers = tokenToOffers[tokenId];
        // // uint256 totalOffers = offers.length;

        // // //returns empty list if starting index is past list length 
        // // if (start >= totalOffers) {
        // //     return new OrderStatisticsTree.Offer[](0);
        // // }

        // // uint256 end = start.add(count);
        // // if (end > totalOffers) {
        // //     end = totalOffers;
        // // }

        // // OrderStatisticsTree.Offer[] memory result = new OrderStatisticsTree.Offer[](end.sub(start));
        // // for (uint256 i = start; i < end; i = i.add(1)) {
        // //     result[i.sub(start)] = offers[i];
        // // }

        // // return result;
        // if(ascending) {
        //     return forSaleTokens.getTokenIdRange(start, count);
        // } else {
        //     return forSaleTokens.getTokenIdRangeReverse(start, count);
        // }
        return forSaleTokens.getTokenIdRange(start, count, ascending);
    }

    function getForSaleTokensCount() public view returns (uint256) {
        // require(_exists(tokenId), "XRC721: offer query for nonexistent token");
        // return tokenToOffers[tokenId].length;
        return forSaleTokens.size();
    }
// OrderStatisticsTree.Tree private notForSaleTokens;
    function getNotForSaleTokens(uint256 start, uint256 count, bool ascending) public view returns (uint256[] memory) {
        // require(_exists(tokenId), "XRC721: offer query for nonexistent token");
        // require(count > 0, "XRC721: count must be greater than zero");
        // require(count > 0, "Count must be > 0");
        if (count == 0) revert CountMustBePositive();

        // // OrderStatisticsTree.Offer[] storage offers = tokenToOffers[tokenId];
        // // uint256 totalOffers = offers.length;

        // // //returns empty list if starting index is past list length 
        // // if (start >= totalOffers) {
        // //     return new OrderStatisticsTree.Offer[](0);
        // // }

        // // uint256 end = start.add(count);
        // // if (end > totalOffers) {
        // //     end = totalOffers;
        // // }

        // // OrderStatisticsTree.Offer[] memory result = new OrderStatisticsTree.Offer[](end.sub(start));
        // // for (uint256 i = start; i < end; i = i.add(1)) {
        // //     result[i.sub(start)] = offers[i];
        // // }

        // // return result;
        // if(ascending) {
        //     return notForSaleTokens.getTokenIdRange(start, count);
        // } else {
        //     return notForSaleTokens.getTokenIdRangeReverse(start, count);
        // }
        return notForSaleTokens.getTokenIdRange(start, count, ascending);
    }

    function getNotForSaleTokensCount() public view returns (uint256) {
        // require(_exists(tokenId), "XRC721: offer query for nonexistent token");
        // return tokenToOffers[tokenId].length;
        return notForSaleTokens.size();
    }

    // Function to get the current offer for a token by a specific bidder
    function getCurrentOfferOfAddressForToken(uint256 tokenId, address bidder) public view returns (OrderStatisticsTree.Offer memory) {
        // require(_exists(tokenId), "XRC721: offer query for nonexistent token");
        if (!_exists(tokenId)) revert TokenNonexistent();
        return _tokenToBidderToOfferMap[tokenId][bidder];
    }

    function getTokenCount() public view returns (uint256) {
        return _totalMintedTokens.current();
    }

    function getOwnerCount() public view returns (uint256) {
        return _uniqueOwnerCount;
    }

    // function getRoyalty() public pure returns (uint256) {
    //     return ROYALTY_PERCENTAGE;
    // }
    // Removed: redundant getter. ROYALTY_FRACTION is public, so Solidity auto-generates
    // a ROYALTY_FRACTION() getter. Use that instead.
    // function getRoyalty() public pure returns (uint256) {
    //     return ROYALTY_FRACTION;
    // }

    function getFloorPrice() public view returns (uint256) {
        // require(floorPriceMinHeap.size() > 0, "XRC721: No tokens are currently listed for sale");
        if (floorPriceMinHeap.size() == 0) revert NoTokensListed();
        return floorPriceMinHeap.getMin().price;
    }

    function getTotalSalesCount() public view returns (uint256) {
        return _totalSalesCount.current();
    }
}
