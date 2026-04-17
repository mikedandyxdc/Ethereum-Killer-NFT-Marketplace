// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "contracts/OriginalNFTMarketplace.sol";
import "contracts/OriginalNFT.sol";
import "contracts/external/IXRC721Receiver.sol";

// Attacker contract that tries to re-enter on every ETH receive
contract OriginalReentrancyAttacker is IXRC721Receiver {
    OriginalNFTMarketplace public marketplace;
    uint256 public attackType;
    // 0 = buyOriginal, 1 = withdrawOriginalOffer, 2 = makeOriginalOffer, 3 = acceptOriginalOffer

    constructor(address _marketplace) {
        marketplace = OriginalNFTMarketplace(_marketplace);
    }

    function attackBuy(uint256 expectedPrice) external payable {
        attackType = 0;
        marketplace.buyOriginal{value: msg.value}(expectedPrice);
    }

    function attackWithdraw() external {
        attackType = 1;
        marketplace.withdrawOriginalOffer();
    }

    function attackMakeOffer() external payable {
        attackType = 2;
        marketplace.makeOriginalOffer{value: msg.value}();
    }

    function attackAcceptOffer(address bidder) external {
        attackType = 3;
        marketplace.acceptOriginalOffer(bidder);
    }

    // Required for safeTransferFrom to work
    function onXRC721Received(address, address, uint256, bytes memory) public pure override returns (bytes4) {
        return 0x150b7a02;
    }

    receive() external payable {
        if (attackType == 0) {
            try marketplace.buyOriginal{value: msg.value}(0) {} catch {}
        } else if (attackType == 1) {
            try marketplace.withdrawOriginalOffer() {} catch {}
        } else if (attackType == 2) {
            try marketplace.makeOriginalOffer{value: msg.value}() {} catch {}
        } else if (attackType == 3) {
            try marketplace.acceptOriginalOffer(address(0)) {} catch {}
        }
    }
}

contract OriginalNFTReentrancyTest is Test {
    OriginalNFTMarketplace public marketplace;
    OriginalNFT public nft;
    OriginalReentrancyAttacker public attacker;

    address constant ORIGINAL_OWNER = 0xb3C7c1c14f83f57370fcE247Ec359BE8584C3902;
    address public royaltyOwner;
    address public buyer1;

    uint256 constant MIN_PRICE = 25000 ether;
    uint256 constant TOKEN_ID = 1;

    function setUp() public {
        royaltyOwner = makeAddr("royaltyOwner");
        buyer1 = makeAddr("buyer1");

        nft = new OriginalNFT();
        // marketplace = new OriginalNFTMarketplace(royaltyOwner);
        // marketplace.setOriginalNFT(address(nft));
        marketplace = new OriginalNFTMarketplace(royaltyOwner, address(nft));

        // Fund accounts generously
        vm.deal(ORIGINAL_OWNER, 1000000 ether);
        vm.deal(buyer1, 1000000 ether);

        // Original owner approves marketplace
        vm.prank(ORIGINAL_OWNER);
        nft.setApprovalForAll(address(marketplace), true);
    }

    // ════════════════════════════════════════════════════
    // 1. Reentrancy on buyOriginal (offer refund path)
    // ════════════════════════════════════════════════════

    function testFuzz_ReentrancyBlocked_BuyOriginal(uint256 price) public {
        price = bound(price, MIN_PRICE, 500000 ether);

        attacker = new OriginalReentrancyAttacker(address(marketplace));
        vm.deal(address(attacker), price * 3);

        // Original owner lists
        vm.prank(ORIGINAL_OWNER);
        marketplace.listOriginal(price);

        // Attacker makes an offer first (so buyOriginal triggers offer refund)
        vm.prank(address(attacker));
        marketplace.makeOriginalOffer{value: MIN_PRICE}();

        uint256 contractBalBefore = address(marketplace).balance;

        // Attacker buys — receive() will try to re-enter buyOriginal
        attacker.attackBuy{value: price}(price);

        // Verify NFT transferred to attacker
        assertEq(nft.ownerOf(TOKEN_ID), address(attacker));
        // Verify contract balance is zero (all funds distributed)
        assertEq(address(marketplace).balance, 0, "Contract should have zero balance");
    }

    // ════════════════════════════════════════════════════
    // 2. Reentrancy on withdrawOriginalOffer
    // ════════════════════════════════════════════════════

    function testFuzz_ReentrancyBlocked_WithdrawOffer(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 500000 ether);

        attacker = new OriginalReentrancyAttacker(address(marketplace));
        vm.deal(address(attacker), offerPrice * 2);

        // Attacker makes offer
        vm.prank(address(attacker));
        marketplace.makeOriginalOffer{value: offerPrice}();

        uint256 attackerBalBefore = address(attacker).balance;

        // Attacker withdraws — receive() tries to re-enter withdrawOriginalOffer
        attacker.attackWithdraw();

        // Verify full refund (exactly once, not double-spent via reentrancy)
        assertEq(address(attacker).balance, attackerBalBefore + offerPrice, "Attacker should get exact refund");
        assertEq(address(marketplace).balance, 0, "Contract should have zero balance");
        assertEq(marketplace.originalOffers(address(attacker)), 0, "Offer should be deleted");
    }

    // ════════════════════════════════════════════════════
    // 3. Reentrancy on makeOriginalOffer (update/refund path)
    // ════════════════════════════════════════════════════

    function testFuzz_ReentrancyBlocked_MakeOfferUpdate(uint256 offer1) public {
        offer1 = bound(offer1, MIN_PRICE, 250000 ether);
        uint256 offer2 = offer1 + 1 ether;

        attacker = new OriginalReentrancyAttacker(address(marketplace));
        vm.deal(address(attacker), offer1 + offer2 + 100 ether);

        // Attacker makes first offer
        vm.prank(address(attacker));
        marketplace.makeOriginalOffer{value: offer1}();

        uint256 attackerBalBefore = address(attacker).balance;

        // Attacker updates offer — receive() tries to re-enter during old offer refund
        // Send offer2 to attacker who forwards to marketplace
        attacker.attackMakeOffer{value: offer2}();

        // Verify: old offer refunded exactly once, new offer held
        // attackerBalBefore was measured after first offer. Test sends offer2 to attacker,
        // attacker forwards it to marketplace, marketplace refunds offer1 back to attacker.
        // Net: attackerBalBefore + offer1
        assertEq(address(attacker).balance, attackerBalBefore + offer1, "Attacker balance wrong after update");
        assertEq(address(marketplace).balance, offer2, "Contract should hold new offer amount");
        assertEq(marketplace.originalOffers(address(attacker)), offer2, "Offer should be updated");
    }

    // ════════════════════════════════════════════════════
    // 4. Reentrancy on acceptOriginalOffer (seller receives ETH)
    // ════════════════════════════════════════════════════

    function testFuzz_ReentrancyBlocked_AcceptOffer(uint256 offerPrice) public {
        offerPrice = bound(offerPrice, MIN_PRICE, 500000 ether);

        attacker = new OriginalReentrancyAttacker(address(marketplace));

        // Transfer NFT from hardcoded owner to attacker (attacker is the seller)
        vm.prank(ORIGINAL_OWNER);
        nft.safeTransferFrom(ORIGINAL_OWNER, address(attacker), TOKEN_ID);

        // Attacker approves marketplace
        vm.prank(address(attacker));
        nft.setApprovalForAll(address(marketplace), true);

        // buyer1 makes offer
        vm.prank(buyer1);
        marketplace.makeOriginalOffer{value: offerPrice}();

        uint256 attackerBalBefore = address(attacker).balance;
        uint256 royaltyOwnerBalBefore = royaltyOwner.balance;

        // Attacker (owner) accepts offer — receive() tries to re-enter during seller payout
        attacker.attackAcceptOffer(buyer1);

        // Verify NFT transferred to buyer
        assertEq(nft.ownerOf(TOKEN_ID), buyer1);

        // Verify royalty paid
        uint256 royalty = (offerPrice * 1200) / 10000;
        assertEq(royaltyOwner.balance, royaltyOwnerBalBefore + royalty, "Royalty wrong");

        // Verify seller got proceeds (exactly once, no reentrancy double-pay)
        uint256 sellerProceeds = offerPrice - royalty;
        assertEq(address(attacker).balance, attackerBalBefore + sellerProceeds, "Seller proceeds wrong");

        // Contract should be empty
        assertEq(address(marketplace).balance, 0, "Contract should have zero balance");
    }
}
