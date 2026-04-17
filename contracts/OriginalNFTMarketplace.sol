// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./external/IXRC721.sol";
import "./external/ReentrancyGuard.sol";
import "./external/Ownable.sol";

contract OriginalNFTMarketplace is Ownable, ReentrancyGuard {

    // =========================================================================
    //                     ORIGINAL 1/1 NFT MARKETPLACE
    // =========================================================================

    struct OriginalSale {
        address seller;
        address buyer;
        uint256 price;
        uint256 timestamp;
    }

    uint256 public constant TOKEN_ID = 1;
    uint256 public constant MIN_PRICE = 25000 ether;
    uint256 public constant ROYALTY_FRACTION = 1200; // 12% = 1200 basis points
    uint256 private constant FEE_DENOMINATOR = 10000;

    // IXRC721 public originalNFT;
    IXRC721 public immutable originalNFT;
    address public royaltyOwner;
    uint256 public originalPrice;
    OriginalSale[] public originalSalesHistory;
    mapping(address => uint256) public originalOffers;
    address[] public originalBidders;
    mapping(address => uint256) private originalBidderIndex; // 1-indexed (0 = not in array)

    // error OriginalNotSet();
    // error OriginalAlreadySet();
    error OriginalNotApproved();
    error CallerIsOwner();
    error CallerNotOwner();
    error ZeroAddress();
    error PriceBelowMinimum();
    error PriceChanged();
    error PriceMustBeDifferent();
    error InsufficientPayment();
    error TokenNotForSale();
    error TokenAlreadyForSale();
    error NoActiveOffer();
    error OfferMustBeGreater();
    error TransferFailed();

    event OriginalListed(address indexed owner, uint256 price);
    event OriginalDelisted(address indexed owner);
    event OriginalSold(address indexed seller, address indexed buyer, uint256 price);
    event OriginalPriceUpdated(address indexed owner, uint256 newPrice);
    event OriginalOfferMade(address indexed bidder, uint256 amount);
    event OriginalOfferWithdrawn(address indexed bidder, uint256 amount);
    event OriginalOfferAccepted(address indexed owner, address indexed bidder, uint256 amount);
    event RoyaltyOwnerChanged(address indexed oldOwner, address indexed newOwner);

    // constructor(address _royaltyOwner) {
    constructor(address _royaltyOwner, address _originalNFT) {
        if (_royaltyOwner == address(0)) revert ZeroAddress();
        if (_originalNFT == address(0)) revert ZeroAddress();
        royaltyOwner = _royaltyOwner;
        originalNFT = IXRC721(_originalNFT);
    }

    // function setOriginalNFT(address _originalNFT) external onlyOwner {
    //     if (address(originalNFT) != address(0)) revert OriginalAlreadySet();
    //     if (_originalNFT == address(0)) revert ZeroAddress();
    //     originalNFT = IXRC721(_originalNFT);
    // }

    function setRoyaltyOwner(address _newRoyaltyOwner) external {
        if (msg.sender != royaltyOwner) revert CallerNotOwner();
        if (_newRoyaltyOwner == address(0)) revert ZeroAddress();
        emit RoyaltyOwnerChanged(royaltyOwner, _newRoyaltyOwner);
        royaltyOwner = _newRoyaltyOwner;
    }

    // function _requireOriginalSet() internal view {
    //     if (address(originalNFT) == address(0)) revert OriginalNotSet();
    // }

    function _originalOwner() internal view returns (address) {
        return originalNFT.ownerOf(TOKEN_ID);
    }

    function _addBidder(address bidder) internal {
        if (originalBidderIndex[bidder] == 0) {
            originalBidders.push(bidder);
            originalBidderIndex[bidder] = originalBidders.length; // 1-indexed
        }
    }

    function _removeBidder(address bidder) internal {
        uint256 index = originalBidderIndex[bidder];
        if (index == 0) return;
        uint256 lastIndex = originalBidders.length;
        if (index != lastIndex) {
            address lastBidder = originalBidders[lastIndex - 1];
            originalBidders[index - 1] = lastBidder;
            originalBidderIndex[lastBidder] = index;
        }
        originalBidders.pop();
        delete originalBidderIndex[bidder];
    }

    function listOriginal(uint256 price) external {
        // _requireOriginalSet();
        if (_originalOwner() != msg.sender) revert CallerNotOwner();
        if (!originalNFT.isApprovedForAll(msg.sender, address(this))) revert OriginalNotApproved();
        if (price < MIN_PRICE) revert PriceBelowMinimum();
        if (originalPrice > 0) revert TokenAlreadyForSale();

        originalPrice = price;
        emit OriginalListed(msg.sender, price);
    }

    function delistOriginal() external {
        // _requireOriginalSet();
        if (_originalOwner() != msg.sender) revert CallerNotOwner();
        if (originalPrice == 0) revert TokenNotForSale();

        originalPrice = 0;
        emit OriginalDelisted(msg.sender);
    }

    function updateOriginalPrice(uint256 price) external {
        // _requireOriginalSet();
        if (_originalOwner() != msg.sender) revert CallerNotOwner();
        if (originalPrice == 0) revert TokenNotForSale();
        if (price < MIN_PRICE) revert PriceBelowMinimum();
        if (price == originalPrice) revert PriceMustBeDifferent();

        originalPrice = price;
        emit OriginalPriceUpdated(msg.sender, price);
    }

    function buyOriginal(uint256 expectedPrice) external payable nonReentrant {
        // _requireOriginalSet();
        if (originalPrice == 0) revert TokenNotForSale();
        if (_originalOwner() == msg.sender) revert CallerIsOwner();
        if (originalPrice != expectedPrice) revert PriceChanged();
        if (msg.value < originalPrice) revert InsufficientPayment();
        if (!originalNFT.isApprovedForAll(_originalOwner(), address(this))) revert OriginalNotApproved();

        uint256 price = originalPrice;
        address seller = _originalOwner();

        // Effects
        originalPrice = 0;
        originalSalesHistory.push(OriginalSale(seller, msg.sender, price, block.timestamp));

        // Refund buyer's existing offer if any
        uint256 buyerOffer = originalOffers[msg.sender];
        if (buyerOffer > 0) {
            delete originalOffers[msg.sender];
            _removeBidder(msg.sender);
        }

        // Interactions
        originalNFT.transferFrom(seller, msg.sender, TOKEN_ID);

        uint256 royalty = (price * ROYALTY_FRACTION) / FEE_DENOMINATOR;
        uint256 sellerProceeds = price - royalty;

        (bool royaltySuccess, ) = payable(royaltyOwner).call{value: royalty}("");
        if (!royaltySuccess) revert TransferFailed();

        (bool sellerSuccess, ) = payable(seller).call{value: sellerProceeds}("");
        if (!sellerSuccess) revert TransferFailed();

        if (buyerOffer > 0) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: buyerOffer}("");
            if (!refundSuccess) revert TransferFailed();
        }

        if (msg.value > price) {
            (bool overpaySuccess, ) = payable(msg.sender).call{value: msg.value - price}("");
            if (!overpaySuccess) revert TransferFailed();
        }

        emit OriginalSold(seller, msg.sender, price);
    }

    function makeOriginalOffer() external payable nonReentrant {
        // _requireOriginalSet();
        if (_originalOwner() == msg.sender) revert CallerIsOwner();
        if (msg.value == 0) revert PriceBelowMinimum();

        uint256 existingOffer = originalOffers[msg.sender];
        if (msg.value <= existingOffer) revert OfferMustBeGreater();

        // Effects — replace, not accumulate (consistent with XRC721)
        originalOffers[msg.sender] = msg.value;
        _addBidder(msg.sender);

        // Interactions — refund previous offer
        if (existingOffer > 0) {
            (bool success, ) = payable(msg.sender).call{value: existingOffer}("");
            if (!success) revert TransferFailed();
        }

        emit OriginalOfferMade(msg.sender, msg.value);
    }

    function withdrawOriginalOffer() external nonReentrant {
        // _requireOriginalSet();
        uint256 amount = originalOffers[msg.sender];
        if (amount == 0) revert NoActiveOffer();

        // Effects
        delete originalOffers[msg.sender];
        _removeBidder(msg.sender);

        // Interactions
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit OriginalOfferWithdrawn(msg.sender, amount);
    }

    function acceptOriginalOffer(address bidder) external nonReentrant {
        // _requireOriginalSet();
        if (_originalOwner() != msg.sender) revert CallerNotOwner();
        if (!originalNFT.isApprovedForAll(msg.sender, address(this))) revert OriginalNotApproved();

        uint256 offerAmount = originalOffers[bidder];
        if (offerAmount == 0) revert NoActiveOffer();

        // Effects
        delete originalOffers[bidder];
        _removeBidder(bidder);
        originalPrice = 0;
        originalSalesHistory.push(OriginalSale(msg.sender, bidder, offerAmount, block.timestamp));

        // Interactions
        originalNFT.transferFrom(msg.sender, bidder, TOKEN_ID);

        uint256 royalty = (offerAmount * ROYALTY_FRACTION) / FEE_DENOMINATOR;
        uint256 sellerProceeds = offerAmount - royalty;

        (bool royaltySuccess, ) = payable(royaltyOwner).call{value: royalty}("");
        if (!royaltySuccess) revert TransferFailed();

        (bool sellerSuccess, ) = payable(msg.sender).call{value: sellerProceeds}("");
        if (!sellerSuccess) revert TransferFailed();

        emit OriginalOfferAccepted(msg.sender, bidder, offerAmount);
    }

    function getOriginalSalesHistory() external view returns (OriginalSale[] memory) {
        return originalSalesHistory;
    }

    function isOriginalForSale() external view returns (bool) {
        return originalPrice > 0;
    }

    function getOriginalOwner() external view returns (address) {
        // _requireOriginalSet();
        return _originalOwner();
    }

    function getOriginalBidders() external view returns (address[] memory) {
        return originalBidders;
    }

    function getOriginalBiddersCount() external view returns (uint256) {
        return originalBidders.length;
    }
}
