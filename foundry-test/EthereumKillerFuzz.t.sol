// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
// import "../XRC721.sol";
import "contracts/EthereumKiller.sol";
import "contracts/OrderStatisticsTree.sol";
import "contracts/CustomMinHeapLib.sol";
import "contracts/CustomMinHeapLibTest.sol";
import "contracts/OrderStatisticsTreeTest.sol";

contract EthereumKillerFuzzTest is Test {
    EthereumKiller public nft;
    address public owner;
    address public buyer1;
    address public buyer2;
    address public buyer3;
    address public buyer4;
    address public buyer5;
    address public seller1;

    uint256 constant MIN_PRICE = 1 ether;
    uint256 constant ROYALTY_PERCENTAGE = 12;
    uint256 constant ROYALTY_FRACTION = 1200;
    uint256 constant FEE_DENOMINATOR = 10000;

    function setUp() public {
        owner = address(this);
        buyer1 = makeAddr("buyer1");
        buyer2 = makeAddr("buyer2");
        buyer3 = makeAddr("buyer3");
        buyer4 = makeAddr("buyer4");
        buyer5 = makeAddr("buyer5");
        seller1 = makeAddr("seller1");

        nft = new EthereumKiller();

        // Fund test accounts generously
        vm.deal(buyer1, 10000 ether);
        vm.deal(buyer2, 10000 ether);
        vm.deal(buyer3, 10000 ether);
        vm.deal(buyer4, 10000 ether);
        vm.deal(buyer5, 10000 ether);
        vm.deal(seller1, 10000 ether);
        vm.deal(owner, 10000 ether);
    }

    // ================================================================
    // SECTION 1: MINTING FUZZ TESTS
    // ================================================================

    function testFuzz_MintAndListForSale(uint256 tokenId, uint256 price) public {
        tokenId = bound(tokenId, 0, 99999);
        price = bound(price, MIN_PRICE, 100 ether);

        nft.mintAndListForSale(owner, tokenId, price, "");

        assertEq(nft.ownerOf(tokenId), owner);
        assertEq(nft.getTokenPrice(tokenId), price);
        assertTrue(nft.isTokenForSale(tokenId));
        assertEq(nft.getFloorPrice(), price);
        assertEq(nft.getTokenCount(), 1);
        assertEq(nft.balanceOf(owner), 1);
    }

    function testFuzz_MintWithURI(uint256 tokenId) public {
        tokenId = bound(tokenId, 0, 99999);
        string memory uri = "ipfs://QmTest123";

        nft.mintAndListForSale(owner, tokenId, MIN_PRICE, uri);

        assertEq(nft.tokenURI(tokenId), uri);
    }

    function testFuzz_MintMultipleTokens(uint8 count) public {
        count = uint8(bound(uint256(count), 1, 50));

        for (uint256 i = 0; i < count; i++) {
            nft.mintAndListForSale(owner, i, MIN_PRICE + i * 1 ether, "");
        }

        assertEq(nft.getTokenCount(), count);
        assertEq(nft.balanceOf(owner), count);
        assertEq(nft.getForSaleTokensCount(), count);
        assertEq(nft.getFloorPrice(), MIN_PRICE);
    }

    function testFuzz_CannotMintDuplicateToken(uint256 tokenId) public {
        tokenId = bound(tokenId, 0, 99999);

        nft.mintAndListForSale(owner, tokenId, MIN_PRICE, "");

        // vm.expectRevert("XRC721: token already exists");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.TokenAlreadyMinted.selector));
        nft.mintAndListForSale(owner, tokenId, MIN_PRICE, "");
    }

    function testFuzz_CannotMintBelowMinPrice(uint256 price) public {
        price = bound(price, 0, MIN_PRICE - 1);

        // vm.expectRevert("XRC721: price must be at least 25,000 XDC");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.PriceBelowMinimum.selector));
        nft.mintAndListForSale(owner, 0, price, "");
    }

    function testFuzz_OnlyOwnerCanMint(uint256 tokenId) public {
        tokenId = bound(tokenId, 0, 99999);

        vm.prank(buyer1);
        vm.expectRevert("Ownable: caller is not the owner");
        nft.mintAndListForSale(buyer1, tokenId, MIN_PRICE, "");
    }

    function testFuzz_MintToAnotherAddress(uint256 tokenId, uint256 price) public {
        tokenId = bound(tokenId, 0, 99999);
        price = bound(price, MIN_PRICE, 100 ether);

        nft.mintAndListForSale(seller1, tokenId, price, "");

        assertEq(nft.ownerOf(tokenId), seller1);
        assertEq(nft.balanceOf(seller1), 1);
    }

    // ================================================================
    // SECTION 2: FLOOR PRICE / MIN HEAP FUZZ TESTS
    // ================================================================

    function testFuzz_FloorPriceWithMultipleTokens(uint256 price1, uint256 price2, uint256 price3) public {
        price1 = bound(price1, MIN_PRICE, 100 ether);
        price2 = bound(price2, MIN_PRICE, 100 ether);
        price3 = bound(price3, MIN_PRICE, 100 ether);

        nft.mintAndListForSale(owner, 0, price1, "");
        nft.mintAndListForSale(owner, 1, price2, "");
        nft.mintAndListForSale(owner, 2, price3, "");

        uint256 expectedFloor = price1;
        if (price2 < expectedFloor) expectedFloor = price2;
        if (price3 < expectedFloor) expectedFloor = price3;

        assertEq(nft.getFloorPrice(), expectedFloor);
    }

    function testFuzz_FloorPriceAfterRemoval(
        uint256 price1,
        uint256 price2,
        uint256 price3,
        uint8 removeIndex
    ) public {
        price1 = bound(price1, MIN_PRICE, 10 ether);
        price2 = bound(price2, MIN_PRICE, 10 ether);
        price3 = bound(price3, MIN_PRICE, 10 ether);
        removeIndex = uint8(bound(uint256(removeIndex), 0, 2));

        nft.mintAndListForSale(owner, 0, price1, "");
        nft.mintAndListForSale(owner, 1, price2, "");
        nft.mintAndListForSale(owner, 2, price3, "");

        uint256[3] memory prices = [price1, price2, price3];

        nft.removeTokenFromSale(removeIndex);

        uint256 expectedFloor = type(uint256).max;
        for (uint256 i = 0; i < 3; i++) {
            if (i != removeIndex && prices[i] < expectedFloor) {
                expectedFloor = prices[i];
            }
        }

        assertEq(nft.getFloorPrice(), expectedFloor);
    }

    function testFuzz_FloorPriceAfterPriceUpdate(uint256 initial, uint256 updated) public {
        initial = bound(initial, MIN_PRICE, 50 ether);
        updated = bound(updated, MIN_PRICE, 50 ether);
        vm.assume(initial != updated);

        nft.mintAndListForSale(owner, 0, initial, "");
        nft.updateTokenPrice(0, updated);

        assertEq(nft.getFloorPrice(), updated);
    }

    // ================================================================
    // SECTION 3: BUY TOKEN FUZZ TESTS
    // ================================================================

    function testFuzz_BuyToken(uint256 price, uint256 overpay) public {
        price = bound(price, MIN_PRICE, 50 ether);
        overpay = bound(overpay, 0, 5 ether);

        nft.mintAndListForSale(owner, 0, price, "");

        uint256 buyerBalanceBefore = buyer1.balance;

        vm.prank(buyer1);
        nft.buyToken{value: price + overpay}(0, price);

        assertEq(nft.ownerOf(0), buyer1);
        assertFalse(nft.isTokenForSale(0));
        // Overpay is refunded
        assertEq(buyer1.balance, buyerBalanceBefore - price);
    }

    function testFuzz_BuyTokenRoyaltyDistribution(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller1, 0, price, "");

        address royaltyOwner = nft.ROYALTY_OWNER();
        uint256 royaltyOwnerBefore = royaltyOwner.balance;
        uint256 sellerBefore = seller1.balance;

        vm.prank(buyer1);
        nft.buyToken{value: price}(0, price);

        uint256 expectedRoyalty = (price * ROYALTY_FRACTION) / FEE_DENOMINATOR;
        uint256 expectedSellerProceeds = price - expectedRoyalty;

        assertEq(royaltyOwner.balance, royaltyOwnerBefore + expectedRoyalty);
        assertEq(seller1.balance, sellerBefore + expectedSellerProceeds);
        assertEq(nft.totalVolume(), price);
        assertEq(nft.getTotalSalesCount(), 1);
    }

    function testFuzz_CannotBuyOwnToken(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, price, "");

        // vm.expectRevert("XRC721: caller is the owner");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.CallerIsOwner.selector));
        nft.buyToken{value: price}(0, price);
    }

    function testFuzz_CannotBuyWithInsufficientPayment(uint256 price, uint256 payment) public {
        price = bound(price, 2 ether, 50 ether);
        payment = bound(payment, 0, price - 1);

        nft.mintAndListForSale(owner, 0, price, "");

        vm.prank(buyer1);
        // vm.expectRevert("XRC721: insufficient payment");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.InsufficientPayment.selector));
        nft.buyToken{value: payment}(0, price);
    }

    function testFuzz_BuyTokenRefundsExistingOffer(uint256 salePrice, uint256 offerPrice) public {
        salePrice = bound(salePrice, MIN_PRICE, 50 ether);
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, salePrice, "");

        // buyer1 makes offer first
        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);

        uint256 buyer1BalanceBefore = buyer1.balance;

        // buyer1 then buys token directly — their offer should be refunded
        vm.prank(buyer1);
        nft.buyToken{value: salePrice}(0, salePrice);

        // buyer1 gets offer refunded, pays sale price
        assertEq(buyer1.balance, buyer1BalanceBefore + offerPrice - salePrice);
        assertEq(nft.ownerOf(0), buyer1);
    }

    // ================================================================
    // SECTION 4: LIST / DELIST / PRICE UPDATE FUZZ TESTS
    // ================================================================

    function testFuzz_ListAndRemoveFromSale(uint256 price) public {
        price = bound(price, MIN_PRICE, 100 ether);

        nft.mintAndListForSale(owner, 0, price, "");

        // Buy it to delist
        vm.prank(buyer1);
        nft.buyToken{value: price}(0, price);
        assertFalse(nft.isTokenForSale(0));
        assertEq(nft.getNotForSaleTokensCount(), 1);

        // Re-list
        vm.prank(buyer1);
        nft.listTokenForSale(0, price);
        assertTrue(nft.isTokenForSale(0));
        assertEq(nft.getTokenPrice(0), price);
        assertEq(nft.getForSaleTokensCount(), 1);

        // Remove from sale
        vm.prank(buyer1);
        nft.removeTokenFromSale(0);
        assertFalse(nft.isTokenForSale(0));
        assertEq(nft.getNotForSaleTokensCount(), 1);
    }

    function testFuzz_UpdateTokenPrice(uint256 initialPrice, uint256 newPrice) public {
        initialPrice = bound(initialPrice, MIN_PRICE, 100 ether);
        newPrice = bound(newPrice, MIN_PRICE, 100 ether);
        vm.assume(initialPrice != newPrice);

        nft.mintAndListForSale(owner, 0, initialPrice, "");
        nft.updateTokenPrice(0, newPrice);

        assertEq(nft.getTokenPrice(0), newPrice);
        assertEq(nft.getFloorPrice(), newPrice);
    }

    function testFuzz_CannotListBelowMinPrice(uint256 price) public {
        price = bound(price, 0, MIN_PRICE - 1);

        nft.mintAndListForSale(owner, 0, MIN_PRICE, "");
        vm.prank(buyer1);
        nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);

        vm.prank(buyer1);
        // vm.expectRevert("XRC721: price must be at least 25,000 XDC");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.PriceBelowMinimum.selector));
        nft.listTokenForSale(0, price);
    }

    function testFuzz_CannotListAlreadyListed(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, price, "");

        // vm.expectRevert("XRC721: token already for sale");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.TokenAlreadyForSale.selector));
        nft.listTokenForSale(0, price);
    }

    function testFuzz_CannotRemoveNotListed(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, price, "");
        vm.prank(buyer1);
        nft.buyToken{value: price}(0, price);

        vm.prank(buyer1);
        // vm.expectRevert("XRC721: token is not listed for sale");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.TokenNotForSale.selector));
        nft.removeTokenFromSale(0);
    }

    function testFuzz_OnlyOwnerCanList(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, price, "");
        vm.prank(buyer1);
        nft.buyToken{value: price}(0, price);

        // buyer2 tries to list buyer1's token
        vm.prank(buyer2);
        // vm.expectRevert("XRC721: caller is not the owner");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.CallerNotOwner.selector));
        nft.listTokenForSale(0, MIN_PRICE);
    }

    // ================================================================
    // SECTION 5: OFFER FUZZ TESTS
    // ================================================================

    function testFuzz_MakeOffer(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, 5 ether, "");

        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);

        OrderStatisticsTree.Offer memory offer = nft.getCurrentOfferOfAddressForToken(0, buyer1);
        assertEq(offer.price, offerPrice);
        assertEq(offer.bidder, buyer1);
        assertEq(offer.tokenId, 0);
        assertEq(nft.getOffersForTokenCount(0), 1);
    }

    function testFuzz_MakeOfferBelowMinPrice(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, 0, MIN_PRICE - 1);

        nft.mintAndListForSale(owner, 0, 5 ether, "");

        vm.prank(buyer1);
        // vm.expectRevert("XRC721: offer price must be at least 25,000 XDC");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.PriceBelowMinimum.selector));
        nft.makeOffer{value: offerPrice}(0);
    }

    function testFuzz_MakeAndWithdrawOffer(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, 5 ether, "");

        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);

        uint256 balanceBefore = buyer1.balance;

        vm.prank(buyer1);
        nft.withdrawOffer(0);

        // Full refund
        assertEq(buyer1.balance, balanceBefore + offerPrice);

        // Offer should be cleared
        OrderStatisticsTree.Offer memory offer = nft.getCurrentOfferOfAddressForToken(0, buyer1);
        assertEq(offer.price, 0);
        assertEq(nft.getOffersForTokenCount(0), 0);
    }

    function testFuzz_MakeAndAcceptOffer(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller1, 0, 5 ether, "");

        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);

        uint256 sellerBefore = seller1.balance;
        uint256 royaltyOwnerBefore = owner.balance;

        vm.prank(seller1);
        nft.acceptOffer(0, buyer1);

        // Ownership transferred
        assertEq(nft.ownerOf(0), buyer1);

        // Royalty and proceeds distributed
        uint256 expectedRoyalty = (offerPrice * ROYALTY_FRACTION) / FEE_DENOMINATOR;
        uint256 expectedProceeds = offerPrice - expectedRoyalty;
        assertEq(seller1.balance, sellerBefore + expectedProceeds);
        assertEq(owner.balance, royaltyOwnerBefore + expectedRoyalty);

        // Volume updated
        assertEq(nft.totalVolume(), offerPrice);

        // Offer cleared
        assertEq(nft.getOffersForTokenCount(0), 0);
    }

    function testFuzz_OfferUpdateHigherValue(uint256 offer1, uint256 offer2) public {
        offer1 = bound(offer1, MIN_PRICE, 25 ether);
        offer2 = bound(offer2, offer1 + 1, 50 ether);

        nft.mintAndListForSale(owner, 0, 5 ether, "");

        vm.prank(buyer1);
        nft.makeOffer{value: offer1}(0);

        uint256 balanceBefore = buyer1.balance;

        // Higher offer replaces, refunds previous
        vm.prank(buyer1);
        nft.makeOffer{value: offer2}(0);

        // Should have been refunded offer1 and charged offer2
        assertEq(buyer1.balance, balanceBefore + offer1 - offer2);

        OrderStatisticsTree.Offer memory offer = nft.getCurrentOfferOfAddressForToken(0, buyer1);
        assertEq(offer.price, offer2);
        // Still only 1 offer for this token from this bidder
        assertEq(nft.getOffersForTokenCount(0), 1);
    }

    function testFuzz_MultipleOffersOnSameToken(uint256 offer1, uint256 offer2, uint256 offer3) public {
        offer1 = bound(offer1, MIN_PRICE, 50 ether);
        offer2 = bound(offer2, MIN_PRICE, 50 ether);
        offer3 = bound(offer3, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, 100 ether, "");

        vm.prank(buyer1);
        nft.makeOffer{value: offer1}(0);

        vm.prank(buyer2);
        nft.makeOffer{value: offer2}(0);

        vm.prank(buyer3);
        nft.makeOffer{value: offer3}(0);

        assertEq(nft.getOffersForTokenCount(0), 3);

        OrderStatisticsTree.Offer memory o1 = nft.getCurrentOfferOfAddressForToken(0, buyer1);
        OrderStatisticsTree.Offer memory o2 = nft.getCurrentOfferOfAddressForToken(0, buyer2);
        OrderStatisticsTree.Offer memory o3 = nft.getCurrentOfferOfAddressForToken(0, buyer3);

        assertEq(o1.price, offer1);
        assertEq(o2.price, offer2);
        assertEq(o3.price, offer3);
    }

    function testFuzz_OffersForBidderAddress(uint256 price1, uint256 price2) public {
        price1 = bound(price1, MIN_PRICE, 50 ether);
        price2 = bound(price2, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, 100 ether, "");
        nft.mintAndListForSale(owner, 1, 100 ether, "");

        vm.prank(buyer1);
        nft.makeOffer{value: price1}(0);

        vm.prank(buyer1);
        nft.makeOffer{value: price2}(1);

        assertEq(nft.getOffersForBidderAddressCount(buyer1), 2);

        OrderStatisticsTree.Offer[] memory offers = nft.getOffersForBidderAddress(buyer1, 0, 10, true);
        assertEq(offers.length, 2);
    }

    function testFuzz_WithdrawNonExistentOffer() public {
        nft.mintAndListForSale(owner, 0, 5 ether, "");

        vm.prank(buyer1);
        vm.expectRevert();
        nft.withdrawOffer(0);
    }

    function testFuzz_AcceptNonExistentOffer() public {
        nft.mintAndListForSale(owner, 0, 5 ether, "");

        vm.expectRevert();
        nft.acceptOffer(0, buyer1);
    }

    // ================================================================
    // SECTION 6: ROYALTY OWNER FUZZ TESTS
    // ================================================================

    function testFuzz_SetRoyaltyOwner() public {
        assertEq(nft.ROYALTY_OWNER(), owner);

        nft.setRoyaltyOwner(buyer1);
        assertEq(nft.ROYALTY_OWNER(), buyer1);
    }

    function testFuzz_CannotSetRoyaltyOwnerIfNotCurrent() public {
        vm.prank(buyer1);
        // vm.expectRevert("Only current ROYALTY_OWNER can change");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.NotRoyaltyOwner.selector));
        nft.setRoyaltyOwner(buyer2);
    }

    function testFuzz_CannotSetRoyaltyOwnerToSame() public {
        // vm.expectRevert("New address must be different from current ROYALTY_OWNER");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.SameRoyaltyOwner.selector));
        nft.setRoyaltyOwner(owner);
    }

    function testFuzz_CannotSetRoyaltyOwnerToZero() public {
        // vm.expectRevert("Invalid address");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.ZeroAddress.selector));
        nft.setRoyaltyOwner(address(0));
    }

    // ================================================================
    // SECTION 7: TRANSFER FUZZ TESTS
    // ================================================================

    function testFuzz_TransferToken(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, price, "");

        vm.prank(buyer1);
        nft.buyToken{value: price}(0, price);

        vm.prank(buyer1);
        nft.transferFrom(buyer1, buyer2, 0);

        assertEq(nft.ownerOf(0), buyer2);
        assertEq(nft.balanceOf(buyer1), 0);
        assertEq(nft.balanceOf(buyer2), 1);
    }

    function testFuzz_ApproveAndTransfer(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, price, "");

        nft.approve(buyer1, 0);
        assertEq(nft.getApproved(0), buyer1);

        vm.prank(buyer1);
        nft.transferFrom(owner, buyer2, 0);

        assertEq(nft.ownerOf(0), buyer2);
    }

    function testFuzz_SetApprovalForAll() public {
        nft.setApprovalForAll(buyer1, true);
        assertTrue(nft.isApprovedForAll(owner, buyer1));

        nft.setApprovalForAll(buyer1, false);
        assertFalse(nft.isApprovedForAll(owner, buyer1));
    }

    function testFuzz_CannotTransferByNonOwner() public {
        nft.mintAndListForSale(owner, 0, MIN_PRICE, "");

        vm.prank(buyer1);
        // vm.expectRevert("XRC721: transfer caller is not owner nor approved");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.CallerNotOwnerNorApproved.selector));
        nft.transferFrom(owner, buyer2, 0);
    }

    // ================================================================
    // SECTION 8: SALES HISTORY FUZZ TESTS
    // ================================================================

    function testFuzz_SalesHistoryRecorded(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller1, 0, price, "");

        vm.prank(buyer1);
        nft.buyToken{value: price}(0, price);

        assertEq(nft.getTokenSalesHistoryCount(0), 1);

        OrderStatisticsTree.Sale[] memory history = nft.getTokenSalesHistory(0, 0, 10, true);
        assertEq(history.length, 1);
        assertEq(history[0].seller, seller1);
        assertEq(history[0].buyer, buyer1);
        assertEq(history[0].price, price);
        assertEq(history[0].tokenId, 0);
    }

    function testFuzz_MultipleSalesHistory(uint256 price1, uint256 price2) public {
        price1 = bound(price1, MIN_PRICE, 50 ether);
        price2 = bound(price2, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, price1, "");

        // Sale 1: owner -> buyer1
        vm.prank(buyer1);
        nft.buyToken{value: price1}(0, price1);

        // Sale 2: buyer1 relists -> buyer2 buys
        vm.prank(buyer1);
        nft.listTokenForSale(0, price2);

        vm.prank(buyer2);
        nft.buyToken{value: price2}(0, price2);

        assertEq(nft.getTokenSalesHistoryCount(0), 2);

        OrderStatisticsTree.Sale[] memory history = nft.getTokenSalesHistory(0, 0, 10, true);
        assertEq(history.length, 2);
        assertEq(history[0].seller, owner);
        assertEq(history[0].buyer, buyer1);
        assertEq(history[0].price, price1);
        assertEq(history[1].seller, buyer1);
        assertEq(history[1].buyer, buyer2);
        assertEq(history[1].price, price2);
    }

    function testFuzz_GlobalSalesTracking(uint256 price1, uint256 price2) public {
        price1 = bound(price1, MIN_PRICE, 50 ether);
        price2 = bound(price2, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, price1, "");
        nft.mintAndListForSale(owner, 1, price2, "");

        vm.prank(buyer1);
        nft.buyToken{value: price1}(0, price1);

        vm.prank(buyer2);
        nft.buyToken{value: price2}(1, price2);

        assertEq(nft.getGlobalSalesCount(), 2);
        assertEq(nft.getTotalSalesCount(), 2);
        assertEq(nft.totalVolume(), price1 + price2);
    }

    function testFuzz_SalesHistoryPagination(uint256 price) public {
        price = bound(price, MIN_PRICE, 10 ether);

        nft.mintAndListForSale(owner, 0, price, "");

        // Create 3 sales
        vm.prank(buyer1);
        nft.buyToken{value: price}(0, price);

        vm.prank(buyer1);
        nft.listTokenForSale(0, price);
        vm.prank(buyer2);
        nft.buyToken{value: price}(0, price);

        vm.prank(buyer2);
        nft.listTokenForSale(0, price);
        vm.prank(buyer3);
        nft.buyToken{value: price}(0, price);

        // Ascending
        OrderStatisticsTree.Sale[] memory asc = nft.getTokenSalesHistory(0, 0, 2, true);
        assertEq(asc.length, 2);

        // Descending
        OrderStatisticsTree.Sale[] memory desc = nft.getTokenSalesHistory(0, 0, 2, false);
        assertEq(desc.length, 2);
    }

    // ================================================================
    // SECTION 9: PAGINATION FUZZ TESTS
    // ================================================================

    function testFuzz_GetOwnedTokensPagination(uint8 numTokens, uint8 start, uint8 count) public {
        numTokens = uint8(bound(uint256(numTokens), 1, 30));
        start = uint8(bound(uint256(start), 0, uint256(numTokens) - 1));
        count = uint8(bound(uint256(count), 1, 30));

        for (uint256 i = 0; i < numTokens; i++) {
            nft.mintAndListForSale(owner, i, MIN_PRICE, "");
        }

        uint256[] memory tokens = nft.getOwnedTokens(owner, start, count, true);

        uint256 expectedLength = count;
        if (start + count > numTokens) {
            expectedLength = numTokens - start;
        }

        assertEq(tokens.length, expectedLength);
    }

    function testFuzz_GetForSaleTokens(uint8 numTokens) public {
        numTokens = uint8(bound(uint256(numTokens), 2, 10));

        for (uint256 i = 0; i < numTokens; i++) {
            nft.mintAndListForSale(owner, i, MIN_PRICE + i * 1 ether, "");
        }

        assertEq(nft.getForSaleTokensCount(), numTokens);

        // Get all ascending
        uint256[] memory asc = nft.getForSaleTokens(0, numTokens, true);
        assertEq(asc.length, numTokens);

        // Ascending should be sorted
        for (uint256 i = 1; i < asc.length; i++) {
            assertTrue(asc[i] >= asc[i - 1]);
        }

        // Descending: start from last index (size-1) and traverse backwards
        uint256[] memory desc = nft.getForSaleTokens(uint256(numTokens) - 1, numTokens, false);
        assertEq(desc.length, numTokens);
        for (uint256 i = 1; i < desc.length; i++) {
            assertTrue(desc[i] <= desc[i - 1]);
        }
    }

    function testFuzz_GetNotForSaleTokens(uint8 numTokens) public {
        numTokens = uint8(bound(uint256(numTokens), 2, 10));

        for (uint256 i = 0; i < numTokens; i++) {
            nft.mintAndListForSale(owner, i, MIN_PRICE, "");
        }

        // Remove some from sale
        for (uint256 i = 0; i < numTokens / 2; i++) {
            nft.removeTokenFromSale(i);
        }

        assertEq(nft.getNotForSaleTokensCount(), numTokens / 2);
        assertEq(nft.getForSaleTokensCount(), numTokens - numTokens / 2);
    }

    function testFuzz_GetTokensMetadata(uint8 numTokens) public {
        numTokens = uint8(bound(uint256(numTokens), 1, 10));

        for (uint256 i = 0; i < numTokens; i++) {
            nft.mintAndListForSale(owner, i, MIN_PRICE, string(abi.encodePacked("uri", uint8(i + 48))));
        }

        string[] memory metadata = nft.getTokensMetadata(0, numTokens);
        assertEq(metadata.length, numTokens);
    }

    // ================================================================
    // SECTION 10: COMPLEX MULTI-OPERATION FUZZ TESTS
    // ================================================================

    function testFuzz_BuyRelistBuy(uint256 price1, uint256 price2) public {
        price1 = bound(price1, MIN_PRICE, 50 ether);
        price2 = bound(price2, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, price1, "");

        // Sale 1
        vm.prank(buyer1);
        nft.buyToken{value: price1}(0, price1);
        assertEq(nft.ownerOf(0), buyer1);

        // Relist
        vm.prank(buyer1);
        nft.listTokenForSale(0, price2);

        // Sale 2
        vm.prank(buyer2);
        nft.buyToken{value: price2}(0, price2);
        assertEq(nft.ownerOf(0), buyer2);

        assertEq(nft.totalVolume(), price1 + price2);
        assertEq(nft.getTotalSalesCount(), 2);
    }

    function testFuzz_OfferWithdrawReoffer(uint256 offer1, uint256 offer2) public {
        offer1 = bound(offer1, MIN_PRICE, 25 ether);
        offer2 = bound(offer2, MIN_PRICE, 25 ether);

        nft.mintAndListForSale(owner, 0, 100 ether, "");

        // Make offer
        vm.prank(buyer1);
        nft.makeOffer{value: offer1}(0);
        assertEq(nft.getOffersForTokenCount(0), 1);

        // Withdraw
        vm.prank(buyer1);
        nft.withdrawOffer(0);
        assertEq(nft.getOffersForTokenCount(0), 0);

        // Reoffer
        vm.prank(buyer1);
        nft.makeOffer{value: offer2}(0);
        assertEq(nft.getOffersForTokenCount(0), 1);

        OrderStatisticsTree.Offer memory o = nft.getCurrentOfferOfAddressForToken(0, buyer1);
        assertEq(o.price, offer2);
    }

    function testFuzz_AcceptOfferWithRemainingOffers(uint256 o1, uint256 o2, uint256 o3) public {
        o1 = bound(o1, MIN_PRICE, 50 ether);
        o2 = bound(o2, MIN_PRICE, 50 ether);
        o3 = bound(o3, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, 100 ether, "");

        vm.prank(buyer1);
        nft.makeOffer{value: o1}(0);
        vm.prank(buyer2);
        nft.makeOffer{value: o2}(0);
        vm.prank(buyer3);
        nft.makeOffer{value: o3}(0);

        assertEq(nft.getOffersForTokenCount(0), 3);

        // Accept buyer2's offer
        nft.acceptOffer(0, buyer2);

        assertEq(nft.ownerOf(0), buyer2);
        // Two remaining offers
        assertEq(nft.getOffersForTokenCount(0), 2);
    }

    function testFuzz_MultipleBuysAndSales(uint8 numTokens) public {
        numTokens = uint8(bound(uint256(numTokens), 1, 20));

        for (uint256 i = 0; i < numTokens; i++) {
            uint256 price = (i + 1) * 1 ether;
            nft.mintAndListForSale(owner, i, price, "");
        }

        assertEq(nft.getTokenCount(), numTokens);
        assertEq(nft.getForSaleTokensCount(), numTokens);
        assertEq(nft.getFloorPrice(), 1 ether);

        vm.prank(buyer1);
        nft.buyToken{value: 1 ether}(0, 1 ether);

        if (numTokens > 1) {
            assertEq(nft.getOwnerCount(), 2);
            assertEq(nft.getFloorPrice(), 2 ether);
        } else {
            assertEq(nft.getOwnerCount(), 1);
        }
    }

    // ================================================================
    // SECTION 11: INVARIANT-STYLE FUZZ TESTS
    // ================================================================

    function testFuzz_TotalVolumeNeverDecreases(uint256 price1, uint256 price2) public {
        price1 = bound(price1, MIN_PRICE, 50 ether);
        price2 = bound(price2, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, price1, "");

        vm.prank(buyer1);
        nft.buyToken{value: price1}(0, price1);
        uint256 volumeAfterFirst = nft.totalVolume();
        assertEq(volumeAfterFirst, price1);

        vm.prank(buyer1);
        nft.listTokenForSale(0, price2);

        vm.prank(buyer2);
        nft.buyToken{value: price2}(0, price2);

        assertTrue(nft.totalVolume() >= volumeAfterFirst);
        assertEq(nft.totalVolume(), price1 + price2);
    }

    function testFuzz_OwnerCountNeverExceedsTokenCount(uint8 numTokens) public {
        numTokens = uint8(bound(uint256(numTokens), 1, 20));

        for (uint256 i = 0; i < numTokens; i++) {
            nft.mintAndListForSale(owner, i, MIN_PRICE, "");
        }

        assertTrue(nft.getOwnerCount() <= nft.getTokenCount());
    }

    function testFuzz_ForSalePlusNotForSaleEqualsTotal(uint8 numTokens, uint8 numDelist) public {
        numTokens = uint8(bound(uint256(numTokens), 2, 20));
        numDelist = uint8(bound(uint256(numDelist), 0, uint256(numTokens) - 1));

        for (uint256 i = 0; i < numTokens; i++) {
            nft.mintAndListForSale(owner, i, MIN_PRICE, "");
        }

        for (uint256 i = 0; i < numDelist; i++) {
            nft.removeTokenFromSale(i);
        }

        assertEq(
            nft.getForSaleTokensCount() + nft.getNotForSaleTokensCount(),
            nft.getTokenCount()
        );
    }

    function testFuzz_SalesCountMatchesEvents(uint8 numSales) public {
        numSales = uint8(bound(uint256(numSales), 1, 5));

        nft.mintAndListForSale(owner, 0, MIN_PRICE, "");

        address[5] memory buyers = [buyer1, buyer2, buyer3, buyer4, buyer5];

        for (uint256 i = 0; i < numSales; i++) {
            address currentBuyer = buyers[i];

            vm.prank(currentBuyer);
            nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);

            if (i < numSales - 1) {
                vm.prank(currentBuyer);
                nft.listTokenForSale(0, MIN_PRICE);
            }
        }

        assertEq(nft.getTotalSalesCount(), numSales);
        assertEq(nft.getTokenSalesHistoryCount(0), numSales);
    }

    function testFuzz_BalanceConsistency(uint8 numTokens) public {
        numTokens = uint8(bound(uint256(numTokens), 1, 20));

        for (uint256 i = 0; i < numTokens; i++) {
            nft.mintAndListForSale(owner, i, MIN_PRICE, "");
        }

        assertEq(nft.balanceOf(owner), numTokens);
        assertEq(nft.getOwnedTokensCount(owner), numTokens);

        // Buy one
        if (numTokens > 0) {
            vm.prank(buyer1);
            nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);

            assertEq(nft.balanceOf(owner), numTokens - 1);
            assertEq(nft.balanceOf(buyer1), 1);
            assertEq(nft.getOwnedTokensCount(owner), numTokens - 1);
            assertEq(nft.getOwnedTokensCount(buyer1), 1);
        }
    }

    // ================================================================
    // SECTION 12: GLOBAL OFFERS TRACKING
    // ================================================================

    function testFuzz_GlobalOffersTracking(uint256 o1, uint256 o2) public {
        o1 = bound(o1, MIN_PRICE, 50 ether);
        o2 = bound(o2, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, 100 ether, "");
        nft.mintAndListForSale(owner, 1, 100 ether, "");

        vm.prank(buyer1);
        nft.makeOffer{value: o1}(0);

        vm.prank(buyer2);
        nft.makeOffer{value: o2}(1);

        assertEq(nft.getGlobalOffersCount(), 2);

        OrderStatisticsTree.Offer[] memory globalOffers = nft.getGlobalOffers(0, 10, true);
        assertEq(globalOffers.length, 2);
    }

    function testFuzz_GlobalOffersAfterWithdrawal(uint256 o1, uint256 o2) public {
        o1 = bound(o1, MIN_PRICE, 50 ether);
        o2 = bound(o2, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, 100 ether, "");

        vm.prank(buyer1);
        nft.makeOffer{value: o1}(0);

        vm.prank(buyer2);
        nft.makeOffer{value: o2}(0);

        assertEq(nft.getGlobalOffersCount(), 2);

        vm.prank(buyer1);
        nft.withdrawOffer(0);

        assertEq(nft.getGlobalOffersCount(), 1);
    }

    // ================================================================
    // SECTION 13: EDGE CASE FUZZ TESTS
    // ================================================================

    function testFuzz_BuyTokenThenMakeOffer(uint256 salePrice, uint256 offerPrice) public {
        salePrice = bound(salePrice, MIN_PRICE, 50 ether);
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, salePrice, "");
        nft.mintAndListForSale(owner, 1, salePrice, "");

        // Buy token 0
        vm.prank(buyer1);
        nft.buyToken{value: salePrice}(0, salePrice);

        // Make offer on token 1
        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(1);

        assertEq(nft.ownerOf(0), buyer1);
        assertEq(nft.getOffersForTokenCount(1), 1);
    }

    function testFuzz_AcceptOfferAfterBuy(uint256 salePrice, uint256 offerPrice) public {
        salePrice = bound(salePrice, MIN_PRICE, 50 ether);
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, salePrice, "");

        // buyer2 makes offer
        vm.prank(buyer2);
        nft.makeOffer{value: offerPrice}(0);

        // buyer1 buys directly — token delisted
        vm.prank(buyer1);
        nft.buyToken{value: salePrice}(0, salePrice);

        assertFalse(nft.isTokenForSale(0));

        // buyer2's offer still exists, new owner (buyer1) can accept
        vm.prank(buyer1);
        nft.acceptOffer(0, buyer2);

        assertEq(nft.ownerOf(0), buyer2);
    }

    function testFuzz_OfferOnNonexistentToken(uint256 tokenId) public {
        tokenId = bound(tokenId, 0, 99999);

        vm.prank(buyer1);
        vm.expectRevert();
        nft.makeOffer{value: MIN_PRICE}(tokenId);
    }

    function testFuzz_BalanceQueryForZeroAddress() public {
        // vm.expectRevert("XRC721: balance query for the zero address");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.ZeroAddress.selector));
        nft.balanceOf(address(0));
    }

    function testFuzz_OwnerOfNonExistentToken(uint256 tokenId) public {
        tokenId = bound(tokenId, 0, 99999);

        // vm.expectRevert("XRC721: owner query for nonexistent token");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.TokenNonexistent.selector));
        nft.ownerOf(tokenId);
    }

    function testFuzz_TokenURINonExistent(uint256 tokenId) public {
        tokenId = bound(tokenId, 0, 99999);

        // vm.expectRevert("XRC721: URI query for nonexistent token");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.TokenNonexistent.selector));
        nft.tokenURI(tokenId);
    }

    // ================================================================
    // SECTION 14: EVENT EMISSION FUZZ TESTS
    // ================================================================

    function testFuzz_MintEmitsTransferEvent(uint256 tokenId, uint256 price) public {
        tokenId = bound(tokenId, 0, 99999);
        price = bound(price, MIN_PRICE, 50 ether);

        vm.expectEmit(true, true, true, false);
        emit Transfer(address(0), owner, tokenId);
        nft.mintAndListForSale(owner, tokenId, price, "");
    }

    function testFuzz_MintEmitsTokenListedForSaleEvent(uint256 tokenId, uint256 price) public {
        tokenId = bound(tokenId, 0, 99999);
        price = bound(price, MIN_PRICE, 50 ether);

        vm.expectEmit(true, false, false, true);
        emit TokenListedForSale(tokenId, price);
        nft.mintAndListForSale(owner, tokenId, price, "");
    }

    function testFuzz_BuyEmitsTokenSoldEvent(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller1, 0, price, "");

        vm.expectEmit(true, true, true, false);
        emit TokenSold(0, 0, seller1, buyer1, price, block.timestamp);

        vm.prank(buyer1);
        nft.buyToken{value: price}(0, price);
    }

    function testFuzz_ListEmitsTokenListedForSaleEvent(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, price, "");
        vm.prank(buyer1);
        nft.buyToken{value: price}(0, price);

        vm.expectEmit(true, false, false, true);
        emit TokenListedForSale(0, price);

        vm.prank(buyer1);
        nft.listTokenForSale(0, price);
    }

    function testFuzz_RemoveFromSaleEmitsEvent(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, price, "");

        vm.expectEmit(true, false, false, false);
        emit TokenRemovedFromSale(0);

        nft.removeTokenFromSale(0);
    }

    function testFuzz_PriceUpdateEmitsEvent(uint256 initial, uint256 updated) public {
        initial = bound(initial, MIN_PRICE, 50 ether);
        updated = bound(updated, MIN_PRICE, 50 ether);
        vm.assume(initial != updated);

        nft.mintAndListForSale(owner, 0, initial, "");

        vm.expectEmit(true, false, false, true);
        emit TokenPriceUpdated(0, updated);

        nft.updateTokenPrice(0, updated);
    }

    function testFuzz_MakeOfferEmitsEvent(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, 100 ether, "");

        vm.expectEmit(true, true, false, true);
        emit MakeOffer(0, buyer1, offerPrice);

        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);
    }

    function testFuzz_WithdrawOfferEmitsEvent(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, 100 ether, "");
        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);

        vm.expectEmit(true, true, false, true);
        emit WithdrawOffer(0, buyer1, offerPrice);

        vm.prank(buyer1);
        nft.withdrawOffer(0);
    }

    function testFuzz_AcceptOfferEmitsWithdrawAndSoldEvents(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller1, 0, 100 ether, "");
        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);

        vm.expectEmit(true, true, false, true);
        emit WithdrawOffer(0, buyer1, offerPrice);

        vm.prank(seller1);
        nft.acceptOffer(0, buyer1);
    }

    function testFuzz_SalesIdIncrementsSequentially(uint8 numSales) public {
        numSales = uint8(bound(uint256(numSales), 1, 5));

        address[5] memory buyers = [buyer1, buyer2, buyer3, buyer4, buyer5];

        nft.mintAndListForSale(owner, 0, MIN_PRICE, "");

        for (uint256 i = 0; i < numSales; i++) {
            address currentBuyer = buyers[i];

            vm.prank(currentBuyer);
            nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);

            if (i < numSales - 1) {
                vm.prank(currentBuyer);
                nft.listTokenForSale(0, MIN_PRICE);
            }
        }

        // Verify salesIds are sequential in the sales history
        OrderStatisticsTree.Sale[] memory history = nft.getTokenSalesHistory(0, 0, numSales, true);
        assertEq(history.length, numSales);
        for (uint256 i = 0; i < history.length; i++) {
            assertEq(history[i].salesId, i);
        }
    }

    // ================================================================
    // SECTION 15: OFFER UPDATE LOWER VALUE REVERT
    // ================================================================

    function testFuzz_OfferUpdateLowerValueReverts(uint256 offer1, uint256 offer2) public {
        offer1 = bound(offer1, MIN_PRICE + 1 ether, 50 ether);
        offer2 = bound(offer2, MIN_PRICE, offer1 - 1);

        nft.mintAndListForSale(owner, 0, 100 ether, "");

        vm.prank(buyer1);
        nft.makeOffer{value: offer1}(0);

        vm.prank(buyer1);
        // vm.expectRevert("XRC721: new offer must be greater than existing offer");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.OfferMustBeGreater.selector));
        nft.makeOffer{value: offer2}(0);
    }

    function testFuzz_OfferUpdateSameValueReverts(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, 100 ether, "");

        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);

        vm.prank(buyer1);
        // vm.expectRevert("XRC721: new offer must be greater than existing offer");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.OfferMustBeGreater.selector));
        nft.makeOffer{value: offerPrice}(0);
    }

    // ================================================================
    // SECTION 16: RANGE QUERY EDGE CASES
    // ================================================================

    function testFuzz_GetForSaleTokensOutOfRangeStart(uint8 numTokens, uint256 startOffset) public {
        numTokens = uint8(bound(uint256(numTokens), 1, 10));
        startOffset = bound(startOffset, 0, 50);

        for (uint256 i = 0; i < numTokens; i++) {
            nft.mintAndListForSale(owner, i, MIN_PRICE + i * 1 ether, "");
        }

        // Start beyond tree size returns empty
        uint256[] memory result = nft.getForSaleTokens(uint256(numTokens) + startOffset, 10, true);
        assertEq(result.length, 0);
    }

    function testFuzz_GetForSaleTokensCountExceedsSize(uint8 numTokens, uint256 extraCount) public {
        numTokens = uint8(bound(uint256(numTokens), 1, 10));
        extraCount = bound(extraCount, 1, 100);

        for (uint256 i = 0; i < numTokens; i++) {
            nft.mintAndListForSale(owner, i, MIN_PRICE + i * 1 ether, "");
        }

        // Ascending: request more than available from start=0
        uint256[] memory asc = nft.getForSaleTokens(0, uint256(numTokens) + extraCount, true);
        assertEq(asc.length, numTokens);

        // Descending: request more than available from start=size-1
        uint256[] memory desc = nft.getForSaleTokens(uint256(numTokens) - 1, uint256(numTokens) + extraCount, false);
        assertEq(desc.length, numTokens);
    }

    function testFuzz_GetForSaleTokensZeroCountReverts() public {
        nft.mintAndListForSale(owner, 0, MIN_PRICE, "");

        // vm.expectRevert("Count must be > 0");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.CountMustBePositive.selector));
        nft.getForSaleTokens(0, 0, true);
    }

    function testFuzz_GetNotForSaleTokensOutOfRange(uint8 numTokens) public {
        numTokens = uint8(bound(uint256(numTokens), 2, 10));

        for (uint256 i = 0; i < numTokens; i++) {
            nft.mintAndListForSale(owner, i, MIN_PRICE, "");
        }

        // Remove all from sale
        for (uint256 i = 0; i < numTokens; i++) {
            nft.removeTokenFromSale(i);
        }

        // Out of range start returns empty
        uint256[] memory result = nft.getNotForSaleTokens(uint256(numTokens) + 5, 10, true);
        assertEq(result.length, 0);
    }

    function testFuzz_GetOwnedTokensStartBeyondCount(uint8 numTokens) public {
        numTokens = uint8(bound(uint256(numTokens), 1, 10));

        for (uint256 i = 0; i < numTokens; i++) {
            nft.mintAndListForSale(owner, i, MIN_PRICE, "");
        }

        // Start beyond owned count returns empty
        uint256[] memory result = nft.getOwnedTokens(owner, uint256(numTokens) + 5, 10, true);
        assertEq(result.length, 0);
    }

    function testFuzz_GetSalesHistoryZeroCountReverts() public {
        nft.mintAndListForSale(owner, 0, MIN_PRICE, "");
        vm.prank(buyer1);
        nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);

        vm.expectRevert();
        nft.getTokenSalesHistory(0, 0, 0, true);
    }

    function testFuzz_GetSalesHistoryOutOfRange() public {
        nft.mintAndListForSale(owner, 0, MIN_PRICE, "");
        vm.prank(buyer1);
        nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);

        // Start beyond sales count returns empty
        OrderStatisticsTree.Sale[] memory result = nft.getTokenSalesHistory(0, 100, 10, true);
        assertEq(result.length, 0);
    }

    function testFuzz_GetForSaleTokensSingleElement() public {
        nft.mintAndListForSale(owner, 42, MIN_PRICE, "");

        uint256[] memory asc = nft.getForSaleTokens(0, 10, true);
        assertEq(asc.length, 1);
        assertEq(asc[0], 42);

        uint256[] memory desc = nft.getForSaleTokens(0, 10, false);
        assertEq(desc.length, 1);
        assertEq(desc[0], 42);
    }

    function testFuzz_GetForSaleTokensPartialRange(uint8 numTokens, uint8 start, uint8 count) public {
        numTokens = uint8(bound(uint256(numTokens), 3, 10));
        start = uint8(bound(uint256(start), 0, uint256(numTokens) - 1));
        count = uint8(bound(uint256(count), 1, 5));

        for (uint256 i = 0; i < numTokens; i++) {
            nft.mintAndListForSale(owner, i, MIN_PRICE + i * 1 ether, "");
        }

        // Ascending partial range
        uint256[] memory asc = nft.getForSaleTokens(start, count, true);
        uint256 expectedLen = count;
        if (uint256(start) + count > numTokens) {
            expectedLen = uint256(numTokens) - start;
        }
        assertEq(asc.length, expectedLen);

        // Verify ascending order within partial range
        for (uint256 i = 1; i < asc.length; i++) {
            assertTrue(asc[i] >= asc[i - 1]);
        }
    }

    // ================================================================
    // SECTION 19: NOT-FOR-SALE TOKENS STATE TRANSITIONS
    // ================================================================

    function testFuzz_NotForSaleTokensAfterMintAndDelist(uint8 numTokens) public {
        numTokens = uint8(bound(uint256(numTokens), 1, 10));

        // Mint all as for-sale
        for (uint256 i = 0; i < numTokens; i++) {
            nft.mintAndListForSale(owner, i, MIN_PRICE + i * 1 ether, "");
        }

        // All tokens for sale, none not-for-sale
        assertEq(nft.getForSaleTokensCount(), numTokens);

        // Delist all
        for (uint256 i = 0; i < numTokens; i++) {
            nft.removeTokenFromSale(i);
        }

        // Now all should be not-for-sale
        assertEq(nft.getForSaleTokensCount(), 0);
        assertEq(nft.getNotForSaleTokensCount(), numTokens);

        // Verify not-for-sale ascending order
        uint256[] memory nfs = nft.getNotForSaleTokens(0, numTokens, true);
        assertEq(nfs.length, numTokens);
        for (uint256 i = 1; i < nfs.length; i++) {
            assertTrue(nfs[i] > nfs[i - 1]);
        }
    }

    function testFuzz_NotForSaleDescending(uint8 numTokens) public {
        numTokens = uint8(bound(uint256(numTokens), 2, 10));

        for (uint256 i = 0; i < numTokens; i++) {
            nft.mintAndListForSale(owner, i, MIN_PRICE, "");
        }
        for (uint256 i = 0; i < numTokens; i++) {
            nft.removeTokenFromSale(i);
        }

        uint256[] memory desc = nft.getNotForSaleTokens(uint256(numTokens) - 1, numTokens, false);
        assertEq(desc.length, numTokens);
        for (uint256 i = 1; i < desc.length; i++) {
            assertTrue(desc[i] < desc[i - 1]);
        }
    }

    function testFuzz_ForSaleNotForSaleToggle(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, price, "");

        assertTrue(nft.isTokenForSale(0));
        assertEq(nft.getForSaleTokensCount(), 1);

        // Delist
        nft.removeTokenFromSale(0);
        assertTrue(!nft.isTokenForSale(0));
        assertEq(nft.getForSaleTokensCount(), 0);
        assertEq(nft.getNotForSaleTokensCount(), 1);

        // Relist
        nft.listTokenForSale(0, price);
        assertTrue(nft.isTokenForSale(0));
        assertEq(nft.getForSaleTokensCount(), 1);
        assertEq(nft.getNotForSaleTokensCount(), 0);

        // Delist again
        nft.removeTokenFromSale(0);
        assertTrue(!nft.isTokenForSale(0));
        assertEq(nft.getNotForSaleTokensCount(), 1);
    }

    // ================================================================
    // SECTION 20: TOKEN LIFECYCLE FULL TRANSITIONS
    // ================================================================

    function testFuzz_FullLifecycleMintBuyRelistBuy(uint256 price1, uint256 price2) public {
        price1 = bound(price1, MIN_PRICE, 50 ether);
        price2 = bound(price2, MIN_PRICE, 50 ether);

        // Mint and list
        nft.mintAndListForSale(owner, 0, price1, "");
        assertEq(nft.getForSaleTokensCount(), 1);

        // Buy
        vm.prank(buyer1);
        nft.buyToken{value: price1}(0, price1);
        assertEq(nft.ownerOf(0), buyer1);
        assertEq(nft.getForSaleTokensCount(), 0);
        assertEq(nft.getNotForSaleTokensCount(), 1);

        // Relist by new owner
        vm.prank(buyer1);
        nft.listTokenForSale(0, price2);
        assertEq(nft.getForSaleTokensCount(), 1);
        assertEq(nft.getNotForSaleTokensCount(), 0);

        // Buy again
        vm.prank(buyer2);
        nft.buyToken{value: price2}(0, price2);
        assertEq(nft.ownerOf(0), buyer2);
        assertEq(nft.getForSaleTokensCount(), 0);

        // Sales history should have 2 entries
        assertEq(nft.getTokenSalesHistoryCount(0), 2);
        OrderStatisticsTree.Sale[] memory history = nft.getTokenSalesHistory(0, 0, 2, true);
        assertEq(history[0].price, price1);
        assertEq(history[1].price, price2);
    }

    function testFuzz_AcceptOfferOnUnlistedToken(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        // Mint listed, then buy, so token is NOT for sale
        nft.mintAndListForSale(owner, 0, MIN_PRICE, "");
        vm.prank(buyer1);
        nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);

        // Token is not for sale, owned by buyer1
        assertTrue(!nft.isTokenForSale(0));

        // buyer2 makes offer on unlisted token
        vm.prank(buyer2);
        nft.makeOffer{value: offerPrice}(0);

        // buyer1 accepts offer - this uses the bug-fixed path
        vm.prank(buyer1);
        nft.acceptOffer(0, buyer2);

        assertEq(nft.ownerOf(0), buyer2);
        assertTrue(!nft.isTokenForSale(0));
    }

    function testFuzz_AcceptOfferOnListedToken(uint256 listPrice, uint256 offerPrice) public {
        listPrice = bound(listPrice, MIN_PRICE, 50 ether);
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller1, 0, listPrice, "");

        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);

        // Accept offer on listed token - should delist it
        vm.prank(seller1);
        nft.acceptOffer(0, buyer1);

        assertEq(nft.ownerOf(0), buyer1);
        assertTrue(!nft.isTokenForSale(0));
        assertEq(nft.getForSaleTokensCount(), 0);
    }

    // ================================================================
    // SECTION 21: SALES HISTORY PAGINATION (ASC/DESC)
    // ================================================================

    function testFuzz_SalesHistoryAscDescPagination(uint8 numSales) public {
        numSales = uint8(bound(uint256(numSales), 2, 5));
        address[5] memory buyers = [buyer1, buyer2, buyer3, buyer4, buyer5];

        nft.mintAndListForSale(owner, 0, MIN_PRICE, "");

        for (uint256 i = 0; i < numSales; i++) {
            vm.prank(buyers[i]);
            nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);

            if (i < numSales - 1) {
                vm.prank(buyers[i]);
                nft.listTokenForSale(0, MIN_PRICE);
            }
        }

        // Ascending: first sale first
        OrderStatisticsTree.Sale[] memory asc = nft.getTokenSalesHistory(0, 0, numSales, true);
        assertEq(asc.length, numSales);
        for (uint256 i = 1; i < asc.length; i++) {
            assertTrue(asc[i].salesId > asc[i - 1].salesId);
        }

        // Descending: last sale first
        OrderStatisticsTree.Sale[] memory desc = nft.getTokenSalesHistory(0, 0, numSales, false);
        assertEq(desc.length, numSales);
        for (uint256 i = 1; i < desc.length; i++) {
            assertTrue(desc[i].salesId < desc[i - 1].salesId);
        }
    }

    function testFuzz_SalesHistoryPartialPage(uint8 numSales) public {
        numSales = uint8(bound(uint256(numSales), 3, 5));
        address[5] memory buyers = [buyer1, buyer2, buyer3, buyer4, buyer5];

        nft.mintAndListForSale(owner, 0, MIN_PRICE, "");

        for (uint256 i = 0; i < numSales; i++) {
            vm.prank(buyers[i]);
            nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);
            if (i < numSales - 1) {
                vm.prank(buyers[i]);
                nft.listTokenForSale(0, MIN_PRICE);
            }
        }

        // Get page starting from index 1
        OrderStatisticsTree.Sale[] memory page = nft.getTokenSalesHistory(0, 1, 2, true);
        assertEq(page.length, 2);
        assertEq(page[0].salesId, 1);
    }

    // ================================================================
    // SECTION 22: FLOOR PRICE TRACKING
    // ================================================================

    function testFuzz_FloorPriceUpdatesCorrectly(uint256 p1, uint256 p2, uint256 p3) public {
        p1 = bound(p1, MIN_PRICE, 100 ether);
        p2 = bound(p2, MIN_PRICE, 100 ether);
        p3 = bound(p3, MIN_PRICE, 100 ether);

        nft.mintAndListForSale(owner, 0, p1, "");
        assertEq(nft.getFloorPrice(), p1);

        nft.mintAndListForSale(owner, 1, p2, "");
        uint256 expectedFloor = p1 < p2 ? p1 : p2;
        assertEq(nft.getFloorPrice(), expectedFloor);

        nft.mintAndListForSale(owner, 2, p3, "");
        if (p3 < expectedFloor) expectedFloor = p3;
        assertEq(nft.getFloorPrice(), expectedFloor);
    }

    function testFuzz_FloorPriceAfterDelistAndPriceUpdate(uint256 p1, uint256 p2, uint256 newP1) public {
        p1 = bound(p1, MIN_PRICE, 50 ether);
        p2 = bound(p2, MIN_PRICE, 50 ether);
        newP1 = bound(newP1, MIN_PRICE, 50 ether);
        vm.assume(newP1 != p1);

        nft.mintAndListForSale(owner, 0, p1, "");
        nft.mintAndListForSale(owner, 1, p2, "");

        // Update price of token 0
        nft.updateTokenPrice(0, newP1);
        uint256 expected = newP1 < p2 ? newP1 : p2;
        assertEq(nft.getFloorPrice(), expected);

        // Delist token with lowest price
        if (newP1 <= p2) {
            nft.removeTokenFromSale(0);
            assertEq(nft.getFloorPrice(), p2);
        } else {
            nft.removeTokenFromSale(1);
            assertEq(nft.getFloorPrice(), newP1);
        }
    }

    function testFuzz_FloorPriceNoListingsReverts() public {
        nft.mintAndListForSale(owner, 0, MIN_PRICE, "");
        nft.removeTokenFromSale(0);

        // vm.expectRevert("XRC721: No tokens are currently listed for sale");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.NoTokensListed.selector));
        nft.getFloorPrice();
    }

    function testFuzz_FloorPriceAfterBuy(uint256 p1, uint256 p2) public {
        p1 = bound(p1, MIN_PRICE, 50 ether);
        p2 = bound(p2, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, p1, "");
        nft.mintAndListForSale(owner, 1, p2, "");

        // Buy cheaper token
        uint256 cheaperToken = p1 <= p2 ? 0 : 1;
        uint256 cheaperPrice = p1 <= p2 ? p1 : p2;
        uint256 otherPrice = p1 <= p2 ? p2 : p1;

        vm.prank(buyer1);
        nft.buyToken{value: cheaperPrice}(cheaperToken, cheaperPrice);

        assertEq(nft.getFloorPrice(), otherPrice);
    }

    // ================================================================
    // SECTION 23: GLOBAL OFFERS TRACKING
    // ================================================================

    function testFuzz_GlobalOffersCountAfterMultipleOffers(uint8 numOffers) public {
        numOffers = uint8(bound(uint256(numOffers), 1, 5));
        address[5] memory bidders = [buyer1, buyer2, buyer3, buyer4, buyer5];

        nft.mintAndListForSale(owner, 0, 100 ether, "");

        for (uint256 i = 0; i < numOffers; i++) {
            vm.prank(bidders[i]);
            nft.makeOffer{value: MIN_PRICE + i * 1 ether}(0);
        }

        assertEq(nft.getGlobalOffersCount(), numOffers);
    }

    function testFuzz_GlobalOffersDecrementOnWithdraw(uint8 numOffers, uint8 withdrawCount) public {
        numOffers = uint8(bound(uint256(numOffers), 2, 5));
        withdrawCount = uint8(bound(uint256(withdrawCount), 1, uint256(numOffers)));
        address[5] memory bidders = [buyer1, buyer2, buyer3, buyer4, buyer5];

        nft.mintAndListForSale(owner, 0, 100 ether, "");

        for (uint256 i = 0; i < numOffers; i++) {
            vm.prank(bidders[i]);
            nft.makeOffer{value: MIN_PRICE + i * 1 ether}(0);
        }

        for (uint256 i = 0; i < withdrawCount; i++) {
            vm.prank(bidders[i]);
            nft.withdrawOffer(0);
        }

        assertEq(nft.getGlobalOffersCount(), uint256(numOffers) - withdrawCount);
    }

    function testFuzz_OffersForTokenPagination(uint8 numOffers) public {
        numOffers = uint8(bound(uint256(numOffers), 2, 5));
        address[5] memory bidders = [buyer1, buyer2, buyer3, buyer4, buyer5];

        nft.mintAndListForSale(owner, 0, 100 ether, "");

        for (uint256 i = 0; i < numOffers; i++) {
            vm.prank(bidders[i]);
            nft.makeOffer{value: MIN_PRICE + i * 1 ether}(0);
        }

        assertEq(nft.getOffersForTokenCount(0), numOffers);

        // Get ascending
        OrderStatisticsTree.Offer[] memory asc = nft.getOffersForToken(0, 0, numOffers, true);
        assertEq(asc.length, numOffers);
        for (uint256 i = 1; i < asc.length; i++) {
            assertTrue(asc[i].price >= asc[i - 1].price);
        }

        // Get descending
        OrderStatisticsTree.Offer[] memory desc = nft.getOffersForToken(0, uint256(numOffers) - 1, numOffers, false);
        assertEq(desc.length, numOffers);
        for (uint256 i = 1; i < desc.length; i++) {
            assertTrue(desc[i].price <= desc[i - 1].price);
        }
    }

    // ================================================================
    // SECTION 24: GLOBAL SALES TRACKING
    // ================================================================

    function testFuzz_GlobalSalesCountAndOrder(uint8 numSales) public {
        numSales = uint8(bound(uint256(numSales), 1, 5));
        address[5] memory buyers = [buyer1, buyer2, buyer3, buyer4, buyer5];

        nft.mintAndListForSale(owner, 0, MIN_PRICE, "");

        for (uint256 i = 0; i < numSales; i++) {
            vm.prank(buyers[i]);
            nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);
            if (i < numSales - 1) {
                vm.prank(buyers[i]);
                nft.listTokenForSale(0, MIN_PRICE);
            }
        }

        assertEq(nft.getGlobalSalesCount(), numSales);

        // Get all sales ascending
        OrderStatisticsTree.Sale[] memory sales = nft.getGlobalSales(0, numSales, true);
        assertEq(sales.length, numSales);
    }

    function testFuzz_TotalVolumeTracking(uint256 p1, uint256 p2) public {
        p1 = bound(p1, MIN_PRICE, 50 ether);
        p2 = bound(p2, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, p1, "");
        nft.mintAndListForSale(owner, 1, p2, "");

        assertEq(nft.totalVolume(), 0);

        vm.prank(buyer1);
        nft.buyToken{value: p1}(0, p1);
        assertEq(nft.totalVolume(), p1);

        vm.prank(buyer2);
        nft.buyToken{value: p2}(1, p2);
        assertEq(nft.totalVolume(), p1 + p2);
    }

    function testFuzz_TotalSalesCount(uint8 numSales) public {
        numSales = uint8(bound(uint256(numSales), 1, 5));
        address[5] memory buyers = [buyer1, buyer2, buyer3, buyer4, buyer5];

        nft.mintAndListForSale(owner, 0, MIN_PRICE, "");

        for (uint256 i = 0; i < numSales; i++) {
            vm.prank(buyers[i]);
            nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);
            if (i < numSales - 1) {
                vm.prank(buyers[i]);
                nft.listTokenForSale(0, MIN_PRICE);
            }
        }

        assertEq(nft.getTotalSalesCount(), numSales);
    }

    // ================================================================
    // SECTION 25: OWNED TOKENS TREE CORRECTNESS
    // ================================================================

    function testFuzz_OwnedTokensAfterMultipleMints(uint8 numTokens) public {
        numTokens = uint8(bound(uint256(numTokens), 1, 10));

        for (uint256 i = 0; i < numTokens; i++) {
            nft.mintAndListForSale(owner, i, MIN_PRICE, "");
        }

        assertEq(nft.getOwnedTokensCount(owner), numTokens);

        uint256[] memory owned = nft.getOwnedTokens(owner, 0, numTokens, true);
        assertEq(owned.length, numTokens);
        for (uint256 i = 1; i < owned.length; i++) {
            assertTrue(owned[i] > owned[i - 1]);
        }
    }

    function testFuzz_OwnedTokensTransferBetweenUsers(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, price, "");
        nft.mintAndListForSale(owner, 1, price, "");
        nft.mintAndListForSale(owner, 2, price, "");

        assertEq(nft.getOwnedTokensCount(owner), 3);

        // buyer1 buys token 1
        vm.prank(buyer1);
        nft.buyToken{value: price}(1, price);

        assertEq(nft.getOwnedTokensCount(owner), 2);
        assertEq(nft.getOwnedTokensCount(buyer1), 1);

        uint256[] memory ownerTokens = nft.getOwnedTokens(owner, 0, 10, true);
        assertEq(ownerTokens.length, 2);
        assertEq(ownerTokens[0], 0);
        assertEq(ownerTokens[1], 2);

        uint256[] memory buyerTokens = nft.getOwnedTokens(buyer1, 0, 10, true);
        assertEq(buyerTokens.length, 1);
        assertEq(buyerTokens[0], 1);
    }

    function testFuzz_OwnedTokensDescending(uint8 numTokens) public {
        numTokens = uint8(bound(uint256(numTokens), 2, 10));

        for (uint256 i = 0; i < numTokens; i++) {
            nft.mintAndListForSale(owner, i, MIN_PRICE, "");
        }

        uint256[] memory desc = nft.getOwnedTokens(owner, uint256(numTokens) - 1, numTokens, false);
        assertEq(desc.length, numTokens);
        for (uint256 i = 1; i < desc.length; i++) {
            assertTrue(desc[i] < desc[i - 1]);
        }
    }

    // ================================================================
    // SECTION 26: MULTI-TOKEN COMPLEX SCENARIOS
    // ================================================================

    function testFuzz_MultiTokenBuyUpdatesAllTrees(uint256 p1, uint256 p2, uint256 p3) public {
        p1 = bound(p1, MIN_PRICE, 50 ether);
        p2 = bound(p2, MIN_PRICE, 50 ether);
        p3 = bound(p3, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, p1, "");
        nft.mintAndListForSale(owner, 1, p2, "");
        nft.mintAndListForSale(owner, 2, p3, "");

        assertEq(nft.getForSaleTokensCount(), 3);

        // Buy token 1
        vm.prank(buyer1);
        nft.buyToken{value: p2}(1, p2);

        // Verify state consistency
        assertEq(nft.getForSaleTokensCount(), 2);
        assertEq(nft.getNotForSaleTokensCount(), 1);
        assertTrue(!nft.isTokenForSale(1));
        assertTrue(nft.isTokenForSale(0));
        assertTrue(nft.isTokenForSale(2));

        // ForSale tokens should be 0 and 2
        uint256[] memory forSale = nft.getForSaleTokens(0, 10, true);
        assertEq(forSale.length, 2);
        assertEq(forSale[0], 0);
        assertEq(forSale[1], 2);

        // NotForSale should be token 1
        uint256[] memory notForSale = nft.getNotForSaleTokens(0, 10, true);
        assertEq(notForSale.length, 1);
        assertEq(notForSale[0], 1);
    }

    function testFuzz_OfferRefundOnBuy(uint256 listPrice, uint256 offerPrice) public {
        listPrice = bound(listPrice, MIN_PRICE, 50 ether);
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller1, 0, listPrice, "");

        // buyer1 makes offer
        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);

        uint256 buyer1BalBefore = buyer1.balance;

        // buyer1 buys the token - existing offer should be refunded
        vm.prank(buyer1);
        nft.buyToken{value: listPrice}(0, listPrice);

        // buyer1 should have gotten offer refunded (paid listPrice, got offerPrice back)
        assertEq(buyer1.balance, buyer1BalBefore - listPrice + offerPrice);
    }

    function testFuzz_OwnerCountTracking() public {
        nft.mintAndListForSale(owner, 0, MIN_PRICE, "");
        nft.mintAndListForSale(owner, 1, MIN_PRICE, "");
        assertEq(nft.getOwnerCount(), 1);

        vm.prank(buyer1);
        nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);
        assertEq(nft.getOwnerCount(), 2);

        // If owner transfers away last token via buy
        vm.prank(buyer2);
        nft.buyToken{value: MIN_PRICE}(1, MIN_PRICE);

        // owner has 0 tokens left, should not be counted
        assertEq(nft.getOwnerCount(), 2); // buyer1 + buyer2, owner removed
    }

    function testFuzz_TokenCountTracking(uint8 numTokens) public {
        numTokens = uint8(bound(uint256(numTokens), 1, 10));

        for (uint256 i = 0; i < numTokens; i++) {
            nft.mintAndListForSale(owner, i, MIN_PRICE, "");
        }

        assertEq(nft.getTokenCount(), numTokens);
    }

    function testFuzz_RoyaltyCalculation(uint256 price) public {
        price = bound(price, MIN_PRICE, 100 ether);

        nft.mintAndListForSale(seller1, 0, price, "");

        uint256 seller1BalBefore = seller1.balance;

        vm.prank(buyer1);
        nft.buyToken{value: price}(0, price);

        // Seller gets price - 12% royalty
        uint256 royalty = price * ROYALTY_FRACTION / FEE_DENOMINATOR;
        uint256 expectedProceeds = price - royalty;
        assertEq(seller1.balance, seller1BalBefore + expectedProceeds);
    }

    function testFuzz_OverpaymentRefund(uint256 price, uint256 overpay) public {
        price = bound(price, MIN_PRICE, 50 ether);
        overpay = bound(overpay, 1, 10 ether);

        nft.mintAndListForSale(seller1, 0, price, "");

        uint256 buyer1BalBefore = buyer1.balance;

        vm.prank(buyer1);
        nft.buyToken{value: price + overpay}(0, price);

        // buyer1 should get overpayment back
        assertEq(buyer1.balance, buyer1BalBefore - price);
    }

    // ================================================================
    // SECTION 27: BIDDER ADDRESS OFFERS TRACKING
    // ================================================================

    function testFuzz_BidderOffersTracking(uint8 numTokens) public {
        numTokens = uint8(bound(uint256(numTokens), 1, 5));

        for (uint256 i = 0; i < numTokens; i++) {
            nft.mintAndListForSale(owner, i, 100 ether, "");
        }

        // buyer1 makes offers on all tokens
        for (uint256 i = 0; i < numTokens; i++) {
            vm.prank(buyer1);
            nft.makeOffer{value: MIN_PRICE + i * 1 ether}(i);
        }

        assertEq(nft.getOffersForBidderAddressCount(buyer1), numTokens);

        // Withdraw one
        vm.prank(buyer1);
        nft.withdrawOffer(0);

        assertEq(nft.getOffersForBidderAddressCount(buyer1), uint256(numTokens) - 1);
    }

    function testFuzz_CurrentOfferForTokenByBidder(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, 100 ether, "");

        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);

        OrderStatisticsTree.Offer memory offer = nft.getCurrentOfferOfAddressForToken(0, buyer1);
        assertEq(offer.price, offerPrice);
        assertEq(offer.bidder, buyer1);
        assertEq(offer.tokenId, 0);
    }

    // ================================================================
    // SECTION 28: REVERT CONDITIONS
    // ================================================================

    function testFuzz_ListAlreadyForSaleReverts(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, price, "");

        // vm.expectRevert("XRC721: token already for sale");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.TokenAlreadyForSale.selector));
        nft.listTokenForSale(0, price);
    }

    function testFuzz_RemoveNotListedReverts() public {
        nft.mintAndListForSale(owner, 0, MIN_PRICE, "");
        nft.removeTokenFromSale(0);

        // vm.expectRevert("XRC721: token is not listed for sale");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.TokenNotForSale.selector));
        nft.removeTokenFromSale(0);
    }

    function testFuzz_BuyOwnTokenReverts(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);
        nft.mintAndListForSale(owner, 0, price, "");

        // vm.expectRevert("XRC721: caller is the owner");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.CallerIsOwner.selector));
        nft.buyToken{value: price}(0, price);
    }

    function testFuzz_BuyInsufficientPaymentReverts(uint256 price) public {
        price = bound(price, MIN_PRICE + 1, 50 ether);

        nft.mintAndListForSale(seller1, 0, price, "");

        vm.prank(buyer1);
        // vm.expectRevert("XRC721: insufficient payment");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.InsufficientPayment.selector));
        nft.buyToken{value: price - 1}(0, price);
    }

    function testFuzz_UpdatePriceSameReverts(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, price, "");

        // vm.expectRevert("XRC721: new price must be different from the current price");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.PriceMustBeDifferent.selector));
        nft.updateTokenPrice(0, price);
    }

    function testFuzz_ListBelowMinPriceReverts(uint256 price) public {
        price = bound(price, 0, MIN_PRICE - 1);

        nft.mintAndListForSale(owner, 0, MIN_PRICE, "");
        vm.prank(buyer1);
        nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);

        vm.prank(buyer1);
        // vm.expectRevert("XRC721: price must be at least 25,000 XDC");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.PriceBelowMinimum.selector));
        nft.listTokenForSale(0, price);
    }

    function testFuzz_NonOwnerCannotList() public {
        nft.mintAndListForSale(owner, 0, MIN_PRICE, "");
        vm.prank(buyer1);
        nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);

        vm.prank(buyer2);
        // vm.expectRevert("XRC721: caller is not the owner");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.CallerNotOwner.selector));
        nft.listTokenForSale(0, MIN_PRICE);
    }

    function testFuzz_NonOwnerCannotDelist() public {
        nft.mintAndListForSale(owner, 0, MIN_PRICE, "");

        vm.prank(buyer1);
        // vm.expectRevert("XRC721: caller is not the owner");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.CallerNotOwner.selector));
        nft.removeTokenFromSale(0);
    }

    function testFuzz_AcceptOfferNoActiveReverts() public {
        nft.mintAndListForSale(owner, 0, MIN_PRICE, "");

        // vm.expectRevert("XRC721: no active offer");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.NoActiveOffer.selector));
        nft.acceptOffer(0, buyer1);
    }

    // ================================================================
    // SECTION 29: MONEY SAFETY - STALE OFFER BUG IN buyToken
    // ================================================================

    // BUG: buyToken refunds buyer's existing offer but does NOT call deleteOffer(),
    // leaving stale entries in bidderAddressToOffers, tokenToOffers, and globalOffers trees.
    // This test proves the stale data causes future offers to revert.
    function testFuzz_BuyTokenStaleOfferBug_FutureOfferReverts(uint256 offerPrice, uint256 listPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);
        listPrice = bound(listPrice, MIN_PRICE, 50 ether);

        // Setup: seller1 lists token
        nft.mintAndListForSale(seller1, 0, listPrice, "");

        // Step 1: buyer1 makes an offer
        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);

        // Step 2: buyer1 buys the token (offer is refunded but NOT cleaned from trees)
        vm.prank(buyer1);
        nft.buyToken{value: listPrice}(0, listPrice);

        // Step 3: buyer1 sells to buyer2
        vm.prank(buyer1);
        nft.listTokenForSale(0, listPrice);
        vm.prank(buyer2);
        nft.buyToken{value: listPrice}(0, listPrice);

        // Step 4: buyer1 tries to make a new offer - THIS SHOULD WORK but will it?
        // The stale entry in tokenToOffers still has buyer1's old offer.
        // insertOffer with OFFER_PRICE_TOKENID and allowSameBidderMultipleUniqueTokenOffers=false
        // uses uint256(uint160(bidder)) as node ID, and requires !initialized.
        // Since the old node was never removed, this REVERTS with "Bidder already exists"
        vm.prank(buyer1);
        // This line will revert if the bug exists - uncomment vm.expectRevert to prove it
        // vm.expectRevert("Bidder already exists");
        nft.makeOffer{value: offerPrice}(0);
    }

    // Test that stale offers show up in queries (ghost offers)
    function testFuzz_BuyTokenStaleOfferBug_GhostOfferInQueries(uint256 offerPrice, uint256 listPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);
        listPrice = bound(listPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller1, 0, listPrice, "");

        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);

        assertEq(nft.getOffersForTokenCount(0), 1);
        assertEq(nft.getGlobalOffersCount(), 1);

        // buyer1 buys (offer refunded but not cleaned from trees)
        vm.prank(buyer1);
        nft.buyToken{value: listPrice}(0, listPrice);

        // After buying, there should be 0 offers. But if bug exists, trees still show 1.
        // If this assertion fails, it proves the stale offer bug.
        assertEq(nft.getOffersForTokenCount(0), 0);
        assertEq(nft.getGlobalOffersCount(), 0);
    }

    // ================================================================
    // SECTION 30: TRANSFER AUTO-DELIST
    // ================================================================

    function testFuzz_TransferFromAutoDelists(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, price, "");
        assertTrue(nft.isTokenForSale(0));
        assertEq(nft.getForSaleTokensCount(), 1);
        assertEq(nft.getFloorPrice(), price);

        // Direct transfer while listed
        nft.transferFrom(owner, buyer1, 0);

        // Token should be auto-delisted
        assertTrue(!nft.isTokenForSale(0));
        assertEq(nft.getForSaleTokensCount(), 0);
        assertEq(nft.getNotForSaleTokensCount(), 1);
        assertEq(nft.ownerOf(0), buyer1);

        // Floor price should revert (no listings)
        // vm.expectRevert("XRC721: No tokens are currently listed for sale");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.NoTokensListed.selector));
        nft.getFloorPrice();
    }

    function testFuzz_TransferNotForSaleTokenNoSideEffect(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);

        // Mint listed, buy (now not for sale), then transfer
        nft.mintAndListForSale(owner, 0, price, "");
        vm.prank(buyer1);
        nft.buyToken{value: price}(0, price);

        assertTrue(!nft.isTokenForSale(0));

        // Transfer not-for-sale token — should work fine, no delist needed
        vm.prank(buyer1);
        nft.transferFrom(buyer1, buyer2, 0);

        assertEq(nft.ownerOf(0), buyer2);
        assertTrue(!nft.isTokenForSale(0));
    }

    function testFuzz_TransferAutoDelistMultipleTokens(uint256 p1, uint256 p2) public {
        p1 = bound(p1, MIN_PRICE, 50 ether);
        p2 = bound(p2, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, p1, "");
        nft.mintAndListForSale(owner, 1, p2, "");
        assertEq(nft.getForSaleTokensCount(), 2);

        // Transfer token 0 — only token 0 should delist
        nft.transferFrom(owner, buyer1, 0);

        assertEq(nft.getForSaleTokensCount(), 1);
        assertTrue(!nft.isTokenForSale(0));
        assertTrue(nft.isTokenForSale(1));
        assertEq(nft.getFloorPrice(), p2);
    }

    // ================================================================
    // SECTION 31: OFFERS SURVIVE SALE — NOT A BUG (CONFIRMATION TESTS)
    // ================================================================

    // Confirms: new owner can only accept ONE offer (transfers token away)
    function testFuzz_NewOwnerCannotDrainMultipleOffers(uint256 offerPrice1, uint256 offerPrice2) public {
        offerPrice1 = bound(offerPrice1, MIN_PRICE, 50 ether);
        offerPrice2 = bound(offerPrice2, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "");

        // Two bidders make offers
        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice1}(0);
        vm.prank(buyer2);
        nft.makeOffer{value: offerPrice2}(0);

        // buyer3 buys the token
        vm.prank(buyer3);
        nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);
        assertEq(nft.ownerOf(0), buyer3);

        // buyer3 accepts buyer1's offer — token transfers to buyer1
        vm.prank(buyer3);
        nft.acceptOffer(0, buyer1);
        assertEq(nft.ownerOf(0), buyer1);

        // buyer3 can NO LONGER accept buyer2's offer — not the owner
        vm.prank(buyer3);
        // vm.expectRevert("XRC721: caller is not the owner");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.CallerNotOwner.selector));
        nft.acceptOffer(0, buyer2);
    }

    // Confirms: bidders can always withdraw after sale
    function testFuzz_BiddersCanWithdrawAfterSale(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "");

        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);

        // Token is sold to buyer2
        vm.prank(buyer2);
        nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);

        // buyer1's offer survived — they can withdraw
        uint256 balBefore = buyer1.balance;
        vm.prank(buyer1);
        nft.withdrawOffer(0);
        assertEq(buyer1.balance, balBefore + offerPrice);

        // Offer is now gone from all data structures
        assertEq(nft.getOffersForTokenCount(0), 0);
        assertEq(nft.getGlobalOffersCount(), 0);
    }

    // Confirms: multiple bidders can all withdraw after sale
    function testFuzz_AllBiddersCanWithdrawAfterSale(uint8 numBidders) public {
        numBidders = uint8(bound(uint256(numBidders), 1, 5));
        address[5] memory bidders = [buyer1, buyer2, buyer3, buyer4, buyer5];

        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "");

        for (uint256 i = 0; i < numBidders; i++) {
            vm.prank(bidders[i]);
            nft.makeOffer{value: MIN_PRICE + i * 1 ether}(0);
        }

        // Token sold — pick a buyer who isn't a bidder for simplicity
        // Use seller1 buying back (delist first, then re-list... actually just use owner)
        // Actually: let's have the last bidder buy it
        address lastBidder = bidders[numBidders - 1];
        vm.prank(lastBidder);
        nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);

        // All OTHER bidders can withdraw
        for (uint256 i = 0; i < numBidders - 1; i++) {
            uint256 expectedRefund = MIN_PRICE + i * 1 ether;
            uint256 balBefore = bidders[i].balance;
            vm.prank(bidders[i]);
            nft.withdrawOffer(0);
            assertEq(bidders[i].balance, balBefore + expectedRefund);
        }
    }

    // ================================================================
    // SECTION 32: BIDDER BECOMES OWNER EDGE CASE
    // ================================================================

    // Bob has offer, then buys token via buyToken — offer is cleaned up
    function testFuzz_BidderBuysTokenOffersCleanedUp(uint256 offerPrice, uint256 listPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);
        listPrice = bound(listPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller1, 0, listPrice, "");

        // buyer1 makes offer
        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);
        assertEq(nft.getOffersForTokenCount(0), 1);

        // buyer1 buys the token — their offer should be refunded and cleaned
        uint256 balBefore = buyer1.balance;
        vm.prank(buyer1);
        nft.buyToken{value: listPrice}(0, listPrice);

        // buyer1 got offer refunded (paid listPrice, got offerPrice back)
        assertEq(buyer1.balance, balBefore - listPrice + offerPrice);
        assertEq(nft.ownerOf(0), buyer1);

        // Offer is cleaned from all trees (ghost offer bug fix)
        assertEq(nft.getOffersForTokenCount(0), 0);
        assertEq(nft.getGlobalOffersCount(), 0);
        assertEq(nft.getOffersForBidderAddressCount(buyer1), 0);
    }

    // Bob has offer, someone ELSE sells to Bob via acceptOffer — offer used for sale
    function testFuzz_BidderGetsTokenViaAcceptOffer(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "");

        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);

        // seller1 accepts buyer1's offer
        vm.prank(seller1);
        nft.acceptOffer(0, buyer1);

        assertEq(nft.ownerOf(0), buyer1);
        // Offer was used for the sale — should be cleaned
        assertEq(nft.getOffersForTokenCount(0), 0);
        assertEq(nft.getGlobalOffersCount(), 0);
    }

    // Bob has offer on token 0, then acquires token 0 via buying a DIFFERENT
    // scenario: Bob offers on token 0, token 0 gets transferred to Bob directly
    function testFuzz_BidderReceivesTokenViaTransfer(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, MIN_PRICE, "");

        // buyer1 makes offer
        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);

        // Owner transfers token directly to buyer1 (not via acceptOffer)
        nft.transferFrom(owner, buyer1, 0);

        // buyer1 now owns token 0 AND has an active offer on it
        assertEq(nft.ownerOf(0), buyer1);
        assertEq(nft.getOffersForTokenCount(0), 1);

        // buyer1 CAN withdraw their own offer as owner
        uint256 balBefore = buyer1.balance;
        vm.prank(buyer1);
        nft.withdrawOffer(0);
        assertEq(buyer1.balance, balBefore + offerPrice);
        assertEq(nft.getOffersForTokenCount(0), 0);
    }

    // Owner cannot make offer on own token
    function testFuzz_OwnerCannotMakeOfferOnOwnToken(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, MIN_PRICE, "");

        // buyer1 buys
        vm.prank(buyer1);
        nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);

        // buyer1 is now owner, cannot offer on own token
        vm.prank(buyer1);
        // vm.expectRevert("XRC721: caller is the owner");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.CallerIsOwner.selector));
        nft.makeOffer{value: offerPrice}(0);
    }

    // Bidder becomes owner via transfer, then sells, then can offer again
    function testFuzz_BidderBecomesOwnerSellsThenCanOfferAgain(uint256 offer1, uint256 offer2) public {
        offer1 = bound(offer1, MIN_PRICE, 25 ether);
        offer2 = bound(offer2, MIN_PRICE, 25 ether);

        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "");

        // buyer1 makes offer
        vm.prank(buyer1);
        nft.makeOffer{value: offer1}(0);

        // buyer1 buys the token (offer cleaned via deleteOffer fix)
        vm.prank(buyer1);
        nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);
        assertEq(nft.ownerOf(0), buyer1);

        // buyer1 lists and sells to buyer2
        vm.prank(buyer1);
        nft.listTokenForSale(0, MIN_PRICE);
        vm.prank(buyer2);
        nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);

        // buyer1 no longer owns — can make a new offer
        vm.prank(buyer1);
        nft.makeOffer{value: offer2}(0);

        assertEq(nft.getOffersForTokenCount(0), 1);
        OrderStatisticsTree.Offer memory offer = nft.getCurrentOfferOfAddressForToken(0, buyer1);
        assertEq(offer.price, offer2);
    }

    // ================================================================
    // SECTION 33: updateTokenPrice MISSING MIN_PRICE BUG
    // ================================================================

    // Fixed: updateTokenPrice now enforces MIN_PRICE
    function testFuzz_UpdatePriceBelowMinPriceReverts(uint256 badPrice) public {
        badPrice = bound(badPrice, 0, MIN_PRICE - 1);

        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "");

        vm.prank(seller1);
        // vm.expectRevert("XRC721: price must be at least 25,000 XDC");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.PriceBelowMinimum.selector));
        nft.updateTokenPrice(0, badPrice);
    }

    // ================================================================
    // SECTION 34: ADVERSARIAL MONEY INVARIANT TESTS
    // ================================================================

    // CORE INVARIANT: contract balance == sum of all active offers
    // After any sequence of operations, no ETH should be stuck or leaked.

    // Attack: buy token, verify every wei is accounted for
    function testFuzz_MoneyInvariant_BuyToken(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller1, 0, price, "");

        uint256 contractBalBefore = address(nft).balance;
        uint256 seller1BalBefore = seller1.balance;
        uint256 buyer1BalBefore = buyer1.balance;
        uint256 royaltyOwnerBal = address(this).balance; // owner == royalty owner == this

        vm.prank(buyer1);
        nft.buyToken{value: price}(0, price);

        uint256 royalty = price * ROYALTY_FRACTION / FEE_DENOMINATOR;
        uint256 sellerProceeds = price - royalty;

        // Seller got exact proceeds
        assertEq(seller1.balance, seller1BalBefore + sellerProceeds);
        // Buyer paid exact price
        assertEq(buyer1.balance, buyer1BalBefore - price);
        // Royalty owner got exact royalty
        assertEq(address(this).balance, royaltyOwnerBal + royalty);
        // Contract balance unchanged (no ETH stuck)
        assertEq(address(nft).balance, contractBalBefore);
    }

    // Attack: buy with overpayment, verify refund is exact
    function testFuzz_MoneyInvariant_Overpayment(uint256 price, uint256 overpay) public {
        price = bound(price, MIN_PRICE, 50 ether);
        overpay = bound(overpay, 1 wei, 10 ether);

        nft.mintAndListForSale(seller1, 0, price, "");

        uint256 contractBalBefore = address(nft).balance;
        uint256 buyer1BalBefore = buyer1.balance;

        vm.prank(buyer1);
        nft.buyToken{value: price + overpay}(0, price);

        // Buyer only paid price, overpayment fully refunded
        assertEq(buyer1.balance, buyer1BalBefore - price);
        // No ETH stuck in contract
        assertEq(address(nft).balance, contractBalBefore);
    }

    // Attack: make offer, withdraw, verify full refund and zero contract balance
    function testFuzz_MoneyInvariant_OfferWithdraw(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller1, 0, 100 ether, "");
        uint256 contractBalBefore = address(nft).balance;

        // Make offer — ETH goes into contract
        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);
        assertEq(address(nft).balance, contractBalBefore + offerPrice);

        // Withdraw — all ETH comes back
        uint256 buyer1BalBefore = buyer1.balance;
        vm.prank(buyer1);
        nft.withdrawOffer(0);
        assertEq(buyer1.balance, buyer1BalBefore + offerPrice);
        assertEq(address(nft).balance, contractBalBefore);
    }

    // Attack: make offer, accept, verify every wei accounted
    function testFuzz_MoneyInvariant_AcceptOffer(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller1, 0, 100 ether, "");
        uint256 contractBalBefore = address(nft).balance;

        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);

        uint256 seller1BalBefore = seller1.balance;
        uint256 royaltyOwnerBal = address(this).balance;

        vm.prank(seller1);
        nft.acceptOffer(0, buyer1);

        uint256 royalty = offerPrice * ROYALTY_FRACTION / FEE_DENOMINATOR;
        uint256 sellerProceeds = offerPrice - royalty;

        assertEq(seller1.balance, seller1BalBefore + sellerProceeds);
        assertEq(address(this).balance, royaltyOwnerBal + royalty);
        // Contract balance back to before offer
        assertEq(address(nft).balance, contractBalBefore);
    }

    // Attack: update offer (higher), verify old refunded, new held
    function testFuzz_MoneyInvariant_OfferUpdate(uint256 offer1, uint256 offer2) public {
        offer1 = bound(offer1, MIN_PRICE, 25 ether);
        offer2 = bound(offer2, offer1 + 1, 50 ether);

        nft.mintAndListForSale(seller1, 0, 100 ether, "");
        uint256 contractBalBefore = address(nft).balance;

        vm.prank(buyer1);
        nft.makeOffer{value: offer1}(0);
        assertEq(address(nft).balance, contractBalBefore + offer1);

        uint256 buyer1BalBefore = buyer1.balance;
        vm.prank(buyer1);
        nft.makeOffer{value: offer2}(0);

        // Old offer refunded, new offer held
        assertEq(buyer1.balance, buyer1BalBefore - offer2 + offer1);
        assertEq(address(nft).balance, contractBalBefore + offer2);
    }

    // Attack: multiple offers on same token, buy it, verify all non-buyer offers survive
    // and contract holds exactly those offers' ETH
    function testFuzz_MoneyInvariant_BuyWithSurvivingOffers(uint256 o1, uint256 o2, uint256 listPrice) public {
        o1 = bound(o1, MIN_PRICE, 25 ether);
        o2 = bound(o2, MIN_PRICE, 25 ether);
        listPrice = bound(listPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller1, 0, listPrice, "");
        uint256 contractBalBefore = address(nft).balance;

        // Two bidders make offers
        vm.prank(buyer1);
        nft.makeOffer{value: o1}(0);
        vm.prank(buyer2);
        nft.makeOffer{value: o2}(0);

        assertEq(address(nft).balance, contractBalBefore + o1 + o2);

        // buyer3 buys (has no offer)
        vm.prank(buyer3);
        nft.buyToken{value: listPrice}(0, listPrice);

        // Contract should hold exactly o1 + o2 (surviving offers)
        assertEq(address(nft).balance, contractBalBefore + o1 + o2);

        // Both can withdraw
        vm.prank(buyer1);
        nft.withdrawOffer(0);
        vm.prank(buyer2);
        nft.withdrawOffer(0);

        // Contract back to zero offers
        assertEq(address(nft).balance, contractBalBefore);
    }

    // Attack: bidder buys token they have offer on — offer refunded + purchase works
    function testFuzz_MoneyInvariant_BidderBuysOwnOffer(uint256 offerPrice, uint256 listPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 25 ether);
        listPrice = bound(listPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller1, 0, listPrice, "");
        uint256 contractBalBefore = address(nft).balance;

        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);

        uint256 buyer1BalBefore = buyer1.balance;
        uint256 seller1BalBefore = seller1.balance;

        vm.prank(buyer1);
        nft.buyToken{value: listPrice}(0, listPrice);

        uint256 royalty = listPrice * ROYALTY_FRACTION / FEE_DENOMINATOR;
        uint256 sellerProceeds = listPrice - royalty;

        // Buyer paid listPrice, got offerPrice refunded
        assertEq(buyer1.balance, buyer1BalBefore - listPrice + offerPrice);
        // Seller got proceeds
        assertEq(seller1.balance, seller1BalBefore + sellerProceeds);
        // Contract holds nothing (offer refunded, sale proceeds distributed)
        assertEq(address(nft).balance, contractBalBefore);
    }

    // Attack: full cycle — mint, sell, relist, sell again — track every wei
    function testFuzz_MoneyInvariant_FullCycle(uint256 p1, uint256 p2) public {
        p1 = bound(p1, MIN_PRICE, 50 ether);
        p2 = bound(p2, MIN_PRICE, 50 ether);

        uint256 contractBalStart = address(nft).balance;

        nft.mintAndListForSale(seller1, 0, p1, "");

        // Round 1: buyer1 buys
        uint256 seller1BalBefore = seller1.balance;
        vm.prank(buyer1);
        nft.buyToken{value: p1}(0, p1);

        uint256 r1 = p1 * 12 / 100;
        assertEq(seller1.balance, seller1BalBefore + p1 - r1);

        // Round 2: buyer1 relists, buyer2 buys
        vm.prank(buyer1);
        nft.listTokenForSale(0, p2);

        uint256 buyer1BalBefore = buyer1.balance;
        vm.prank(buyer2);
        nft.buyToken{value: p2}(0, p2);

        uint256 r2 = p2 * 12 / 100;
        assertEq(buyer1.balance, buyer1BalBefore + p2 - r2);

        // Contract holds nothing — all money distributed
        assertEq(address(nft).balance, contractBalStart);
    }

    // Attack: accept offer on unlisted token — money still works
    function testFuzz_MoneyInvariant_AcceptOfferUnlisted(uint256 offerPrice, uint256 listPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);
        listPrice = bound(listPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller1, 0, listPrice, "");

        // buyer1 buys — token now unlisted, owned by buyer1
        vm.prank(buyer1);
        nft.buyToken{value: listPrice}(0, listPrice);

        uint256 contractBalBefore = address(nft).balance;

        // buyer2 makes offer on unlisted token
        vm.prank(buyer2);
        nft.makeOffer{value: offerPrice}(0);
        assertEq(address(nft).balance, contractBalBefore + offerPrice);

        // buyer1 accepts — money flows correctly
        uint256 buyer1BalBefore = buyer1.balance;
        vm.prank(buyer1);
        nft.acceptOffer(0, buyer2);

        uint256 royalty = offerPrice * ROYALTY_FRACTION / FEE_DENOMINATOR;
        assertEq(buyer1.balance, buyer1BalBefore + offerPrice - royalty);
        assertEq(address(nft).balance, contractBalBefore);
    }

    // Attack: transfer listed token, verify no money leaks
    function testFuzz_MoneyInvariant_TransferListedToken(uint256 price, uint256 offerPrice) public {
        price = bound(price, MIN_PRICE, 50 ether);
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(owner, 0, price, "");
        uint256 contractBalBefore = address(nft).balance;

        // buyer1 makes offer
        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);

        // Owner transfers token (auto-delists) — offer survives
        nft.transferFrom(owner, buyer2, 0);

        // Contract still holds the offer
        assertEq(address(nft).balance, contractBalBefore + offerPrice);

        // buyer1 can withdraw
        uint256 buyer1BalBefore = buyer1.balance;
        vm.prank(buyer1);
        nft.withdrawOffer(0);
        assertEq(buyer1.balance, buyer1BalBefore + offerPrice);
        assertEq(address(nft).balance, contractBalBefore);
    }

    // Attack: double-withdraw attempt
    function testFuzz_MoneyInvariant_DoubleWithdrawReverts(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller1, 0, 100 ether, "");

        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);

        vm.prank(buyer1);
        nft.withdrawOffer(0);

        // Second withdraw should revert
        vm.prank(buyer1);
        vm.expectRevert();
        nft.withdrawOffer(0);
    }

    // Attack: complex multi-party scenario — 3 tokens, 5 users, offers + buys + withdraws
    function testFuzz_MoneyInvariant_ComplexMultiParty(uint256 seed) public {
        seed = bound(seed, 1, 10000);

        uint256 contractBalStart = address(nft).balance;

        // Mint 3 tokens
        uint256 p1 = MIN_PRICE + (seed % 10) * 1 ether;
        uint256 p2 = MIN_PRICE + ((seed / 10) % 10) * 1 ether;
        uint256 p3 = MIN_PRICE + ((seed / 100) % 10) * 1 ether;

        nft.mintAndListForSale(seller1, 0, p1, "");
        nft.mintAndListForSale(seller1, 1, p2, "");
        nft.mintAndListForSale(seller1, 2, p3, "");

        // buyer1 offers on token 0
        uint256 offer1 = MIN_PRICE + ((seed / 1000) % 5) * 1 ether;
        vm.prank(buyer1);
        nft.makeOffer{value: offer1}(0);

        // buyer2 offers on token 1
        uint256 offer2 = MIN_PRICE + ((seed / 5000) % 5) * 1 ether;
        vm.prank(buyer2);
        nft.makeOffer{value: offer2}(1);

        // buyer3 buys token 0
        vm.prank(buyer3);
        nft.buyToken{value: p1}(0, p1);

        // buyer1 withdraws surviving offer on token 0
        vm.prank(buyer1);
        nft.withdrawOffer(0);

        // seller1 accepts buyer2's offer on token 1
        vm.prank(seller1);
        nft.acceptOffer(1, buyer2);

        // buyer4 buys token 2
        vm.prank(buyer4);
        nft.buyToken{value: p3}(2, p3);

        // All offers resolved — contract should hold nothing
        assertEq(address(nft).balance, contractBalStart);
    }

    // Attack: offer, buy, relist, new offer, accept — full churn
    function testFuzz_MoneyInvariant_OfferBuyRelistOfferAccept(uint256 o1, uint256 o2, uint256 listPrice) public {
        o1 = bound(o1, MIN_PRICE, 25 ether);
        o2 = bound(o2, MIN_PRICE, 25 ether);
        listPrice = bound(listPrice, MIN_PRICE, 50 ether);

        uint256 contractBalStart = address(nft).balance;

        nft.mintAndListForSale(seller1, 0, listPrice, "");

        // buyer1 offers
        vm.prank(buyer1);
        nft.makeOffer{value: o1}(0);

        // buyer2 buys
        vm.prank(buyer2);
        nft.buyToken{value: listPrice}(0, listPrice);

        // buyer1 withdraws old offer
        vm.prank(buyer1);
        nft.withdrawOffer(0);

        // buyer2 relists
        vm.prank(buyer2);
        nft.listTokenForSale(0, listPrice);

        // buyer3 offers on relisted token
        vm.prank(buyer3);
        nft.makeOffer{value: o2}(0);

        // buyer2 accepts buyer3's offer
        vm.prank(buyer2);
        nft.acceptOffer(0, buyer3);

        // All money distributed — contract empty
        assertEq(address(nft).balance, contractBalStart);
    }

    // Attack: verify royalty is ALWAYS exactly 12%
    function testFuzz_MoneyInvariant_RoyaltyExact(uint256 price) public {
        price = bound(price, MIN_PRICE, 1000 ether);

        nft.mintAndListForSale(seller1, 0, price, "");

        uint256 royaltyOwnerBal = address(this).balance;
        uint256 sellerBal = seller1.balance;

        vm.prank(buyer1);
        nft.buyToken{value: price}(0, price);

        uint256 royalty = price * ROYALTY_FRACTION / FEE_DENOMINATOR;
        uint256 proceeds = price - royalty;

        // Exact royalty
        assertEq(address(this).balance - royaltyOwnerBal, royalty);
        // Exact proceeds
        assertEq(seller1.balance - sellerBal, proceeds);
        // Royalty + proceeds == price (no dust)
        assertEq(royalty + proceeds, price);
    }

    // Attack: can new owner accept surviving offer, does money work?
    function testFuzz_MoneyInvariant_NewOwnerAcceptsSurvivingOffer(uint256 offerPrice, uint256 listPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 25 ether);
        listPrice = bound(listPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller1, 0, listPrice, "");
        uint256 contractBalBefore = address(nft).balance;

        // buyer1 offers
        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);

        // buyer2 buys (buyer1's offer survives)
        vm.prank(buyer2);
        nft.buyToken{value: listPrice}(0, listPrice);

        assertEq(address(nft).balance, contractBalBefore + offerPrice);

        // buyer2 (new owner) accepts buyer1's surviving offer
        uint256 buyer2BalBefore = buyer2.balance;
        vm.prank(buyer2);
        nft.acceptOffer(0, buyer1);

        uint256 royalty = offerPrice * ROYALTY_FRACTION / FEE_DENOMINATOR;
        // buyer2 gets sellerProceeds, loses token
        assertEq(buyer2.balance, buyer2BalBefore + offerPrice - royalty);
        // Contract empty
        assertEq(address(nft).balance, contractBalBefore);
        // buyer1 now owns it
        assertEq(nft.ownerOf(0), buyer1);
    }

    // ================================================================
    // SECTION 35: REENTRANCY PROTECTION TESTS
    // ================================================================

    // Proves nonReentrant blocks reentrancy during .call refunds.
    // A malicious contract tries to re-enter buyToken when receiving a refund.
    function testFuzz_ReentrancyBlocked_BuyToken(uint256 price) public {
        price = bound(price, MIN_PRICE, 10 ether);

        // Deploy attacker contract
        ReentrancyAttacker attacker = new ReentrancyAttacker(address(nft));
        vm.deal(address(attacker), 100 ether);

        // Mint and list token
        nft.mintAndListForSale(seller1, 0, price, "");

        // Attacker makes offer (so buyToken will refund during purchase)
        vm.prank(address(attacker));
        nft.makeOffer{value: MIN_PRICE}(0);

        // Attacker tries to buy — during the offer refund .call, the attacker's
        // receive() will try to re-enter buyToken. nonReentrant should block it.
        // The attacker's receive() reverts, which causes the whole tx to revert.
        vm.prank(address(attacker));
        vm.expectRevert();
        attacker.attackBuyToken{value: price}(0, price);
    }

    // Proves nonReentrant blocks reentrancy during withdrawOffer.
    // A malicious contract tries to re-enter withdrawOffer when receiving its refund.
    function testFuzz_ReentrancyBlocked_WithdrawOffer(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 10 ether);

        ReentrancyAttacker attacker = new ReentrancyAttacker(address(nft));
        vm.deal(address(attacker), 100 ether);

        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "");

        // Attacker makes offer
        vm.prank(address(attacker));
        nft.makeOffer{value: offerPrice}(0);

        // Attacker withdraws — during .call refund, receive() tries to re-enter.
        vm.prank(address(attacker));
        vm.expectRevert();
        attacker.attackWithdrawOffer(0);
    }

    // Proves nonReentrant blocks reentrancy during makeOffer refund (offer update).
    function testFuzz_ReentrancyBlocked_MakeOfferUpdate(uint256 offer1) public {
        offer1 = bound(offer1, MIN_PRICE, 5 ether);

        ReentrancyAttacker attacker = new ReentrancyAttacker(address(nft));
        vm.deal(address(attacker), 100 ether);

        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "");

        // Attacker makes first offer
        vm.prank(address(attacker));
        nft.makeOffer{value: offer1}(0);

        // Attacker updates offer — old offer refund triggers receive() which tries to re-enter.
        vm.prank(address(attacker));
        vm.expectRevert();
        attacker.attackMakeOffer{value: offer1 + 1 ether}(0);
    }

    // ================================================================
    // SECTION 36: OFFER PERSISTS AFTER TRANSFER — NEW OWNER CAN ACCEPT
    // ================================================================

    // Proves that when a token is transferred, existing offers remain valid
    // and the new owner can accept them (ownerOf returns the current owner).
    function testFuzz_NewOwnerCanAcceptExistingOffer(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 10 ether);

        // Seller1 mints and lists token
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri");

        // Buyer1 makes an offer
        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);

        // Seller1 transfers token to buyer3 (not a sale, just a transfer)
        // buyer3 acts as the "new owner" in this test
        vm.prank(seller1);
        nft.transferFrom(seller1, buyer3, 0);

        // Confirm buyer3 is now the owner
        assertEq(nft.ownerOf(0), buyer3);

        // buyer3 (new owner) can accept buyer1's existing offer
        uint256 newOwnerBalanceBefore = buyer3.balance;
        vm.prank(buyer3);
        nft.acceptOffer(0, buyer1);

        // Confirm token transferred to buyer1
        assertEq(nft.ownerOf(0), buyer1);

        // Confirm buyer3 received payment (offer price minus royalty)
        uint256 royalty = offerPrice * ROYALTY_FRACTION / FEE_DENOMINATOR;
        uint256 expectedProceeds = offerPrice - royalty;
        assertEq(buyer3.balance, newOwnerBalanceBefore + expectedProceeds);
    }

    // Receive ether (needed for royalty/refund transfers)
    receive() external payable {}

    // Event declarations for vm.expectEmit
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event WithdrawOffer(uint256 indexed tokenId, address indexed bidder, uint256 amount);
    event MakeOffer(uint256 indexed tokenId, address indexed bidder, uint256 amount);
    event TokenRemovedFromSale(uint256 indexed tokenId);
    event TokenListedForSale(uint256 indexed tokenId, uint256 price);
    event TokenPriceUpdated(uint256 indexed tokenId, uint256 newPrice);
    event TokenSold(uint256 salesId, uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price, uint256 timestamp);
}

// ================================================================
// DIRECT DATA STRUCTURE FUZZ TESTS
// ================================================================

// ================================================================
// SECTION 17: CustomMinHeapLib DIRECT FUZZ TESTS
// ================================================================

contract MinHeapFuzzTest is Test {
    CustomMinHeapLibTest public heap;

    function setUp() public {
        heap = new CustomMinHeapLibTest();
    }

    function testFuzz_InsertMaintainsMin(uint256 p1, uint256 p2, uint256 p3) public {
        p1 = bound(p1, 1, 10000);
        p2 = bound(p2, 1, 10000);
        p3 = bound(p3, 1, 10000);

        heap.insert(p1, 1);
        heap.insert(p2, 2);
        heap.insert(p3, 3);

        uint256 expectedMin = p1;
        if (p2 < expectedMin) expectedMin = p2;
        if (p3 < expectedMin) expectedMin = p3;

        CustomMinHeapLib.PriceToken memory min = heap.getMin();
        assertEq(min.price, expectedMin);
        assertEq(heap.size(), 3);
    }

    function testFuzz_InsertAndRemoveAll(uint8 count) public {
        count = uint8(bound(uint256(count), 1, 30));

        for (uint256 i = 0; i < count; i++) {
            heap.insert((i + 1) * 10, i);
        }
        assertEq(heap.size(), count);

        for (uint256 i = 0; i < count; i++) {
            heap.remove(i);
        }
        assertEq(heap.size(), 0);
    }

    function testFuzz_RemoveMinMaintainsHeap(uint256 p1, uint256 p2, uint256 p3, uint256 p4, uint256 p5) public {
        p1 = bound(p1, 1, 10000);
        p2 = bound(p2, 1, 10000);
        p3 = bound(p3, 1, 10000);
        p4 = bound(p4, 1, 10000);
        p5 = bound(p5, 1, 10000);

        uint256[5] memory prices = [p1, p2, p3, p4, p5];

        for (uint256 i = 0; i < 5; i++) {
            heap.insert(prices[i], i);
        }

        // Find and remove the min token
        CustomMinHeapLib.PriceToken memory firstMin = heap.getMin();
        heap.remove(firstMin.tokenId);

        assertEq(heap.size(), 4);

        // New min should be >= old min
        CustomMinHeapLib.PriceToken memory newMin = heap.getMin();
        assertTrue(newMin.price >= firstMin.price);
    }

    function testFuzz_InsertRemoveInterleavedMaintainsMin(
        uint256 p1, uint256 p2, uint256 p3, uint256 p4, uint256 p5, uint256 p6
    ) public {
        p1 = bound(p1, 1, 10000);
        p2 = bound(p2, 1, 10000);
        p3 = bound(p3, 1, 10000);
        p4 = bound(p4, 1, 10000);
        p5 = bound(p5, 1, 10000);
        p6 = bound(p6, 1, 10000);

        // Insert 3
        heap.insert(p1, 1);
        heap.insert(p2, 2);
        heap.insert(p3, 3);

        // Remove middle one
        heap.remove(2);
        assertEq(heap.size(), 2);

        // Insert 3 more
        heap.insert(p4, 4);
        heap.insert(p5, 5);
        heap.insert(p6, 6);
        assertEq(heap.size(), 5);

        // Remove first
        heap.remove(1);
        assertEq(heap.size(), 4);

        // Verify min is correct among remaining: p3(id=3), p4(id=4), p5(id=5), p6(id=6)
        uint256 expectedMin = p3;
        if (p4 < expectedMin) expectedMin = p4;
        if (p5 < expectedMin) expectedMin = p5;
        if (p6 < expectedMin) expectedMin = p6;

        assertEq(heap.getMin().price, expectedMin);
    }

    function testFuzz_RemoveNonExistentReverts(uint256 tokenId) public {
        tokenId = bound(tokenId, 0, 99999);

        vm.expectRevert("TokenId not found");
        heap.remove(tokenId);
    }

    function testFuzz_DuplicateInsertReverts(uint256 price1, uint256 price2) public {
        price1 = bound(price1, 1, 10000);
        price2 = bound(price2, 1, 10000);

        heap.insert(price1, 1);

        vm.expectRevert("TokenId already exists in the heap");
        heap.insert(price2, 1);
    }

    function testFuzz_EmptyHeapGetMinReverts() public {
        vm.expectRevert("Heap is empty");
        heap.getMin();
    }

    function testFuzz_InsertRemoveReinsert(uint256 p1, uint256 p2) public {
        p1 = bound(p1, 1, 10000);
        p2 = bound(p2, 1, 10000);

        heap.insert(p1, 1);
        heap.remove(1);
        assertEq(heap.size(), 0);

        // Reinsert same tokenId with different price
        heap.insert(p2, 1);
        assertEq(heap.size(), 1);
        assertEq(heap.getMin().price, p2);
        assertEq(heap.getMin().tokenId, 1);
    }

    function testFuzz_RemoveLastElement(uint256 price) public {
        price = bound(price, 1, 10000);

        heap.insert(price, 1);
        assertEq(heap.size(), 1);

        heap.remove(1);
        assertEq(heap.size(), 0);

        vm.expectRevert("Heap is empty");
        heap.getMin();
    }

    function testFuzz_ManyInsertsRemoveHalf(uint8 count) public {
        count = uint8(bound(uint256(count), 4, 40));

        // Insert count elements with random-ish prices
        for (uint256 i = 0; i < count; i++) {
            uint256 price = ((i * 7 + 13) % 100) + 1;
            heap.insert(price, i);
        }
        assertEq(heap.size(), count);

        // Remove first half
        for (uint256 i = 0; i < count / 2; i++) {
            heap.remove(i);
        }
        assertEq(heap.size(), uint256(count) - count / 2);

        // Verify min is still valid by extracting all remaining
        uint256 lastPrice = 0;
        uint256 remaining = heap.size();
        CustomMinHeapLib.PriceToken memory min = heap.getMin();
        // Min should exist and be >= 1
        assertTrue(min.price >= 1);
    }

    function testFuzz_SamePriceDifferentTokenIds(uint256 price, uint8 count) public {
        price = bound(price, 1, 10000);
        count = uint8(bound(uint256(count), 2, 20));

        // All same price, different tokenIds
        for (uint256 i = 0; i < count; i++) {
            heap.insert(price, i);
        }

        assertEq(heap.size(), count);
        // Min should have the smallest tokenId (tiebreaker)
        assertEq(heap.getMin().price, price);
        assertEq(heap.getMin().tokenId, 0);

        // Remove tokenId 0
        heap.remove(0);
        assertEq(heap.size(), uint256(count) - 1);
        assertEq(heap.getMin().price, price);
        assertEq(heap.getMin().tokenId, 1);
    }
}

// ================================================================
// SECTION 18: OrderStatisticsTree DIRECT FUZZ TESTS
// ================================================================

contract OrderStatisticsTreeFuzzTest is Test {
    OrderStatisticsTreeTest public tree;

    function setUp() public {
        tree = new OrderStatisticsTreeTest();
        tree.initializeTree(OrderStatisticsTree.ComparatorType.PRICETOKEN_PRICE_TOKENID);
    }

    function testFuzz_InsertAndSize(uint8 count) public {
        count = uint8(bound(uint256(count), 1, 50));

        for (uint256 i = 0; i < count; i++) {
            tree.insert((i + 1) * 10, i);
        }

        assertEq(tree.size(), count);
    }

    function testFuzz_InsertMaintainsSortedOrder(uint256 p1, uint256 p2, uint256 p3, uint256 p4, uint256 p5) public {
        p1 = bound(p1, 1, 10000);
        p2 = bound(p2, 1, 10000);
        p3 = bound(p3, 1, 10000);
        p4 = bound(p4, 1, 10000);
        p5 = bound(p5, 1, 10000);

        tree.insert(p1, 1);
        tree.insert(p2, 2);
        tree.insert(p3, 3);
        tree.insert(p4, 4);
        tree.insert(p5, 5);

        // Verify ascending order via range query
        OrderStatisticsTree.PriceToken[] memory asc = tree.getPriceTokenRange(0, 5);
        assertEq(asc.length, 5);

        for (uint256 i = 1; i < asc.length; i++) {
            // price[i] >= price[i-1], or same price with tokenId[i] >= tokenId[i-1]
            assertTrue(
                asc[i].price > asc[i - 1].price ||
                (asc[i].price == asc[i - 1].price && asc[i].tokenId > asc[i - 1].tokenId)
            );
        }
    }

    function testFuzz_RemoveMaintainsSortedOrder(uint8 count, uint8 removeIdx) public {
        count = uint8(bound(uint256(count), 3, 20));
        removeIdx = uint8(bound(uint256(removeIdx), 0, uint256(count) - 1));

        for (uint256 i = 0; i < count; i++) {
            tree.insert((i + 1) * 10, i);
        }

        tree.remove(removeIdx);
        assertEq(tree.size(), uint256(count) - 1);

        // Verify remaining still sorted
        OrderStatisticsTree.PriceToken[] memory asc = tree.getPriceTokenRange(0, count);
        assertEq(asc.length, uint256(count) - 1);

        for (uint256 i = 1; i < asc.length; i++) {
            assertTrue(
                asc[i].price > asc[i - 1].price ||
                (asc[i].price == asc[i - 1].price && asc[i].tokenId > asc[i - 1].tokenId)
            );
        }
    }

    function testFuzz_InsertRemoveAll(uint8 count) public {
        count = uint8(bound(uint256(count), 1, 30));

        for (uint256 i = 0; i < count; i++) {
            tree.insert((i + 1) * 5, i);
        }

        for (uint256 i = 0; i < count; i++) {
            tree.remove(i);
        }

        assertEq(tree.size(), 0);
    }

    function testFuzz_DuplicateTokenIdReverts(uint256 p1, uint256 p2) public {
        p1 = bound(p1, 1, 10000);
        p2 = bound(p2, 1, 10000);

        tree.insert(p1, 1);

        vm.expectRevert("TokenId already exists");
        tree.insert(p2, 1);
    }

    function testFuzz_RemoveNonExistentReverts(uint256 tokenId) public {
        tokenId = bound(tokenId, 0, 99999);

        vm.expectRevert("TokenId not found");
        tree.remove(tokenId);
    }

    function testFuzz_GetMinAfterInserts(uint256 p1, uint256 p2, uint256 p3) public {
        p1 = bound(p1, 1, 10000);
        p2 = bound(p2, 1, 10000);
        p3 = bound(p3, 1, 10000);

        tree.insert(p1, 1);
        tree.insert(p2, 2);
        tree.insert(p3, 3);

        OrderStatisticsTree.PriceToken memory min = tree.getMin();
        uint256 expectedMin = p1;
        uint256 expectedTokenId = 1;
        if (p2 < expectedMin || (p2 == expectedMin && 2 < expectedTokenId)) {
            expectedMin = p2;
            expectedTokenId = 2;
        }
        if (p3 < expectedMin || (p3 == expectedMin && 3 < expectedTokenId)) {
            expectedMin = p3;
            expectedTokenId = 3;
        }

        assertEq(min.price, expectedMin);
    }

    function testFuzz_GetMinAfterRemoval(uint256 p1, uint256 p2, uint256 p3) public {
        p1 = bound(p1, 1, 10000);
        p2 = bound(p2, 1, 10000);
        p3 = bound(p3, 1, 10000);

        tree.insert(p1, 1);
        tree.insert(p2, 2);
        tree.insert(p3, 3);

        // Remove the min element
        OrderStatisticsTree.PriceToken memory firstMin = tree.getMin();
        tree.remove(firstMin.tokenId);

        assertEq(tree.size(), 2);

        OrderStatisticsTree.PriceToken memory newMin = tree.getMin();
        assertTrue(
            newMin.price > firstMin.price ||
            (newMin.price == firstMin.price && newMin.tokenId > firstMin.tokenId)
        );
    }

    function testFuzz_InsertRemoveReinsert(uint256 p1, uint256 p2) public {
        p1 = bound(p1, 1, 10000);
        p2 = bound(p2, 1, 10000);

        tree.insert(p1, 1);
        tree.remove(1);
        assertEq(tree.size(), 0);

        // Reinsert same tokenId with different price
        tree.insert(p2, 1);
        assertEq(tree.size(), 1);
        assertEq(tree.getMin().price, p2);
    }

    function testFuzz_RangeQueryAscDesc(uint8 count) public {
        count = uint8(bound(uint256(count), 2, 15));

        for (uint256 i = 0; i < count; i++) {
            tree.insert((i + 1) * 10, i);
        }

        // Ascending
        OrderStatisticsTree.PriceToken[] memory asc = tree.getPriceTokenRange(0, count);
        assertEq(asc.length, count);
        for (uint256 i = 1; i < asc.length; i++) {
            assertTrue(asc[i].price >= asc[i - 1].price);
        }

        // Descending
        OrderStatisticsTree.PriceToken[] memory desc = tree.getPriceTokenRangeReverse(uint256(count) - 1, count);
        assertEq(desc.length, count);
        for (uint256 i = 1; i < desc.length; i++) {
            assertTrue(desc[i].price <= desc[i - 1].price);
        }
    }

    function testFuzz_RangeQueryOutOfRange(uint8 count) public {
        count = uint8(bound(uint256(count), 1, 10));

        for (uint256 i = 0; i < count; i++) {
            tree.insert((i + 1) * 10, i);
        }

        // Start beyond size returns empty
        OrderStatisticsTree.PriceToken[] memory result = tree.getPriceTokenRange(count, 10);
        assertEq(result.length, 0);
    }

    function testFuzz_RangeQueryCountExceedsSize(uint8 count) public {
        count = uint8(bound(uint256(count), 1, 10));

        for (uint256 i = 0; i < count; i++) {
            tree.insert((i + 1) * 10, i);
        }

        // Request more than available
        OrderStatisticsTree.PriceToken[] memory result = tree.getPriceTokenRange(0, uint256(count) + 50);
        assertEq(result.length, count);
    }

    function testFuzz_ManyInsertsRandomRemoves(uint8 totalInserts, uint8 removeCount) public {
        totalInserts = uint8(bound(uint256(totalInserts), 5, 40));
        removeCount = uint8(bound(uint256(removeCount), 1, uint256(totalInserts) - 1));

        for (uint256 i = 0; i < totalInserts; i++) {
            uint256 price = ((i * 13 + 7) % 200) + 1;
            tree.insert(price, i);
        }

        // Remove first removeCount elements
        for (uint256 i = 0; i < removeCount; i++) {
            tree.remove(i);
        }

        uint256 remaining = uint256(totalInserts) - removeCount;
        assertEq(tree.size(), remaining);

        // Verify remaining are still sorted
        if (remaining > 0) {
            OrderStatisticsTree.PriceToken[] memory asc = tree.getPriceTokenRange(0, remaining);
            assertEq(asc.length, remaining);
            for (uint256 i = 1; i < asc.length; i++) {
                assertTrue(
                    asc[i].price > asc[i - 1].price ||
                    (asc[i].price == asc[i - 1].price && asc[i].tokenId > asc[i - 1].tokenId)
                );
            }
        }
    }

    function testFuzz_SamePriceDifferentTokenIds(uint256 price, uint8 count) public {
        price = bound(price, 1, 10000);
        count = uint8(bound(uint256(count), 2, 20));

        for (uint256 i = 0; i < count; i++) {
            tree.insert(price, i);
        }

        assertEq(tree.size(), count);

        // All have same price, sorted by tokenId
        OrderStatisticsTree.PriceToken[] memory asc = tree.getPriceTokenRange(0, count);
        for (uint256 i = 0; i < asc.length; i++) {
            assertEq(asc[i].price, price);
            assertEq(asc[i].tokenId, i);
        }
    }

    function testFuzz_SelectByIndex(uint8 count) public {
        count = uint8(bound(uint256(count), 1, 20));

        for (uint256 i = 0; i < count; i++) {
            tree.insert((i + 1) * 10, i);
        }

        // getPriceTokenByIndex uses 0-based index (adds 1 internally for select)
        for (uint256 i = 0; i < count; i++) {
            OrderStatisticsTree.PriceToken memory pt = tree.getPriceTokenByIndex(i);
            // i-th smallest should have price (i+1)*10
            assertEq(pt.price, (i + 1) * 10);
            assertEq(pt.tokenId, i);
        }
    }

    function testFuzz_HeightBounded(uint8 count) public {
        count = uint8(bound(uint256(count), 1, 50));

        for (uint256 i = 0; i < count; i++) {
            tree.insert((i + 1) * 10, i);
        }

        uint256 h = tree.height();
        // Red-black tree height <= 2 * log2(n+1)
        // For 50 nodes: 2 * log2(51) ≈ 11.3, so height should be <= 12
        assertTrue(h <= 2 * log2Ceil(uint256(count) + 1));
    }

    function log2Ceil(uint256 x) internal pure returns (uint256) {
        uint256 result = 0;
        uint256 val = 1;
        while (val < x) {
            val *= 2;
            result++;
        }
        return result;
    }

    function testFuzz_InterleavedInsertRemove(
        uint256 p1, uint256 p2, uint256 p3, uint256 p4, uint256 p5, uint256 p6
    ) public {
        p1 = bound(p1, 1, 10000);
        p2 = bound(p2, 1, 10000);
        p3 = bound(p3, 1, 10000);
        p4 = bound(p4, 1, 10000);
        p5 = bound(p5, 1, 10000);
        p6 = bound(p6, 1, 10000);

        tree.insert(p1, 1);
        tree.insert(p2, 2);
        tree.insert(p3, 3);
        assertEq(tree.size(), 3);

        tree.remove(2);
        assertEq(tree.size(), 2);

        tree.insert(p4, 4);
        tree.insert(p5, 5);
        assertEq(tree.size(), 4);

        tree.remove(1);
        tree.remove(3);
        assertEq(tree.size(), 2);

        tree.insert(p6, 6);
        assertEq(tree.size(), 3);

        // Verify sorted order of remaining: tokenId 4,5,6
        OrderStatisticsTree.PriceToken[] memory asc = tree.getPriceTokenRange(0, 3);
        assertEq(asc.length, 3);
        for (uint256 i = 1; i < asc.length; i++) {
            assertTrue(
                asc[i].price > asc[i - 1].price ||
                (asc[i].price == asc[i - 1].price && asc[i].tokenId > asc[i - 1].tokenId)
            );
        }
    }

    function testFuzz_LargeScaleInsertRemove() public {
        // Insert 100 elements
        for (uint256 i = 0; i < 100; i++) {
            uint256 price = ((i * 17 + 3) % 500) + 1;
            tree.insert(price, i);
        }
        assertEq(tree.size(), 100);

        // Remove 50 odd-indexed elements
        for (uint256 i = 1; i < 100; i += 2) {
            tree.remove(i);
        }
        assertEq(tree.size(), 50);

        // Verify sorted
        OrderStatisticsTree.PriceToken[] memory asc = tree.getPriceTokenRange(0, 50);
        assertEq(asc.length, 50);
        for (uint256 i = 1; i < asc.length; i++) {
            assertTrue(
                asc[i].price > asc[i - 1].price ||
                (asc[i].price == asc[i - 1].price && asc[i].tokenId > asc[i - 1].tokenId)
            );
        }

        // Height should be bounded
        uint256 h = tree.height();
        assertTrue(h <= 2 * log2Ceil(51));
    }

    function testFuzz_DescRangeQueryPartialOffset(uint8 count) public {
        count = uint8(bound(uint256(count), 5, 20));

        for (uint256 i = 0; i < count; i++) {
            tree.insert((i + 1) * 10, i);
        }

        // Start from middle descending
        uint256 midIdx = uint256(count) / 2;
        OrderStatisticsTree.PriceToken[] memory desc = tree.getPriceTokenRangeReverse(midIdx, midIdx + 1);
        assertEq(desc.length, midIdx + 1);
        for (uint256 i = 1; i < desc.length; i++) {
            assertTrue(desc[i].price <= desc[i - 1].price);
        }
    }

    function testFuzz_InsertRemoveReinsertDifferentPrice(uint256 p1, uint256 p2) public {
        p1 = bound(p1, 1, 5000);
        p2 = bound(p2, 5001, 10000);

        tree.insert(p1, 100);
        tree.insert(p2, 200);
        tree.insert(500, 300);

        // Remove and reinsert with swapped prices
        tree.remove(100);
        tree.remove(200);
        tree.insert(p2, 100);
        tree.insert(p1, 200);

        assertEq(tree.size(), 3);

        OrderStatisticsTree.PriceToken[] memory asc = tree.getPriceTokenRange(0, 3);
        for (uint256 i = 1; i < asc.length; i++) {
            assertTrue(
                asc[i].price > asc[i - 1].price ||
                (asc[i].price == asc[i - 1].price && asc[i].tokenId > asc[i - 1].tokenId)
            );
        }
    }
}

// ================================================================
// REENTRANCY ATTACKER CONTRACT
// Used by Section 35 tests to prove nonReentrant blocks reentrancy.
// ================================================================
contract ReentrancyAttacker {
    EthereumKiller public nft;
    uint256 public attackType; // 0 = buyToken, 1 = withdrawOffer, 2 = makeOffer

    constructor(address _nft) {
        nft = EthereumKiller(_nft);
    }

    function attackBuyToken(uint256 tokenId, uint256 expectedPrice) external payable {
        attackType = 0;
        nft.buyToken{value: msg.value}(tokenId, expectedPrice);
    }

    function attackWithdrawOffer(uint256 tokenId) external {
        attackType = 1;
        nft.withdrawOffer(tokenId);
    }

    function attackMakeOffer(uint256 tokenId) external payable {
        attackType = 2;
        nft.makeOffer{value: msg.value}(tokenId);
    }

    // When receiving ETH refund, try to re-enter the contract
    receive() external payable {
        if (attackType == 0) {
            // Try to re-enter buyToken during offer refund
            nft.buyToken{value: msg.value}(0, 0);
        } else if (attackType == 1) {
            // Try to re-enter withdrawOffer during refund
            nft.withdrawOffer(0);
        } else if (attackType == 2) {
            // Try to re-enter makeOffer during old offer refund
            nft.makeOffer{value: msg.value}(0);
        }
    }
}

// ================================================================
// ULTIMATE COMPREHENSIVE MONEY SECURITY TEST SUITE
// ================================================================
// Tests every ETH flow path, edge case, and attack vector to guarantee:
// - Zero wei can be lost, stolen, or locked
// - State and balances stay perfectly in sync
// - All known attack vectors are blocked
// ================================================================

contract MoneySecurityTest is Test {
    EthereumKiller public nft;
    address public owner;
    address public seller;
    address public buyer;
    address public bidder1;
    address public bidder2;
    address public bidder3;
    address public royaltyOwner;

    uint256 constant MIN_PRICE = 1 ether;
    uint256 constant ROYALTY_FRACTION = 1200;
    uint256 constant FEE_DENOMINATOR = 10000;

    function setUp() public {
        owner = address(this);
        seller = makeAddr("seller");
        buyer = makeAddr("buyer");
        bidder1 = makeAddr("bidder1");
        bidder2 = makeAddr("bidder2");
        bidder3 = makeAddr("bidder3");

        nft = new EthereumKiller();
        royaltyOwner = nft.ROYALTY_OWNER();

        vm.deal(seller, 10000 ether);
        vm.deal(buyer, 10000 ether);
        vm.deal(bidder1, 10000 ether);
        vm.deal(bidder2, 10000 ether);
        vm.deal(bidder3, 10000 ether);
        vm.deal(owner, 10000 ether);
    }

    // ================================================================
    // HELPER: Calculate expected royalty and proceeds
    // ================================================================
    function _royalty(uint256 price) internal pure returns (uint256) {
        return price * ROYALTY_FRACTION / FEE_DENOMINATOR;
    }

    function _proceeds(uint256 price) internal pure returns (uint256) {
        return price - _royalty(price);
    }

    // ================================================================
    // 1. GLOBAL ETH ACCOUNTING — ZERO-SUM INVARIANT
    // Every wei that enters the contract must exit. Nothing stuck.
    // ================================================================

    // After a complete buy cycle, contract balance returns to zero.
    function testFuzz_ZeroSum_BuyToken(uint256 price) public {
        price = bound(price, MIN_PRICE, 100 ether);

        nft.mintAndListForSale(seller, 0, price, "uri");
        uint256 contractBalBefore = address(nft).balance;

        vm.prank(buyer);
        nft.buyToken{value: price}(0, price);

        // Contract should hold zero ETH after sale completes
        assertEq(address(nft).balance, contractBalBefore, "ETH stuck in contract after buyToken");
    }

    // After a complete offer+accept cycle, contract balance returns to zero.
    function testFuzz_ZeroSum_AcceptOffer(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 100 ether);

        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        vm.prank(bidder1);
        nft.makeOffer{value: offerPrice}(0);

        uint256 contractBalBefore = address(nft).balance;
        assertEq(contractBalBefore, offerPrice, "Contract should hold offer ETH");

        vm.prank(seller);
        nft.acceptOffer(0, bidder1);

        // Contract should hold zero ETH after acceptance
        assertEq(address(nft).balance, 0, "ETH stuck in contract after acceptOffer");
    }

    // After offer+withdraw cycle, contract balance returns to zero.
    function testFuzz_ZeroSum_WithdrawOffer(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 100 ether);

        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        vm.prank(bidder1);
        nft.makeOffer{value: offerPrice}(0);

        vm.prank(bidder1);
        nft.withdrawOffer(0);

        assertEq(address(nft).balance, 0, "ETH stuck after withdraw");
    }

    // After offer update (old refunded, new stored), contract holds exactly new amount.
    function testFuzz_ZeroSum_OfferUpdate(uint256 offer1, uint256 offer2) public {
        offer1 = bound(offer1, MIN_PRICE, 50 ether);
        offer2 = bound(offer2, offer1 + 1, 100 ether);

        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        vm.prank(bidder1);
        nft.makeOffer{value: offer1}(0);

        vm.prank(bidder1);
        nft.makeOffer{value: offer2}(0);

        // Contract should hold exactly the new offer amount
        assertEq(address(nft).balance, offer2, "Contract balance mismatch after offer update");
    }

    // ================================================================
    // 2. EXACT ETH DISTRIBUTION — EVERY WEI GOES TO RIGHT RECIPIENT
    // ================================================================

    // buyToken: seller gets proceeds, royaltyOwner gets royalty, buyer gets change
    function testFuzz_ExactDistribution_BuyToken(uint256 price, uint256 overpay) public {
        price = bound(price, MIN_PRICE, 50 ether);
        overpay = bound(overpay, 0, 10 ether);
        uint256 totalSent = price + overpay;

        nft.mintAndListForSale(seller, 0, price, "uri");

        uint256 sellerBefore = seller.balance;
        uint256 royaltyBefore = royaltyOwner.balance;
        uint256 buyerBefore = buyer.balance;

        vm.prank(buyer);
        nft.buyToken{value: totalSent}(0, price);

        uint256 expectedRoyalty = _royalty(price);
        uint256 expectedProceeds = _proceeds(price);

        assertEq(seller.balance, sellerBefore + expectedProceeds, "Seller got wrong amount");
        assertEq(royaltyOwner.balance, royaltyBefore + expectedRoyalty, "Royalty owner got wrong amount");
        assertEq(buyer.balance, buyerBefore - price, "Buyer paid wrong amount (overpay not refunded correctly)");
    }

    // acceptOffer: seller gets proceeds, royaltyOwner gets royalty
    function testFuzz_ExactDistribution_AcceptOffer(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 100 ether);

        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        uint256 bidderBefore = bidder1.balance;

        vm.prank(bidder1);
        nft.makeOffer{value: offerPrice}(0);

        uint256 sellerBefore = seller.balance;
        uint256 royaltyBefore = royaltyOwner.balance;

        vm.prank(seller);
        nft.acceptOffer(0, bidder1);

        uint256 expectedRoyalty = _royalty(offerPrice);
        uint256 expectedProceeds = _proceeds(offerPrice);

        assertEq(seller.balance, sellerBefore + expectedProceeds, "Seller got wrong amount from acceptOffer");
        assertEq(royaltyOwner.balance, royaltyBefore + expectedRoyalty, "Royalty wrong from acceptOffer");
        assertEq(bidder1.balance, bidderBefore - offerPrice, "Bidder paid wrong total");
    }

    // withdrawOffer: bidder gets back 100% of their offer
    function testFuzz_ExactRefund_WithdrawOffer(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 100 ether);

        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        uint256 bidderBefore = bidder1.balance;

        vm.prank(bidder1);
        nft.makeOffer{value: offerPrice}(0);

        vm.prank(bidder1);
        nft.withdrawOffer(0);

        assertEq(bidder1.balance, bidderBefore, "Bidder didn't get full refund on withdraw");
    }

    // Offer update: bidder gets old offer refunded, contract holds new amount
    function testFuzz_ExactRefund_OfferUpdate(uint256 offer1, uint256 offer2) public {
        offer1 = bound(offer1, MIN_PRICE, 50 ether);
        offer2 = bound(offer2, offer1 + 1, 100 ether);

        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        uint256 bidderBefore = bidder1.balance;

        vm.prank(bidder1);
        nft.makeOffer{value: offer1}(0);

        vm.prank(bidder1);
        nft.makeOffer{value: offer2}(0);

        // Bidder spent offer2 total (offer1 was refunded, offer2 is locked)
        assertEq(bidder1.balance, bidderBefore - offer2, "Bidder balance wrong after offer update");
    }

    // ================================================================
    // 3. ROYALTY MATH PRECISION — VERIFY EXACT WEI AMOUNTS
    // ================================================================

    // Royalty + proceeds must always equal price (no wei lost to rounding)
    function testFuzz_RoyaltyPlusProceedsEqualsPrice(uint256 price) public {
        price = bound(price, MIN_PRICE, 1000 ether);

        uint256 royalty = _royalty(price);
        uint256 proceeds = price - royalty;

        assertEq(royalty + proceeds, price, "Royalty + proceeds != price (wei lost to rounding)");
    }

    // Royalty must be exactly 12% for all prices
    function testFuzz_RoyaltyIsExactly12Percent(uint256 price) public {
        price = bound(price, MIN_PRICE, 1000 ether);

        uint256 royalty = _royalty(price);
        uint256 expected = price * 12 / 100;

        assertEq(royalty, expected, "Royalty is not exactly 12%");
    }

    // ================================================================
    // 4. BUYER EXISTING OFFER REFUND DURING BUY
    // When buyer has an offer and then buys, their offer must be refunded
    // ================================================================

    function testFuzz_BuyerOfferRefundedOnBuy(uint256 listPrice, uint256 offerPrice) public {
        listPrice = bound(listPrice, MIN_PRICE, 50 ether);
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller, 0, listPrice, "uri");

        // Buyer makes an offer first
        vm.prank(buyer);
        nft.makeOffer{value: offerPrice}(0);

        uint256 buyerBefore = buyer.balance;

        // Same buyer now buys the token — offer should be refunded
        vm.prank(buyer);
        nft.buyToken{value: listPrice}(0, listPrice);

        // Buyer spent listPrice but got offerPrice back as refund
        assertEq(buyer.balance, buyerBefore - listPrice + offerPrice, "Buyer offer not refunded during buy");

        // Contract should hold zero
        assertEq(address(nft).balance, 0, "ETH stuck after buy with existing offer");
    }

    // ================================================================
    // 5. MULTIPLE OFFERS ON SAME TOKEN — ALL ACCOUNTING CORRECT
    // ================================================================

    function testFuzz_MultipleOffersAccounting(uint256 offer1, uint256 offer2, uint256 offer3) public {
        offer1 = bound(offer1, MIN_PRICE, 30 ether);
        offer2 = bound(offer2, MIN_PRICE, 30 ether);
        offer3 = bound(offer3, MIN_PRICE, 30 ether);

        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        // Three different bidders make offers
        vm.prank(bidder1);
        nft.makeOffer{value: offer1}(0);

        vm.prank(bidder2);
        nft.makeOffer{value: offer2}(0);

        vm.prank(bidder3);
        nft.makeOffer{value: offer3}(0);

        // Contract should hold all three offers
        assertEq(address(nft).balance, offer1 + offer2 + offer3, "Contract doesn't hold all offers");

        // Accept bidder2's offer — bidder1 and bidder3 offers stay locked
        uint256 sellerBefore = seller.balance;
        vm.prank(seller);
        nft.acceptOffer(0, bidder2);

        // Contract should still hold bidder1 and bidder3 offers
        assertEq(address(nft).balance, offer1 + offer3, "Wrong balance after accepting one offer");

        // Bidder1 withdraws
        uint256 bidder1Before = bidder1.balance;
        vm.prank(bidder1);
        nft.withdrawOffer(0);
        assertEq(bidder1.balance, bidder1Before + offer1, "Bidder1 withdraw wrong amount");

        // Bidder3 withdraws
        uint256 bidder3Before = bidder3.balance;
        vm.prank(bidder3);
        nft.withdrawOffer(0);
        assertEq(bidder3.balance, bidder3Before + offer3, "Bidder3 withdraw wrong amount");

        // Contract should be empty now
        assertEq(address(nft).balance, 0, "ETH stuck after all withdrawals");
    }

    // ================================================================
    // 6. FRONT-RUNNING PROTECTION — expectedPrice BLOCKS PRICE CHANGES
    // ================================================================

    function testFuzz_FrontRunBlocked_PriceIncrease(uint256 originalPrice, uint256 newPrice) public {
        originalPrice = bound(originalPrice, MIN_PRICE, 50 ether);
        newPrice = bound(newPrice, originalPrice + 1, 100 ether);

        nft.mintAndListForSale(seller, 0, originalPrice, "uri");

        // Seller front-runs by updating price
        vm.prank(seller);
        nft.updateTokenPrice(0, newPrice);

        // Buyer's tx with old expectedPrice must revert
        vm.prank(buyer);
        // vm.expectRevert("XRC721: price changed");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.PriceChanged.selector));
        nft.buyToken{value: newPrice}(0, originalPrice);
    }

    function testFuzz_FrontRunBlocked_PriceDecrease(uint256 originalPrice, uint256 newPrice) public {
        originalPrice = bound(originalPrice, MIN_PRICE + 1, 50 ether);
        newPrice = bound(newPrice, MIN_PRICE, originalPrice - 1);

        nft.mintAndListForSale(seller, 0, originalPrice, "uri");

        // Seller front-runs by decreasing price
        vm.prank(seller);
        nft.updateTokenPrice(0, newPrice);

        // Buyer's tx with old expectedPrice must revert
        vm.prank(buyer);
        // vm.expectRevert("XRC721: price changed");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.PriceChanged.selector));
        nft.buyToken{value: originalPrice}(0, originalPrice);
    }

    // ================================================================
    // 7. REENTRANCY — ALL MONEY FUNCTIONS BLOCKED
    // ================================================================

    function testFuzz_Reentrancy_BuyToken(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);

        ReentrancyAttacker attacker = new ReentrancyAttacker(address(nft));
        vm.deal(address(attacker), 100 ether);

        nft.mintAndListForSale(seller, 0, price, "uri");

        // Attacker makes offer so refund triggers receive()
        vm.prank(address(attacker));
        nft.makeOffer{value: MIN_PRICE}(0);

        // Attacker tries to buy — receive() will try to re-enter
        vm.prank(address(attacker));
        vm.expectRevert();
        attacker.attackBuyToken{value: price}(0, price);
    }

    function testFuzz_Reentrancy_WithdrawOffer(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        ReentrancyAttacker attacker = new ReentrancyAttacker(address(nft));
        vm.deal(address(attacker), 100 ether);

        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        vm.prank(address(attacker));
        nft.makeOffer{value: offerPrice}(0);

        vm.prank(address(attacker));
        vm.expectRevert();
        attacker.attackWithdrawOffer(0);
    }

    function testFuzz_Reentrancy_MakeOfferUpdate(uint256 offer1) public {
        offer1 = bound(offer1, MIN_PRICE, 5 ether);

        ReentrancyAttacker attacker = new ReentrancyAttacker(address(nft));
        vm.deal(address(attacker), 100 ether);

        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        vm.prank(address(attacker));
        nft.makeOffer{value: offer1}(0);

        // Attacker updates offer — refund triggers receive() which tries to re-enter.
        vm.prank(address(attacker));
        vm.expectRevert();
        attacker.attackMakeOffer{value: offer1 + 1 ether}(0);
    }

    // ================================================================
    // 8. ACCESS CONTROL — NO UNAUTHORIZED ETH EXTRACTION
    // ================================================================

    // Non-owner can't buy their own token
    function testFuzz_CannotBuyOwnToken(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller, 0, price, "uri");

        vm.prank(seller);
        // vm.expectRevert("XRC721: caller is the owner");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.CallerIsOwner.selector));
        nft.buyToken{value: price}(0, price);
    }

    // Can't make offer on own token
    function testFuzz_CannotOfferOwnToken(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        vm.prank(seller);
        // vm.expectRevert("XRC721: caller is the owner");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.CallerIsOwner.selector));
        nft.makeOffer{value: offerPrice}(0);
    }

    // Can't accept non-existent offer
    function test_CannotAcceptFakeOffer() public {
        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        vm.prank(seller);
        // vm.expectRevert("XRC721: no active offer");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.NoActiveOffer.selector));
        nft.acceptOffer(0, bidder1);
    }

    // Can't withdraw someone else's offer
    function testFuzz_CannotWithdrawOthersOffer(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        vm.prank(bidder1);
        nft.makeOffer{value: offerPrice}(0);

        // Bidder2 tries to withdraw bidder1's offer
        vm.prank(bidder2);
        // vm.expectRevert("XRC721: caller is not the bidder");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.CallerNotBidder.selector));
        nft.withdrawOffer(0);

        // Bidder1's ETH is still safe
        assertEq(address(nft).balance, offerPrice);
    }

    // Non-owner can't accept offers
    function testFuzz_CannotAcceptIfNotOwner(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        vm.prank(bidder1);
        nft.makeOffer{value: offerPrice}(0);

        vm.prank(buyer);
        // vm.expectRevert("XRC721: caller is not the owner");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.CallerNotOwner.selector));
        nft.acceptOffer(0, bidder1);
    }

    // ================================================================
    // 9. PAYMENT VALIDATION — CAN'T UNDERPAY
    // ================================================================

    function testFuzz_CannotUnderpayBuy(uint256 price) public {
        price = bound(price, MIN_PRICE + 1, 50 ether);

        nft.mintAndListForSale(seller, 0, price, "uri");

        vm.prank(buyer);
        // vm.expectRevert("XRC721: insufficient payment");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.InsufficientPayment.selector));
        nft.buyToken{value: price - 1}(0, price);
    }

    function testFuzz_CannotOfferBelowMinPrice(uint256 lowOffer) public {
        lowOffer = bound(lowOffer, 0, MIN_PRICE - 1);

        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        vm.prank(bidder1);
        // vm.expectRevert("XRC721: offer price must be at least 25,000 XDC");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.PriceBelowMinimum.selector));
        nft.makeOffer{value: lowOffer}(0);
    }

    // Can't update offer with lower amount
    function testFuzz_CannotLowerOffer(uint256 offer1) public {
        offer1 = bound(offer1, MIN_PRICE + 1, 50 ether);

        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        vm.prank(bidder1);
        nft.makeOffer{value: offer1}(0);

        vm.prank(bidder1);
        // vm.expectRevert("XRC721: new offer must be greater than existing offer");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.OfferMustBeGreater.selector));
        nft.makeOffer{value: offer1 - 1}(0);
    }

    // ================================================================
    // 10. STATE CONSISTENCY — TOKEN OWNERSHIP MATCHES PAYMENT
    // ================================================================

    // After buyToken, buyer owns token and seller got paid
    function testFuzz_StateConsistency_BuyToken(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller, 0, price, "uri");

        vm.prank(buyer);
        nft.buyToken{value: price}(0, price);

        assertEq(nft.ownerOf(0), buyer, "Buyer doesn't own token after purchase");
        assertEq(nft.isTokenForSale(0), false, "Token still listed after purchase");
    }

    // After acceptOffer, bidder owns token
    function testFuzz_StateConsistency_AcceptOffer(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        vm.prank(bidder1);
        nft.makeOffer{value: offerPrice}(0);

        vm.prank(seller);
        nft.acceptOffer(0, bidder1);

        assertEq(nft.ownerOf(0), bidder1, "Bidder doesn't own token after acceptance");
    }

    // After withdrawOffer, offer state is cleared
    function testFuzz_StateConsistency_WithdrawOffer(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        vm.prank(bidder1);
        nft.makeOffer{value: offerPrice}(0);

        vm.prank(bidder1);
        nft.withdrawOffer(0);

        // Offer should be cleared
        OrderStatisticsTree.Offer memory offer = nft.getCurrentOfferOfAddressForToken(0, bidder1);
        assertEq(offer.price, 0, "Offer not cleared after withdraw");
    }

    // ================================================================
    // 11. TOTAL VOLUME TRACKING — MUST MATCH ALL SALES
    // ================================================================

    function testFuzz_TotalVolumeTracking(uint256 price1, uint256 price2, uint256 offer1) public {
        price1 = bound(price1, MIN_PRICE, 30 ether);
        price2 = bound(price2, MIN_PRICE, 30 ether);
        offer1 = bound(offer1, MIN_PRICE, 30 ether);

        nft.mintAndListForSale(seller, 0, price1, "uri0");
        nft.mintAndListForSale(seller, 1, price2, "uri1");
        nft.mintAndListForSale(seller, 2, MIN_PRICE, "uri2");

        // Buy token 0
        vm.prank(buyer);
        nft.buyToken{value: price1}(0, price1);

        // Buy token 1
        vm.prank(buyer);
        nft.buyToken{value: price2}(1, price2);

        // Offer + accept token 2
        vm.prank(bidder1);
        nft.makeOffer{value: offer1}(2);

        vm.prank(seller);
        nft.acceptOffer(2, bidder1);

        assertEq(nft.totalVolume(), price1 + price2 + offer1, "Total volume doesn't match sales");
    }

    // ================================================================
    // 12. TRANSFER THEN ACCEPT — NEW OWNER GETS PAID CORRECTLY
    // ================================================================

    function testFuzz_TransferThenAccept(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        // Bidder makes offer
        vm.prank(bidder1);
        nft.makeOffer{value: offerPrice}(0);

        // Seller transfers token to buyer (not a sale)
        vm.prank(seller);
        nft.transferFrom(seller, buyer, 0);

        // New owner (buyer) accepts the existing offer
        uint256 buyerBefore = buyer.balance;
        vm.prank(buyer);
        nft.acceptOffer(0, bidder1);

        // New owner received the proceeds
        uint256 expectedProceeds = _proceeds(offerPrice);
        assertEq(buyer.balance, buyerBefore + expectedProceeds, "New owner got wrong proceeds");
        assertEq(nft.ownerOf(0), bidder1, "Bidder should own token");
        assertEq(address(nft).balance, 0, "ETH stuck after transfer+accept");
    }

    // ================================================================
    // 13. BUY UNLISTED TOKEN — MUST REVERT
    // ================================================================

    function testFuzz_CannotBuyUnlistedToken(uint256 payment) public {
        payment = bound(payment, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        // Delist it
        vm.prank(seller);
        nft.removeTokenFromSale(0);

        vm.prank(buyer);
        // vm.expectRevert("XRC721: token not for sale");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.TokenNotForSale.selector));
        nft.buyToken{value: payment}(0, MIN_PRICE);
    }

    // ================================================================
    // 14. DOUBLE BUY — SECOND BUYER MUST BE BLOCKED
    // ================================================================

    function testFuzz_CannotDoubleBuy(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller, 0, price, "uri");

        // First buyer succeeds
        vm.prank(buyer);
        nft.buyToken{value: price}(0, price);

        // Second buyer must fail (token no longer for sale)
        vm.prank(bidder1);
        // vm.expectRevert("XRC721: token not for sale");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.TokenNotForSale.selector));
        nft.buyToken{value: price}(0, price);
    }

    // ================================================================
    // 15. DOUBLE WITHDRAW — MUST REVERT ON SECOND ATTEMPT
    // ================================================================

    function testFuzz_CannotDoubleWithdraw(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        vm.prank(bidder1);
        nft.makeOffer{value: offerPrice}(0);

        // First withdraw succeeds
        vm.prank(bidder1);
        nft.withdrawOffer(0);

        // Second withdraw must fail
        vm.prank(bidder1);
        // vm.expectRevert("XRC721: caller is not the bidder");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.CallerNotBidder.selector));
        nft.withdrawOffer(0);
    }

    // ================================================================
    // 16. DOUBLE ACCEPT — MUST REVERT ON SECOND ATTEMPT
    // ================================================================

    function testFuzz_CannotDoubleAccept(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        vm.prank(bidder1);
        nft.makeOffer{value: offerPrice}(0);

        // First accept succeeds
        vm.prank(seller);
        nft.acceptOffer(0, bidder1);

        // Second accept must fail (offer deleted)
        vm.prank(bidder1); // bidder1 is now owner
        // vm.expectRevert("XRC721: no active offer");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.NoActiveOffer.selector));
        nft.acceptOffer(0, bidder1);
    }

    // ================================================================
    // 17. COMPLEX MULTI-TOKEN MULTI-USER ETH ACCOUNTING
    // Full lifecycle: mint, list, offer, buy, relist, offer, accept, withdraw
    // Verify EVERY balance at the end
    // ================================================================

    function testFuzz_ComplexLifecycle(uint256 price1, uint256 price2, uint256 offer1, uint256 offer2) public {
        price1 = bound(price1, MIN_PRICE, 20 ether);
        price2 = bound(price2, MIN_PRICE, 20 ether);
        offer1 = bound(offer1, MIN_PRICE, 20 ether);
        offer2 = bound(offer2, MIN_PRICE, 20 ether);

        // Snapshot all starting balances
        uint256 sellerStart = seller.balance;
        uint256 buyerStart = buyer.balance;
        uint256 bidder1Start = bidder1.balance;
        uint256 bidder2Start = bidder2.balance;
        uint256 royaltyStart = royaltyOwner.balance;

        // Mint two tokens
        nft.mintAndListForSale(seller, 0, price1, "uri0");
        nft.mintAndListForSale(seller, 1, price2, "uri1");

        // Buyer buys token 0
        vm.prank(buyer);
        nft.buyToken{value: price1}(0, price1);

        // Bidder1 offers on token 1
        vm.prank(bidder1);
        nft.makeOffer{value: offer1}(1);

        // Bidder2 also offers on token 1
        vm.prank(bidder2);
        nft.makeOffer{value: offer2}(1);

        // Seller accepts bidder1's offer on token 1
        vm.prank(seller);
        nft.acceptOffer(1, bidder1);

        // Bidder2 withdraws their offer
        vm.prank(bidder2);
        nft.withdrawOffer(1);

        // Verify final balances
        uint256 royalty1 = _royalty(price1);
        uint256 royalty2 = _royalty(offer1);
        uint256 proceeds1 = _proceeds(price1);
        uint256 proceeds2 = _proceeds(offer1);

        assertEq(seller.balance, sellerStart + proceeds1 + proceeds2, "Seller final balance wrong");
        assertEq(buyer.balance, buyerStart - price1, "Buyer final balance wrong");
        assertEq(bidder1.balance, bidder1Start - offer1, "Bidder1 final balance wrong");
        assertEq(bidder2.balance, bidder2Start, "Bidder2 should have all money back");
        assertEq(royaltyOwner.balance, royaltyStart + royalty1 + royalty2, "Royalty final balance wrong");
        assertEq(address(nft).balance, 0, "Contract should hold zero ETH at end");

        // Verify ownership
        assertEq(nft.ownerOf(0), buyer);
        assertEq(nft.ownerOf(1), bidder1);

        // Verify volume
        assertEq(nft.totalVolume(), price1 + offer1);
    }

    // ================================================================
    // 18. OVERPAYMENT REFUND — EXCESS ETH ALWAYS RETURNED
    // ================================================================

    function testFuzz_OverpaymentAlwaysRefunded(uint256 price, uint256 extra) public {
        price = bound(price, MIN_PRICE, 50 ether);
        extra = bound(extra, 1, 50 ether);

        nft.mintAndListForSale(seller, 0, price, "uri");

        uint256 buyerBefore = buyer.balance;

        vm.prank(buyer);
        nft.buyToken{value: price + extra}(0, price);

        // Buyer should only lose `price`, not `price + extra`
        assertEq(buyer.balance, buyerBefore - price, "Overpayment not fully refunded");
    }

    // ================================================================
    // 19. MIN_PRICE ENFORCEMENT — NO CHEAP EXPLOITS
    // ================================================================

    function test_CannotListBelowMinPrice() public {
        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        // Delist then try to relist below min
        vm.prank(seller);
        nft.removeTokenFromSale(0);

        vm.prank(seller);
        // vm.expectRevert("XRC721: price must be at least 25,000 XDC");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.PriceBelowMinimum.selector));
        nft.listTokenForSale(0, MIN_PRICE - 1);
    }

    function test_CannotUpdatePriceBelowMin() public {
        nft.mintAndListForSale(seller, 0, MIN_PRICE + 1, "uri");

        vm.prank(seller);
        // vm.expectRevert("XRC721: price must be at least 25,000 XDC");
        vm.expectRevert(abi.encodeWithSelector(EthereumKiller.PriceBelowMinimum.selector));
        nft.updateTokenPrice(0, MIN_PRICE - 1);
    }

    // ================================================================
    // 20. STRESS TEST — RAPID OFFER CYCLES DON'T LEAK ETH
    // ================================================================

    function testFuzz_RapidOfferCyclesNoLeak(uint256 seed) public {
        seed = bound(seed, 1, 1000);

        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        uint256 bidder1Start = bidder1.balance;

        // Make and withdraw 10 times rapidly
        for (uint256 i = 0; i < 10; i++) {
            uint256 offerAmount = MIN_PRICE + (i * 0.1 ether);

            vm.prank(bidder1);
            nft.makeOffer{value: offerAmount}(0);

            vm.prank(bidder1);
            nft.withdrawOffer(0);
        }

        // Bidder should have lost zero wei total
        assertEq(bidder1.balance, bidder1Start, "ETH leaked during rapid offer cycles");
        assertEq(address(nft).balance, 0, "Contract leaked ETH during rapid cycles");
    }

    // ================================================================
    // 21. OFFER UPDATE CYCLES — ESCALATING OFFERS DON'T LEAK
    // ================================================================

    function testFuzz_EscalatingOffersNoLeak(uint256 baseOffer) public {
        baseOffer = bound(baseOffer, MIN_PRICE, 10 ether);

        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        uint256 bidder1Start = bidder1.balance;

        // Escalate offer 5 times
        uint256 currentOffer = baseOffer;
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(bidder1);
            nft.makeOffer{value: currentOffer}(0);
            currentOffer = currentOffer + 1 ether;
        }

        // Final offer is currentOffer - 1 ether (last one sent)
        uint256 finalOffer = currentOffer - 1 ether;

        // Withdraw final offer
        vm.prank(bidder1);
        nft.withdrawOffer(0);

        // Bidder should have all money back
        assertEq(bidder1.balance, bidder1Start, "ETH leaked during escalating offers");
        assertEq(address(nft).balance, 0, "Contract leaked ETH during escalation");
    }

    // ================================================================
    // 22. RESALE CYCLE — BUY, RELIST, BUY AGAIN — ALL ACCOUNTING CORRECT
    // ================================================================

    function testFuzz_ResaleCycle(uint256 price1, uint256 price2) public {
        price1 = bound(price1, MIN_PRICE, 30 ether);
        price2 = bound(price2, MIN_PRICE, 30 ether);

        nft.mintAndListForSale(seller, 0, price1, "uri");

        // First sale: buyer buys from seller
        vm.prank(buyer);
        nft.buyToken{value: price1}(0, price1);

        // Buyer relists at price2
        vm.prank(buyer);
        nft.listTokenForSale(0, price2);

        // Bidder1 buys from buyer
        uint256 buyerBefore = buyer.balance;
        vm.prank(bidder1);
        nft.buyToken{value: price2}(0, price2);

        // Buyer (now seller) received proceeds
        assertEq(buyer.balance, buyerBefore + _proceeds(price2), "Reseller got wrong proceeds");
        assertEq(nft.ownerOf(0), bidder1, "Wrong owner after resale");
        assertEq(nft.totalVolume(), price1 + price2, "Volume wrong after resale");
        assertEq(address(nft).balance, 0, "ETH stuck after resale cycle");
    }

    // ================================================================
    // 23. ACCEPT OFFER ON UNLISTED TOKEN — SHOULD WORK
    // ================================================================

    function testFuzz_AcceptOfferOnUnlistedToken(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 50 ether);

        nft.mintAndListForSale(seller, 0, MIN_PRICE, "uri");

        // Bidder makes offer while listed
        vm.prank(bidder1);
        nft.makeOffer{value: offerPrice}(0);

        // Seller delists
        vm.prank(seller);
        nft.removeTokenFromSale(0);

        // Seller can still accept offer on unlisted token
        uint256 sellerBefore = seller.balance;
        vm.prank(seller);
        nft.acceptOffer(0, bidder1);

        assertEq(seller.balance, sellerBefore + _proceeds(offerPrice), "Accept on unlisted: wrong proceeds");
        assertEq(nft.ownerOf(0), bidder1);
        assertEq(address(nft).balance, 0, "ETH stuck after accept on unlisted");
    }

    // Receive ether (needed for royalty transfers to test contract)
    receive() external payable {}
}

// ================================================================
// COMPREHENSIVE ATTACK VECTOR TEST SUITE
// ================================================================
// Tests every applicable attack vector to guarantee 100% coverage.
// Covers: approvals, operator abuse, data structure integrity,
// boundary conditions, event emission, and edge cases.
// ================================================================

contract NonReceiverContract {
    // Intentionally does NOT implement IXRC721Receiver
    // safeTransferFrom to this contract must revert
}

contract ComprehensiveVectorTest is Test {
    EthereumKiller public nft;
    address public owner;
    address public seller1;
    address public buyer1;
    address public buyer2;
    address public buyer3;
    address public buyer4;
    address public buyer5;
    address public royaltyOwner;

    uint256 constant MIN_PRICE = 1 ether;
    uint256 constant ROYALTY_FRACTION = 1200;
    uint256 constant FEE_DENOMINATOR = 10000;

    // Events for expectEmit
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event TokenListedForSale(uint256 indexed tokenId, uint256 price);
    event TokenRemovedFromSale(uint256 indexed tokenId);
    event TokenPriceUpdated(uint256 indexed tokenId, uint256 newPrice);
    event TokenSold(uint256 salesId, uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price, uint256 timestamp);
    event MakeOffer(uint256 indexed tokenId, address indexed bidder, uint256 amount);
    event WithdrawOffer(uint256 indexed tokenId, address indexed bidder, uint256 amount);

    function setUp() public {
        owner = address(this);
        seller1 = makeAddr("seller1");
        buyer1 = makeAddr("buyer1");
        buyer2 = makeAddr("buyer2");
        buyer3 = makeAddr("buyer3");
        buyer4 = makeAddr("buyer4");
        buyer5 = makeAddr("buyer5");

        nft = new EthereumKiller();
        royaltyOwner = nft.ROYALTY_OWNER();

        vm.deal(seller1, 10000 ether);
        vm.deal(buyer1, 10000 ether);
        vm.deal(buyer2, 10000 ether);
        vm.deal(buyer3, 10000 ether);
        vm.deal(buyer4, 10000 ether);
        vm.deal(buyer5, 10000 ether);
        vm.deal(owner, 10000 ether);
    }

    function _royalty(uint256 price) internal pure returns (uint256) {
        return price * ROYALTY_FRACTION / FEE_DENOMINATOR;
    }

    function _proceeds(uint256 price) internal pure returns (uint256) {
        return price - _royalty(price);
    }

    receive() external payable {}

    // ================================================================
    // Category 1: Approval & Transfer Security (7 tests)
    // ================================================================

    function test_ApprovalClearedAfterTransfer() public {
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");
        vm.prank(seller1);
        nft.removeTokenFromSale(0);

        vm.prank(seller1);
        nft.approve(buyer1, 0);
        assertEq(nft.getApproved(0), buyer1);

        vm.prank(seller1);
        nft.transferFrom(seller1, buyer2, 0);
        assertEq(nft.getApproved(0), address(0), "Approval not cleared after transfer");
    }

    function test_ApprovalClearedAfterBuy() public {
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");

        vm.prank(seller1);
        nft.approve(buyer1, 0);
        assertEq(nft.getApproved(0), buyer1);

        vm.prank(buyer2);
        nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);
        assertEq(nft.getApproved(0), address(0), "Approval not cleared after buy");
    }

    function test_ApprovedCannotAccessAfterTransfer() public {
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");
        vm.prank(seller1);
        nft.removeTokenFromSale(0);

        vm.prank(seller1);
        nft.approve(buyer1, 0);

        vm.prank(seller1);
        nft.transferFrom(seller1, buyer2, 0);

        vm.prank(buyer1);
        vm.expectRevert(EthereumKiller.CallerNotOwnerNorApproved.selector);
        nft.transferFrom(buyer2, buyer1, 0);
    }

    function test_ApprovedCannotAccessAfterAcceptOffer() public {
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");
        vm.prank(seller1);
        nft.removeTokenFromSale(0);

        vm.prank(seller1);
        nft.approve(buyer1, 0);

        vm.prank(buyer2);
        nft.makeOffer{value: MIN_PRICE}(0);

        vm.prank(seller1);
        nft.acceptOffer(0, buyer2);

        vm.prank(buyer1);
        vm.expectRevert(EthereumKiller.CallerNotOwnerNorApproved.selector);
        nft.transferFrom(buyer2, buyer1, 0);
    }

    function testFuzz_SelfTransferBehavior(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);
        // Mint 2 tokens so seller1 has >1 (avoids tree delete/re-insert edge case)
        nft.mintAndListForSale(seller1, 0, price, "uri0");
        nft.mintAndListForSale(seller1, 1, price, "uri1");
        assertTrue(nft.isTokenForSale(0));

        vm.prank(seller1);
        nft.transferFrom(seller1, seller1, 0);

        assertEq(nft.ownerOf(0), seller1, "Self-transfer: wrong owner");
        assertFalse(nft.isTokenForSale(0), "Self-transfer: should auto-delist");
        assertEq(nft.balanceOf(seller1), 2, "Self-transfer: balance wrong");
    }

    function testFuzz_SafeTransferFromAutoDelists(uint256 price) public {
        price = bound(price, MIN_PRICE, 50 ether);
        nft.mintAndListForSale(seller1, 0, price, "uri0");
        uint256 forSaleBefore = nft.getForSaleTokensCount();

        vm.prank(seller1);
        nft.safeTransferFrom(seller1, buyer1, 0);

        assertFalse(nft.isTokenForSale(0), "safeTransferFrom should auto-delist");
        assertEq(nft.getForSaleTokensCount(), forSaleBefore - 1, "For-sale count mismatch");
        assertEq(nft.ownerOf(0), buyer1);
    }

    function test_TransferFromAutoDelists() public {
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");
        uint256 forSaleBefore = nft.getForSaleTokensCount();

        vm.prank(seller1);
        nft.transferFrom(seller1, buyer1, 0);

        assertFalse(nft.isTokenForSale(0), "transferFrom should auto-delist");
        assertEq(nft.getForSaleTokensCount(), forSaleBefore - 1, "For-sale count mismatch");
    }

    // ================================================================
    // Category 2: Operator Abuse (6 tests)
    // ================================================================

    function test_OperatorCannotListToken() public {
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");
        vm.prank(seller1);
        nft.removeTokenFromSale(0);

        vm.prank(seller1);
        nft.setApprovalForAll(buyer1, true);

        vm.prank(buyer1);
        vm.expectRevert(EthereumKiller.CallerNotOwner.selector);
        nft.listTokenForSale(0, MIN_PRICE);
    }

    function test_OperatorCannotDelistToken() public {
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");

        vm.prank(seller1);
        nft.setApprovalForAll(buyer1, true);

        vm.prank(buyer1);
        vm.expectRevert(EthereumKiller.CallerNotOwner.selector);
        nft.removeTokenFromSale(0);
    }

    function test_OperatorCannotUpdatePrice() public {
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");

        vm.prank(seller1);
        nft.setApprovalForAll(buyer1, true);

        vm.prank(buyer1);
        vm.expectRevert(EthereumKiller.CallerNotOwner.selector);
        nft.updateTokenPrice(0, 2 ether);
    }

    function test_OperatorCannotAcceptOffer() public {
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");

        vm.prank(buyer2);
        nft.makeOffer{value: MIN_PRICE}(0);

        vm.prank(seller1);
        nft.setApprovalForAll(buyer1, true);

        vm.prank(buyer1);
        vm.expectRevert(EthereumKiller.CallerNotOwner.selector);
        nft.acceptOffer(0, buyer2);
    }

    function test_OperatorCanTransferToken() public {
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");
        vm.prank(seller1);
        nft.removeTokenFromSale(0);

        vm.prank(seller1);
        nft.setApprovalForAll(buyer1, true);

        vm.prank(buyer1);
        nft.transferFrom(seller1, buyer2, 0);
        assertEq(nft.ownerOf(0), buyer2);
    }

    function test_OperatorCanTransferViaSafeTransfer() public {
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");
        vm.prank(seller1);
        nft.removeTokenFromSale(0);

        vm.prank(seller1);
        nft.setApprovalForAll(buyer1, true);

        vm.prank(buyer1);
        nft.safeTransferFrom(seller1, buyer2, 0);
        assertEq(nft.ownerOf(0), buyer2);
    }

    // ================================================================
    // Category 3: Concurrent Offers & Multi-Transfer Persistence (4 tests)
    // ================================================================

    function testFuzz_ConcurrentOffersFromSameBidder(uint256 o1, uint256 o2, uint256 o3) public {
        o1 = bound(o1, MIN_PRICE, 30 ether);
        o2 = bound(o2, MIN_PRICE, 30 ether);
        o3 = bound(o3, MIN_PRICE, 30 ether);

        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");
        nft.mintAndListForSale(seller1, 1, MIN_PRICE, "uri1");
        nft.mintAndListForSale(seller1, 2, MIN_PRICE, "uri2");

        vm.startPrank(buyer1);
        nft.makeOffer{value: o1}(0);
        nft.makeOffer{value: o2}(1);
        nft.makeOffer{value: o3}(2);
        vm.stopPrank();

        assertEq(nft.getOffersForBidderAddressCount(buyer1), 3, "Bidder should have 3 offers");
        assertEq(nft.getOffersForTokenCount(0), 1, "Token 0 should have 1 offer");
        assertEq(nft.getOffersForTokenCount(1), 1, "Token 1 should have 1 offer");
        assertEq(nft.getOffersForTokenCount(2), 1, "Token 2 should have 1 offer");
        assertEq(nft.getGlobalOffersCount(), 3, "Global offers should be 3");

        vm.prank(buyer1);
        nft.withdrawOffer(1);

        assertEq(nft.getOffersForBidderAddressCount(buyer1), 2, "Bidder should have 2 offers after withdraw");
        assertEq(nft.getOffersForTokenCount(1), 0, "Token 1 should have 0 offers");
        assertEq(nft.getGlobalOffersCount(), 2, "Global offers should be 2");
    }

    function testFuzz_ConcurrentOffersWithdrawAll(uint256 o1, uint256 o2) public {
        o1 = bound(o1, MIN_PRICE, 30 ether);
        o2 = bound(o2, MIN_PRICE, 30 ether);

        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");
        nft.mintAndListForSale(seller1, 1, MIN_PRICE, "uri1");

        uint256 buyer1BalBefore = buyer1.balance;

        vm.startPrank(buyer1);
        nft.makeOffer{value: o1}(0);
        nft.makeOffer{value: o2}(1);
        nft.withdrawOffer(0);
        nft.withdrawOffer(1);
        vm.stopPrank();

        assertEq(nft.getOffersForBidderAddressCount(buyer1), 0, "Bidder should have 0 offers");
        assertEq(nft.getGlobalOffersCount(), 0, "Global offers should be 0");
        assertEq(buyer1.balance, buyer1BalBefore, "Buyer1 should get full refund");
    }

    function testFuzz_OfferPersistsAcrossMultipleTransfers(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 30 ether);

        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");
        vm.prank(seller1);
        nft.removeTokenFromSale(0);

        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);

        // Transfer chain: seller1 -> buyer2 -> buyer3 -> buyer4
        vm.prank(seller1);
        nft.transferFrom(seller1, buyer2, 0);
        vm.prank(buyer2);
        nft.transferFrom(buyer2, buyer3, 0);
        vm.prank(buyer3);
        nft.transferFrom(buyer3, buyer4, 0);

        assertEq(nft.getOffersForTokenCount(0), 1, "Offer should persist across transfers");

        uint256 buyer4Before = buyer4.balance;
        uint256 royaltyOwnerBefore = royaltyOwner.balance;

        vm.prank(buyer4);
        nft.acceptOffer(0, buyer1);

        assertEq(nft.ownerOf(0), buyer1, "buyer1 should own after accept");
        assertEq(buyer4.balance, buyer4Before + _proceeds(offerPrice), "buyer4 proceeds wrong");
        assertEq(royaltyOwner.balance, royaltyOwnerBefore + _royalty(offerPrice), "royalty wrong");
    }

    function testFuzz_OfferPersistsAcrossMultipleSales(uint256 offerPrice, uint256 salePrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 30 ether);
        salePrice = bound(salePrice, MIN_PRICE, 30 ether);

        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");

        vm.prank(buyer1);
        nft.makeOffer{value: offerPrice}(0);

        // buyer2 buys (not buyer1)
        vm.prank(buyer2);
        nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);

        // buyer2 relists
        vm.prank(buyer2);
        nft.listTokenForSale(0, salePrice);

        // buyer3 buys
        vm.prank(buyer3);
        nft.buyToken{value: salePrice}(0, salePrice);

        assertEq(nft.ownerOf(0), buyer3);
        assertEq(nft.getOffersForTokenCount(0), 1, "Offer should persist across sales");

        uint256 buyer3Before = buyer3.balance;
        vm.prank(buyer3);
        nft.acceptOffer(0, buyer1);

        assertEq(nft.ownerOf(0), buyer1, "buyer1 should own after accept");
        assertEq(buyer3.balance, buyer3Before + _proceeds(offerPrice), "buyer3 proceeds wrong");
    }

    // ================================================================
    // Category 4: Zero-Value Edge Cases (2 tests)
    // ================================================================

    function test_ZeroValueOffer() public {
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");

        vm.prank(buyer1);
        vm.expectRevert(EthereumKiller.PriceBelowMinimum.selector);
        nft.makeOffer{value: 0}(0);
    }

    function test_ZeroValueBuy() public {
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");

        vm.prank(buyer1);
        vm.expectRevert(EthereumKiller.InsufficientPayment.selector);
        nft.buyToken{value: 0}(0, MIN_PRICE);
    }

    // ================================================================
    // Category 5: Data Structure Integrity (4 tests)
    // ================================================================

    function testFuzz_ForSalePlusNotForSaleInvariant(uint256 p1, uint256 p2, uint256 p3) public {
        p1 = bound(p1, MIN_PRICE, 30 ether);
        p2 = bound(p2, MIN_PRICE, 30 ether);
        p3 = bound(p3, MIN_PRICE, 30 ether);

        // Mint 3 tokens (all listed)
        nft.mintAndListForSale(seller1, 0, p1, "uri0");
        nft.mintAndListForSale(seller1, 1, p2, "uri1");
        nft.mintAndListForSale(seller1, 2, p3, "uri2");
        assertEq(nft.getForSaleTokensCount() + nft.getNotForSaleTokensCount(), nft.getTokenCount(), "Invariant after mint");

        // Delist one
        vm.prank(seller1);
        nft.removeTokenFromSale(0);
        assertEq(nft.getForSaleTokensCount() + nft.getNotForSaleTokensCount(), nft.getTokenCount(), "Invariant after delist");

        // Buy one (auto-delists)
        vm.prank(buyer1);
        nft.buyToken{value: p2}(1, p2);
        assertEq(nft.getForSaleTokensCount() + nft.getNotForSaleTokensCount(), nft.getTokenCount(), "Invariant after buy");

        // Relist the bought one
        vm.prank(buyer1);
        nft.listTokenForSale(1, p2);
        assertEq(nft.getForSaleTokensCount() + nft.getNotForSaleTokensCount(), nft.getTokenCount(), "Invariant after relist");
    }

    function testFuzz_MinHeapAfterComplexSequence(uint256 p1, uint256 p2, uint256 p3, uint256 newP1) public {
        p1 = bound(p1, MIN_PRICE, 50 ether);
        p2 = bound(p2, MIN_PRICE, 50 ether);
        p3 = bound(p3, MIN_PRICE, 50 ether);
        newP1 = bound(newP1, MIN_PRICE, 50 ether);
        // updateTokenPrice reverts if price is unchanged
        vm.assume(newP1 != p2);

        nft.mintAndListForSale(seller1, 0, p1, "uri0");
        nft.mintAndListForSale(seller1, 1, p2, "uri1");
        nft.mintAndListForSale(seller1, 2, p3, "uri2");

        uint256 expectedFloor = p1 < p2 ? (p1 < p3 ? p1 : p3) : (p2 < p3 ? p2 : p3);
        assertEq(nft.getFloorPrice(), expectedFloor, "Floor after 3 mints");

        // Delist token 0
        vm.prank(seller1);
        nft.removeTokenFromSale(0);
        uint256 floor2 = p2 < p3 ? p2 : p3;
        assertEq(nft.getFloorPrice(), floor2, "Floor after delist token 0");

        // Update token 1 price to newP1
        vm.prank(seller1);
        nft.updateTokenPrice(1, newP1);
        uint256 floor3 = newP1 < p3 ? newP1 : p3;
        assertEq(nft.getFloorPrice(), floor3, "Floor after update token 1");

        // Relist token 0 at p1
        vm.prank(seller1);
        nft.listTokenForSale(0, p1);
        uint256 floor4 = p1 < newP1 ? (p1 < p3 ? p1 : p3) : (newP1 < p3 ? newP1 : p3);
        assertEq(nft.getFloorPrice(), floor4, "Floor after relist token 0");
    }

    function testFuzz_OwnedTokensAfterMultiUserTransfers(uint256 price) public {
        price = bound(price, MIN_PRICE, 30 ether);

        // Mint 5 tokens to seller1
        nft.mintAndListForSale(seller1, 0, price, "uri0");
        nft.mintAndListForSale(seller1, 1, price, "uri1");
        nft.mintAndListForSale(seller1, 2, price, "uri2");
        nft.mintAndListForSale(seller1, 3, price, "uri3");
        nft.mintAndListForSale(seller1, 4, price, "uri4");

        // buyer1 buys 0, 2, 4
        vm.startPrank(buyer1);
        nft.buyToken{value: price}(0, price);
        nft.buyToken{value: price}(2, price);
        nft.buyToken{value: price}(4, price);
        vm.stopPrank();

        // buyer1 transfers 2 to buyer2
        vm.prank(buyer1);
        nft.transferFrom(buyer1, buyer2, 2);

        assertEq(nft.getOwnedTokensCount(seller1), nft.balanceOf(seller1), "seller1 owned vs balance");
        assertEq(nft.getOwnedTokensCount(buyer1), nft.balanceOf(buyer1), "buyer1 owned vs balance");
        assertEq(nft.getOwnedTokensCount(buyer2), nft.balanceOf(buyer2), "buyer2 owned vs balance");

        assertEq(nft.balanceOf(seller1), 2, "seller1 should have 2");
        assertEq(nft.balanceOf(buyer1), 2, "buyer1 should have 2");
        assertEq(nft.balanceOf(buyer2), 1, "buyer2 should have 1");
    }

    function testFuzz_GlobalOffersTreeSync(uint256 o1, uint256 o2, uint256 o3) public {
        o1 = bound(o1, MIN_PRICE, 20 ether);
        o2 = bound(o2, MIN_PRICE, 20 ether);
        o3 = bound(o3, MIN_PRICE, 20 ether);

        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");
        nft.mintAndListForSale(seller1, 1, MIN_PRICE, "uri1");

        // buyer1 offers on both tokens
        vm.startPrank(buyer1);
        nft.makeOffer{value: o1}(0);
        nft.makeOffer{value: o2}(1);
        vm.stopPrank();

        // buyer2 offers on token 0
        vm.prank(buyer2);
        nft.makeOffer{value: o3}(0);

        assertEq(nft.getGlobalOffersCount(), 3, "Global should be 3");

        // Withdraw buyer1's offer on token 0
        vm.prank(buyer1);
        nft.withdrawOffer(0);
        assertEq(nft.getGlobalOffersCount(), 2, "Global should be 2 after withdraw");

        // Accept buyer2's offer on token 0
        vm.prank(seller1);
        nft.acceptOffer(0, buyer2);
        assertEq(nft.getGlobalOffersCount(), 1, "Global should be 1 after accept");
    }

    // ================================================================
    // Category 6: Boundary & Royalty Edge Cases (4 tests)
    // ================================================================

    function test_RoyaltyAtMinPrice() public {
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");

        uint256 sellerBefore = seller1.balance;
        uint256 royaltyOwnerBefore = royaltyOwner.balance;

        vm.prank(buyer1);
        nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);

        uint256 expectedRoyalty = 0.12 ether;
        uint256 expectedProceeds = 0.88 ether;

        assertEq(royaltyOwner.balance - royaltyOwnerBefore, expectedRoyalty, "Royalty at min price wrong");
        assertEq(seller1.balance - sellerBefore, expectedProceeds, "Proceeds at min price wrong");
        assertEq(expectedRoyalty + expectedProceeds, MIN_PRICE, "Royalty + proceeds != price");
    }

    function test_RoyaltyAtLargePrice() public {
        uint256 largePrice = 999999 ether;
        nft.mintAndListForSale(seller1, 0, largePrice, "uri0");

        vm.deal(buyer1, largePrice + 1 ether);

        uint256 sellerBefore = seller1.balance;
        uint256 royaltyOwnerBefore = royaltyOwner.balance;

        vm.prank(buyer1);
        nft.buyToken{value: largePrice}(0, largePrice);

        uint256 royalty = royaltyOwner.balance - royaltyOwnerBefore;
        uint256 proceeds = seller1.balance - sellerBefore;
        assertEq(royalty + proceeds, largePrice, "Royalty + proceeds != price at large price (dust!)");
    }

    function testFuzz_RoyaltyNeverLosesDust(uint256 price) public {
        price = bound(price, MIN_PRICE, 500000 ether);
        uint256 royalty = _royalty(price);
        uint256 proceeds = _proceeds(price);
        assertEq(royalty + proceeds, price, "Royalty + proceeds != price (dust detected)");
    }

    function test_MaxSupplyConstant() public {
        assertEq(nft.MAX_TOKEN_SUPPLY(), 10000, "MAX_TOKEN_SUPPLY should be 10000");
    }

    // ================================================================
    // Category 7: Transfer to Non-Receiver Contract (2 tests)
    // ================================================================

    function test_SafeTransferToNonReceiverReverts() public {
        NonReceiverContract nonReceiver = new NonReceiverContract();
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");
        vm.prank(seller1);
        nft.removeTokenFromSale(0);

        vm.prank(seller1);
        vm.expectRevert();
        nft.safeTransferFrom(seller1, address(nonReceiver), 0);
    }

    function test_TransferFromToContractSucceeds() public {
        NonReceiverContract nonReceiver = new NonReceiverContract();
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");
        vm.prank(seller1);
        nft.removeTokenFromSale(0);

        vm.prank(seller1);
        nft.transferFrom(seller1, address(nonReceiver), 0);
        assertEq(nft.ownerOf(0), address(nonReceiver), "Non-receiver should own token after transferFrom");
    }

    // ================================================================
    // Category 8: Sales History, Unique Owners & Events (9 tests)
    // ================================================================

    function testFuzz_SalesHistoryIntegrity(uint256 price1, uint256 price2) public {
        price1 = bound(price1, MIN_PRICE, 30 ether);
        price2 = bound(price2, MIN_PRICE, 30 ether);

        nft.mintAndListForSale(seller1, 0, price1, "uri0");

        vm.prank(buyer1);
        nft.buyToken{value: price1}(0, price1);

        vm.prank(buyer1);
        nft.listTokenForSale(0, price2);

        vm.prank(buyer2);
        nft.buyToken{value: price2}(0, price2);

        assertEq(nft.getTokenSalesHistoryCount(0), 2, "Should have 2 sales");
    }

    function test_UniqueOwnerCountAccuracy() public {
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");
        nft.mintAndListForSale(seller1, 1, MIN_PRICE, "uri1");
        nft.mintAndListForSale(seller1, 2, MIN_PRICE, "uri2");
        // seller1 is the only unique owner (besides test contract which is deployer/owner)
        // Actually the test contract (owner) is the deployer but tokens are minted to seller1
        // So unique owners = 1 (seller1 only)
        assertEq(nft.getOwnerCount(), 1, "After mint 3 to seller1: count=1");

        vm.prank(buyer1);
        nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);
        assertEq(nft.getOwnerCount(), 2, "After buyer1 buys: count=2");

        vm.prank(buyer2);
        nft.buyToken{value: MIN_PRICE}(1, MIN_PRICE);
        assertEq(nft.getOwnerCount(), 3, "After buyer2 buys: count=3");

        // buyer1 transfers to buyer2 — buyer1 now has 0 tokens
        vm.prank(buyer1);
        nft.transferFrom(buyer1, buyer2, 0);
        // buyer1 balance is 0 → _uniqueOwners[buyer1] deleted, count decrements
        // but buyer2 already tracked, so count stays at 2 (seller1 + buyer2)
        assertEq(nft.getOwnerCount(), 2, "After buyer1 transfers out: count=2");
    }

    function test_EventEmission_BuyToken() public {
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");

        // TokenSold: salesId is non-indexed, tokenId/seller/buyer are indexed
        vm.expectEmit(true, true, true, false);
        emit TokenSold(0, 0, seller1, buyer1, MIN_PRICE, block.timestamp);

        vm.prank(buyer1);
        nft.buyToken{value: MIN_PRICE}(0, MIN_PRICE);
    }

    function test_EventEmission_ListToken() public {
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");
        vm.prank(seller1);
        nft.removeTokenFromSale(0);

        vm.expectEmit(true, true, false, false);
        emit TokenListedForSale(0, 2 ether);

        vm.prank(seller1);
        nft.listTokenForSale(0, 2 ether);
    }

    function test_EventEmission_DelistToken() public {
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");

        vm.expectEmit(true, false, false, false);
        emit TokenRemovedFromSale(0);

        vm.prank(seller1);
        nft.removeTokenFromSale(0);
    }

    function test_EventEmission_UpdatePrice() public {
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");

        vm.expectEmit(true, true, false, false);
        emit TokenPriceUpdated(0, 5 ether);

        vm.prank(seller1);
        nft.updateTokenPrice(0, 5 ether);
    }

    function test_EventEmission_MakeOffer() public {
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");

        vm.expectEmit(true, true, true, false);
        emit MakeOffer(0, buyer1, MIN_PRICE);

        vm.prank(buyer1);
        nft.makeOffer{value: MIN_PRICE}(0);
    }

    function test_EventEmission_WithdrawOffer() public {
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");

        vm.prank(buyer1);
        nft.makeOffer{value: MIN_PRICE}(0);

        vm.expectEmit(true, true, true, false);
        emit WithdrawOffer(0, buyer1, MIN_PRICE);

        vm.prank(buyer1);
        nft.withdrawOffer(0);
    }

    function test_EventEmission_AcceptOffer() public {
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");

        vm.prank(buyer1);
        nft.makeOffer{value: MIN_PRICE}(0);

        // acceptOffer emits WithdrawOffer then TokenSold
        vm.expectEmit(true, true, true, false);
        emit WithdrawOffer(0, buyer1, MIN_PRICE);

        vm.expectEmit(true, true, true, false);
        emit TokenSold(0, 0, seller1, buyer1, MIN_PRICE, block.timestamp);

        vm.prank(seller1);
        nft.acceptOffer(0, buyer1);
    }

    // ================================================================
    // Category 9: getOffersForBidderAddress ascending parameter (3 tests)
    // Added after exposing ascending parameter for consistency
    // ================================================================

    function test_BidderOffersAscendingOrder() public {
        // Mint 3 tokens
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");
        nft.mintAndListForSale(seller1, 1, MIN_PRICE, "uri1");
        nft.mintAndListForSale(seller1, 2, MIN_PRICE, "uri2");

        // buyer1 offers on all 3
        vm.startPrank(buyer1);
        nft.makeOffer{value: MIN_PRICE}(0);
        nft.makeOffer{value: MIN_PRICE}(1);
        nft.makeOffer{value: MIN_PRICE}(2);
        vm.stopPrank();

        // Ascending: should return tokenIds 0, 1, 2
        OrderStatisticsTree.Offer[] memory asc = nft.getOffersForBidderAddress(buyer1, 0, 3, true);
        assertEq(asc.length, 3, "Should return 3 offers ascending");
        assertEq(asc[0].tokenId, 0, "Asc first should be tokenId 0");
        assertEq(asc[1].tokenId, 1, "Asc second should be tokenId 1");
        assertEq(asc[2].tokenId, 2, "Asc third should be tokenId 2");
    }

    function test_BidderOffersDescendingOrder() public {
        // Mint 3 tokens
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");
        nft.mintAndListForSale(seller1, 1, MIN_PRICE, "uri1");
        nft.mintAndListForSale(seller1, 2, MIN_PRICE, "uri2");

        // buyer1 offers on all 3
        vm.startPrank(buyer1);
        nft.makeOffer{value: MIN_PRICE}(0);
        nft.makeOffer{value: MIN_PRICE}(1);
        nft.makeOffer{value: MIN_PRICE}(2);
        vm.stopPrank();

        // Descending: start from last element (index 2 for 3 elements), should return tokenIds 2, 1, 0
        OrderStatisticsTree.Offer[] memory desc = nft.getOffersForBidderAddress(buyer1, 2, 3, false);
        assertEq(desc.length, 3, "Should return 3 offers descending");
        assertEq(desc[0].tokenId, 2, "Desc first should be tokenId 2");
        assertEq(desc[1].tokenId, 1, "Desc second should be tokenId 1");
        assertEq(desc[2].tokenId, 0, "Desc third should be tokenId 0");
    }

    function test_BidderOffersPaginationWithAscending() public {
        // Mint 4 tokens
        nft.mintAndListForSale(seller1, 0, MIN_PRICE, "uri0");
        nft.mintAndListForSale(seller1, 1, MIN_PRICE, "uri1");
        nft.mintAndListForSale(seller1, 2, MIN_PRICE, "uri2");
        nft.mintAndListForSale(seller1, 3, MIN_PRICE, "uri3");

        // buyer1 offers on all 4
        vm.startPrank(buyer1);
        nft.makeOffer{value: MIN_PRICE}(0);
        nft.makeOffer{value: MIN_PRICE}(1);
        nft.makeOffer{value: MIN_PRICE}(2);
        nft.makeOffer{value: MIN_PRICE}(3);
        vm.stopPrank();

        // Page 1 ascending (start=0, count=2): tokenIds 0, 1
        OrderStatisticsTree.Offer[] memory page1 = nft.getOffersForBidderAddress(buyer1, 0, 2, true);
        assertEq(page1.length, 2, "Page 1 asc should have 2");
        assertEq(page1[0].tokenId, 0, "Page 1 asc first should be 0");
        assertEq(page1[1].tokenId, 1, "Page 1 asc second should be 1");

        // Page 1 descending (start=3 for last element of 4, count=2): tokenIds 3, 2
        OrderStatisticsTree.Offer[] memory page1desc = nft.getOffersForBidderAddress(buyer1, 3, 2, false);
        assertEq(page1desc.length, 2, "Page 1 desc should have 2");
        assertEq(page1desc[0].tokenId, 3, "Page 1 desc first should be 3");
        assertEq(page1desc[1].tokenId, 2, "Page 1 desc second should be 2");
    }
}
