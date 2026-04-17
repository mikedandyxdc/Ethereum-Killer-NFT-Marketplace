const { expect } = require("chai");
const { ethers } = require("hardhat");

const Color = { RED: 0, BLACK: 1 }; // Ensure the Color enum is defined similarly
const ComparatorType = { TOKENID: 0, PRICETOKEN_PRICE_TOKENID: 1, OFFER_TOKENID: 2, OFFER_PRICE_TOKENID: 3, SALE_PRICE_TOKENID: 4 };

describe("EthereumKiller", function () {
  let EthereumKiller, xrc721, owner, bidder1, bidder2, bidder3, bidder4, bidder5, bidder6, bidder7, bidder8, bidder9, bidder10, seller, buyer;
  let buyer1;
  let buyer2;
  let buyer3;
  let buyer4;
  let buyer5;
  let tokenId0 = 0;
  let tokenId1 = 1;
  let tokenId2 = 2;
  let tokenId3 = 3;
  let tokenId4 = 4;
  let tokenId5 = 5;
  let tokenId6 = 6;
  let price1 = ethers.parseEther("25000");
  let price2 = ethers.parseEther("50000");
  let price3 = ethers.parseEther("75000");
  let price4 = ethers.parseEther("100000");
  let price5 = ethers.parseEther("125000");
  let price6 = ethers.parseEther("150000");

  // let ROYALTY_PERCENTAGE = BigInt(12);
  let ROYALTY_FRACTION = BigInt(1200);
  let FEE_DENOMINATOR = BigInt(10000);

  let tokenId = 1;
  let mintPrice = ethers.parseEther("25000");
  let offerPrice1 = ethers.parseEther("37500");
  let offerPrice2 = ethers.parseEther("50000");
  let salePrice = ethers.parseEther("75000");

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const ORIGINAL_NFT_ADDRESS = "0xd6950d16402AEA3776881D3f72C13558444E8304";


  // beforeEach(async function () {
  beforeEach(async function () {

    OrderStatisticsTree = await ethers.getContractFactory("OrderStatisticsTree");
    orderStatisticsTree = await OrderStatisticsTree.deploy();
    await orderStatisticsTree.waitForDeployment();
    // console.log(orderStatisticsTree.target);

    CustomMinHeapLib = await ethers.getContractFactory("CustomMinHeapLib");
    CustomMinHeapLib = await CustomMinHeapLib.deploy();
    await CustomMinHeapLib.waitForDeployment();
    
    // Get the ContractFactory and Signers here.
    EthereumKiller = await ethers.getContractFactory("EthereumKiller", {
      libraries: {
        OrderStatisticsTree: orderStatisticsTree.target,
        CustomMinHeapLib: CustomMinHeapLib.target,
      },
    });
    // xrc721 = await ethers.getContractFactory("EthereumKiller");
    [owner, bidder1, bidder2, bidder3, bidder4, bidder5, bidder6, bidder7, bidder8, bidder9, bidder10, buyer1, buyer2, buyer3, buyer4, buyer5, seller, buyer] = await ethers.getSigners();

    // Deploy the contract
    xrc721 = await EthereumKiller.deploy();
    await xrc721.waitForDeployment();  // Wait for the contract deployment to be mined

    // Get the ContractFactory
    OriginalNFT = await ethers.getContractFactory("OriginalNFT");
    originalNFT = await OriginalNFT.deploy();
    await originalNFT.waitForDeployment();  // Wait for the contract deployment to be mined

  });

  // it("Should check if tokenId 0 exists using _exists function", async function() {
  //   console.log(await originalNFT.tokenURI(1));
  // });

  it("Should set initial ROYALTY_OWNER to contract deployer", async function () {
    expect(await xrc721.ROYALTY_OWNER()).to.equal(owner.address);
  });

  it("Should handle setting and getting ROYALTY_OWNER correctly", async function () {
    // Initial ROYALTY_OWNER should be the contract deployer (owner)
    expect(await xrc721.ROYALTY_OWNER()).to.equal(owner.address);

    // Set ROYALTY_OWNER to bidder1
    await xrc721.setRoyaltyOwner(bidder1.address);
    expect(await xrc721.ROYALTY_OWNER()).to.equal(bidder1.address);

    // Try to set ROYALTY_OWNER from non-ROYALTY_OWNER account (should fail)
    await expect(xrc721.connect(owner).setRoyaltyOwner(bidder2.address))
      // .to.be.revertedWith("Only current ROYALTY_OWNER can change");
      .to.be.revertedWithCustomError(xrc721, "NotRoyaltyOwner");

    // Set ROYALTY_OWNER to bidder2 from bidder1 (current ROYALTY_OWNER)
    await xrc721.connect(bidder1).setRoyaltyOwner(bidder2.address);
    expect(await xrc721.ROYALTY_OWNER()).to.equal(bidder2.address);

    // Try to set ROYALTY_OWNER to current ROYALTY_OWNER (should fail)
    await expect(xrc721.connect(bidder2).setRoyaltyOwner(bidder2.address))
      // .to.be.revertedWith("New address must be different from current ROYALTY_OWNER");
      .to.be.revertedWithCustomError(xrc721, "SameRoyaltyOwner");

    // Try to set ROYALTY_OWNER to zero address (should fail)
    await expect(xrc721.connect(bidder2).setRoyaltyOwner(ZERO_ADDRESS))
      // .to.be.revertedWith("Invalid address");
      .to.be.revertedWithCustomError(xrc721, "ZeroAddress");

    // Set ROYALTY_OWNER to seller
    await xrc721.connect(bidder2).setRoyaltyOwner(seller.address);
    expect(await xrc721.ROYALTY_OWNER()).to.equal(seller.address);

    // Set ROYALTY_OWNER to buyer
    await xrc721.connect(seller).setRoyaltyOwner(buyer.address);
    expect(await xrc721.ROYALTY_OWNER()).to.equal(buyer.address);
  });

  it("Should deduct the sale price from the buyer's balance when purchasing a token", async function () {
    const salePrice = ethers.parseEther("25000"); // Example sale price
    await xrc721.connect(owner).mintAndListForSale(seller.address, tokenId, salePrice, "TokenURI1");

    // Record the balance of the buyer before the purchase
    const balanceBeforePurchase = await ethers.provider.getBalance(buyer.address);

    // Buyer purchases the token
    const purchaseTx = await xrc721.connect(buyer).buyToken(tokenId, salePrice, { value: salePrice });

    // Record the balance of the buyer after the purchase
    const balanceAfterPurchase = await ethers.provider.getBalance(buyer.address);

    // Check that the buyer's balance has decreased by the sale price
    expect(balanceAfterPurchase).to.equal(balanceBeforePurchase - salePrice);

    // Verify that the token's ownership has changed
    expect(await xrc721.ownerOf(tokenId)).to.equal(buyer.address);
});

  it("should correctly handle all ether transfers", async function () {
    // Mint a token to the seller first
    await xrc721.connect(owner).mintAndListForSale(seller.address, tokenId0, price1, "TokenURI1");

    // Initial balances
    const ownerInitialBalance = await ethers.provider.getBalance(owner.address);
    const sellerInitialBalance = await ethers.provider.getBalance(seller.address);
    const buyerInitialBalance = await ethers.provider.getBalance(buyer1.address);
    const bidder1InitialBalance = await ethers.provider.getBalance(bidder1.address);
    const bidder2InitialBalance = await ethers.provider.getBalance(bidder2.address);


    // Bidder1 makes an offer
    const offer1Amount = ethers.parseEther("37500");
    await xrc721.connect(bidder1).makeOffer(tokenId0, { value: offer1Amount });

    // Check Bidder1's balance after making the offer
    const bidder1BalanceAfterOffer1 = await ethers.provider.getBalance(bidder1.address);
    expect(bidder1BalanceAfterOffer1).to.equal(bidder1InitialBalance - offer1Amount);

    // Bidder2 makes an offer
    const offer2Amount = ethers.parseEther("50000");
    await xrc721.connect(bidder2).makeOffer(tokenId0, { value: offer2Amount });

    // Check Bidder2's balance after making the offer
    const bidder2BalanceAfterOffer2 = await ethers.provider.getBalance(bidder2.address);
    expect(bidder2BalanceAfterOffer2).to.equal(bidder2InitialBalance - offer2Amount);


    // Now let's assume Bidder2 makes a higher offer again, their previous offer should be refunded
    await xrc721.connect(bidder2).makeOffer(tokenId0, { value: ethers.parseEther("62500") });

    // Check Bidder2's balance after refunding their first offer
    const bidder2BalanceAfterRefund = await ethers.provider.getBalance(bidder2.address);
    // Adjust the expected value based on the refund and gas fees (ignoring gas for simplicity in the example)
    expect(bidder2BalanceAfterRefund).to.equal(bidder2InitialBalance - ethers.parseEther("62500"));

    // Buyer buys the token. If Buyer1 had made an offer, that offer would be refunded (otherwise no refund).
    await xrc721.connect(buyer1).buyToken(tokenId0, price1, { value: price1 });

    // Check balances after purchase
    const ownerFinalBalance = await ethers.provider.getBalance(owner.address);
    const sellerFinalBalance = await ethers.provider.getBalance(seller.address);
    const buyerFinalBalance = await ethers.provider.getBalance(buyer1.address);
    const bidder2FinalBalance = await ethers.provider.getBalance(bidder2.address);

    // Owner receives royalty
    const expectedRoyalty = (price1 * ROYALTY_FRACTION) / FEE_DENOMINATOR;
    expect(ownerFinalBalance).to.equal(ownerInitialBalance + expectedRoyalty);

    // Seller receives sale proceeds minus royalty
    const expectedSellerProceeds = price1 - expectedRoyalty;
    expect(sellerFinalBalance).to.equal(sellerInitialBalance + expectedSellerProceeds);

    // If Buyer1 had made an offer, their balance should reflect the refund and cost of the token.
    if (bidder2.address === buyer1.address) {
        expect(buyerFinalBalance).to.equal(buyerInitialBalance);
    } else {
        expect(buyerFinalBalance).to.equal(buyerInitialBalance - price1);
    }
});

it("should correctly handle withdrawal of offer", async function () {
  // Mint a token to the seller first
  await xrc721.connect(owner).mintAndListForSale(seller.address, tokenId1, price2, "TokenURI2");

  // Initial balance
  const bidder1InitialBalance = await ethers.provider.getBalance(bidder1.address);

  // Bidder1 makes an offer
  const offerAmount = ethers.parseEther("37500"); // Example offer amount
  await xrc721.connect(bidder1).makeOffer(tokenId1, { value: offerAmount });

  // Check Bidder1's balance after making the offer
  const bidder1BalanceAfterOffer = await ethers.provider.getBalance(bidder1.address);
  expect(bidder1BalanceAfterOffer).to.equal(bidder1InitialBalance - offerAmount);

  // Withdraw the offer
  await xrc721.connect(bidder1).withdrawOffer(tokenId1);

  // Check Bidder1's balance after withdrawal
  const bidder1BalanceAfterWithdrawal = await ethers.provider.getBalance(bidder1.address);
  expect(bidder1BalanceAfterWithdrawal).to.equal(bidder1InitialBalance);
});

it("should correctly handle acceptance of offer", async function () {
    // Mint a token to the seller first
    await xrc721.connect(owner).mintAndListForSale(seller.address, tokenId2, price3, "TokenURI3");

    // Initial balances
    const ownerInitialBalance = await ethers.provider.getBalance(owner.address);
    const sellerInitialBalance = await ethers.provider.getBalance(seller.address);
    const bidder1InitialBalance = await ethers.provider.getBalance(bidder1.address);

    // Bidder1 makes an offer
    await xrc721.connect(bidder1).makeOffer(tokenId2, { value: ethers.parseEther("37500") });

    // Seller accepts the offer
    await xrc721.connect(seller).acceptOffer(tokenId2, bidder1.address);

    // Check balances after acceptance
    const ownerFinalBalance = await ethers.provider.getBalance(owner.address);
    const sellerFinalBalance = await ethers.provider.getBalance(seller.address);
    const bidder1FinalBalance = await ethers.provider.getBalance(bidder1.address);

    // Owner receives royalty
    const expectedRoyalty = (ethers.parseEther("37500") * ROYALTY_FRACTION) / FEE_DENOMINATOR;
    expect(ownerFinalBalance).to.equal(ownerInitialBalance + expectedRoyalty);

    // Seller receives offer amount minus royalty
    const expectedSellerProceeds = ethers.parseEther("37500") - expectedRoyalty;
    expect(sellerFinalBalance).to.equal(sellerInitialBalance + expectedSellerProceeds);

    // Bidder1 should have less ether by offer amount
    expect(bidder1FinalBalance).to.equal(bidder1InitialBalance - ethers.parseEther("37500"));
});


  it("Should get an offer for a token", async function () {
    await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI");

    await xrc721.connect(bidder1).makeOffer(tokenId0, { value: price1 });

    const offer = await xrc721.getCurrentOfferOfAddressForToken(tokenId0, bidder1.address);
    expect(offer.tokenId).to.equal(tokenId0);
    expect(offer.bidder).to.equal(bidder1.address);
    expect(offer.price).to.equal(price1);
  });

  it("Should get all offers for a bidder address", async function () {
    await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI");

    await xrc721.connect(bidder1).makeOffer(tokenId0, { value: price1 });

    const offers = await xrc721.getOffersForBidderAddress(bidder1.address, 0, 10, true);
    expect(offers.length).to.equal(1);
    expect(offers[0].tokenId).to.equal(tokenId0);
    expect(offers[0].bidder).to.equal(bidder1.address);
    expect(offers[0].price).to.equal(price1);
  });

  // it("Should get all offers for a seller address", async function () {
  //   await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI");

  //   await xrc721.connect(bidder1).makeOffer(tokenId0, { value: price1 });

  //   const offers = await xrc721.getOffersForSellerAddress(owner.address, 0, 10);
  //   expect(offers.length).to.equal(1);
  //   expect(offers[0].tokenId).to.equal(tokenId0);
  //   expect(offers[0].bidder).to.equal(bidder1.address);
  //   expect(offers[0].price).to.equal(price1);
  // });

  it("Should get all offers for a token", async function () {
    await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI");

    await xrc721.connect(bidder1).makeOffer(tokenId0, { value: price1 });

    const offers = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
    expect(offers.length).to.equal(1);
    expect(offers[0].tokenId).to.equal(tokenId0);
    expect(offers[0].bidder).to.equal(bidder1.address);
    expect(offers[0].price).to.equal(price1);
  });

  it("Should handle withdraw offer correctly", async function () {
    await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI");

    await xrc721.connect(bidder1).makeOffer(tokenId0, { value: price1 });
    await xrc721.connect(bidder1).withdrawOffer(tokenId0);

    const offer = await xrc721.getCurrentOfferOfAddressForToken(tokenId0, bidder1.address);
    expect(offer.price).to.equal(0);

    const offers = await xrc721.getOffersForBidderAddress(bidder1.address, 0, 10, true);
    expect(offers.length).to.equal(0);

    // const sellerOffers = await xrc721.getOffersForSellerAddress(owner.address, 0, 10);
    // expect(sellerOffers.length).to.equal(0);

    const tokenOffers = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
    expect(tokenOffers.length).to.equal(0);
  });

  it("Should handle accept offer correctly", async function () {
    await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI");

    await xrc721.connect(bidder1).makeOffer(tokenId0, { value: price1 });
    await xrc721.connect(owner).acceptOffer(tokenId0, bidder1.address);

    const offer = await xrc721.getCurrentOfferOfAddressForToken(tokenId0, bidder1.address);
    expect(offer.price).to.equal(0);

    const offers = await xrc721.getOffersForBidderAddress(bidder1.address, 0, 10, true);

    expect(offers.length).to.equal(0);

    // const sellerOffers = await xrc721.getOffersForSellerAddress(owner.address, 0, 10);

    // // console.log(sellerOffers.length);

    // expect(sellerOffers.length).to.equal(0);

    const tokenOffers = await xrc721.getOffersForToken(tokenId0, 0, 10, true);

    expect(tokenOffers.length).to.equal(0);

    expect(await xrc721.ownerOf(tokenId0)).to.equal(bidder1.address);
  });

  it("Should handle multiple offers, withdrawals, and accepts correctly", async function () {
    await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
    await xrc721.mintAndListForSale(owner.address, tokenId1, price2, "tokenURI2");

    // Bidder1 makes an offer on tokenId0
    await xrc721.connect(bidder1).makeOffer(tokenId0, { value: price1 });

    // Bidder2 makes an offer on tokenId0
    await xrc721.connect(bidder2).makeOffer(tokenId0, { value: price2 });

    // Bidder3 makes an offer on tokenId1
    await xrc721.connect(bidder3).makeOffer(tokenId1, { value: price1 });

    // Verify the offers
    let offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
    expect(offers1.length).to.equal(2);
    expect(offers1[0].bidder).to.equal(bidder1.address);
    expect(offers1[1].bidder).to.equal(bidder2.address);

    let offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(1);
    expect(offers2[0].bidder).to.equal(bidder3.address);

    // Bidder1 withdraws their offer on tokenId0
    await xrc721.connect(bidder1).withdrawOffer(tokenId0);

    // Verify the offers after withdrawal
    offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
    expect(offers1.length).to.equal(1);
    expect(offers1[0].bidder).to.equal(bidder2.address);

    // Owner accepts Bidder2's offer on tokenId0
    await xrc721.connect(owner).acceptOffer(tokenId0, bidder2.address);

    // Verify the offers and ownership after acceptance
    offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
    expect(offers1.length).to.equal(0);
    expect(await xrc721.ownerOf(tokenId0)).to.equal(bidder2.address);

    // Verify the offers for tokenId1 remain unchanged
    offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(1);
    expect(offers2[0].bidder).to.equal(bidder3.address);

    // Bidder2 makes an offer on tokenId1
    await xrc721.connect(bidder2).makeOffer(tokenId1, { value: price2 });

    // Verify the offers after the new offer
    offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(2);
    expect(offers2[0].bidder).to.equal(bidder3.address);
    expect(offers2[1].bidder).to.equal(bidder2.address);

    // Bidder3 withdraws their offer on tokenId1
    await xrc721.connect(bidder3).withdrawOffer(tokenId1);

    // Verify the offers after withdrawal
    offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(1);
    expect(offers2[0].bidder).to.equal(bidder2.address);

    // Owner accepts Bidder2's offer on tokenId1
    await xrc721.connect(owner).acceptOffer(tokenId1, bidder2.address);

    // Verify the offers and ownership after acceptance
    offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(0);
    expect(await xrc721.ownerOf(tokenId1)).to.equal(bidder2.address);
  });


it("Should handle multiple offers, withdrawals, and accepts correctly with four bidders", async function () {
  // Mint and list multiple tokens
  await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
  await xrc721.mintAndListForSale(owner.address, tokenId1, price2, "tokenURI2");
  await xrc721.mintAndListForSale(owner.address, tokenId2, price3, "tokenURI3");

  // Helper function to verify offers
  const verifyOffers = async (tokenId, expectedOffers) => {
    const offers = await xrc721.getOffersForToken(tokenId, 0, 10, true);
    expect(offers.length).to.equal(expectedOffers.length);
    for (let i = 0; i < expectedOffers.length; i++) {
      expect(offers[i].bidder).to.equal(expectedOffers[i].bidder);
      expect(offers[i].price).to.equal(expectedOffers[i].price);
    }
  };

  // Bidder1 makes offers
  await xrc721.connect(bidder1).makeOffer(tokenId0, { value: price1 });
  await verifyOffers(tokenId0, [{ bidder: bidder1.address, price: price1 }]);
  await verifyOffers(tokenId1, []);
  await verifyOffers(tokenId2, []);

  await xrc721.connect(bidder1).makeOffer(tokenId1, { value: price2 });
  await verifyOffers(tokenId0, [{ bidder: bidder1.address, price: price1 }]);
  await verifyOffers(tokenId1, [{ bidder: bidder1.address, price: price2 }]);
  await verifyOffers(tokenId2, []);

  // Bidder2 makes offers
  await xrc721.connect(bidder2).makeOffer(tokenId0, { value: price2 });
  await verifyOffers(tokenId0, [
    { bidder: bidder1.address, price: price1 },
    { bidder: bidder2.address, price: price2 }
  ]);
  await verifyOffers(tokenId1, [{ bidder: bidder1.address, price: price2 }]);
  await verifyOffers(tokenId2, []);

  await xrc721.connect(bidder2).makeOffer(tokenId2, { value: price1 });
  await verifyOffers(tokenId0, [
    { bidder: bidder1.address, price: price1 },
    { bidder: bidder2.address, price: price2 }
  ]);
  await verifyOffers(tokenId1, [{ bidder: bidder1.address, price: price2 }]);
  await verifyOffers(tokenId2, [{ bidder: bidder2.address, price: price1 }]);

  // Bidder3 makes offers
  await xrc721.connect(bidder3).makeOffer(tokenId0, { value: price3 });
  await xrc721.connect(bidder3).makeOffer(tokenId1, { value: price1 });
  await verifyOffers(tokenId0, [
    { bidder: bidder1.address, price: price1 },
    { bidder: bidder2.address, price: price2 },
    { bidder: bidder3.address, price: price3 }
  ]);
  await verifyOffers(tokenId1, [
    { bidder: bidder3.address, price: price1 },
    { bidder: bidder1.address, price: price2 }
  ]);
  await verifyOffers(tokenId2, [{ bidder: bidder2.address, price: price1 }]);

  // Bidder4 makes offers
  await xrc721.connect(bidder4).makeOffer(tokenId0, { value: price2 });
  await xrc721.connect(bidder4).makeOffer(tokenId2, { value: price3 });
  await verifyOffers(tokenId0, [
    { bidder: bidder1.address, price: price1 },
    { bidder: bidder2.address, price: price2 },
    { bidder: bidder4.address, price: price2 },
    { bidder: bidder3.address, price: price3 }
  ]);
  await verifyOffers(tokenId1, [
    { bidder: bidder3.address, price: price1 },
    { bidder: bidder1.address, price: price2 }
  ]);
  await verifyOffers(tokenId2, [
    { bidder: bidder2.address, price: price1 },
    { bidder: bidder4.address, price: price3 }
  ]);

  // Bidder1 withdraws offer on tokenId0
  await xrc721.connect(bidder1).withdrawOffer(tokenId0);
  await verifyOffers(tokenId0, [
    { bidder: bidder2.address, price: price2 },
    { bidder: bidder4.address, price: price2 },
    { bidder: bidder3.address, price: price3 }
  ]);
  await verifyOffers(tokenId1, [
    { bidder: bidder3.address, price: price1 },
    { bidder: bidder1.address, price: price2 }
  ]);
  await verifyOffers(tokenId2, [
    { bidder: bidder2.address, price: price1 },
    { bidder: bidder4.address, price: price3 }
  ]);

  // Owner accepts Bidder2's offer on tokenId0
  await xrc721.connect(owner).acceptOffer(tokenId0, bidder2.address);
  await verifyOffers(tokenId0, [
    { bidder: bidder4.address, price: price2 },
    { bidder: bidder3.address, price: price3 }
  ]);
  expect(await xrc721.ownerOf(tokenId0)).to.equal(bidder2.address);

  // Bidder3 withdraws offer on tokenId1
  await xrc721.connect(bidder3).withdrawOffer(tokenId1);
  await verifyOffers(tokenId0, [
    { bidder: bidder4.address, price: price2 },
    { bidder: bidder3.address, price: price3 }
  ]);
  await verifyOffers(tokenId1, [{ bidder: bidder1.address, price: price2 }]);
  await verifyOffers(tokenId2, [
    { bidder: bidder2.address, price: price1 },
    { bidder: bidder4.address, price: price3 }
  ]);

  // Owner accepts Bidder4's offer on tokenId2
  await xrc721.connect(owner).acceptOffer(tokenId2, bidder4.address);
  await verifyOffers(tokenId0, [
    { bidder: bidder4.address, price: price2 },
    { bidder: bidder3.address, price: price3 }
  ]);
  await verifyOffers(tokenId1, [{ bidder: bidder1.address, price: price2 }]);
  await verifyOffers(tokenId2, [{ bidder: bidder2.address, price: price1 }]); 
  expect(await xrc721.ownerOf(tokenId2)).to.equal(bidder4.address);

  // Final state verification
  await verifyOffers(tokenId0, [
    { bidder: bidder4.address, price: price2 },
    { bidder: bidder3.address, price: price3 }
  ]);
  await verifyOffers(tokenId1, [{ bidder: bidder1.address, price: price2 }]);
  await verifyOffers(tokenId2, [{ bidder: bidder2.address, price: price1 }]); 
  expect(await xrc721.ownerOf(tokenId0)).to.equal(bidder2.address);
  expect(await xrc721.ownerOf(tokenId1)).to.equal(owner.address);
  expect(await xrc721.ownerOf(tokenId2)).to.equal(bidder4.address);
});

  // it("Should handle multiple offers, withdrawals, and accepts in a complicated scenario", async function () {
  //   // Mint and list multiple tokens
  //   await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
  //   await xrc721.mintAndListForSale(owner.address, tokenId1, price2, "tokenURI2");
  //   await xrc721.mintAndListForSale(owner.address, tokenId2, price3, "tokenURI3");

  //   // Bidder1 makes an offer on tokenId0
  //   await xrc721.connect(bidder1).makeOffer(tokenId0, { value: price1 });

  //   // Bidder2 makes offers on tokenId0 and tokenId1
  //   await xrc721.connect(bidder2).makeOffer(tokenId0, { value: price2 });
  //   await xrc721.connect(bidder2).makeOffer(tokenId1, { value: price3 });

  //   // Bidder3 makes offers on tokenId0, tokenId1, and tokenId2
  //   await xrc721.connect(bidder3).makeOffer(tokenId0, { value: price3 });
  //   await xrc721.connect(bidder3).makeOffer(tokenId1, { value: price1 });
  //   await xrc721.connect(bidder3).makeOffer(tokenId2, { value: price2 });

  //   // Verify the offers for each token
  //   let offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
  //   expect(offers1.length).to.equal(3);
  //   expect(offers1[0].bidder).to.equal(bidder1.address);
  //   expect(offers1[1].bidder).to.equal(bidder2.address);
  //   expect(offers1[2].bidder).to.equal(bidder3.address);

  //   let offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
  //   expect(offers2.length).to.equal(2);
  //   expect(offers2[0].bidder).to.equal(bidder2.address);
  //   expect(offers2[1].bidder).to.equal(bidder3.address);

  //   let offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
  //   expect(offers3.length).to.equal(1);
  //   expect(offers3[0].bidder).to.equal(bidder3.address);

  //   // Bidder1 withdraws their offer on tokenId0
  //   await xrc721.connect(bidder1).withdrawOffer(tokenId0);

  //   // Verify the offers after withdrawal
  //   offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
  //   expect(offers1.length).to.equal(2);
  //   expect(offers1[0].bidder).to.equal(bidder3.address);
  //   expect(offers1[1].bidder).to.equal(bidder2.address);

  //   // Owner accepts Bidder2's offer on tokenId0
  //   await xrc721.connect(owner).acceptOffer(tokenId0, bidder2.address);

  //   // Verify the offers and ownership after acceptance
  //   offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
  //   expect(offers1.length).to.equal(1);
  //   expect(await xrc721.ownerOf(tokenId0)).to.equal(bidder2.address);

  //   // Verify the offers for tokenId1 and tokenId2 remain unchanged
  //   offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
  //   expect(offers2.length).to.equal(2);
  //   expect(offers2[0].bidder).to.equal(bidder2.address);
  //   expect(offers2[1].bidder).to.equal(bidder3.address);

  //   offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
  //   expect(offers3.length).to.equal(1);
  //   expect(offers3[0].bidder).to.equal(bidder3.address);

  //   // Bidder3 withdraws their offer on tokenId1
  //   await xrc721.connect(bidder3).withdrawOffer(tokenId1);

  //   // Verify the offers after withdrawal
  //   offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
  //   expect(offers2.length).to.equal(1);
  //   expect(offers2[0].bidder).to.equal(bidder2.address);

  //   // Owner accepts Bidder2's offer on tokenId1
  //   await xrc721.connect(owner).acceptOffer(tokenId1, bidder2.address);

  //   // Verify the offers and ownership after acceptance
  //   offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
  //   expect(offers2.length).to.equal(0);
  //   expect(await xrc721.ownerOf(tokenId1)).to.equal(bidder2.address);

  //   // Bidder1 makes a new offer on tokenId2
  //   await xrc721.connect(bidder1).makeOffer(tokenId2, { value: price1 });

  //   // Verify the offers after new offer
  //   offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
  //   expect(offers3.length).to.equal(2);
  //   expect(offers3[0].bidder).to.equal(bidder3.address);
  //   expect(offers3[1].bidder).to.equal(bidder1.address);

  //   // Owner accepts Bidder3's offer on tokenId2
  //   await xrc721.connect(owner).acceptOffer(tokenId2, bidder3.address);

  //   // Verify the offers and ownership after acceptance
  //   offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
  //   expect(offers3.length).to.equal(1);
  //   expect(await xrc721.ownerOf(tokenId2)).to.equal(bidder3.address);

  //   // // Verify that no offers remain for any tokens
  //   // offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
  //   // expect(offers1.length).to.equal(1);

  //   // offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
  //   // expect(offers2.length).to.equal(0);

  //   // offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
  //   // expect(offers3.length).to.equal(1);
  // });
  it("Should handle multiple offers, withdrawals, and accepts in a complicated scenario", async function () {
    // Mint and list multiple tokens
    await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
    await xrc721.mintAndListForSale(owner.address, tokenId1, price2, "tokenURI2");
    await xrc721.mintAndListForSale(owner.address, tokenId2, price3, "tokenURI3");
  
    // Bidder1 makes an offer on tokenId0
    await xrc721.connect(bidder1).makeOffer(tokenId0, { value: price1 });
  
    // Bidder2 makes offers on tokenId0 and tokenId1
    await xrc721.connect(bidder2).makeOffer(tokenId0, { value: price2 });
    await xrc721.connect(bidder2).makeOffer(tokenId1, { value: price3 });
  
    // Bidder3 makes offers on tokenId0, tokenId1, and tokenId2
    await xrc721.connect(bidder3).makeOffer(tokenId0, { value: price3 });
    await xrc721.connect(bidder3).makeOffer(tokenId1, { value: price1 });
    await xrc721.connect(bidder3).makeOffer(tokenId2, { value: price2 });
  
    // Verify the offers for each token (sorted from lowest to highest price)
    let offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
    expect(offers1.length).to.equal(3);
    expect(offers1[0].bidder).to.equal(bidder1.address); // Lowest price (price1)
    expect(offers1[1].bidder).to.equal(bidder2.address); // Middle price (price2)
    expect(offers1[2].bidder).to.equal(bidder3.address); // Highest price (price3)
  
    let offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(2);
    expect(offers2[0].bidder).to.equal(bidder3.address); // Lower price (price1)
    expect(offers2[1].bidder).to.equal(bidder2.address); // Higher price (price3)
  
    let offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
    expect(offers3.length).to.equal(1);
    expect(offers3[0].bidder).to.equal(bidder3.address);
  
    // Bidder1 withdraws their offer on tokenId0
    await xrc721.connect(bidder1).withdrawOffer(tokenId0);
  
    // Verify the offers after withdrawal
    offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
    expect(offers1.length).to.equal(2);
    expect(offers1[0].bidder).to.equal(bidder2.address); // Lower price (price2)
    expect(offers1[1].bidder).to.equal(bidder3.address); // Higher price (price3)
  
    // Owner accepts Bidder2's offer (lowest remaining) on tokenId0
    await xrc721.connect(owner).acceptOffer(tokenId0, bidder2.address);
  
    // Verify the offers and ownership after acceptance
    offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
    expect(offers1.length).to.equal(1);
    expect(await xrc721.ownerOf(tokenId0)).to.equal(bidder2.address);
  
    // Verify the offers for tokenId1 and tokenId2 remain unchanged
    offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(2);
    expect(offers2[0].bidder).to.equal(bidder3.address);
    expect(offers2[1].bidder).to.equal(bidder2.address);
  
    offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
    expect(offers3.length).to.equal(1);
    expect(offers3[0].bidder).to.equal(bidder3.address);
  
    // Bidder3 withdraws their offer on tokenId1
    await xrc721.connect(bidder3).withdrawOffer(tokenId1);
  
    // Verify the offers after withdrawal
    offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(1);
    expect(offers2[0].bidder).to.equal(bidder2.address);
  
    // Owner accepts Bidder2's offer on tokenId1
    await xrc721.connect(owner).acceptOffer(tokenId1, bidder2.address);
  
    // Verify the offers and ownership after acceptance
    offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(0);
    expect(await xrc721.ownerOf(tokenId1)).to.equal(bidder2.address);
  
    // Bidder1 makes a new offer on tokenId2
    await xrc721.connect(bidder1).makeOffer(tokenId2, { value: price1 });
  
    // Verify the offers after new offer
    offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
    expect(offers3.length).to.equal(2);
    expect(offers3[0].bidder).to.equal(bidder1.address); // Lower price (price1)
    expect(offers3[1].bidder).to.equal(bidder3.address); // Higher price (price2)
  
    // Owner accepts Bidder1's offer (lowest) on tokenId2
    await xrc721.connect(owner).acceptOffer(tokenId2, bidder1.address);
  
    // Verify the offers and ownership after acceptance
    offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
    expect(offers3.length).to.equal(1);
    expect(await xrc721.ownerOf(tokenId2)).to.equal(bidder1.address);
  
    // Verify remaining offers
    offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
    expect(offers1.length).to.equal(1);
  
    offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(0);
  
    offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
    expect(offers3.length).to.equal(1);
  });

  // it("Should handle a highly complex scenario with multiple offers, withdrawals, and acceptances", async function () {
  //   // Mint and list multiple tokens
  //   await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
  //   await xrc721.mintAndListForSale(owner.address, tokenId1, price2, "tokenURI2");
  //   await xrc721.mintAndListForSale(owner.address, tokenId2, price3, "tokenURI3");
  //   await xrc721.mintAndListForSale(owner.address, tokenId3, price4, "tokenURI4");

  //   // Bidder1 makes offers on all tokens
  //   await xrc721.connect(bidder1).makeOffer(tokenId0, { value: price1 });
  //   await xrc721.connect(bidder1).makeOffer(tokenId1, { value: price2 });
  //   await xrc721.connect(bidder1).makeOffer(tokenId2, { value: price3 });
  //   await xrc721.connect(bidder1).makeOffer(tokenId3, { value: price4 });

  //   // Bidder2 makes offers on tokenId0 and tokenId1
  //   await xrc721.connect(bidder2).makeOffer(tokenId0, { value: price2 });
  //   await xrc721.connect(bidder2).makeOffer(tokenId1, { value: price3 });

  //   // Bidder3 makes offers on tokenId2 and tokenId3
  //   await xrc721.connect(bidder3).makeOffer(tokenId2, { value: price2 });
  //   await xrc721.connect(bidder3).makeOffer(tokenId3, { value: price1 });

  //   // Bidder4 makes offers on all tokens
  //   await xrc721.connect(bidder4).makeOffer(tokenId0, { value: price3 });
  //   await xrc721.connect(bidder4).makeOffer(tokenId1, { value: price4 });
  //   await xrc721.connect(bidder4).makeOffer(tokenId2, { value: price4 });
  //   await xrc721.connect(bidder4).makeOffer(tokenId3, { value: price3 });

  //   // Verify initial offers
  //   let offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
  //   expect(offers1.length).to.equal(3);
  //   expect(offers1[0].bidder).to.equal(bidder1.address);
  //   expect(offers1[1].bidder).to.equal(bidder2.address);
  //   expect(offers1[2].bidder).to.equal(bidder4.address);

  //   let offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
  //   expect(offers2.length).to.equal(3);
  //   expect(offers2[0].bidder).to.equal(bidder1.address);
  //   expect(offers2[1].bidder).to.equal(bidder2.address);
  //   expect(offers2[2].bidder).to.equal(bidder4.address);

  //   let offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
  //   expect(offers3.length).to.equal(3);
  //   expect(offers3[0].bidder).to.equal(bidder1.address);
  //   expect(offers3[1].bidder).to.equal(bidder3.address);
  //   expect(offers3[2].bidder).to.equal(bidder4.address);

  //   let offers4 = await xrc721.getOffersForToken(tokenId3, 0, 10, true);
  //   expect(offers4.length).to.equal(3);
  //   expect(offers4[0].bidder).to.equal(bidder1.address);
  //   expect(offers4[1].bidder).to.equal(bidder3.address);
  //   expect(offers4[2].bidder).to.equal(bidder4.address);

  //   // Bidder1 withdraws their offer on tokenId0
  //   await xrc721.connect(bidder1).withdrawOffer(tokenId0);

  //   // Verify offers after withdrawal
  //   offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
  //   expect(offers1.length).to.equal(2);
  //   expect(offers1[0].bidder).to.equal(bidder4.address); // Swapped in place of bidder1
  //   expect(offers1[1].bidder).to.equal(bidder2.address);

  //   // Owner accepts Bidder2's offer on tokenId0
  //   await xrc721.connect(owner).acceptOffer(tokenId0, bidder2.address);

  //   // Verify offers and ownership after acceptance
  //   offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
  //   expect(offers1.length).to.equal(1); // Only Bidder4's offer remains
  //   expect(offers1[0].bidder).to.equal(bidder4.address); // Bidder4's offer remains
  //   expect(await xrc721.ownerOf(tokenId0)).to.equal(bidder2.address);

  //   // Bidder4 withdraws their offers on tokenId1 and tokenId3
  //   await xrc721.connect(bidder4).withdrawOffer(tokenId1);
  //   await xrc721.connect(bidder4).withdrawOffer(tokenId3);

  //   // Verify offers after withdrawals
  //   offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
  //   expect(offers2.length).to.equal(2);
  //   expect(offers2[0].bidder).to.equal(bidder1.address);
  //   expect(offers2[1].bidder).to.equal(bidder2.address);

  //   offers4 = await xrc721.getOffersForToken(tokenId3, 0, 10, true);
  //   expect(offers4.length).to.equal(2);
  //   expect(offers4[0].bidder).to.equal(bidder1.address);
  //   expect(offers4[1].bidder).to.equal(bidder3.address);

  //   // Owner accepts Bidder3's offer on tokenId2
  //   await xrc721.connect(owner).acceptOffer(tokenId2, bidder3.address);

  //   // Verify offers and ownership after acceptance
  //   offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
  //   expect(offers3.length).to.equal(2); // Bidder1's and Bidder4's offers remain
  //   expect(offers3[0].bidder).to.equal(bidder1.address);
  //   expect(offers3[1].bidder).to.equal(bidder4.address);
  //   expect(await xrc721.ownerOf(tokenId2)).to.equal(bidder3.address);

  //   // Bidder1 withdraws their remaining offers on tokenId1, tokenId2, and tokenId3
  //   await xrc721.connect(bidder1).withdrawOffer(tokenId1);
  //   await xrc721.connect(bidder1).withdrawOffer(tokenId2);
  //   await xrc721.connect(bidder1).withdrawOffer(tokenId3);

  //   // Verify offers after withdrawals
  //   offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
  //   expect(offers2.length).to.equal(1);
  //   expect(offers2[0].bidder).to.equal(bidder2.address);

  //   offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
  //   expect(offers3.length).to.equal(1);
  //   expect(offers3[0].bidder).to.equal(bidder4.address);

  //   offers4 = await xrc721.getOffersForToken(tokenId3, 0, 10, true);
  //   expect(offers4.length).to.equal(1);
  //   expect(offers4[0].bidder).to.equal(bidder3.address);

  //   // Owner accepts Bidder2's offer on tokenId1
  //   await xrc721.connect(owner).acceptOffer(tokenId1, bidder2.address);

  //   // Verify offers and ownership after acceptance
  //   offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
  //   expect(offers2.length).to.equal(0);
  //   expect(await xrc721.ownerOf(tokenId1)).to.equal(bidder2.address);

  //   // Verify the final state of offers
  //   offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
  //   expect(offers1.length).to.equal(1);
  //   expect(offers1[0].bidder).to.equal(bidder4.address);

  //   offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
  //   expect(offers2.length).to.equal(0);

  //   offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
  //   expect(offers3.length).to.equal(1);
  //   expect(offers3[0].bidder).to.equal(bidder4.address);

  //   offers4 = await xrc721.getOffersForToken(tokenId3, 0, 10, true);
  //   expect(offers4.length).to.equal(1);
  //   expect(offers4[0].bidder).to.equal(bidder3.address);
  // });
  it("Should handle a highly complex scenario with multiple offers, withdrawals, and acceptances", async function () {
    // Mint and list multiple tokens
    await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
    await xrc721.mintAndListForSale(owner.address, tokenId1, price2, "tokenURI2");
    await xrc721.mintAndListForSale(owner.address, tokenId2, price3, "tokenURI3");
    await xrc721.mintAndListForSale(owner.address, tokenId3, price4, "tokenURI4");
  
    // Bidder1 makes offers on all tokens
    await xrc721.connect(bidder1).makeOffer(tokenId0, { value: price1 });
    await xrc721.connect(bidder1).makeOffer(tokenId1, { value: price2 });
    await xrc721.connect(bidder1).makeOffer(tokenId2, { value: price3 });
    await xrc721.connect(bidder1).makeOffer(tokenId3, { value: price4 });
  
    // Bidder2 makes offers on tokenId0 and tokenId1
    await xrc721.connect(bidder2).makeOffer(tokenId0, { value: price2 });
    await xrc721.connect(bidder2).makeOffer(tokenId1, { value: price3 });
  
    // Bidder3 makes offers on tokenId2 and tokenId3
    await xrc721.connect(bidder3).makeOffer(tokenId2, { value: price2 });
    await xrc721.connect(bidder3).makeOffer(tokenId3, { value: price1 });
  
    // Bidder4 makes offers on all tokens
    await xrc721.connect(bidder4).makeOffer(tokenId0, { value: price3 });
    await xrc721.connect(bidder4).makeOffer(tokenId1, { value: price4 });
    await xrc721.connect(bidder4).makeOffer(tokenId2, { value: price4 });
    await xrc721.connect(bidder4).makeOffer(tokenId3, { value: price3 });
  
    // Verify initial offers
    let offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
    expect(offers1.length).to.equal(3);
    expect(offers1[0].bidder).to.equal(bidder1.address); // Lowest price (price1)
    expect(offers1[1].bidder).to.equal(bidder2.address); // Middle price (price2)
    expect(offers1[2].bidder).to.equal(bidder4.address); // Highest price (price3)
  
    let offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(3);
    expect(offers2[0].bidder).to.equal(bidder1.address); // Lowest price (price2)
    expect(offers2[1].bidder).to.equal(bidder2.address); // Middle price (price3)
    expect(offers2[2].bidder).to.equal(bidder4.address); // Highest price (price4)
  
    let offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
    expect(offers3.length).to.equal(3);
    expect(offers3[0].bidder).to.equal(bidder3.address); // Lowest price (price2)
    expect(offers3[1].bidder).to.equal(bidder1.address); // Middle price (price3)
    expect(offers3[2].bidder).to.equal(bidder4.address); // Highest price (price4)
  
    let offers4 = await xrc721.getOffersForToken(tokenId3, 0, 10, true);
    expect(offers4.length).to.equal(3);
    expect(offers4[0].bidder).to.equal(bidder3.address); // Lowest price (price1)
    expect(offers4[1].bidder).to.equal(bidder4.address); // Middle price (price4)
    expect(offers4[2].bidder).to.equal(bidder1.address); // Highest price (price3)
  
    // Bidder1 withdraws their offer on tokenId0
    await xrc721.connect(bidder1).withdrawOffer(tokenId0);
  
    // Verify offers after withdrawal
    offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
    expect(offers1.length).to.equal(2);
    expect(offers1[0].bidder).to.equal(bidder2.address); // Now the lowest (price2)
    expect(offers1[1].bidder).to.equal(bidder4.address); // Highest (price3)
  
    // Owner accepts Bidder2's offer on tokenId0
    await xrc721.connect(owner).acceptOffer(tokenId0, bidder2.address);
  
    // Verify offers and ownership after acceptance
    offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
    expect(offers1.length).to.equal(1); // Only Bidder4's offer remains
    expect(offers1[0].bidder).to.equal(bidder4.address); // Bidder4's offer remains
    expect(await xrc721.ownerOf(tokenId0)).to.equal(bidder2.address);
  
    // Bidder4 withdraws their offers on tokenId1 and tokenId3
    await xrc721.connect(bidder4).withdrawOffer(tokenId1);
    await xrc721.connect(bidder4).withdrawOffer(tokenId3);
  
    // Verify offers after withdrawals
    offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(2);
    expect(offers2[0].bidder).to.equal(bidder1.address); // Lower price (price2)
    expect(offers2[1].bidder).to.equal(bidder2.address); // Higher price (price3)
  
    offers4 = await xrc721.getOffersForToken(tokenId3, 0, 10, true);
    expect(offers4.length).to.equal(2);
    expect(offers4[0].bidder).to.equal(bidder3.address); // Lower price (price1)
    expect(offers4[1].bidder).to.equal(bidder1.address); // Higher price (price4)
  
    // Owner accepts Bidder3's offer on tokenId2
    await xrc721.connect(owner).acceptOffer(tokenId2, bidder3.address);
  
    // Verify offers and ownership after acceptance
    offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
    expect(offers3.length).to.equal(2); // Bidder1's and Bidder4's offers remain
    expect(offers3[0].bidder).to.equal(bidder1.address); // Lower price (price3)
    expect(offers3[1].bidder).to.equal(bidder4.address); // Higher price (price4)
    expect(await xrc721.ownerOf(tokenId2)).to.equal(bidder3.address);
  
    // Bidder1 withdraws their remaining offers on tokenId1, tokenId2, and tokenId3
    await xrc721.connect(bidder1).withdrawOffer(tokenId1);
    await xrc721.connect(bidder1).withdrawOffer(tokenId2);
    await xrc721.connect(bidder1).withdrawOffer(tokenId3);
  
    // Verify offers after withdrawals
    offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(1);
    expect(offers2[0].bidder).to.equal(bidder2.address);
  
    offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
    expect(offers3.length).to.equal(1);
    expect(offers3[0].bidder).to.equal(bidder4.address);
  
    offers4 = await xrc721.getOffersForToken(tokenId3, 0, 10, true);
    expect(offers4.length).to.equal(1);
    expect(offers4[0].bidder).to.equal(bidder3.address);
  
    // Owner accepts Bidder2's offer on tokenId1
    await xrc721.connect(owner).acceptOffer(tokenId1, bidder2.address);
  
    // Verify offers and ownership after acceptance
    offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(0);
    expect(await xrc721.ownerOf(tokenId1)).to.equal(bidder2.address);
  
    // Verify the final state of offers
    offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
    expect(offers1.length).to.equal(1);
    expect(offers1[0].bidder).to.equal(bidder4.address);
  
    offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(0);
  
    offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
    expect(offers3.length).to.equal(1);
    expect(offers3[0].bidder).to.equal(bidder4.address);
  
    offers4 = await xrc721.getOffersForToken(tokenId3, 0, 10, true);
    expect(offers4.length).to.equal(1);
    expect(offers4[0].bidder).to.equal(bidder3.address);
  });

  // it("Should handle a highly complex scenario with multiple offers, withdrawals, acceptances, and sales", async function () {
  //   // Mint and list multiple tokens
  //   await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
  //   await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId1, price2, "tokenURI2");
  //   await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId2, price3, "tokenURI3");
  //   await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId3, price4, "tokenURI4");

  //   // Bidder1 makes offers on all tokens
  //   await xrc721.connect(bidder1).makeOffer(tokenId0, { value: price1 });
  //   await xrc721.connect(bidder1).makeOffer(tokenId1, { value: price2 });
  //   await xrc721.connect(bidder1).makeOffer(tokenId2, { value: price3 });
  //   await xrc721.connect(bidder1).makeOffer(tokenId3, { value: price4 });

  //   // Bidder2 makes offers on tokenId0 and tokenId1
  //   await xrc721.connect(bidder2).makeOffer(tokenId0, { value: price2 });
  //   await xrc721.connect(bidder2).makeOffer(tokenId1, { value: price3 });

  //   // Bidder3 makes offers on tokenId2 and tokenId3
  //   await xrc721.connect(bidder3).makeOffer(tokenId2, { value: price2 });
  //   await xrc721.connect(bidder3).makeOffer(tokenId3, { value: price1 });

  //   // Bidder4 makes offers on all tokens
  //   await xrc721.connect(bidder4).makeOffer(tokenId0, { value: price3 });
  //   await xrc721.connect(bidder4).makeOffer(tokenId1, { value: price4 });
  //   await xrc721.connect(bidder4).makeOffer(tokenId2, { value: price4 });
  //   await xrc721.connect(bidder4).makeOffer(tokenId3, { value: price3 });

  //   // Verify initial offers
  //   let offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
  //   expect(offers1.length).to.equal(3);
  //   expect(offers1[0].bidder).to.equal(bidder1.address);
  //   expect(offers1[1].bidder).to.equal(bidder2.address);
  //   expect(offers1[2].bidder).to.equal(bidder4.address);

  //   let offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
  //   expect(offers2.length).to.equal(3);
  //   expect(offers2[0].bidder).to.equal(bidder1.address);
  //   expect(offers2[1].bidder).to.equal(bidder2.address);
  //   expect(offers2[2].bidder).to.equal(bidder4.address);

  //   let offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
  //   expect(offers3.length).to.equal(3);
  //   expect(offers3[0].bidder).to.equal(bidder1.address);
  //   expect(offers3[1].bidder).to.equal(bidder3.address);
  //   expect(offers3[2].bidder).to.equal(bidder4.address);

  //   let offers4 = await xrc721.getOffersForToken(tokenId3, 0, 10, true);
  //   expect(offers4.length).to.equal(3);
  //   expect(offers4[0].bidder).to.equal(bidder1.address);
  //   expect(offers4[1].bidder).to.equal(bidder3.address);
  //   expect(offers4[2].bidder).to.equal(bidder4.address);

  //   // Bidder1 withdraws their offer on tokenId0
  //   await xrc721.connect(bidder1).withdrawOffer(tokenId0);

  //   // Verify offers after withdrawal
  //   offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
  //   expect(offers1.length).to.equal(2);
  //   expect(offers1[0].bidder).to.equal(bidder4.address); // Swapped in place of bidder1
  //   expect(offers1[1].bidder).to.equal(bidder2.address);

  //   // Owner accepts Bidder2's offer on tokenId0
  //   await xrc721.connect(owner).acceptOffer(tokenId0, bidder2.address);

  //   // Verify offers and ownership after acceptance
  //   offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
  //   expect(offers1.length).to.equal(1); // Only Bidder4's offer remains
  //   expect(offers1[0].bidder).to.equal(bidder4.address); // Bidder4's offer remains
  //   expect(await xrc721.ownerOf(tokenId0)).to.equal(bidder2.address);

  //   // Buyer1 buys tokenId0 from Bidder2
  //   await xrc721.connect(bidder2).listTokenForSale(tokenId0, price2);
  //   await xrc721.connect(buyer1).buyToken(tokenId0, { value: price2 });

  //   // Verify ownership after purchase
  //   expect(await xrc721.ownerOf(tokenId0)).to.equal(buyer1.address);

  //   // Verify sales history for tokenId0
  //   let salesHistory1 = await xrc721.getTokenSalesHistory(tokenId0, 0, 10, true);
  //   expect(salesHistory1.length).to.equal(2); // 2 sales: owner to bidder2, bidder2 to buyer1
  //   expect(salesHistory1[0].seller).to.equal(owner.address);
  //   expect(salesHistory1[0].buyer).to.equal(bidder2.address);
  //   expect(salesHistory1[1].seller).to.equal(bidder2.address);
  //   expect(salesHistory1[1].buyer).to.equal(buyer1.address);

  //   // Mint another token and list it for sale
  //   await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId4, price5, "tokenURI5");

  //   // Bidder3 makes an offer on tokenId4
  //   await xrc721.connect(bidder3).makeOffer(tokenId4, { value: price3 });

  //   // Verify offer on tokenId4
  //   let offers5 = await xrc721.getOffersForToken(tokenId4, 0, 10, true);
  //   expect(offers5.length).to.equal(1);
  //   expect(offers5[0].bidder).to.equal(bidder3.address);

  //   // Owner accepts Bidder3's offer on tokenId2
  //   await xrc721.connect(owner).acceptOffer(tokenId2, bidder3.address);

  //   // Verify offers and ownership after acceptance
  //   offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
  //   expect(offers3.length).to.equal(2); // Bidder1's and Bidder4's offers remain
  //   expect(offers3[0].bidder).to.equal(bidder1.address);
  //   expect(offers3[1].bidder).to.equal(bidder4.address);
  //   expect(await xrc721.ownerOf(tokenId2)).to.equal(bidder3.address);

  //   // Bidder4 withdraws their offers on tokenId1 and tokenId3
  //   await xrc721.connect(bidder4).withdrawOffer(tokenId1);
  //   await xrc721.connect(bidder4).withdrawOffer(tokenId3);

  //   // Verify offers after withdrawals
  //   offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
  //   expect(offers2.length).to.equal(2);
  //   expect(offers2[0].bidder).to.equal(bidder1.address);
  //   expect(offers2[1].bidder).to.equal(bidder2.address);

  //   offers4 = await xrc721.getOffersForToken(tokenId3, 0, 10, true);
  //   expect(offers4.length).to.equal(2);
  //   expect(offers4[0].bidder).to.equal(bidder1.address);
  //   expect(offers4[1].bidder).to.equal(bidder3.address);

  //   // Verify tokens metadata
  //   let metadata = await xrc721.getTokensMetadata(0, 5);
  //   // let answer = await xrc721.tokenURI(0);
  //   // console.log("aaaaa:" + answer);
  //   expect(metadata.length).to.equal(5);
  //   expect(metadata[0]).to.equal("tokenURI1");
  //   expect(metadata[1]).to.equal("tokenURI2");
  //   expect(metadata[2]).to.equal("tokenURI3");
  //   expect(metadata[3]).to.equal("tokenURI4");
  //   expect(metadata[4]).to.equal("tokenURI5");

  //   // Bidder1 withdraws their remaining offers on tokenId1, tokenId2, and tokenId3
  //   await xrc721.connect(bidder1).withdrawOffer(tokenId1);
  //   await xrc721.connect(bidder1).withdrawOffer(tokenId2);
  //   await xrc721.connect(bidder1).withdrawOffer(tokenId3);

  //   // Verify offers after withdrawals
  //   offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
  //   expect(offers2.length).to.equal(1);
  //   expect(offers2[0].bidder).to.equal(bidder2.address);

  //   offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
  //   expect(offers3.length).to.equal(1);
  //   expect(offers3[0].bidder).to.equal(bidder4.address);

  //   offers4 = await xrc721.getOffersForToken(tokenId3, 0, 10, true);
  //   expect(offers4.length).to.equal(1);
  //   expect(offers4[0].bidder).to.equal(bidder3.address);

  //   // Owner accepts Bidder2's offer on tokenId1
  //   await xrc721.connect(owner).acceptOffer(tokenId1, bidder2.address);

  //   // Verify offers and ownership after acceptance
  //   offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
  //   expect(offers2.length).to.equal(0);
  //   expect(await xrc721.ownerOf(tokenId1)).to.equal(bidder2.address);

  //   // Verify the final state of offers
  //   offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
  //   expect(offers1.length).to.equal(1);
  //   expect(offers1[0].bidder).to.equal(bidder4.address);

  //   offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
  //   expect(offers2.length).to.equal(0);

  //   offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
  //   expect(offers3.length).to.equal(1);
  //   expect(offers3[0].bidder).to.equal(bidder4.address);

  //   offers4 = await xrc721.getOffersForToken(tokenId3, 0, 10, true);
  //   expect(offers4.length).to.equal(1);
  //   expect(offers4[0].bidder).to.equal(bidder3.address);

  //   offers5 = await xrc721.getOffersForToken(tokenId4, 0, 10, true);
  //   expect(offers5.length).to.equal(1);
  //   expect(offers5[0].bidder).to.equal(bidder3.address);

  //   // Get current offer of address for a specific token
  //   let currentOffer = await xrc721.getCurrentOfferOfAddressForToken(tokenId2, bidder4.address);
  //   expect(currentOffer.bidder).to.equal(bidder4.address);
  //   expect(currentOffer.price).to.equal(price4);
  // });
  it("Should handle a highly complex scenario with multiple offers, withdrawals, acceptances, and sales", async function () {
    // Mint and list multiple tokens
    await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
    await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId1, price2, "tokenURI2");
    await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId2, price3, "tokenURI3");
    await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId3, price4, "tokenURI4");
  
    // Bidder1 makes offers on all tokens
    await xrc721.connect(bidder1).makeOffer(tokenId0, { value: price1 });
    await xrc721.connect(bidder1).makeOffer(tokenId1, { value: price2 });
    await xrc721.connect(bidder1).makeOffer(tokenId2, { value: price3 });
    await xrc721.connect(bidder1).makeOffer(tokenId3, { value: price4 });
  
    // Bidder2 makes offers on tokenId0 and tokenId1
    await xrc721.connect(bidder2).makeOffer(tokenId0, { value: price2 });
    await xrc721.connect(bidder2).makeOffer(tokenId1, { value: price3 });
  
    // Bidder3 makes offers on tokenId2 and tokenId3
    await xrc721.connect(bidder3).makeOffer(tokenId2, { value: price2 });
    await xrc721.connect(bidder3).makeOffer(tokenId3, { value: price1 });
  
    // Bidder4 makes offers on all tokens
    await xrc721.connect(bidder4).makeOffer(tokenId0, { value: price3 });
    await xrc721.connect(bidder4).makeOffer(tokenId1, { value: price4 });
    await xrc721.connect(bidder4).makeOffer(tokenId2, { value: price4 });
    await xrc721.connect(bidder4).makeOffer(tokenId3, { value: price3 });
  
    // Verify initial offers
    let offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
    expect(offers1.length).to.equal(3);
    expect(offers1[0].bidder).to.equal(bidder1.address); // Lowest price (price1)
    expect(offers1[1].bidder).to.equal(bidder2.address); // Middle price (price2)
    expect(offers1[2].bidder).to.equal(bidder4.address); // Highest price (price3)
  
    let offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(3);
    expect(offers2[0].bidder).to.equal(bidder1.address); // Lowest price (price2)
    expect(offers2[1].bidder).to.equal(bidder2.address); // Middle price (price3)
    expect(offers2[2].bidder).to.equal(bidder4.address); // Highest price (price4)
  
    let offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
    expect(offers3.length).to.equal(3);
    expect(offers3[0].bidder).to.equal(bidder3.address); // Lowest price (price2)
    expect(offers3[1].bidder).to.equal(bidder1.address); // Middle price (price3)
    expect(offers3[2].bidder).to.equal(bidder4.address); // Highest price (price4)
  
    let offers4 = await xrc721.getOffersForToken(tokenId3, 0, 10, true);
    expect(offers4.length).to.equal(3);
    expect(offers4[0].bidder).to.equal(bidder3.address); // Lowest price (price1)
    expect(offers4[1].bidder).to.equal(bidder4.address); // Middle price (price4)
    expect(offers4[2].bidder).to.equal(bidder1.address); // Highest price (price3)
  
    // Bidder1 withdraws their offer on tokenId0
    await xrc721.connect(bidder1).withdrawOffer(tokenId0);
  
    // Verify offers after withdrawal
    offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
    expect(offers1.length).to.equal(2);
    expect(offers1[0].bidder).to.equal(bidder2.address); // Now the lowest (price2)
    expect(offers1[1].bidder).to.equal(bidder4.address); // Highest (price3)
  
    // Owner accepts Bidder2's offer on tokenId0
    await xrc721.connect(owner).acceptOffer(tokenId0, bidder2.address);
  
    // Verify offers and ownership after acceptance
    offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
    expect(offers1.length).to.equal(1); // Only Bidder4's offer remains
    expect(offers1[0].bidder).to.equal(bidder4.address); // Bidder4's offer remains
    expect(await xrc721.ownerOf(tokenId0)).to.equal(bidder2.address);
  
    // Buyer1 buys tokenId0 from Bidder2
    await xrc721.connect(bidder2).listTokenForSale(tokenId0, price2);
    await xrc721.connect(buyer1).buyToken(tokenId0, price2, { value: price2 });

    // Verify ownership after purchase
    expect(await xrc721.ownerOf(tokenId0)).to.equal(buyer1.address);
  
    // Verify sales history for tokenId0
    let salesHistory1 = await xrc721.getTokenSalesHistory(tokenId0, 0, 10, true);
    expect(salesHistory1.length).to.equal(2); // 2 sales: owner to bidder2, bidder2 to buyer1
    expect(salesHistory1[0].seller).to.equal(owner.address);
    expect(salesHistory1[0].buyer).to.equal(bidder2.address);
    expect(salesHistory1[1].seller).to.equal(bidder2.address);
    expect(salesHistory1[1].buyer).to.equal(buyer1.address);
  
    // Mint another token and list it for sale
    await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId4, price5, "tokenURI5");
  
    // Bidder3 makes an offer on tokenId4
    await xrc721.connect(bidder3).makeOffer(tokenId4, { value: price3 });
  
    // Verify offer on tokenId4
    let offers5 = await xrc721.getOffersForToken(tokenId4, 0, 10, true);
    expect(offers5.length).to.equal(1);
    expect(offers5[0].bidder).to.equal(bidder3.address);
  
    // Owner accepts Bidder3's offer on tokenId2
    await xrc721.connect(owner).acceptOffer(tokenId2, bidder3.address);
  
    // Verify offers and ownership after acceptance
    offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
    expect(offers3.length).to.equal(2); // Bidder1's and Bidder4's offers remain
    expect(offers3[0].bidder).to.equal(bidder1.address); // Lower price (price3)
    expect(offers3[1].bidder).to.equal(bidder4.address); // Higher price (price4)
    expect(await xrc721.ownerOf(tokenId2)).to.equal(bidder3.address);
  
    // Bidder4 withdraws their offers on tokenId1 and tokenId3
    await xrc721.connect(bidder4).withdrawOffer(tokenId1);
    await xrc721.connect(bidder4).withdrawOffer(tokenId3);
  
    // Verify offers after withdrawals
    offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(2);
    expect(offers2[0].bidder).to.equal(bidder1.address); // Lower price (price2)
    expect(offers2[1].bidder).to.equal(bidder2.address); // Higher price (price3)
  
    offers4 = await xrc721.getOffersForToken(tokenId3, 0, 10, true);
    expect(offers4.length).to.equal(2);
    expect(offers4[0].bidder).to.equal(bidder3.address); // Lower price (price1)
    expect(offers4[1].bidder).to.equal(bidder1.address); // Higher price (price4)
  
    // Verify tokens metadata
    let metadata = await xrc721.getTokensMetadata(0, 5);
    expect(metadata.length).to.equal(5);
    expect(metadata[0]).to.equal("tokenURI1");
    expect(metadata[1]).to.equal("tokenURI2");
    expect(metadata[2]).to.equal("tokenURI3");
    expect(metadata[3]).to.equal("tokenURI4");
    expect(metadata[4]).to.equal("tokenURI5");
  
    // Bidder1 withdraws their remaining offers on tokenId1, tokenId2, and tokenId3
    await xrc721.connect(bidder1).withdrawOffer(tokenId1);
    await xrc721.connect(bidder1).withdrawOffer(tokenId2);
    await xrc721.connect(bidder1).withdrawOffer(tokenId3);
  
    // Verify offers after withdrawals
    offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(1);
    expect(offers2[0].bidder).to.equal(bidder2.address);
  
    offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
    expect(offers3.length).to.equal(1);
    expect(offers3[0].bidder).to.equal(bidder4.address);
  
    offers4 = await xrc721.getOffersForToken(tokenId3, 0, 10, true);
    expect(offers4.length).to.equal(1);
    expect(offers4[0].bidder).to.equal(bidder3.address);
  
    // Owner accepts Bidder2's offer on tokenId1
    await xrc721.connect(owner).acceptOffer(tokenId1, bidder2.address);
  
    // Verify offers and ownership after acceptance
    offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(0);
    expect(await xrc721.ownerOf(tokenId1)).to.equal(bidder2.address);
  
    // Verify the final state of offers
    offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
    expect(offers1.length).to.equal(1);
    expect(offers1[0].bidder).to.equal(bidder4.address);
  
    offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(0);
  
    offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
    expect(offers3.length).to.equal(1);
    expect(offers3[0].bidder).to.equal(bidder4.address);
  
    offers4 = await xrc721.getOffersForToken(tokenId3, 0, 10, true);
    expect(offers4.length).to.equal(1);
    expect(offers4[0].bidder).to.equal(bidder3.address);
  
    offers5 = await xrc721.getOffersForToken(tokenId4, 0, 10, true);
    expect(offers5.length).to.equal(1);
    expect(offers5[0].bidder).to.equal(bidder3.address);
  
    // Get current offer of address for a specific token
    let currentOffer = await xrc721.getCurrentOfferOfAddressForToken(tokenId2, bidder4.address);
    expect(currentOffer.bidder).to.equal(bidder4.address);
    expect(currentOffer.price).to.equal(price4);
  });

  it("should deploy the contract", async function () {
    expect(xrc721.target).to.properAddress;  // Use `target` to get the address of the deployed contract
  });

  it("should mint a token and assign it to an owner", async function () {
    await xrc721.mintAndListForSale(owner.address, 1, ethers.parseEther("25000"), "tokenURI");
    const balance = await xrc721.balanceOf(owner.address);
    expect(balance).to.equal(1);
  });

  it("should approve and transfer token", async function () {
    await xrc721.mintAndListForSale(owner.address, 1, ethers.parseEther("25000"), "tokenURI");
    await xrc721.approve(bidder1.address, 1);
    const approved = await xrc721.getApproved(1);
    expect(approved).to.equal(bidder1.address);
    await xrc721.transferFrom(owner.address, bidder1.address, 1);
    const newOwner = await xrc721.ownerOf(1);
    expect(newOwner).to.equal(bidder1.address);
  });

  it("should list token for sale and remove from sale", async function () {
    await xrc721.mintAndListForSale(owner.address, 1, ethers.parseEther("25000"), "tokenURI");
    // await xrc721.listTokenForSale(1, ethers.parseEther("25000"));
    let isForSale = await xrc721.isTokenForSale(1);
    expect(isForSale).to.equal(true);
    await xrc721.removeTokenFromSale(1);
    isForSale = await xrc721.isTokenForSale(1);
    expect(isForSale).to.equal(false);
  });

  it("should make and accept an offer", async function () {
    await xrc721.mintAndListForSale(owner.address, 2, ethers.parseEther("25000"), "tokenURI2");
    await xrc721.connect(bidder1).makeOffer(2, { value: ethers.parseEther("25000") });
    
    const offer = await xrc721.getCurrentOfferOfAddressForToken(2, bidder1);
    expect(offer.bidder).to.equal(bidder1.address);
    
    await xrc721.acceptOffer(2, bidder1.address);
    const newOwner = await xrc721.ownerOf(2);
    expect(newOwner).to.equal(bidder1.address);


  });

  it("should handle multiple offers and withdrawals", async function () {
    await xrc721.mintAndListForSale(owner.address, 3, ethers.parseEther("25000"), "tokenURI3");
    await xrc721.connect(bidder1).makeOffer(3, { value: ethers.parseEther("50000") });
    await xrc721.connect(bidder2).makeOffer(3, { value: ethers.parseEther("75000") });
    const offer1 = await xrc721.getCurrentOfferOfAddressForToken(3, bidder1);
    expect(offer1.bidder).to.equal(bidder1.address);
    // await xrc721.connect(bidder2).withdrawOffer(3);
    const offer2 = await xrc721.getCurrentOfferOfAddressForToken(3, bidder2);
    expect(offer2.bidder).to.equal(bidder2.address);
  });



  //100 TESTS

  // it("should deploy the contract", async function () {
  //   expect(xrc721.address).to.properAddress;
  // });

  it("should mint a token and assign it to an owner", async function () {
    await xrc721.mintAndListForSale(owner.address, 1, ethers.parseEther("25000"), "tokenURI");
    const balance = await xrc721.balanceOf(owner.address);
    expect(balance).to.equal(1);
  });

  it("should approve and transfer token", async function () {
    await xrc721.mintAndListForSale(owner.address, 1, ethers.parseEther("25000"), "tokenURI");
    await xrc721.approve(bidder1.address, 1);
    const approved = await xrc721.getApproved(1);
    expect(approved).to.equal(bidder1.address);
    await xrc721.transferFrom(owner.address, bidder1.address, 1);
    const newOwner = await xrc721.ownerOf(1);
    expect(newOwner).to.equal(bidder1.address);
  });

  it("should list token for sale and remove from sale", async function () {
    await xrc721.mintAndListForSale(owner.address, 1, ethers.parseEther("25000"), "tokenURI");
    // await xrc721.listTokenForSale(1, ethers.parseEther("25000"));
    let isForSale = await xrc721.isTokenForSale(1);
    expect(isForSale).to.equal(true);
    await xrc721.removeTokenFromSale(1);
    isForSale = await xrc721.isTokenForSale(1);
    expect(isForSale).to.equal(false);
  });

  it("should make and accept an offer", async function () {
    await xrc721.mintAndListForSale(owner.address, 2, ethers.parseEther("25000"), "tokenURI2");
    await xrc721.connect(bidder1).makeOffer(2, { value: ethers.parseEther("25000") });

    const offer = await xrc721.getCurrentOfferOfAddressForToken(2, bidder1.address);
    expect(offer.bidder).to.equal(bidder1.address);

    await xrc721.acceptOffer(2, bidder1.address);
    const newOwner = await xrc721.ownerOf(2);
    expect(newOwner).to.equal(bidder1.address);
  });

  it("should handle multiple offers and withdrawals", async function () {
    await xrc721.mintAndListForSale(owner.address, 3, ethers.parseEther("25000"), "tokenURI3");
    await xrc721.connect(bidder1).makeOffer(3, { value: ethers.parseEther("50000") });
    await xrc721.connect(bidder2).makeOffer(3, { value: ethers.parseEther("75000") });
    const offer1 = await xrc721.getCurrentOfferOfAddressForToken(3, bidder1.address);
    expect(offer1.bidder).to.equal(bidder1.address);

    await xrc721.connect(bidder2).withdrawOffer(3);
    const offer2 = await xrc721.getCurrentOfferOfAddressForToken(3, bidder2.address);
    expect(offer2.price).to.equal(0);
  });

  it("should withdraw an offer", async function () {
    await xrc721.mintAndListForSale(owner.address, 4, ethers.parseEther("25000"), "tokenURI4");
    await xrc721.connect(bidder1).makeOffer(4, { value: ethers.parseEther("50000") });
    await xrc721.connect(bidder1).withdrawOffer(4);
    const offer = await xrc721.getCurrentOfferOfAddressForToken(4, bidder1.address);
    expect(offer.price).to.equal(0);
  });

  it("should record sales history correctly", async function () {
    await xrc721.mintAndListForSale(owner.address, 5, ethers.parseEther("25000"), "tokenURI5");
    await xrc721.connect(bidder1).makeOffer(5, { value: ethers.parseEther("50000") });
    await xrc721.acceptOffer(5, bidder1.address);

    const salesHistory = await xrc721.getTokenSalesHistory(5, 0, 10, true);
    expect(salesHistory.length).to.equal(1);
    expect(salesHistory[0].buyer).to.equal(bidder1.address);
    expect(salesHistory[0].seller).to.equal(owner.address);
    expect(salesHistory[0].price).to.equal(ethers.parseEther("50000"));
  });

  it("should return correct token URI", async function () {
    await xrc721.mintAndListForSale(owner.address, 6, ethers.parseEther("25000"), "tokenURI6");
    const uri = await xrc721.tokenURI(6);
    expect(uri).to.equal("tokenURI6");
  });

  it("should return owned tokens with pagination", async function () {
    await xrc721.mintAndListForSale(owner.address, 7, ethers.parseEther("25000"), "tokenURI7");
    await xrc721.mintAndListForSale(owner.address, 8, ethers.parseEther("25000"), "tokenURI8");
    const ownedTokens = await xrc721.getOwnedTokens(owner.address, 0, 10, true);
    expect(ownedTokens.length).to.equal(2);
    expect(ownedTokens[0]).to.equal(7);
    expect(ownedTokens[1]).to.equal(8);
  });

  it("should return total volume correctly", async function () {
    await xrc721.mintAndListForSale(owner.address, 9, ethers.parseEther("25000"), "tokenURI9");
    await xrc721.connect(bidder1).makeOffer(9, { value: ethers.parseEther("50000") });
    await xrc721.acceptOffer(9, bidder1.address);

    const totalVolume = await xrc721.totalVolume();
    expect(totalVolume).to.equal(ethers.parseEther("50000"));
  });

  it("should return correct balance of tokens", async function () {
    await xrc721.mintAndListForSale(owner.address, 10, ethers.parseEther("25000"), "tokenURI10");
    const balance = await xrc721.balanceOf(owner.address);
    expect(balance).to.equal(1);
  });

  it("should correctly handle approvals for all", async function () {
    await xrc721.setApprovalForAll(bidder1.address, true);
    const isApproved = await xrc721.isApprovedForAll(owner.address, bidder1.address);
    expect(isApproved).to.equal(true);
  });

  it("should correctly handle multiple sales history", async function () {
    await xrc721.mintAndListForSale(owner.address, 11, ethers.parseEther("25000"), "tokenURI11");
    await xrc721.connect(bidder1).makeOffer(11, { value: ethers.parseEther("50000") });
    await xrc721.acceptOffer(11, bidder1.address);
    
    await xrc721.connect(bidder1).listTokenForSale(11, ethers.parseEther("75000"));
    await xrc721.connect(bidder2).makeOffer(11, { value: ethers.parseEther("75000") });
    await xrc721.connect(bidder1).acceptOffer(11, bidder2.address);

    const salesHistory = await xrc721.getTokenSalesHistory(11, 0, 10, true);
    expect(salesHistory.length).to.equal(2);
    expect(salesHistory[1].buyer).to.equal(bidder2.address);
    expect(salesHistory[1].seller).to.equal(bidder1.address);
    expect(salesHistory[1].price).to.equal(ethers.parseEther("75000"));
  });

  it("should correctly handle offers from multiple bidders", async function () {
    await xrc721.mintAndListForSale(owner.address, 12, ethers.parseEther("25000"), "tokenURI12");
    await xrc721.connect(bidder1).makeOffer(12, { value: ethers.parseEther("50000") });
    await xrc721.connect(bidder2).makeOffer(12, { value: ethers.parseEther("75000") });

    const offer1 = await xrc721.getCurrentOfferOfAddressForToken(12, bidder1.address);
    const offer2 = await xrc721.getCurrentOfferOfAddressForToken(12, bidder2.address);

    expect(offer1.bidder).to.equal(bidder1.address);
    expect(offer2.bidder).to.equal(bidder2.address);
  });

  it("should correctly handle minting and listing multiple tokens", async function () {
    await xrc721.mintAndListForSale(owner.address, 13, ethers.parseEther("25000"), "tokenURI13");
    await xrc721.mintAndListForSale(owner.address, 14, ethers.parseEther("25000"), "tokenURI14");

    const balance = await xrc721.balanceOf(owner.address);
    expect(balance).to.equal(2);
  });

  // it("should correctly handle minting up to the maximum supply", async function () {
  //   for (let i = 15; i < 1015; i++) {
  //     await xrc721.mintAndListForSale(owner.address, i, ethers.parseEther("25000"), `tokenURI${i}`);
  //   }
  //   const totalMinted = await xrc721._totalMintedTokens();
  //   expect(totalMinted).to.equal(1000);
  // });

  // it("should correctly handle failed minting beyond maximum supply", async function () {
  //   for (let i = 1015; i < 11015; i++) {
  //     await xrc721.mintAndListForSale(owner.address, i, ethers.parseEther("25000"), `tokenURI${i}`);
  //   }
  //   await expect(xrc721.mintAndListForSale(owner.address, 11016, ethers.parseEther("25000"), "tokenURI11016"))
  //     .to.be.revertedWith("XRC721: maximum token supply reached");
  // });

  it("should correctly return owned tokens with pagination for a specific address", async function () {
    await xrc721.mintAndListForSale(owner.address, 15, ethers.parseEther("25000"), "tokenURI15");
    await xrc721.mintAndListForSale(owner.address, 16, ethers.parseEther("25000"), "tokenURI16");
    await xrc721.mintAndListForSale(owner.address, 17, ethers.parseEther("25000"), "tokenURI17");

    const ownedTokensPage1 = await xrc721.getOwnedTokens(owner.address, 0, 2, true);
    const ownedTokensPage2 = await xrc721.getOwnedTokens(owner.address, 2, 100, true);

    expect(ownedTokensPage1.length).to.equal(2);
    expect(ownedTokensPage1[0]).to.equal(15);
    expect(ownedTokensPage1[1]).to.equal(16);
    // console.log(ownedTokensPage2.length);
    expect(ownedTokensPage2.length).to.equal(1);
    expect(ownedTokensPage2[0]).to.equal(17);
  });

  it("should return empty array if pagination start is beyond owned tokens", async function () {
    await xrc721.mintAndListForSale(owner.address, 18, ethers.parseEther("25000"), "tokenURI18");
    const ownedTokens = await xrc721.getOwnedTokens(owner.address, 10, 2, true);
    expect(ownedTokens.length).to.equal(0);
  });

  // it("should correctly set and get token URI", async function () {
  //   await xrc721.mintAndListForSale(owner.address, 19, ethers.parseEther("25000"), "tokenURI19");
  //   await xrc721._setTokenURI(19, "newTokenURI19");
  //   const tokenURI = await xrc721.tokenURI(19);
  //   expect(tokenURI).to.equal("newTokenURI19");
  // });

  // it("should not set token URI for non-existent token", async function () {
  //   await expect(xrc721._setTokenURI(20, "tokenURI20"))
  //     .to.be.revertedWith("XRC721: URI set of nonexistent token");
  // });

  it("should correctly handle offer update with higher value", async function () {
    await xrc721.mintAndListForSale(owner.address, 21, ethers.parseEther("25000"), "tokenURI21");
    await xrc721.connect(bidder1).makeOffer(21, { value: ethers.parseEther("50000") });
    await xrc721.connect(bidder1).makeOffer(21, { value: ethers.parseEther("75000") });

    const offer = await xrc721.getCurrentOfferOfAddressForToken(21, bidder1.address);
    expect(offer.price).to.equal(ethers.parseEther("75000"));
  });

  it("should revert offer update with lower value", async function () {
    await xrc721.mintAndListForSale(owner.address, 22, ethers.parseEther("25000"), "tokenURI22");
    await xrc721.connect(bidder1).makeOffer(22, { value: ethers.parseEther("50000") });
    await expect(xrc721.connect(bidder1).makeOffer(22, { value: ethers.parseEther("25000") }))
      // .to.be.revertedWith("XRC721: new offer must be greater than existing offer");
      .to.be.revertedWithCustomError(xrc721, "OfferMustBeGreater");
  });

  it("should revert withdrawal of non-existent offer", async function () {
    await xrc721.mintAndListForSale(owner.address, 23, ethers.parseEther("25000"), "tokenURI23");
    await expect(xrc721.connect(bidder1).withdrawOffer(23))
      // .to.be.revertedWith("XRC721: caller is not the bidder");
      .to.be.revertedWithCustomError(xrc721, "CallerNotBidder");
  });

  it("should revert acceptance of non-existent offer", async function () {
    await xrc721.mintAndListForSale(owner.address, 24, ethers.parseEther("25000"), "tokenURI24");
    await expect(xrc721.acceptOffer(24, bidder1.address))
      // .to.be.revertedWith("XRC721: no active offer");
      .to.be.revertedWithCustomError(xrc721, "NoActiveOffer");
  });

  it("should revert token transfer by non-owner", async function () {
    await xrc721.mintAndListForSale(owner.address, 25, ethers.parseEther("25000"), "tokenURI25");
    await expect(xrc721.connect(bidder1).transferFrom(owner.address, bidder2.address, 25))
      // .to.be.revertedWith("XRC721: transfer caller is not owner nor approved");
      .to.be.revertedWithCustomError(xrc721, "CallerNotOwnerNorApproved");
  });

  // it("should revert token transfer to zero address", async function () {
  //   await xrc721.mintAndListForSale(owner.address, 26, ethers.parseEther("25000"), "tokenURI26");
  //   await expect(xrc721.transferFrom(owner.address, ethers.constants.AddressZero, 26))
  //     .to.be.revertedWith("XRC721: transfer to the zero address");
  // });

  it("should revert token transfer of non-existent token", async function () {
    await expect(xrc721.transferFrom(owner.address, bidder1.address, 27))
      // .to.be.revertedWith("XRC721: operator query for nonexistent token");
      .to.be.revertedWithCustomError(xrc721, "TokenNonexistent");
  });

  it("should revert token transfer by non-approved address", async function () {
    await xrc721.mintAndListForSale(owner.address, 28, ethers.parseEther("25000"), "tokenURI28");
    await expect(xrc721.connect(bidder1).transferFrom(owner.address, bidder2.address, 28))
      // .to.be.revertedWith("XRC721: transfer caller is not owner nor approved");
      .to.be.revertedWithCustomError(xrc721, "CallerNotOwnerNorApproved");
  });

  it("should correctly mint and transfer multiple tokens", async function () {
    for (let i = 29; i < 39; i++) {
      await xrc721.mintAndListForSale(owner.address, i, ethers.parseEther("25000"), `tokenURI${i}`);
      await xrc721.transferFrom(owner.address, bidder1.address, i);
      const newOwner = await xrc721.ownerOf(i);
      expect(newOwner).to.equal(bidder1.address);
    }
  });

  // it("should revert token transfer by revoked approval", async function () {
  //   await xrc721.mintAndListForSale(owner.address, 39, ethers.parseEther("25000"), "tokenURI39");
  //   await xrc721.approve(bidder1.address, 39);
  //   await xrc721.approve(ethers.constants.AddressZero, 39);
  //   await expect(xrc721.connect(bidder1).transferFrom(owner.address, bidder2.address, 39))
  //     .to.be.revertedWith("XRC721: transfer caller is not owner nor approved");
  // });

  // it("should correctly handle safe transfer with data", async function () {
  //   await xrc721.mintAndListForSale(owner.address, 40, ethers.parseEther("25000"), "tokenURI40");
  //   await xrc721.safeTransferFrom(owner.address, bidder1.address, 40, "0x1234");
  //   const newOwner = await xrc721.ownerOf(40);
  //   expect(newOwner).to.equal(bidder1.address);
  // });

  // it("should revert safe transfer to non-receiver contract", async function () {
  //   const NonReceiver = await ethers.getContractFactory("NonReceiver");
  //   const nonReceiver = await NonReceiver.deploy();
  //   await nonReceiver.deployed();

  //   await xrc721.mintAndListForSale(owner.address, 41, ethers.parseEther("25000"), "tokenURI41");
  //   await expect(xrc721.safeTransferFrom(owner.address, nonReceiver.address, 41, "0x1234"))
  //     .to.be.revertedWith("XRC721: transfer to non XRC721Receiver implementer");
  // });

  // it("should correctly handle transfer to XRC721Receiver contract", async function () {
  //   const Receiver = await ethers.getContractFactory("Receiver");
  //   const receiver = await Receiver.deploy();
  //   await receiver.deployed();

  //   await xrc721.mintAndListForSale(owner.address, 42, ethers.parseEther("25000"), "tokenURI42");
  //   await xrc721.safeTransferFrom(owner.address, receiver.address, 42, "0x1234");
  //   const newOwner = await xrc721.ownerOf(42);
  //   expect(newOwner).to.equal(receiver.address);
  // // });

  // it("should correctly handle batch minting and transfers", async function () {
  //   for (let i = 43; i < 53; i++) {
  //     await xrc721.mintAndListForSale(owner.address, i, ethers.parseEther("25000"), `tokenURI${i}`);
  //     await xrc721.safeTransferFrom(owner.address, bidder1.address, i, "0x1234");
  //     const newOwner = await xrc721.ownerOf(i);
  //     expect(newOwner).to.equal(bidder1.address);
  //   }
  // });

  it("should revert minting if not owner", async function () {
    await expect(xrc721.connect(bidder1).mintAndListForSale(bidder1.address, 53, ethers.parseEther("25000"), "tokenURI53"))
      .to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("should correctly calculate royalty", async function () {
    await xrc721.mintAndListForSale(owner.address, 54, ethers.parseEther("25000"), "tokenURI54");
    const royalty = await xrc721.ROYALTY_FRACTION();
    expect(royalty).to.equal(ROYALTY_FRACTION);
  });

  it("should correctly handle withdrawal of offer", async function () {
    await xrc721.mintAndListForSale(owner.address, 55, ethers.parseEther("25000"), "tokenURI55");
    await xrc721.connect(bidder1).makeOffer(55, { value: ethers.parseEther("50000") });
    await xrc721.connect(bidder1).withdrawOffer(55);
    const offer = await xrc721.getCurrentOfferOfAddressForToken(55, bidder1.address);
    expect(offer.price).to.equal(0);
  });

  it("should correctly insert tokens in order when minting out of order", async function () {
    // Mint tokens out of order
    await xrc721.mintAndListForSale(owner.address, 3, ethers.parseEther("25000"), "tokenURI3");
    await xrc721.mintAndListForSale(owner.address, 1, ethers.parseEther("25000"), "tokenURI1");
    await xrc721.mintAndListForSale(owner.address, 4, ethers.parseEther("25000"), "tokenURI4");
    await xrc721.mintAndListForSale(owner.address, 2, ethers.parseEther("25000"), "tokenURI2");

    // Retrieve the owned tokens
    const ownedTokens = await xrc721.getOwnedTokens(owner.address, 0, 10, true);

    // Check if the tokens are in the correct order
    expect(ownedTokens.length).to.equal(4);
    expect(ownedTokens[0]).to.equal(1);
    expect(ownedTokens[1]).to.equal(2);
    expect(ownedTokens[2]).to.equal(3);
    expect(ownedTokens[3]).to.equal(4);
  });

  // it("should correctly handle multiple tokens transfer between accounts", async function () {
  //   for (let i = 56; i < 66; i++) {
  //     await xrc721.mintAndListForSale(owner.address, i, ethers.parseEther("25000"), `tokenURI${i}`);
  //     await xrc721.safeTransferFrom(owner.address, bidder1.address, i, "0x1234");
  //   }

  //   for (let i = 56; i < 66; i++) {
  //     await xrc721.safeTransferFrom(bidder1.address, bidder2.address, i, "0x1234");
  //     const newOwner = await xrc721.ownerOf(i);
  //     expect(newOwner).to.equal(bidder2.address);
  //   }
  // });

  // it("should correctly handle updating token URI", async function () {
  //   await xrc721.mintAndListForSale(owner.address, 66, ethers.parseEther("25000"), "tokenURI66");
  //   await xrc721._setTokenURI(66, "newTokenURI66");
  //   const tokenURI = await xrc721.tokenURI(66);
  //   expect(tokenURI).to.equal("newTokenURI66");
  // });

  // it("should revert updating token URI for non-existent token", async function () {
  //   await expect(xrc721._setTokenURI(67, "newTokenURI67"))
  //     .to.be.revertedWith("XRC721: URI set of nonexistent token");
  // });

  // it("should correctly handle multiple minting, listing, and transfers", async function () {
  //   for (let i = 68; i < 78; i++) {
  //     await xrc721.mintAndListForSale(owner.address, i, ethers.parseEther("25000"), `tokenURI${i}`);
  //     await xrc721.listTokenForSale(i, ethers.parseEther("50000"));
  //     await xrc721.safeTransferFrom(owner.address, bidder1.address, i, "0x1234");
  //     const newOwner = await xrc721.ownerOf(i);
  //     expect(newOwner).to.equal(bidder1.address);
  //   }
  // });

  it("should correctly handle offers and withdrawals by multiple bidders", async function () {
    await xrc721.mintAndListForSale(owner.address, 78, ethers.parseEther("25000"), "tokenURI78");
    await xrc721.connect(bidder1).makeOffer(78, { value: ethers.parseEther("50000") });
    await xrc721.connect(bidder2).makeOffer(78, { value: ethers.parseEther("75000") });
    await xrc721.connect(bidder1).withdrawOffer(78);
    const offer1 = await xrc721.getCurrentOfferOfAddressForToken(78, bidder1.address);
    expect(offer1.price).to.equal(0);
    const offer2 = await xrc721.getCurrentOfferOfAddressForToken(78, bidder2.address);
    expect(offer2.price).to.equal(ethers.parseEther("75000"));
  });

  it("should correctly handle multiple sales history", async function () {
    await xrc721.mintAndListForSale(owner.address, 79, ethers.parseEther("25000"), "tokenURI79");
    await xrc721.connect(bidder1).makeOffer(79, { value: ethers.parseEther("50000") });
    await xrc721.acceptOffer(79, bidder1.address);

    await xrc721.connect(bidder1).listTokenForSale(79, ethers.parseEther("75000"));
    await xrc721.connect(bidder2).makeOffer(79, { value: ethers.parseEther("75000") });
    await xrc721.connect(bidder1).acceptOffer(79, bidder2.address);

    await xrc721.connect(bidder2).listTokenForSale(79, ethers.parseEther("100000"));
    await xrc721.connect(bidder3).makeOffer(79, { value: ethers.parseEther("100000") });
    await xrc721.connect(bidder2).acceptOffer(79, bidder3.address);

    const salesHistory = await xrc721.getTokenSalesHistory(79, 0, 10, true);
    expect(salesHistory.length).to.equal(3);
  });

  it("should correctly handle edge case of multiple offers and withdrawals", async function () {
    await xrc721.mintAndListForSale(owner.address, 80, ethers.parseEther("25000"), "tokenURI80");
    await xrc721.connect(bidder1).makeOffer(80, { value: ethers.parseEther("50000") });
    await xrc721.connect(bidder2).makeOffer(80, { value: ethers.parseEther("75000") });
    await xrc721.connect(bidder3).makeOffer(80, { value: ethers.parseEther("100000") });

    await xrc721.connect(bidder2).withdrawOffer(80);
    const offer2 = await xrc721.getCurrentOfferOfAddressForToken(80, bidder2.address);
    expect(offer2.price).to.equal(0);

    await xrc721.connect(bidder3).withdrawOffer(80);
    const offer3 = await xrc721.getCurrentOfferOfAddressForToken(80, bidder3.address);
    expect(offer3.price).to.equal(0);

    await xrc721.connect(bidder1).withdrawOffer(80);
    const offer1 = await xrc721.getCurrentOfferOfAddressForToken(80, bidder1.address);
    expect(offer1.price).to.equal(0);
  });

  it("should correctly handle total volume calculation after multiple sales", async function () {
    await xrc721.mintAndListForSale(owner.address, 81, ethers.parseEther("25000"), "tokenURI81");
    await xrc721.connect(bidder1).makeOffer(81, { value: ethers.parseEther("50000") });
    await xrc721.acceptOffer(81, bidder1.address);

    await xrc721.connect(bidder1).listTokenForSale(81, ethers.parseEther("75000"));
    await xrc721.connect(bidder2).makeOffer(81, { value: ethers.parseEther("75000") });
    await xrc721.connect(bidder1).acceptOffer(81, bidder2.address);

    await xrc721.connect(bidder2).listTokenForSale(81, ethers.parseEther("100000"));
    await xrc721.connect(bidder3).makeOffer(81, { value: ethers.parseEther("100000") });
    await xrc721.connect(bidder2).acceptOffer(81, bidder3.address);

    const totalVolume = await xrc721.totalVolume();
    expect(totalVolume).to.equal(ethers.parseEther("225000"));
  });

  it("should correctly handle pagination for multiple owned tokens", async function () {
    for (let i = 82; i < 92; i++) {
      await xrc721.mintAndListForSale(owner.address, i, ethers.parseEther("25000"), `tokenURI${i}`);
    }
    const ownedTokensPage1 = await xrc721.getOwnedTokens(owner.address, 0, 5, true);
    const ownedTokensPage2 = await xrc721.getOwnedTokens(owner.address, 5, 5, true);

    expect(ownedTokensPage1.length).to.equal(5);
    expect(ownedTokensPage2.length).to.equal(5);
  });

  //no need for below test, uint256 by default cannot be negative
  // it("should revert if pagination start index is negative", async function () {
  //   await expect(xrc721.getOwnedTokens(owner.address, -1, 5, true))
  //     .to.be.revertedWith("XRC721: start index out of bounds");
  // });

  it("should revert if pagination start index exceeds owned tokens count", async function () {
    await xrc721.mintAndListForSale(owner.address, 92, ethers.parseEther("25000"), "tokenURI92");
    const ownedTokens = await xrc721.getOwnedTokens(owner.address, 10, 5, true);
    expect(ownedTokens.length).to.equal(0);
  });

  it("should correctly return zero owned tokens if none exist", async function () {
    const ownedTokens = await xrc721.getOwnedTokens(bidder1.address, 0, 5, true);
    expect(ownedTokens.length).to.equal(0);
  });

  it("should revert if non-existent token is queried for URI", async function () {
    await expect(xrc721.tokenURI(93))
      // .to.be.revertedWith("XRC721: URI query for nonexistent token");
      .to.be.revertedWithCustomError(xrc721, "TokenNonexistent");
  });

  it("should correctly handle multiple minting and transferring with approval", async function () {
    for (let i = 94; i < 104; i++) {
      await xrc721.mintAndListForSale(owner.address, i, ethers.parseEther("25000"), `tokenURI${i}`);
      await xrc721.approve(bidder1.address, i);
      await xrc721.transferFrom(owner.address, bidder1.address, i);
      const newOwner = await xrc721.ownerOf(i);
      expect(newOwner).to.equal(bidder1.address);
    }
  });

  it("should correctly handle multiple offers and acceptance by different bidders", async function () {
    await xrc721.mintAndListForSale(owner.address, 104, ethers.parseEther("25000"), "tokenURI104");
    await xrc721.connect(bidder1).makeOffer(104, { value: ethers.parseEther("50000") });
    await xrc721.connect(bidder2).makeOffer(104, { value: ethers.parseEther("75000") });
    await xrc721.connect(bidder3).makeOffer(104, { value: ethers.parseEther("100000") });

    await xrc721.connect(owner).acceptOffer(104, bidder2.address);
    const newOwner = await xrc721.ownerOf(104);
    expect(newOwner).to.equal(bidder2.address);
  });

  it("should correctly handle total volume calculation with different offers", async function () {
    await xrc721.mintAndListForSale(owner.address, 105, ethers.parseEther("25000"), "tokenURI105");
    await xrc721.connect(bidder1).makeOffer(105, { value: ethers.parseEther("50000") });
    await xrc721.connect(owner).acceptOffer(105, bidder1.address);

    await xrc721.connect(bidder1).listTokenForSale(105, ethers.parseEther("75000"));
    await xrc721.connect(bidder2).makeOffer(105, { value: ethers.parseEther("75000") });
    await xrc721.connect(bidder1).acceptOffer(105, bidder2.address);

    await xrc721.connect(bidder2).listTokenForSale(105, ethers.parseEther("100000"));
    await xrc721.connect(bidder3).makeOffer(105, { value: ethers.parseEther("100000") });
    await xrc721.connect(bidder2).acceptOffer(105, bidder3.address);

    const totalVolume = await xrc721.totalVolume();
    expect(totalVolume).to.equal(ethers.parseEther("225000"));
  });

  // it("should revert transfer to zero address by non-owner", async function () {
  //   await xrc721.mintAndListForSale(owner.address, 106, ethers.parseEther("25000"), "tokenURI106");
  //   await expect(xrc721.connect(bidder1).transferFrom(owner.address, ethers.constants.AddressZero, 106))
  //     .to.be.revertedWith("XRC721: transfer to the zero address");
  // });

  it("should correctly handle offers and withdrawals in different scenarios", async function () {
    await xrc721.mintAndListForSale(owner.address, 107, ethers.parseEther("25000"), "tokenURI107");
    await xrc721.connect(bidder1).makeOffer(107, { value: ethers.parseEther("50000") });
    await xrc721.connect(bidder2).makeOffer(107, { value: ethers.parseEther("75000") });

    await xrc721.connect(bidder1).withdrawOffer(107);
    const offer1 = await xrc721.getCurrentOfferOfAddressForToken(107, bidder1.address);
    expect(offer1.price).to.equal(0);

    await xrc721.connect(bidder2).withdrawOffer(107);
    const offer2 = await xrc721.getCurrentOfferOfAddressForToken(107, bidder2.address);
    expect(offer2.price).to.equal(0);
  });

  it("should correctly handle total volume calculation after multiple offers", async function () {
    await xrc721.mintAndListForSale(owner.address, 108, ethers.parseEther("25000"), "tokenURI108");
    await xrc721.connect(bidder1).makeOffer(108, { value: ethers.parseEther("50000") });
    await xrc721.acceptOffer(108, bidder1.address);

    await xrc721.connect(bidder1).listTokenForSale(108, ethers.parseEther("75000"));
    await xrc721.connect(bidder2).makeOffer(108, { value: ethers.parseEther("75000") });
    await xrc721.connect(bidder1).acceptOffer(108, bidder2.address);

    await xrc721.connect(bidder2).listTokenForSale(108, ethers.parseEther("100000"));
    await xrc721.connect(bidder3).makeOffer(108, { value: ethers.parseEther("100000") });
    await xrc721.connect(bidder2).acceptOffer(108, bidder3.address);

    const totalVolume = await xrc721.totalVolume();
    expect(totalVolume).to.equal(ethers.parseEther("225000"));
  });

  // it("should correctly handle transfer with safe transfer data", async function () {
  //   await xrc721.mintAndListForSale(owner.address, 109, ethers.parseEther("25000"), "tokenURI109");
  //   await xrc721.safeTransferFrom(owner.address, bidder1.address, 109, "0x1234");
  //   const newOwner = await xrc721.ownerOf(109);
  //   expect(newOwner).to.equal(bidder1.address);
  // });

  // it("should revert safe transfer to non-receiver contract", async function () {
  //   const NonReceiver = await ethers.getContractFactory("NonReceiver");
  //   const nonReceiver = await NonReceiver.deploy();
  //   await nonReceiver.deployed();

  //   await xrc721.mintAndListForSale(owner.address, 110, ethers.parseEther("25000"), "tokenURI110");
  //   await expect(xrc721.safeTransferFrom(owner.address, nonReceiver.address, 110, "0x1234"))
  //     .to.be.revertedWith("XRC721: transfer to non XRC721Receiver implementer");
  // });

  it("should correctly handle multiple minting and approvals", async function () {
    for (let i = 111; i < 121; i++) {
      await xrc721.mintAndListForSale(owner.address, i, ethers.parseEther("25000"), `tokenURI${i}`);
      await xrc721.approve(bidder1.address, i);
      await xrc721.transferFrom(owner.address, bidder1.address, i);
      const newOwner = await xrc721.ownerOf(i);
      expect(newOwner).to.equal(bidder1.address);
    }
  });

  it("should correctly handle offers and acceptance in different scenarios", async function () {
    await xrc721.mintAndListForSale(owner.address, 121, ethers.parseEther("25000"), "tokenURI121");
    await xrc721.connect(bidder1).makeOffer(121, { value: ethers.parseEther("50000") });
    await xrc721.connect(bidder2).makeOffer(121, { value: ethers.parseEther("75000") });
    await xrc721.connect(bidder3).makeOffer(121, { value: ethers.parseEther("100000") });

    await xrc721.connect(owner).acceptOffer(121, bidder2.address);
    const newOwner = await xrc721.ownerOf(121);
    expect(newOwner).to.equal(bidder2.address);
  });

  it("should correctly handle total volume calculation with different offers and sales", async function () {
    await xrc721.mintAndListForSale(owner.address, 122, ethers.parseEther("25000"), "tokenURI122");
    await xrc721.connect(bidder1).makeOffer(122, { value: ethers.parseEther("50000") });
    await xrc721.connect(owner).acceptOffer(122, bidder1.address);

    await xrc721.connect(bidder1).listTokenForSale(122, ethers.parseEther("75000"));
    await xrc721.connect(bidder2).makeOffer(122, { value: ethers.parseEther("75000") });
    await xrc721.connect(bidder1).acceptOffer(122, bidder2.address);

    await xrc721.connect(bidder2).listTokenForSale(122, ethers.parseEther("100000"));
    await xrc721.connect(bidder3).makeOffer(122, { value: ethers.parseEther("100000") });
    await xrc721.connect(bidder2).acceptOffer(122, bidder3.address);

    const totalVolume = await xrc721.totalVolume();
    expect(totalVolume).to.equal(ethers.parseEther("225000"));
  });

  // it("should revert transfer to zero address", async function () {
  //   await xrc721.mintAndListForSale(owner.address, 123, ethers.parseEther("25000"), "tokenURI123");
  //   await expect(xrc721.transferFrom(owner.address, ethers.constants.AddressZero, 123))
  //     .to.be.revertedWith("XRC721: transfer to the zero address");
  // });

  it("should correctly handle total volume calculation after multiple transfers and sales", async function () {
    await xrc721.mintAndListForSale(owner.address, 124, ethers.parseEther("25000"), "tokenURI124");
    await xrc721.connect(bidder1).makeOffer(124, { value: ethers.parseEther("50000") });
    await xrc721.acceptOffer(124, bidder1.address);

    await xrc721.connect(bidder1).listTokenForSale(124, ethers.parseEther("75000"));
    await xrc721.connect(bidder2).makeOffer(124, { value: ethers.parseEther("75000") });
    await xrc721.connect(bidder1).acceptOffer(124, bidder2.address);

    await xrc721.connect(bidder2).listTokenForSale(124, ethers.parseEther("100000"));
    await xrc721.connect(bidder3).makeOffer(124, { value: ethers.parseEther("100000") });
    await xrc721.connect(bidder2).acceptOffer(124, bidder3.address);

    const totalVolume = await xrc721.totalVolume();
    expect(totalVolume).to.equal(ethers.parseEther("225000"));
  });

  // it("Should handle a highly complex scenario", async function () {
  //   // Mint and list multiple tokens
  //   await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
  //   await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId1, price2, "tokenURI2");
  //   await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId2, price3, "tokenURI3");
  //   await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId3, price4, "tokenURI4");

  //   // Bidder1 makes offers on all tokens
  //   await xrc721.connect(bidder1).makeOffer(tokenId0, { value: price1 });
  //   await xrc721.connect(bidder1).makeOffer(tokenId1, { value: price2 });
  //   await xrc721.connect(bidder1).makeOffer(tokenId2, { value: price3 });
  //   await xrc721.connect(bidder1).makeOffer(tokenId3, { value: price4 });

  //   // Bidder2 makes offers on tokenId0 and tokenId1
  //   await xrc721.connect(bidder2).makeOffer(tokenId0, { value: price2 });
  //   await xrc721.connect(bidder2).makeOffer(tokenId1, { value: price3 });

  //   // Bidder3 makes offers on tokenId2 and tokenId3
  //   await xrc721.connect(bidder3).makeOffer(tokenId2, { value: price2 });
  //   await xrc721.connect(bidder3).makeOffer(tokenId3, { value: price1 });

  //   // Bidder4 makes offers on all tokens
  //   await xrc721.connect(bidder4).makeOffer(tokenId0, { value: price3 });
  //   await xrc721.connect(bidder4).makeOffer(tokenId1, { value: price4 });
  //   await xrc721.connect(bidder4).makeOffer(tokenId2, { value: price4 });
  //   await xrc721.connect(bidder4).makeOffer(tokenId3, { value: price3 });

  //   // Verify initial offers
  //   let offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
  //   expect(offers1.length).to.equal(3);
  //   expect(offers1[0].bidder).to.equal(bidder1.address);
  //   expect(offers1[1].bidder).to.equal(bidder2.address);
  //   expect(offers1[2].bidder).to.equal(bidder4.address);

  //   let offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
  //   expect(offers2.length).to.equal(3);
  //   expect(offers2[0].bidder).to.equal(bidder1.address);
  //   expect(offers2[1].bidder).to.equal(bidder2.address);
  //   expect(offers2[2].bidder).to.equal(bidder4.address);

  //   let offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
  //   expect(offers3.length).to.equal(3);
  //   expect(offers3[0].bidder).to.equal(bidder1.address);
  //   expect(offers3[1].bidder).to.equal(bidder3.address);
  //   expect(offers3[2].bidder).to.equal(bidder4.address);

  //   let offers4 = await xrc721.getOffersForToken(tokenId3, 0, 10, true);
  //   expect(offers4.length).to.equal(3);
  //   expect(offers4[0].bidder).to.equal(bidder1.address);
  //   expect(offers4[1].bidder).to.equal(bidder3.address);
  //   expect(offers4[2].bidder).to.equal(bidder4.address);

  //   // Bidder1 withdraws their offer on tokenId0
  //   await xrc721.connect(bidder1).withdrawOffer(tokenId0);

  //   // Verify offers after withdrawal
  //   offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
  //   expect(offers1.length).to.equal(2);
  //   expect(offers1[0].bidder).to.equal(bidder4.address); // Swapped in place of bidder1
  //   expect(offers1[1].bidder).to.equal(bidder2.address);

  //   // Owner accepts Bidder2's offer on tokenId0
  //   await xrc721.connect(owner).acceptOffer(tokenId0, bidder2.address);

  //   // Verify offers and ownership after acceptance
  //   offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
  //   expect(offers1.length).to.equal(1); // Only Bidder4's offer remains
  //   expect(offers1[0].bidder).to.equal(bidder4.address); // Bidder4's offer remains
  //   expect(await xrc721.ownerOf(tokenId0)).to.equal(bidder2.address);

  //   // Buyer1 buys tokenId0 from Bidder2
  //   await xrc721.connect(bidder2).listTokenForSale(tokenId0, price2);
  //   await xrc721.connect(buyer1).buyToken(tokenId0, { value: price2 });

  //   // Verify ownership after purchase
  //   expect(await xrc721.ownerOf(tokenId0)).to.equal(buyer1.address);

  //   // Verify sales history for tokenId0
  //   let salesHistory1 = await xrc721.getTokenSalesHistory(tokenId0, 0, 10, true);
  //   expect(salesHistory1.length).to.equal(2); // 2 sales: owner to bidder2, bidder2 to buyer1
  //   expect(salesHistory1[0].seller).to.equal(owner.address);
  //   expect(salesHistory1[0].buyer).to.equal(bidder2.address);
  //   expect(salesHistory1[1].seller).to.equal(bidder2.address);
  //   expect(salesHistory1[1].buyer).to.equal(buyer1.address);

  //   // Mint another token and list it for sale
  //   await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId4, price5, "tokenURI5");

  //   // Bidder3 makes an offer on tokenId4
  //   await xrc721.connect(bidder3).makeOffer(tokenId4, { value: price3 });

  //   // Verify offer on tokenId4
  //   let offers5 = await xrc721.getOffersForToken(tokenId4, 0, 10, true);
  //   expect(offers5.length).to.equal(1);
  //   expect(offers5[0].bidder).to.equal(bidder3.address);

  //   // Owner accepts Bidder3's offer on tokenId2
  //   await xrc721.connect(owner).acceptOffer(tokenId2, bidder3.address);

  //   // Verify offers and ownership after acceptance
  //   offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
  //   expect(offers3.length).to.equal(2); // Bidder1's and Bidder4's offers remain
  //   expect(offers3[0].bidder).to.equal(bidder1.address);
  //   expect(offers3[1].bidder).to.equal(bidder4.address);
  //   expect(await xrc721.ownerOf(tokenId2)).to.equal(bidder3.address);

  //   // Bidder4 withdraws their offers on tokenId1 and tokenId3
  //   await xrc721.connect(bidder4).withdrawOffer(tokenId1);
  //   await xrc721.connect(bidder4).withdrawOffer(tokenId3);

  //   // Verify offers after withdrawals
  //   offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
  //   expect(offers2.length).to.equal(2);
  //   expect(offers2[0].bidder).to.equal(bidder1.address);
  //   expect(offers2[1].bidder).to.equal(bidder2.address);

  //   offers4 = await xrc721.getOffersForToken(tokenId3, 0, 10, true);
  //   expect(offers4.length).to.equal(2);
  //   expect(offers4[0].bidder).to.equal(bidder1.address);
  //   expect(offers4[1].bidder).to.equal(bidder3.address);

  //   // Verify tokens metadata
  //   let metadata = await xrc721.getTokensMetadata(0, 5);
  //   expect(metadata.length).to.equal(5);
  //   expect(metadata[0]).to.equal("tokenURI1");
  //   expect(metadata[1]).to.equal("tokenURI2");
  //   expect(metadata[2]).to.equal("tokenURI3");
  //   expect(metadata[3]).to.equal("tokenURI4");
  //   expect(metadata[4]).to.equal("tokenURI5");

  //   // Bidder1 withdraws their remaining offers on tokenId1, tokenId2, and tokenId3
  //   await xrc721.connect(bidder1).withdrawOffer(tokenId1);
  //   await xrc721.connect(bidder1).withdrawOffer(tokenId2);
  //   await xrc721.connect(bidder1).withdrawOffer(tokenId3);

  //   // Verify offers after withdrawals
  //   offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
  //   expect(offers2.length).to.equal(1);
  //   expect(offers2[0].bidder).to.equal(bidder2.address);

  //   offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
  //   expect(offers3.length).to.equal(1);
  //   expect(offers3[0].bidder).to.equal(bidder4.address);

  //   offers4 = await xrc721.getOffersForToken(tokenId3, 0, 10, true);
  //   expect(offers4.length).to.equal(1);
  //   expect(offers4[0].bidder).to.equal(bidder3.address);

  //   // Owner accepts Bidder2's offer on tokenId1
  //   await xrc721.connect(owner).acceptOffer(tokenId1, bidder2.address);

  //   // Verify offers and ownership after acceptance
  //   offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
  //   expect(offers2.length).to.equal(0);
  //   expect(await xrc721.ownerOf(tokenId1)).to.equal(bidder2.address);

  //   // Verify the final state of offers
  //   offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
  //   expect(offers1.length).to.equal(1);
  //   expect(offers1[0].bidder).to.equal(bidder4.address);

  //   offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
  //   expect(offers2.length).to.equal(0);

  //   offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
  //   expect(offers3.length).to.equal(1);
  //   expect(offers3[0].bidder).to.equal(bidder4.address);

  //   offers4 = await xrc721.getOffersForToken(tokenId3, 0, 10, true);
  //   expect(offers4.length).to.equal(1);
  //   expect(offers4[0].bidder).to.equal(bidder3.address);

  //   offers5 = await xrc721.getOffersForToken(tokenId4, 0, 10, true);
  //   expect(offers5.length).to.equal(1);
  //   expect(offers5[0].bidder).to.equal(bidder3.address);

  //   // Get current offer of address for a specific token
  //   let currentOffer = await xrc721.getCurrentOfferOfAddressForToken(tokenId2, bidder4.address);
  //   expect(currentOffer.bidder).to.equal(bidder4.address);
  //   expect(currentOffer.price).to.equal(price4);
  // });
  it("Should handle a highly complex scenario", async function () {
    // Mint and list multiple tokens
    await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
    await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId1, price2, "tokenURI2");
    await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId2, price3, "tokenURI3");
    await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId3, price4, "tokenURI4");
  
    // Bidder1 makes offers on all tokens
    await xrc721.connect(bidder1).makeOffer(tokenId0, { value: price1 });
    await xrc721.connect(bidder1).makeOffer(tokenId1, { value: price2 });
    await xrc721.connect(bidder1).makeOffer(tokenId2, { value: price3 });
    await xrc721.connect(bidder1).makeOffer(tokenId3, { value: price4 });
  
    // Bidder2 makes offers on tokenId0 and tokenId1
    await xrc721.connect(bidder2).makeOffer(tokenId0, { value: price2 });
    await xrc721.connect(bidder2).makeOffer(tokenId1, { value: price3 });
  
    // Bidder3 makes offers on tokenId2 and tokenId3
    await xrc721.connect(bidder3).makeOffer(tokenId2, { value: price2 });
    await xrc721.connect(bidder3).makeOffer(tokenId3, { value: price1 });
  
    // Bidder4 makes offers on all tokens
    await xrc721.connect(bidder4).makeOffer(tokenId0, { value: price3 });
    await xrc721.connect(bidder4).makeOffer(tokenId1, { value: price4 });
    await xrc721.connect(bidder4).makeOffer(tokenId2, { value: price4 });
    await xrc721.connect(bidder4).makeOffer(tokenId3, { value: price3 });
  
    // Verify initial offers
    let offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
    expect(offers1.length).to.equal(3);
    expect(offers1[0].bidder).to.equal(bidder1.address); // Lowest price (price1)
    expect(offers1[1].bidder).to.equal(bidder2.address); // Middle price (price2)
    expect(offers1[2].bidder).to.equal(bidder4.address); // Highest price (price3)
  
    let offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(3);
    expect(offers2[0].bidder).to.equal(bidder1.address); // Lowest price (price2)
    expect(offers2[1].bidder).to.equal(bidder2.address); // Middle price (price3)
    expect(offers2[2].bidder).to.equal(bidder4.address); // Highest price (price4)
  
    let offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
    expect(offers3.length).to.equal(3);
    expect(offers3[0].bidder).to.equal(bidder3.address); // Lowest price (price2)
    expect(offers3[1].bidder).to.equal(bidder1.address); // Middle price (price3)
    expect(offers3[2].bidder).to.equal(bidder4.address); // Highest price (price4)
  
    let offers4 = await xrc721.getOffersForToken(tokenId3, 0, 10, true);
    expect(offers4.length).to.equal(3);
    expect(offers4[0].bidder).to.equal(bidder3.address); // Lowest price (price1)
    expect(offers4[1].bidder).to.equal(bidder4.address); // Middle price (price3)
    expect(offers4[2].bidder).to.equal(bidder1.address); // Highest price (price4)
  
    // Bidder1 withdraws their offer on tokenId0
    await xrc721.connect(bidder1).withdrawOffer(tokenId0);
  
    // Verify offers after withdrawal
    offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
    expect(offers1.length).to.equal(2);
    expect(offers1[0].bidder).to.equal(bidder2.address); // Now the lowest (price2)
    expect(offers1[1].bidder).to.equal(bidder4.address); // Highest (price3)
  
    // Owner accepts Bidder2's offer on tokenId0
    await xrc721.connect(owner).acceptOffer(tokenId0, bidder2.address);
  
    // Verify offers and ownership after acceptance
    offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
    expect(offers1.length).to.equal(1); // Only Bidder4's offer remains
    expect(offers1[0].bidder).to.equal(bidder4.address); // Bidder4's offer remains
    expect(await xrc721.ownerOf(tokenId0)).to.equal(bidder2.address);
  
    // Buyer1 buys tokenId0 from Bidder2
    await xrc721.connect(bidder2).listTokenForSale(tokenId0, price2);
    await xrc721.connect(buyer1).buyToken(tokenId0, price2, { value: price2 });

    // Verify ownership after purchase
    expect(await xrc721.ownerOf(tokenId0)).to.equal(buyer1.address);
  
    // Verify sales history for tokenId0
    let salesHistory1 = await xrc721.getTokenSalesHistory(tokenId0, 0, 10, true);
    expect(salesHistory1.length).to.equal(2); // 2 sales: owner to bidder2, bidder2 to buyer1
    expect(salesHistory1[0].seller).to.equal(owner.address);
    expect(salesHistory1[0].buyer).to.equal(bidder2.address);
    expect(salesHistory1[1].seller).to.equal(bidder2.address);
    expect(salesHistory1[1].buyer).to.equal(buyer1.address);
  
    // Mint another token and list it for sale
    await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId4, price5, "tokenURI5");
  
    // Bidder3 makes an offer on tokenId4
    await xrc721.connect(bidder3).makeOffer(tokenId4, { value: price3 });
  
    // Verify offer on tokenId4
    let offers5 = await xrc721.getOffersForToken(tokenId4, 0, 10, true);
    expect(offers5.length).to.equal(1);
    expect(offers5[0].bidder).to.equal(bidder3.address);
  
    // Owner accepts Bidder3's offer on tokenId2
    await xrc721.connect(owner).acceptOffer(tokenId2, bidder3.address);
  
    // Verify offers and ownership after acceptance
    offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
    expect(offers3.length).to.equal(2); // Bidder1's and Bidder4's offers remain
    expect(offers3[0].bidder).to.equal(bidder1.address); // Lower price (price3)
    expect(offers3[1].bidder).to.equal(bidder4.address); // Higher price (price4)
    expect(await xrc721.ownerOf(tokenId2)).to.equal(bidder3.address);
  
    // Bidder4 withdraws their offers on tokenId1 and tokenId3
    await xrc721.connect(bidder4).withdrawOffer(tokenId1);
    await xrc721.connect(bidder4).withdrawOffer(tokenId3);
  
    // Verify offers after withdrawals
    offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(2);
    expect(offers2[0].bidder).to.equal(bidder1.address); // Lower price (price2)
    expect(offers2[1].bidder).to.equal(bidder2.address); // Higher price (price3)
  
    offers4 = await xrc721.getOffersForToken(tokenId3, 0, 10, true);
    expect(offers4.length).to.equal(2);
    expect(offers4[0].bidder).to.equal(bidder3.address); // Lower price (price1)
    expect(offers4[1].bidder).to.equal(bidder1.address); // Higher price (price4)
  
    // Verify tokens metadata
    let metadata = await xrc721.getTokensMetadata(0, 5);
    expect(metadata.length).to.equal(5);
    expect(metadata[0]).to.equal("tokenURI1");
    expect(metadata[1]).to.equal("tokenURI2");
    expect(metadata[2]).to.equal("tokenURI3");
    expect(metadata[3]).to.equal("tokenURI4");
    expect(metadata[4]).to.equal("tokenURI5");
  
    // Bidder1 withdraws their remaining offers on tokenId1, tokenId2, and tokenId3
    await xrc721.connect(bidder1).withdrawOffer(tokenId1);
    await xrc721.connect(bidder1).withdrawOffer(tokenId2);
    await xrc721.connect(bidder1).withdrawOffer(tokenId3);
  
    // Verify offers after withdrawals
    offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(1);
    expect(offers2[0].bidder).to.equal(bidder2.address);
  
    offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
    expect(offers3.length).to.equal(1);
    expect(offers3[0].bidder).to.equal(bidder4.address);
  
    offers4 = await xrc721.getOffersForToken(tokenId3, 0, 10, true);
    expect(offers4.length).to.equal(1);
    expect(offers4[0].bidder).to.equal(bidder3.address);
  
    // Owner accepts Bidder2's offer on tokenId1
    await xrc721.connect(owner).acceptOffer(tokenId1, bidder2.address);
  
    // Verify offers and ownership after acceptance
    offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(0);
    expect(await xrc721.ownerOf(tokenId1)).to.equal(bidder2.address);
  
    // Verify the final state of offers
    offers1 = await xrc721.getOffersForToken(tokenId0, 0, 10, true);
    expect(offers1.length).to.equal(1);
    expect(offers1[0].bidder).to.equal(bidder4.address);
  
    offers2 = await xrc721.getOffersForToken(tokenId1, 0, 10, true);
    expect(offers2.length).to.equal(0);
  
    offers3 = await xrc721.getOffersForToken(tokenId2, 0, 10, true);
    expect(offers3.length).to.equal(1);
    expect(offers3[0].bidder).to.equal(bidder4.address);
  
    offers4 = await xrc721.getOffersForToken(tokenId3, 0, 10, true);
    expect(offers4.length).to.equal(1);
    expect(offers4[0].bidder).to.equal(bidder3.address);
  
    offers5 = await xrc721.getOffersForToken(tokenId4, 0, 10, true);
    expect(offers5.length).to.equal(1);
    expect(offers5[0].bidder).to.equal(bidder3.address);
  
    // Get current offer of address for a specific token
    let currentOffer = await xrc721.getCurrentOfferOfAddressForToken(tokenId2, bidder4.address);
    expect(currentOffer.bidder).to.equal(bidder4.address);
    expect(currentOffer.price).to.equal(price4);
  });

    it("Should return the correct number of minted tokens", async function () {
      // Initially, no tokens are minted
      expect(await xrc721.getTokenCount()).to.equal(0);

      // Mint a token
      await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
      expect(await xrc721.getTokenCount()).to.equal(1);

      // Mint another token
      await xrc721.mintAndListForSale(owner.address, tokenId1, price2, "tokenURI2");
      expect(await xrc721.getTokenCount()).to.equal(2);
    });

    it("Should return the correct number of unique owners after minting, listing, selling, and consolidating ownership", async function () {
      // Initially, no owners
      expect(await xrc721.getOwnerCount()).to.equal(0);
  
      // Mint a token to owner
      await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
      expect(await xrc721.getOwnerCount()).to.equal(1);
  
      // Mint another token to a different address
      await xrc721.mintAndListForSale(bidder1.address, tokenId1, price2, "tokenURI2");
      expect(await xrc721.getOwnerCount()).to.equal(2);
  
      // Mint another token to a third address
      await xrc721.mintAndListForSale(bidder2.address, tokenId2, price3, "tokenURI3");
      expect(await xrc721.getOwnerCount()).to.equal(3);
  
      // Sell tokenId0 from owner to bidder3
      await xrc721.connect(bidder3).makeOffer(tokenId0, { value: price1 });
      await xrc721.connect(owner).acceptOffer(tokenId0, bidder3.address);
      expect(await xrc721.getOwnerCount()).to.equal(3);
  
      // Sell tokenId1 from bidder1 to bidder3 (consolidating ownership)
      await xrc721.connect(bidder3).makeOffer(tokenId1, { value: price2 });
      await xrc721.connect(bidder1).acceptOffer(tokenId1, bidder3.address);
      expect(await xrc721.getOwnerCount()).to.equal(2); // Decrease in unique owners
  
      // Sell tokenId2 from bidder2 to bidder3 (further consolidating ownership)
      await xrc721.connect(bidder3).makeOffer(tokenId2, { value: price3 });
      await xrc721.connect(bidder2).acceptOffer(tokenId2, bidder3.address);
      expect(await xrc721.getOwnerCount()).to.equal(1); // Further decrease in unique owners
  });

  it("Should refund the existing offer and emit WithdrawOffer when the token is purchased", async function () {
    // Bidder1 makes an offer on the token
    await xrc721.mintAndListForSale(owner.address, tokenId, salePrice, "tokenURI1");

    await xrc721.connect(bidder1).makeOffer(tokenId, { value: offerPrice1 });

    // Record the balance of the bidder before the purchase
    const balanceBeforePurchase = await ethers.provider.getBalance(bidder1.address);

    // Bidder1 purchases the token
    const purchaseTx = await xrc721.connect(bidder1).buyToken(tokenId, salePrice, { value: salePrice });

    // Record the balance of the bidder after the purchase
    const balanceAfterPurchase = await ethers.provider.getBalance(bidder1.address);

    // Check that the offer was refunded (balance after purchase should be balance before purchase - salePrice + offerPrice)
    expect(balanceAfterPurchase).to.equal(
      balanceBeforePurchase - salePrice + offerPrice1
    );

    // Verify that the token's ownership has changed
    expect(await xrc721.ownerOf(tokenId)).to.equal(bidder1.address);

    // Check that the WithdrawOffer event was emitted correctly
    await expect(purchaseTx)
        .to.emit(xrc721, "WithdrawOffer")
        .withArgs(tokenId, bidder1.address, offerPrice1);
});


    it("Should return the correct royalty percentage", async function () {
      // Check the royalty percentage
      expect(await xrc721.ROYALTY_FRACTION()).to.equal(ROYALTY_FRACTION);
    });

    it("Should return the correct floor price", async function () {
      // Initially, no tokens are listed for sale, so getting the floor price should fail
      // await expect(xrc721.getFloorPrice()).to.be.revertedWith("XRC721: No tokens are currently listed for sale");
    await expect(xrc721.getFloorPrice()).to.be.revertedWithCustomError(xrc721, "NoTokensListed");

      // Mint and list tokens for sale
      // await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
      await xrc721.mintAndListForSale(owner.address, tokenId1, price2, "tokenURI2");
      // await xrc721.mintAndListForSale(owner.address, tokenId2, price1, "tokenURI3");
      await xrc721.mintAndListForSale(owner.address, tokenId3, price4, "tokenURI4");


      // Check the floor price
      expect(await xrc721.getFloorPrice()).to.equal(price2);

      // List another token at a lower price and check the floor price again
      // const lowerPrice = ethers.parseEther("12500");
      const lowerPrice = price1;
      await xrc721.mintAndListForSale(owner.address, tokenId4, lowerPrice, "tokenURI5");
      expect(await xrc721.getFloorPrice()).to.equal(lowerPrice);
  });

  it("should correctly handle global offers in complex scenarios", async function () {
    // Initial setup: mint some tokens
    await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
    await xrc721.mintAndListForSale(owner.address, tokenId1, price2, "tokenURI2");
    await xrc721.mintAndListForSale(owner.address, tokenId2, price3, "tokenURI3");
    await xrc721.mintAndListForSale(owner.address, tokenId3, price4, "tokenURI4");
    await xrc721.mintAndListForSale(owner.address, tokenId4, price5, "tokenURI5");
  
    // Make offers with various prices to create a diverse offer landscape
    // Test 1: Multiple offers for the same token with different prices
    await xrc721.connect(bidder1).makeOffer(tokenId0, { value: ethers.parseEther("25000") });
    await xrc721.connect(bidder2).makeOffer(tokenId0, { value: ethers.parseEther("37500") });
    await xrc721.connect(bidder3).makeOffer(tokenId0, { value: ethers.parseEther("50000") });
  
    // Test 2: Multiple offers from the same bidder for different tokens
    await xrc721.connect(bidder1).makeOffer(tokenId1, { value: ethers.parseEther("62500") });
    await xrc721.connect(bidder1).makeOffer(tokenId2, { value: ethers.parseEther("75000") });
  
    // Test 3: Offers with equal prices but different tokenIds
    await xrc721.connect(bidder2).makeOffer(tokenId3, { value: ethers.parseEther("50000") });
    await xrc721.connect(bidder3).makeOffer(tokenId4, { value: ethers.parseEther("50000") });
  
    // Verify initial state of global offers (should be ordered by price, then tokenId)
    let globalOffers = await xrc721.getGlobalOffers(0, 10, true);
    expect(globalOffers.length).to.equal(7);
    expect(globalOffers[0].price).to.equal(ethers.parseEther("25000"));
    expect(globalOffers[0].tokenId).to.equal(tokenId0);
    expect(globalOffers[0].bidder).to.equal(bidder1.address);
  
    // Test 4: Withdraw an offer and verify global offers update
    await xrc721.connect(bidder1).withdrawOffer(tokenId0);
    globalOffers = await xrc721.getGlobalOffers(0, 10, true);
    expect(globalOffers.length).to.equal(6);
    expect(globalOffers[0].price).to.equal(ethers.parseEther("37500"));
    expect(globalOffers[0].tokenId).to.equal(tokenId0);
    expect(globalOffers[0].bidder).to.equal(bidder2.address);
  
    // Test 5: Accept an offer and verify global offers update
    await xrc721.connect(owner).acceptOffer(tokenId0, bidder2.address);
    globalOffers = await xrc721.getGlobalOffers(0, 10, true);
    expect(globalOffers.length).to.equal(5);
  
    // Test 6: Make new offers after previous offers are gone
    await xrc721.connect(bidder4).makeOffer(tokenId0, { value: ethers.parseEther("62500") });
    globalOffers = await xrc721.getGlobalOffers(0, 10, true);
    expect(globalOffers.length).to.equal(6);
    
    // Test 7: Test pagination of global offers
    let firstPage = await xrc721.getGlobalOffers(0, 2, true);
    expect(firstPage.length).to.equal(2);
    let secondPage = await xrc721.getGlobalOffers(2, 2, true);
    expect(secondPage.length).to.equal(2);
    let lastPage = await xrc721.getGlobalOffers(4, 2, true);
    expect(lastPage.length).to.equal(2);
  
    // Test 8: Make an offer, update it with a higher price, and verify global offers update
    await xrc721.connect(bidder4).makeOffer(tokenId1, { value: ethers.parseEther("87500") });
    globalOffers = await xrc721.getGlobalOffers(0, 10, true);
    expect(globalOffers[globalOffers.length - 1].price).to.equal(ethers.parseEther("87500"));
  
    // // Test 9: Verify that selling a token removes all offers for that token from global offers
    // await xrc721.connect(owner).listTokenForSale(tokenId2, ethers.parseEther("100000"));
    // await xrc721.connect(buyer1).buyToken(tokenId2, { value: ethers.parseEther("100000") });
    // globalOffers = await xrc721.getGlobalOffers(0, 10, true);
    
    // // Should not find any offers for tokenId2
    // const hastokenId2Offers = globalOffers.some(offer => offer.tokenId === tokenId2);
    // expect(hastokenId2Offers).to.be.false;
  
    // Test 10: Try to get global offers with out-of-range index
    const offersPastEnd = await xrc721.getGlobalOffers(1000, 10, true);
    expect(offersPastEnd.length).to.equal(0);  // Should return empty array for out of range index
    // await expect(xrc721.getGlobalOffers(0, 0, true)).to.be.revertedWith("Count must be > 0");
    await expect(xrc721.getGlobalOffers(0, 0, true)).to.be.revertedWithCustomError(xrc721, "CountMustBePositive");

    // Test 11: Create a complex scenario with rapid offer creation and removal
    for (let i = 0; i < 5; i++) {
      await xrc721.connect(bidder1).makeOffer(tokenId3, { value: ethers.parseEther((50000 + 250 * i).toString()) });
      await xrc721.connect(bidder1).withdrawOffer(tokenId3);
    }

    expect(globalOffers.length).to.equal(7);
    
    // Make a final set of offers to verify state after rapid changes
    await xrc721.connect(bidder1).makeOffer(tokenId3, { value: ethers.parseEther("75000") });
    await xrc721.connect(bidder2).makeOffer(tokenId3, { value: ethers.parseEther("87500") });
    await xrc721.connect(bidder3).makeOffer(tokenId3, { value: ethers.parseEther("100000") });
  
    globalOffers = await xrc721.getGlobalOffers(0, 20, true);

    expect(globalOffers.length).to.equal(9);
    
    // Verify final state
    //offer.tokenId is a BigNumber so needs to be ==, not === for below line to pass
    let tokenId3Offers = globalOffers.filter(offer => offer.tokenId == tokenId3);
    expect(tokenId3Offers.length).to.equal(3);
    expect(tokenId3Offers[0].price).to.equal(ethers.parseEther("75000"));
    expect(tokenId3Offers[1].price).to.equal(ethers.parseEther("87500"));
    expect(tokenId3Offers[2].price).to.equal(ethers.parseEther("100000"));
  
    // Test 12: Verify global offers maintains correct order after all operations
    const isOrdered = globalOffers.every((offer, i) => {
      if (i === 0) return true;
      const prev = globalOffers[i - 1];
      if (prev.price === offer.price) {
        return prev.tokenId <= offer.tokenId;
      }
      return prev.price < offer.price;
    });
    expect(isOrdered).to.be.true;
  });

  it("should handle complex global offers scenarios", async function () {
    // Initial setup: mint tokens
    await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
    await xrc721.mintAndListForSale(owner.address, tokenId1, price2, "tokenURI2");
    await xrc721.mintAndListForSale(owner.address, tokenId2, price3, "tokenURI3");
    await xrc721.mintAndListForSale(owner.address, tokenId3, price4, "tokenURI4");
    await xrc721.mintAndListForSale(owner.address, tokenId4, price5, "tokenURI5");

    // Test 1: Multiple offers for the same token with different prices
    await xrc721.connect(bidder1).makeOffer(tokenId0, { value: ethers.parseEther("25000") });
    await xrc721.connect(bidder2).makeOffer(tokenId0, { value: ethers.parseEther("37500") });
    await xrc721.connect(bidder3).makeOffer(tokenId0, { value: ethers.parseEther("50000") });

    // Test 2: Multiple offers from the same bidder for different tokens
    await xrc721.connect(bidder1).makeOffer(tokenId1, { value: ethers.parseEther("62500") });
    await xrc721.connect(bidder1).makeOffer(tokenId2, { value: ethers.parseEther("75000") });

    // Test 3: Offers with equal prices but different tokenIds
    await xrc721.connect(bidder2).makeOffer(tokenId3, { value: ethers.parseEther("50000") });
    await xrc721.connect(bidder3).makeOffer(tokenId4, { value: ethers.parseEther("50000") });

    // Test 4: Verify initial state of global offers (ordered by price, then tokenId)
    let globalOffers = await xrc721.getGlobalOffers(0, 10, true);
    expect(globalOffers.length).to.equal(7);
    expect(globalOffers[0].price).to.equal(ethers.parseEther("25000"));
    expect(globalOffers[0].tokenId).to.equal(tokenId0);
    expect(globalOffers[0].bidder).to.equal(bidder1.address);

    // Test 5: Withdraw an offer and verify global offers update
    await xrc721.connect(bidder1).withdrawOffer(tokenId0);
    globalOffers = await xrc721.getGlobalOffers(0, 10, true);
    expect(globalOffers.length).to.equal(6);
    expect(globalOffers[0].price).to.equal(ethers.parseEther("37500"));
    expect(globalOffers[0].tokenId).to.equal(tokenId0);
    expect(globalOffers[0].bidder).to.equal(bidder2.address);

    // Test 6: Accept an offer and verify global offers update
    await xrc721.connect(owner).acceptOffer(tokenId0, bidder2.address);
    globalOffers = await xrc721.getGlobalOffers(0, 10, true);
    expect(globalOffers.length).to.equal(5);

    // Test 7: Make new offers after previous offers are gone
    await xrc721.connect(bidder4).makeOffer(tokenId0, { value: ethers.parseEther("62500") });
    globalOffers = await xrc721.getGlobalOffers(0, 10, true);
    expect(globalOffers.length).to.equal(6);

    // Test 8: Test pagination of global offers
    let firstPage = await xrc721.getGlobalOffers(0, 2, true);
    expect(firstPage.length).to.equal(2);
    let secondPage = await xrc721.getGlobalOffers(2, 2, true);
    expect(secondPage.length).to.equal(2);
    let lastPage = await xrc721.getGlobalOffers(4, 2, true);
    expect(lastPage.length).to.equal(2);

    // Test 9: Make an offer, update it with a higher price, and verify global offers update
    await xrc721.connect(bidder4).makeOffer(tokenId1, { value: ethers.parseEther("87500") });
    globalOffers = await xrc721.getGlobalOffers(0, 10, true);
    expect(globalOffers[globalOffers.length - 1].price).to.equal(ethers.parseEther("87500"));

    // Test 10: Try to get global offers with out-of-range index
    const offersPastEnd = await xrc721.getGlobalOffers(1000, 10, true);
    expect(offersPastEnd.length).to.equal(0);
    // await expect(xrc721.getGlobalOffers(0, 0, true)).to.be.revertedWith("Count must be > 0");
    await expect(xrc721.getGlobalOffers(0, 0, true)).to.be.revertedWithCustomError(xrc721, "CountMustBePositive");

    // Test 11: Extreme price scenario
    // const maxPrice = ethers.MaxUint256;
    const maxPrice = ethers.parseEther("25000000");;
    await xrc721.connect(bidder5).makeOffer(tokenId0, { value: maxPrice });
    globalOffers = await xrc721.getGlobalOffers(0, 20, true);
    expect(globalOffers[globalOffers.length - 1].price).to.equal(maxPrice);

    // Test 12: Prevent duplicate offers from same bidder on same token
    await xrc721.connect(bidder6).makeOffer(tokenId1, { value: ethers.parseEther("100000") });
    await expect(
        xrc721.connect(bidder6).makeOffer(tokenId1, { value: ethers.parseEther("112500") })
    ).to.emit(xrc721, "WithdrawOffer");

    // Test 13: Mass offer creation and deletion
    const numOffers = 10;
    for (let i = 0; i < numOffers; i++) {
        await xrc721.connect(bidder7).makeOffer(
            tokenId2, 
            { value: ethers.parseEther((25000 + 250 * i).toString()) }
        );
    }

    globalOffers = await xrc721.getGlobalOffers(0, numOffers + 10, true);
    expect(globalOffers.filter(offer => offer.tokenId == tokenId2).length).to.equal(2);

    // Test 14: Verify reverse order of global offers
    const reverseOffers = await xrc721.getGlobalOffers(0, 20, false);
    const isDescendingOrder = reverseOffers.every((offer, i) => {
        if (i === 0) return true;
        const prev = reverseOffers[i - 1];
        if (prev.price === offer.price) {
            return prev.tokenId >= offer.tokenId;
        }
        return prev.price > offer.price;
    });
    expect(isDescendingOrder).to.be.true;

    // Test 15: Complex ordering with same price different tokens
    await xrc721.connect(bidder8).makeOffer(tokenId3, { value: ethers.parseEther("125000") });
    await xrc721.connect(bidder9).makeOffer(tokenId4, { value: ethers.parseEther("125000") });

    globalOffers = await xrc721.getGlobalOffers(0, 20, true);
    const samepriceOffers = globalOffers.filter(offer => offer.price === ethers.parseEther("125000"));
    expect(samepriceOffers[0].tokenId).to.equal(tokenId3);
    expect(samepriceOffers[1].tokenId).to.equal(tokenId4);

    // Final verification of global offers ordering
    const isAscendingOrder = globalOffers.every((offer, i) => {
        if (i === 0) return true;
        const prev = globalOffers[i - 1];
        if (prev.price === offer.price) {
            return prev.tokenId <= offer.tokenId;
        }
        return prev.price < offer.price;
    });
    expect(isAscendingOrder).to.be.true;
  });

  it("should handle complex global offers scenarios with intermixed offers and withdrawals", async function () {
    // Initial setup: mint tokens
    await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
    await xrc721.mintAndListForSale(owner.address, tokenId1, price2, "tokenURI2");
    await xrc721.mintAndListForSale(owner.address, tokenId2, price3, "tokenURI3");
    await xrc721.mintAndListForSale(owner.address, tokenId3, price4, "tokenURI4");
    await xrc721.mintAndListForSale(owner.address, tokenId4, price5, "tokenURI5");
  
    // Test 1: Multiple offers for the same token with different prices
    await xrc721.connect(bidder1).makeOffer(tokenId0, { value: ethers.parseEther("25000") });
    await xrc721.connect(bidder2).makeOffer(tokenId0, { value: ethers.parseEther("37500") });
    await xrc721.connect(bidder3).makeOffer(tokenId0, { value: ethers.parseEther("50000") });
  
    // Test 2: Multiple offers from the same bidder for different tokens
    await xrc721.connect(bidder1).makeOffer(tokenId1, { value: ethers.parseEther("62500") });
    await xrc721.connect(bidder1).makeOffer(tokenId2, { value: ethers.parseEther("75000") });
  
    // Test 3: Offers with equal prices but different tokenIds
    await xrc721.connect(bidder2).makeOffer(tokenId3, { value: ethers.parseEther("50000") });
    await xrc721.connect(bidder3).makeOffer(tokenId4, { value: ethers.parseEther("50000") });
  
    // Test 4: Verify initial state of global offers
    let globalOffers = await xrc721.getGlobalOffers(0, 10, true);
    expect(globalOffers.length).to.equal(7);
  
    // Test 5: Complex series of offer creations and withdrawals
    await xrc721.connect(bidder4).makeOffer(tokenId2, { value: ethers.parseEther("80000") });
    await xrc721.connect(bidder1).withdrawOffer(tokenId1);
    await xrc721.connect(bidder5).makeOffer(tokenId1, { value: ethers.parseEther("67500") });
    await xrc721.connect(bidder2).withdrawOffer(tokenId0);
    await xrc721.connect(bidder3).withdrawOffer(tokenId4);
    await xrc721.connect(bidder6).makeOffer(tokenId4, { value: ethers.parseEther("52500") });
  
    globalOffers = await xrc721.getGlobalOffers(0, 20, true);
    expect(globalOffers.length).to.equal(7);

  //   globalOffers.forEach((offer, index) => {
  //     console.log(`Offer ${index}:`, 
  //         "TokenId:", offer.tokenId.toString(), 
  //         "Bidder:", offer.bidder, 
  //         "Price:", ethers.formatEther(offer.price)
  //     );
  // });
  
    // Test 6: Verify specific offer states after complex interactions
    expect(globalOffers.find(o => o.bidder == bidder1.address && o.tokenId == tokenId1)).to.be.undefined;
    expect(globalOffers.find(o => o.bidder == bidder4.address && o.tokenId == tokenId2)).to.not.be.undefined;
    expect(globalOffers.find(o => o.bidder == bidder5.address && o.tokenId == tokenId1)).to.not.be.undefined;
  
    // Test 7: Make overlapping offers and withdrawals
    await xrc721.connect(bidder7).makeOffer(tokenId3, { value: ethers.parseEther("55000") });
    await xrc721.connect(bidder2).withdrawOffer(tokenId3);
    await xrc721.connect(bidder8).makeOffer(tokenId3, { value: ethers.parseEther("57500") });
    await xrc721.connect(bidder7).withdrawOffer(tokenId3);
  
    globalOffers = await xrc721.getGlobalOffers(0, 20, true);
    const tokenId3Offers = globalOffers.filter(o => o.tokenId == tokenId3);
    expect(tokenId3Offers.length).to.equal(1);
    expect(tokenId3Offers[0].bidder).to.equal(bidder8.address);
  
    // Test 8: Rapid offer creation and withdrawal
    for (let i = 0; i < 5; i++) {
      await xrc721.connect(eval(`bidder${i+1}`)).makeOffer(tokenId0, { value: ethers.parseEther((137500 + 250 * i).toString()) });
      if (i % 2 === 0) {
        await xrc721.connect(eval(`bidder${i+1}`)).withdrawOffer(tokenId0);
      }
    }
  
    globalOffers = await xrc721.getGlobalOffers(0, 30, true);
    const tokenId0Offers = globalOffers.filter(o => o.tokenId == tokenId0);
    expect(tokenId0Offers.length).to.equal(2);  // 5 offers created, 3 removed 0,2,4 because % 2 even
  
    // Test 9: Verify correct ordering after complex interactions
    const isAscendingOrder = globalOffers.every((offer, i) => {
      if (i === 0) return true;
      const prev = globalOffers[i - 1];
      if (prev.price === offer.price) {
        return prev.tokenId <= offer.tokenId;
      }
      return prev.price < offer.price;
    });
    expect(isAscendingOrder).to.be.true;
  
    // Test 10: Final complex interaction
    await xrc721.connect(bidder9).makeOffer(tokenId4, { value: ethers.parseEther("100000") });
    await xrc721.connect(bidder6).withdrawOffer(tokenId4);
    await xrc721.connect(bidder10).makeOffer(tokenId4, { value: ethers.parseEther("97500") });
  
    globalOffers = await xrc721.getGlobalOffers(0, 30, true);
    const finalTokenId4Offers = globalOffers.filter(o => o.tokenId == tokenId4);
    expect(finalTokenId4Offers.length).to.equal(2);
    expect(finalTokenId4Offers[0].price).to.equal(ethers.parseEther("97500"));
    expect(finalTokenId4Offers[1].price).to.equal(ethers.parseEther("100000"));
  });

  it("should correctly handle global sales in complex scenarios", async function () {
    // Initial setup: mint some tokens
    await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
    await xrc721.mintAndListForSale(owner.address, tokenId1, price2, "tokenURI2");
    await xrc721.mintAndListForSale(owner.address, tokenId2, price3, "tokenURI3");
    await xrc721.mintAndListForSale(owner.address, tokenId3, price4, "tokenURI4");
    await xrc721.mintAndListForSale(owner.address, tokenId4, price5, "tokenURI5");
    // await xrc721.mintAndListForSale(owner.address, tokenId5, price6, "tokenURI5");
  
    // Test 1: Make several sales
    await xrc721.connect(buyer1).buyToken(tokenId0, price1, { value: price1 });
    await xrc721.connect(buyer2).buyToken(tokenId1, price2, { value: price2 });
    await xrc721.connect(buyer3).buyToken(tokenId2, price3, { value: price3 });

    // Test 2: Verify initial state of global sales
    let globalSales = await xrc721.getGlobalSales(0, 10, true);
    expect(globalSales.length).to.equal(3);
    expect(globalSales[0].price).to.equal(price1);
    expect(globalSales[0].tokenId).to.equal(tokenId0);
    expect(globalSales[0].buyer).to.equal(buyer1.address);
  
    // Test 3: Make an offer and accept it
    await xrc721.connect(bidder1).makeOffer(tokenId3, { value: ethers.parseEther("50000") });
    await xrc721.connect(owner).acceptOffer(tokenId3, bidder1.address);
    
    globalSales = await xrc721.getGlobalSales(0, 10, true);
    expect(globalSales.length).to.equal(4);
    expect(globalSales[3].price).to.equal(ethers.parseEther("75000"));
    expect(globalSales[3].tokenId).to.equal(tokenId2);
    expect(globalSales[3].buyer).to.equal(buyer3.address);
  
    // Test 4: Test pagination of global sales
    let firstPage = await xrc721.getGlobalSales(0, 2, true);
    expect(firstPage.length).to.equal(2);
    let secondPage = await xrc721.getGlobalSales(2, 2, true);
    expect(secondPage.length).to.equal(2);
  
    // Test 5: Try to get global sales with out-of-range index
    const salesPastEnd = await xrc721.getGlobalSales(1000, 10, true);
    expect(salesPastEnd.length).to.equal(0);
    // await expect(xrc721.getGlobalSales(0, 0, true)).to.be.revertedWith("Count must be > 0");
    await expect(xrc721.getGlobalSales(0, 0, true)).to.be.revertedWithCustomError(xrc721, "CountMustBePositive");

    await xrc721.connect(owner).removeTokenFromSale(tokenId4);
    // Test 6: Create a complex scenario with rapid sales
    for (let i = 0; i < 5; i++) {
      const currentOwner = i === 0 ? owner : eval(`buyer${i}`);
      await xrc721.connect(currentOwner).listTokenForSale(tokenId4, ethers.parseEther((75000 + 250 * i).toString()));
      await xrc721.connect(eval(`buyer${i+1}`)).buyToken(tokenId4, ethers.parseEther((75000 + 250 * i).toString()), { value: ethers.parseEther((75000 + 250 * i).toString()) });
    }
  
    globalSales = await xrc721.getGlobalSales(0, 20, true);
    expect(globalSales.length).to.equal(9);
  
    // Test 7: Verify global sales maintains correct order after all operations
    const isOrdered = globalSales.every((sale, i) => {
      if (i === 0) return true;
      const prev = globalSales[i - 1];
      if (prev.price === sale.price) {
        return prev.tokenId <= sale.tokenId;
      }
      return prev.price < sale.price;
    });
    expect(isOrdered).to.be.true;
  });
  
  it("should handle complex global sales scenarios", async function () {
    // Initial setup: mint tokens
    await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
    await xrc721.mintAndListForSale(owner.address, tokenId1, price2, "tokenURI2");
    await xrc721.mintAndListForSale(owner.address, tokenId2, price3, "tokenURI3");
    await xrc721.mintAndListForSale(owner.address, tokenId3, price4, "tokenURI4");
    await xrc721.mintAndListForSale(owner.address, tokenId4, price5, "tokenURI5");
  
    // Test 1: Multiple sales of different tokens
    await xrc721.connect(buyer1).buyToken(tokenId0, price1, { value: price1 });
    await xrc721.connect(buyer2).buyToken(tokenId1, price2, { value: price2 });
    await xrc721.connect(buyer3).buyToken(tokenId2, price3, { value: price3 });

    // Test 2: Multiple sales of the same token
    await xrc721.connect(buyer1).buyToken(tokenId3, price4, { value: price4 });
    await xrc721.connect(buyer1).listTokenForSale(tokenId3, ethers.parseEther("62500"));
    await xrc721.connect(buyer3).buyToken(tokenId3, ethers.parseEther("62500"), { value: ethers.parseEther("62500") });
  
    // Test 3: Verify state of global sales
    let globalSales = await xrc721.getGlobalSales(0, 10, true);
    expect(globalSales.length).to.equal(5);
    expect(globalSales[0].price).to.equal(price1);
    expect(globalSales[0].tokenId).to.equal(tokenId0);
    expect(globalSales[0].buyer).to.equal(buyer1.address);
  
    // Test 4: Test pagination of global sales
    let firstPage = await xrc721.getGlobalSales(0, 2, true);
    expect(firstPage.length).to.equal(2);
    let secondPage = await xrc721.getGlobalSales(2, 2, true);
    expect(secondPage.length).to.equal(2);
    let lastPage = await xrc721.getGlobalSales(4, 2, true);
    expect(lastPage.length).to.equal(1);
  
    // Test 5: Try to get global sales with out-of-range index
    const salesPastEnd = await xrc721.getGlobalSales(1000, 10, true);
    expect(salesPastEnd.length).to.equal(0);
    // await expect(xrc721.getGlobalSales(0, 0, true)).to.be.revertedWith("Count must be > 0");
    await expect(xrc721.getGlobalSales(0, 0, true)).to.be.revertedWithCustomError(xrc721, "CountMustBePositive");

    // Test 6: Extreme price scenario
    const maxPrice = ethers.parseEther("25000000");
    await xrc721.connect(owner).removeTokenFromSale(tokenId4);
    await xrc721.connect(owner).listTokenForSale(tokenId4, maxPrice);
    await xrc721.connect(buyer4).buyToken(tokenId4, maxPrice, { value: maxPrice });
    globalSales = await xrc721.getGlobalSales(0, 20, true);
    expect(globalSales[globalSales.length - 1].price).to.equal(maxPrice);

    // Test 7: Mass sale creation
    const numSales = 10;
    for (let i = 0; i < numSales; i++) {
      await xrc721.connect(owner).mintAndListForSale(owner.address, 1000 + i, ethers.parseEther((25000 + 250 * i).toString()), `tokenURI${1000 + i}`);
      await xrc721.connect(eval(`buyer${(i % 4) + 1}`)).buyToken(1000 + i, ethers.parseEther((25000 + 250 * i).toString()), { value: ethers.parseEther((25000 + 250 * i).toString()) });
    }
  
    globalSales = await xrc721.getGlobalSales(0, numSales + 20, true);
    expect(globalSales.length).to.equal(numSales + 6);
  
    // Test 8: Verify reverse order of global sales
    const reverseSales = await xrc721.getGlobalSales(0, 20, false);
    const isDescendingOrder = reverseSales.every((sale, i) => {
      if (i === 0) return true;
      const prev = reverseSales[i - 1];
      if (prev.price === sale.price) {
        return prev.tokenId >= sale.tokenId;
      }
      return prev.price > sale.price;
    });
    expect(isDescendingOrder).to.be.true;
  
    // Test 9: Complex ordering with same price different tokens
    await xrc721.connect(owner).mintAndListForSale(owner.address, 2000, ethers.parseEther("125000"), "tokenURI2000");
    await xrc721.connect(owner).mintAndListForSale(owner.address, 2001, ethers.parseEther("125000"), "tokenURI2001");
    await xrc721.connect(buyer1).buyToken(2000, ethers.parseEther("125000"), { value: ethers.parseEther("125000") });
    await xrc721.connect(buyer2).buyToken(2001, ethers.parseEther("125000"), { value: ethers.parseEther("125000") });
  
    globalSales = await xrc721.getGlobalSales(0, 30, true);
    const samePriceSales = globalSales.filter(sale => sale.price === ethers.parseEther("125000"));
    expect(samePriceSales[0].tokenId).to.equal(2000);
    expect(samePriceSales[1].tokenId).to.equal(2001);
  
    // Final verification of global sales ordering
    const isAscendingOrder = globalSales.every((sale, i) => {
      if (i === 0) return true;
      const prev = globalSales[i - 1];
      if (prev.price === sale.price) {
        return prev.tokenId <= sale.tokenId;
      }
      return prev.price < sale.price;
    });
    expect(isAscendingOrder).to.be.true;
  });

  it("should handle complex global sales scenarios with mixed offers and sales", async function () {
    // Initial setup: mint tokens
    for (let i = 1; i <= 10; i++) {
      await xrc721.mintAndListForSale(owner.address, i, ethers.parseEther((25000 + 250 * i).toString()), `tokenURI${i}`);
    }
  
    // Test 1: Multiple offers from same bidder for different tokens
    for (let i = 1; i <= 5; i++) {
      await xrc721.connect(bidder1).makeOffer(i, { value: ethers.parseEther((37500 + 125 * i).toString()) });
    }
  
    // Test 2: Offers from different bidders
    await xrc721.connect(bidder2).makeOffer(2, { value: ethers.parseEther("42500") });
    await xrc721.connect(bidder3).makeOffer(3, { value: ethers.parseEther("45000") });
    await xrc721.connect(bidder4).makeOffer(4, { value: ethers.parseEther("47500") });
  
    // Test 3: Direct purchases mixed with offer acceptances
    await xrc721.connect(buyer1).buyToken(1, ethers.parseEther("25250"), { value: ethers.parseEther("25250") });
    await xrc721.connect(owner).acceptOffer(2, bidder2.address);
    await xrc721.connect(buyer2).buyToken(5, ethers.parseEther("26250"), { value: ethers.parseEther("26250") });
    await xrc721.connect(owner).acceptOffer(3, bidder3.address);
  
    // Test 4: Update offers and accept higher ones
    await xrc721.connect(bidder1).makeOffer(4, { value: ethers.parseEther("50000") });
    await xrc721.connect(owner).acceptOffer(4, bidder1.address);
  
    // Test 5: Verify initial state of global sales
    let globalSales = await xrc721.getGlobalSales(0, 10, true);
    expect(globalSales.length).to.equal(5);
    expect(globalSales[0].price).to.equal(ethers.parseEther("25250"));
    expect(globalSales[0].tokenId).to.equal(1);
    expect(globalSales[0].buyer).to.equal(buyer1.address);
  
    // Test 6: More complex offer and sale patterns
    await xrc721.connect(bidder5).makeOffer(6, { value: ethers.parseEther("42500") });
    await xrc721.connect(bidder6).makeOffer(6, { value: ethers.parseEther("45000") });
    await xrc721.connect(bidder7).makeOffer(7, { value: ethers.parseEther("47500") });
    await xrc721.connect(bidder8).makeOffer(8, { value: ethers.parseEther("50000") });
  
    await xrc721.connect(owner).acceptOffer(6, bidder6.address);
    // expectedPrice must match the exact listing price from mintAndListForSale above.
    // Using the same expression (25000 + 250 * 7) because JS floating point makes
    // "1.7" !== (25000 + 250 * 7).toString() — they differ by 200 wei.
    // In production, read price from contract (getTokenPrice) to avoid this.
    await xrc721.connect(buyer3).buyToken(7, ethers.parseEther((25000 + 250 * 7).toString()), { value: ethers.parseEther((25000 + 250 * 7).toString()) });
    await xrc721.connect(owner).acceptOffer(8, bidder8.address);
  
    // Test 7: Reselling of tokens
    await xrc721.connect(bidder6).listTokenForSale(6, ethers.parseEther("62500"));
    await xrc721.connect(buyer4).buyToken(6, ethers.parseEther("62500"), { value: ethers.parseEther("62500") });
  
    // Test 8: Verify updated global sales
    globalSales = await xrc721.getGlobalSales(0, 20, true);
    expect(globalSales.length).to.equal(9);
  
    // Test 9: Verify correct ordering
    const isOrdered = globalSales.every((sale, i) => {
      if (i === 0) return true;
      const prev = globalSales[i - 1];
      if (prev.price === sale.price) {
        return prev.tokenId <= sale.tokenId;
      }
      return prev.price < sale.price;
    });
    expect(isOrdered).to.be.true;
  
    // Test 10: Pagination and reverse ordering
    let firstPage = await xrc721.getGlobalSales(0, 3, true);
    expect(firstPage.length).to.equal(3);
    // let lastPage = await xrc721.getGlobalSales(0, 3, false);
    // expect(lastPage.length).to.equal(3);

    //  globalSales = await xrc721.getGlobalSales(Number(await xrc721.getGlobalSalesCount()) - 1, 20, false);
    // globalSales.forEach((sale, index) => {
    //     console.log(`Sale ${index}:`, 
    //         "TokenId:", sale.tokenId.toString(), 
    //         "Price:", ethers.formatEther(sale.price)
    //     );
    // });

    let lastPage = await xrc721.getGlobalSales(Number(await xrc721.getGlobalSalesCount()) - 1, 3, false);
    expect(lastPage[0].price).to.equal(ethers.parseEther("62500"));
  
    // Test 11: Extreme price scenario
    const maxPrice = ethers.parseEther("25000000");
    await xrc721.connect(owner).removeTokenFromSale(9);
    await xrc721.connect(owner).listTokenForSale(9, maxPrice);
    await xrc721.connect(buyer5).buyToken(9, maxPrice, { value: maxPrice });
  
    globalSales = await xrc721.getGlobalSales(0, 20, true);
    expect(globalSales[globalSales.length - 1].price).to.equal(maxPrice);
  
    // Test 12: Mass rapid sales
    for (let i = 11; i <= 20; i++) {
      await xrc721.mintAndListForSale(owner.address, i, ethers.parseEther((25000 + 250 * i).toString()), `tokenURI${i}`);
      await xrc721.connect(eval(`buyer${(i % 5) + 1}`)).buyToken(i, ethers.parseEther((25000 + 250 * i).toString()), { value: ethers.parseEther((25000 + 250 * i).toString()) });
    }
  
    // Test 13: Verify final state of global sales
    globalSales = await xrc721.getGlobalSales(0, 30, true);
    expect(globalSales.length).to.equal(20);
  
    // Test 14: Check for specific complex interactions
    const token6Sales = globalSales.filter(sale => sale.tokenId == 6);
    expect(token6Sales.length).to.equal(2);
    expect(token6Sales[0].price).to.be.lt(token6Sales[1].price);
  
    // Test 15: Verify behavior with out-of-range index
    const outOfRangeSales = await xrc721.getGlobalSales(1000, 10, true);
    expect(outOfRangeSales.length).to.equal(0);
  
    // Test 16: Attempt to get sales with invalid count
    // await expect(xrc721.getGlobalSales(0, 0, true)).to.be.revertedWith("Count must be > 0");
    await expect(xrc721.getGlobalSales(0, 0, true)).to.be.revertedWithCustomError(xrc721, "CountMustBePositive");
  });

  describe('ForSaleTokens Tree', function () {
    it('should add tokens to forSaleTokens when listing for sale', async function () {
      await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
      const forSaleTokens = await xrc721.getForSaleTokens(0, 10, true);
      expect(forSaleTokens.length).to.equal(1);
      expect(forSaleTokens[0]).to.equal(tokenId0);
    });
  
    it('should remove tokens from forSaleTokens when bought', async function () {
      await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
      await xrc721.connect(buyer1).buyToken(tokenId0, price1, { value: price1 });

      const forSaleTokens = await xrc721.getForSaleTokens(0, 10, true);
      expect(forSaleTokens.length).to.equal(0);
    });
  
    it('should handle multiple tokens being listed for sale', async function () {
      await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
      await xrc721.mintAndListForSale(owner.address, tokenId1, price2, "tokenURI2");
      await xrc721.mintAndListForSale(owner.address, tokenId2, price3, "tokenURI3");
      
      const forSaleTokens = await xrc721.getForSaleTokens(0, 10, true);
      expect(forSaleTokens.length).to.equal(3);
    });
  
    it('should remove token from forSaleTokens when removed from sale', async function () {
      await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
      await xrc721.removeTokenFromSale(tokenId0);
      
      const forSaleTokens = await xrc721.getForSaleTokens(0, 10, true);
      expect(forSaleTokens.length).to.equal(0);
    });
  
    it('should maintain correct ascending order when listing multiple tokens', async function () {
      await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
      await xrc721.mintAndListForSale(owner.address, tokenId1, price2, "tokenURI2");
      await xrc721.mintAndListForSale(owner.address, tokenId2, price3, "tokenURI3");
      
      const forSaleTokens = await xrc721.getForSaleTokens(0, 10, true);
      expect(forSaleTokens[0]).to.equal(tokenId0);
      expect(forSaleTokens[1]).to.equal(tokenId1);
      expect(forSaleTokens[2]).to.equal(tokenId2);
  
      const forSaleTokensReverse = await xrc721.getForSaleTokens(2, 10, false);
      expect(forSaleTokensReverse[0]).to.equal(tokenId2);
      expect(forSaleTokensReverse[1]).to.equal(tokenId1);
      expect(forSaleTokensReverse[2]).to.equal(tokenId0);
    });
  
    it('should handle pagination of for sale tokens', async function () {
      // Mint and list multiple tokens
      for (let i = 0; i < 10; i++) {
        await xrc721.mintAndListForSale(owner.address, 1000 + i, ethers.parseEther((25000 + 250 * i).toString()), `tokenURI${1000 + i}`);
      }
      
      const firstPage = await xrc721.getForSaleTokens(0, 5, true);
      const secondPage = await xrc721.getForSaleTokens(5, 5, true);
      
      expect(firstPage.length).to.equal(5);
      expect(secondPage.length).to.equal(5);
      expect(firstPage[0]).to.equal(1000);
      expect(secondPage[0]).to.equal(1005);
    });
  });
  
  describe('NotForSaleTokens Tree', function () {
    it('should add tokens to notForSaleTokens when bought', async function () {
      await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
      await xrc721.connect(buyer1).buyToken(tokenId0, price1, { value: price1 });

      const notForSaleTokens = await xrc721.getNotForSaleTokens(0, 10, true);
      expect(notForSaleTokens.length).to.equal(1);
      expect(notForSaleTokens[0]).to.equal(tokenId0);
    });
  
    it('should add tokens to notForSaleTokens when removed from sale', async function () {
      await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
      await xrc721.removeTokenFromSale(tokenId0);
      
      const notForSaleTokens = await xrc721.getNotForSaleTokens(0, 10, true);
      expect(notForSaleTokens.length).to.equal(1);
      expect(notForSaleTokens[0]).to.equal(tokenId0);
    });
  
    it('should handle multiple tokens becoming not for sale', async function () {
      await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
      await xrc721.mintAndListForSale(owner.address, tokenId1, price2, "tokenURI2");
      
      await xrc721.connect(buyer1).buyToken(tokenId0, price1, { value: price1 });
      await xrc721.removeTokenFromSale(tokenId1);

      const notForSaleTokens = await xrc721.getNotForSaleTokens(0, 10, true);
      expect(notForSaleTokens.length).to.equal(2);
    });
  
    it('should maintain correct ascending order when tokens become not for sale', async function () {
      await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
      await xrc721.mintAndListForSale(owner.address, tokenId1, price2, "tokenURI2");
      await xrc721.mintAndListForSale(owner.address, tokenId2, price3, "tokenURI3");
      
      await xrc721.connect(buyer1).buyToken(tokenId1, price2, { value: price2 });
      await xrc721.removeTokenFromSale(tokenId0);
      
      const notForSaleTokens = await xrc721.getNotForSaleTokens(0, 10, true);
      expect(notForSaleTokens.length).to.equal(2);
  
      const notForSaleTokensReverse = await xrc721.getNotForSaleTokens(1, 10, false);
      expect(notForSaleTokensReverse[0]).to.equal(tokenId1);
      expect(notForSaleTokensReverse[1]).to.equal(tokenId0);
    });
  
    it('should handle pagination of not for sale tokens', async function () {
      // Mint and make multiple tokens not for sale
      for (let i = 0; i < 10; i++) {
        await xrc721.mintAndListForSale(owner.address, 1000 + i, ethers.parseEther((25000 + 250 * i).toString()), `tokenURI${1000 + i}`);
        await xrc721.connect(buyer1).buyToken(1000 + i, ethers.parseEther((25000 + 250 * i).toString()), { value: ethers.parseEther((25000 + 250 * i).toString()) });
      }

      const firstPage = await xrc721.getNotForSaleTokens(0, 5, true);
      const secondPage = await xrc721.getNotForSaleTokens(5, 5, true);
      
      expect(firstPage.length).to.equal(5);
      expect(secondPage.length).to.equal(5);
      expect(firstPage[0]).to.equal(1000);
      expect(secondPage[0]).to.equal(1005);
    });
  });

  describe('ForSaleTokens Tree - Comprehensive Tests', function () {
    // Basic Functionality Tests
    describe('Basic Operations', function () {
      it('should handle empty tree', async function () {
        const forSaleTokens = await xrc721.getForSaleTokens(0, 10, true);
        expect(forSaleTokens.length).to.equal(0);
      });
  
      it('should handle single token listing', async function () {
        await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
        const forSaleTokens = await xrc721.getForSaleTokens(0, 10, true);
        expect(forSaleTokens.length).to.equal(1);
        expect(forSaleTokens[0]).to.equal(tokenId0);
      });
    });
  
    // Edge Case Tests
    describe('Edge Cases', function () {
      it('should handle very large number of tokens', async function () {
        const tokenCount = 100;
        for (let i = 0; i < tokenCount; i++) {
          await xrc721.mintAndListForSale(owner.address, 2000 + i, ethers.parseEther((25000 + 250 * i).toString()), `tokenURI${2000 + i}`);
        }
  
        const forSaleTokens = await xrc721.getForSaleTokens(0, tokenCount, true);
        expect(forSaleTokens.length).to.equal(tokenCount);
      });
  
      it('should handle pagination with large number of tokens', async function () {
        const tokenCount = 100;
        for (let i = 0; i < tokenCount; i++) {
          await xrc721.mintAndListForSale(owner.address, 2000 + i, ethers.parseEther((25000 + 250 * i).toString()), `tokenURI${2000 + i}`);
        }
  
        const firstPage = await xrc721.getForSaleTokens(0, 10, true);
        const secondPage = await xrc721.getForSaleTokens(10, 10, true);
        
        expect(firstPage.length).to.equal(10);
        expect(secondPage.length).to.equal(10);
        expect(firstPage[0]).to.equal(2000);
        expect(secondPage[0]).to.equal(2010);
      });
    });
  
    // Ordering Tests
    describe('Ordering Scenarios', function () {
      it('should maintain correct order with mixed token IDs and prices', async function () {
        // Create tokens with intentionally mixed order
        await xrc721.mintAndListForSale(owner.address, 100, ethers.parseEther("50000"), "tokenURI100");
        await xrc721.mintAndListForSale(owner.address, 50, ethers.parseEther("37500"), "tokenURI50");
        await xrc721.mintAndListForSale(owner.address, 200, ethers.parseEther("25000"), "tokenURI200");
  
        const forSaleTokensAscending = await xrc721.getForSaleTokens(0, 10, true);
        expect(forSaleTokensAscending[0]).to.equal(50);
        expect(forSaleTokensAscending[1]).to.equal(100);
        expect(forSaleTokensAscending[2]).to.equal(200);
  
        const forSaleTokensDescending = await xrc721.getForSaleTokens(2, 10, false);
        expect(forSaleTokensDescending[0]).to.equal(200);
        expect(forSaleTokensDescending[1]).to.equal(100);
        expect(forSaleTokensDescending[2]).to.equal(50);
      });
    });
  
    // Boundary Condition Tests
    describe('Boundary Conditions', function () {
      it('should handle tokens at minimum and maximum possible IDs', async function () {
        const minTokenId = 0;
        // const maxTokenId = 2**256 - 1;
        const maxTokenId = ethers.MaxUint256 / 2n;  // Use ethers' built-in max uint256 value
  
        await xrc721.mintAndListForSale(owner.address, minTokenId, price1, "minTokenURI");
        await xrc721.mintAndListForSale(owner.address, maxTokenId, price2, "maxTokenURI");
  
        const forSaleTokens = await xrc721.getForSaleTokens(0, 10, true);
        expect(forSaleTokens.length).to.equal(2);
      });
    });
  
    // Error Handling Tests
    describe('Error Handling', function () {
      it('should handle out-of-range start index', async function () {
        await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
        
        const forSaleTokens = await xrc721.getForSaleTokens(1000, 10, true);
        expect(forSaleTokens.length).to.equal(0);
      });
    });
  
    // Concurrent Modification Tests
    describe('Concurrent Modifications', function () {
      it('should handle interleaved sale and purchase', async function () {
        await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
        await xrc721.mintAndListForSale(owner.address, tokenId1, price2, "tokenURI2");
        
        await xrc721.connect(buyer1).buyToken(tokenId0, price1, { value: price1 });
        await xrc721.mintAndListForSale(owner.address, tokenId2, price3, "tokenURI3");
        
        const forSaleTokens = await xrc721.getForSaleTokens(0, 10, true);
        expect(forSaleTokens.length).to.equal(2);
      });
    });
  });
  
  describe('NotForSaleTokens Tree - Comprehensive Tests', function () {
    // Basic Functionality Tests
    describe('Basic Operations', function () {
      it('should handle empty tree', async function () {
        const notForSaleTokens = await xrc721.getNotForSaleTokens(0, 10, true);
        expect(notForSaleTokens.length).to.equal(0);
      });
  
      it('should handle single token becoming not for sale', async function () {
        await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
        await xrc721.connect(buyer1).buyToken(tokenId0, price1, { value: price1 });

        const notForSaleTokens = await xrc721.getNotForSaleTokens(0, 10, true);
        expect(notForSaleTokens.length).to.equal(1);
        expect(notForSaleTokens[0]).to.equal(tokenId0);
      });
    });
  
    // Edge Case Tests
    describe('Edge Cases', function () {
      it('should handle very large number of tokens becoming not for sale', async function () {
        const tokenCount = 100;
        for (let i = 0; i < tokenCount; i++) {
          await xrc721.mintAndListForSale(owner.address, 2000 + i, ethers.parseEther((25000 + 250 * i).toString()), `tokenURI${2000 + i}`);
          await xrc721.connect(buyer1).buyToken(2000 + i, ethers.parseEther((25000 + 250 * i).toString()), { value: ethers.parseEther((25000 + 250 * i).toString()) });
        }
  
        const notForSaleTokens = await xrc721.getNotForSaleTokens(0, tokenCount, true);
        expect(notForSaleTokens.length).to.equal(tokenCount);
      });

      it('should handle tokens transitioning between for sale and not for sale states', async function () {
        const tokenCount = 100;
        for (let i = 0; i < tokenCount; i++) {
          // Mint and list tokens for sale
          await xrc721.mintAndListForSale(owner.address, 2000 + i, ethers.parseEther((25000 + 250 * i).toString()), `tokenURI${2000 + i}`);
        }

        // Buy all tokens
        for (let i = 0; i < tokenCount; i++) {
          await xrc721.connect(buyer1).buyToken(2000 + i, ethers.parseEther((25000 + 250 * i).toString()), { value: ethers.parseEther((25000 + 250 * i).toString()) });
        }

        // Check not for sale tokens
        let notForSaleTokens = await xrc721.getNotForSaleTokens(0, tokenCount, true);
        expect(notForSaleTokens.length).to.equal(tokenCount);
      
        // Relist all tokens for sale by the new buyer
        for (let i = 0; i < tokenCount; i++) {
          await xrc721.connect(buyer1).listTokenForSale(2000 + i, ethers.parseEther((50000 + 250 * i).toString()));
        }
      
        // Check for sale tokens
        let forSaleTokens = await xrc721.getForSaleTokens(0, tokenCount, true);
        expect(forSaleTokens.length).to.equal(tokenCount);
      
        // Check not for sale tokens are now zero
        notForSaleTokens = await xrc721.getNotForSaleTokens(0, tokenCount, true);
        expect(notForSaleTokens.length).to.equal(0);
      });

      it('should handle tokens transitioning between for sale and not for sale states bot tokencount is half', async function () {
        const tokenCount = 100;
        const tokenCountHalf = 50;
        for (let i = 0; i < tokenCount; i++) {
          // Mint and list tokens for sale
          await xrc721.mintAndListForSale(owner.address, 2000 + i, ethers.parseEther((25000 + 250 * i).toString()), `tokenURI${2000 + i}`);
        }

        // Buy all tokens
        for (let i = 0; i < tokenCount; i++) {
          await xrc721.connect(buyer1).buyToken(2000 + i, ethers.parseEther((25000 + 250 * i).toString()), { value: ethers.parseEther((25000 + 250 * i).toString()) });
        }
      
        // Check not for sale tokens
        let notForSaleTokens = await xrc721.getNotForSaleTokens(0, tokenCount, true);
        expect(notForSaleTokens.length).to.equal(tokenCount);
      
        // Relist all tokens for sale by the new buyer
        for (let i = 0; i < tokenCountHalf; i++) {
          await xrc721.connect(buyer1).listTokenForSale(2000 + i, ethers.parseEther((50000 + 250 * i).toString()));
        }
      
        // Check for sale tokens
        let forSaleTokens = await xrc721.getForSaleTokens(0, tokenCount, true);
        expect(forSaleTokens.length).to.equal(tokenCountHalf);
      
        // Check not for sale tokens are now zero
        notForSaleTokens = await xrc721.getNotForSaleTokens(0, tokenCount, true);
        expect(notForSaleTokens.length).to.equal(tokenCountHalf);
      });
  
      it('should handle pagination with large number of tokens', async function () {
        const tokenCount = 100;
        for (let i = 0; i < tokenCount; i++) {
          await xrc721.mintAndListForSale(owner.address, 2000 + i, ethers.parseEther((25000 + 250 * i).toString()), `tokenURI${2000 + i}`);
          await xrc721.connect(buyer1).buyToken(2000 + i, ethers.parseEther((25000 + 250 * i).toString()), { value: ethers.parseEther((25000 + 250 * i).toString()) });
        }
  
        const firstPage = await xrc721.getNotForSaleTokens(0, 10, true);
        const secondPage = await xrc721.getNotForSaleTokens(10, 10, true);
        
        expect(firstPage.length).to.equal(10);
        expect(secondPage.length).to.equal(10);
        expect(firstPage[0]).to.equal(2000);
        expect(secondPage[0]).to.equal(2010);
      });
    });
  
    // Ordering Tests
    describe('Ordering Scenarios', function () {
      it('should maintain correct order with mixed token IDs', async function () {
        // Create tokens becoming not for sale in mixed order
        await xrc721.mintAndListForSale(owner.address, 100, ethers.parseEther("50000"), "tokenURI100");
        await xrc721.mintAndListForSale(owner.address, 50, ethers.parseEther("37500"), "tokenURI50");
        await xrc721.mintAndListForSale(owner.address, 200, ethers.parseEther("25000"), "tokenURI200");

        await xrc721.connect(buyer1).buyToken(50, ethers.parseEther("37500"), { value: ethers.parseEther("37500") });
        await xrc721.connect(buyer2).buyToken(100, ethers.parseEther("50000"), { value: ethers.parseEther("50000") });
        await xrc721.connect(buyer3).buyToken(200, ethers.parseEther("25000"), { value: ethers.parseEther("25000") });

        const notForSaleTokensAscending = await xrc721.getNotForSaleTokens(0, 10, true);
        expect(notForSaleTokensAscending[0]).to.equal(50);
        expect(notForSaleTokensAscending[1]).to.equal(100);
        expect(notForSaleTokensAscending[2]).to.equal(200);
  
        const notForSaleTokensDescending = await xrc721.getNotForSaleTokens(2, 10, false);
        expect(notForSaleTokensDescending[0]).to.equal(200);
        expect(notForSaleTokensDescending[1]).to.equal(100);
        expect(notForSaleTokensDescending[2]).to.equal(50);
      });
    });
  
    // Boundary Condition Tests
    describe('Boundary Conditions', function () {
      it('should handle tokens at minimum and maximum possible IDs', async function () {
        const minTokenId = 0;
        // const maxTokenId = 2**256 - 1;
        const maxTokenId = ethers.MaxUint256 / 2n;  // Use ethers' built-in max uint256 value

  
        await xrc721.mintAndListForSale(owner.address, minTokenId, price1, "minTokenURI");
        await xrc721.connect(buyer1).buyToken(minTokenId, price1, { value: price1 });
  
        await xrc721.mintAndListForSale(owner.address, maxTokenId, price2, "maxTokenURI");
        await xrc721.connect(buyer2).buyToken(maxTokenId, price2, { value: price2 });
  
        const notForSaleTokens = await xrc721.getNotForSaleTokens(0, 10, true);
        expect(notForSaleTokens.length).to.equal(2);
      });
    });
  
    // Error Handling Tests
    describe('Error Handling', function () {
      it('should handle out-of-range start index', async function () {
        await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
        await xrc721.connect(buyer1).buyToken(tokenId0, price1, { value: price1 });

        const notForSaleTokens = await xrc721.getNotForSaleTokens(1000, 10, true);
        expect(notForSaleTokens.length).to.equal(0);
      });
    });
  
    // Concurrent Modification Tests
    describe('Concurrent Modifications', function () {
      it('should handle multiple tokens becoming not for sale', async function () {
        await xrc721.mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
        await xrc721.mintAndListForSale(owner.address, tokenId1, price2, "tokenURI2");
        await xrc721.mintAndListForSale(owner.address, tokenId2, price3, "tokenURI3");
        
        await xrc721.connect(buyer1).buyToken(tokenId0, price1, { value: price1 });
        await xrc721.connect(buyer2).buyToken(tokenId1, price2, { value: price2 });

        const notForSaleTokens = await xrc721.getNotForSaleTokens(0, 10, true);
        expect(notForSaleTokens.length).to.equal(2);
      });
    });
  });

  describe("XRC721 Event Comprehensive Test", function () {
    it("should comprehensively test all contract events", async function () {
        // Initial token setup
        await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId0, price1, "tokenURI1");
        await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId1, price2, "tokenURI2");
        await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId2, price3, "tokenURI3");

        // 1. TokenListedForSale Event Tests
        // Basic listing
        await expect(xrc721.connect(owner).mintAndListForSale(owner.address, tokenId3, price4, "tokenURI4"))
            .to.emit(xrc721, "TokenListedForSale")
            .withArgs(tokenId3, price4);

        // Relist after removal
        await xrc721.connect(owner).removeTokenFromSale(tokenId3);
        await expect(xrc721.connect(owner).listTokenForSale(tokenId3, price4))
            .to.emit(xrc721, "TokenListedForSale")
            .withArgs(tokenId3, price4);

        // 2. MakeOffer Event Tests
        // Basic offer
        await expect(xrc721.connect(bidder1).makeOffer(tokenId0, { value: price1 }))
            .to.emit(xrc721, "MakeOffer")
            .withArgs(tokenId0, bidder1.address, price1);

        // Offer replacement (should emit WithdrawOffer for previous offer)
        await expect(xrc721.connect(bidder1).makeOffer(tokenId0, { value: price2 }))
            .to.emit(xrc721, "WithdrawOffer")
            .withArgs(tokenId0, bidder1.address, price1)
            .and.to.emit(xrc721, "MakeOffer")
            .withArgs(tokenId0, bidder1.address, price2);

        // 3. WithdrawOffer Event Tests
        // Direct withdrawal
        await expect(xrc721.connect(bidder1).withdrawOffer(tokenId0))
            .to.emit(xrc721, "WithdrawOffer")
            .withArgs(tokenId0, bidder1.address, price2);

        // 4. TokenRemovedFromSale Event Tests
        await expect(xrc721.connect(owner).removeTokenFromSale(tokenId1))
            .to.emit(xrc721, "TokenRemovedFromSale")
            .withArgs(tokenId1);

        // 5. TokenPriceUpdated Event Tests
        // Update price while token is for sale
        await xrc721.connect(owner).listTokenForSale(tokenId1, price2);
        await expect(xrc721.connect(owner).updateTokenPrice(tokenId1, price3))
            .to.emit(xrc721, "TokenPriceUpdated")
            .withArgs(tokenId1, price3);

        // 6. TokenSold Event Tests
        // Make an offer and accept it
        await xrc721.connect(bidder2).makeOffer(tokenId2, { value: price3 });
        await expect(xrc721.connect(owner).acceptOffer(tokenId2, bidder2.address))
            .to.emit(xrc721, "WithdrawOffer")
            .withArgs(tokenId2, bidder2.address, price3)
            .and.to.emit(xrc721, "TokenSold")
            .withArgs(0, tokenId2, owner.address, bidder2.address, price3, (timestamp) => timestamp > 0n);

        // Direct purchase
        await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId4, price4, "tokenURI5");
        await expect(xrc721.connect(bidder3).buyToken(tokenId4, price4, { value: price4 }))
            .to.emit(xrc721, "TokenSold")
            .withArgs(1, tokenId4, owner.address, bidder3.address, price4, (timestamp) => timestamp > 0n);

        // 7. Complex Scenario: Multiple Offers and Operations
        await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId5, price1, "tokenURI6");
        
        // Multiple offers
        await xrc721.connect(bidder1).makeOffer(tokenId5, { value: price1 });
        await xrc721.connect(bidder2).makeOffer(tokenId5, { value: price2 });

        // Accept offer with multiple existing offers
        await expect(xrc721.connect(owner).acceptOffer(tokenId5, bidder2.address))
            .to.emit(xrc721, "WithdrawOffer")
            .withArgs(tokenId5, bidder2.address, price2)
            .and.to.emit(xrc721, "TokenSold")
            .withArgs(2, tokenId5, owner.address, bidder2.address, price2, (timestamp) => timestamp > 0n);

        // Verify that the other offer still exists
        const remainingOffers = await xrc721.getOffersForToken(tokenId5, 0, 10, true);
        expect(remainingOffers.length).to.equal(1);
        expect(remainingOffers[0].bidder).to.equal(bidder1.address);

        // 8. Edge Cases and Error Scenarios
        // Attempt to make offer below minimum price
        await expect(
            xrc721.connect(bidder4).makeOffer(tokenId0, { value: ethers.parseEther("0.001") })
        // ).to.be.revertedWith("XRC721: offer price must be at least 25,000 XDC");
        ).to.be.revertedWithCustomError(xrc721, "PriceBelowMinimum");

        // Attempt to accept offer from non-owner
        await xrc721.connect(owner).mintAndListForSale(owner.address, tokenId6, price1, "tokenURI7");
        await xrc721.connect(bidder5).makeOffer(tokenId6, { value: price1 });
        await expect(
            xrc721.connect(bidder5).acceptOffer(tokenId6, bidder5.address)
        // ).to.be.revertedWith("XRC721: caller is not the owner");
        ).to.be.revertedWithCustomError(xrc721, "CallerNotOwner");
    });
  });

  describe("getTokenSalesHistory", function() {
    beforeEach(async function () {
        OrderStatisticsTree = await ethers.getContractFactory("OrderStatisticsTree");
        orderStatisticsTree = await OrderStatisticsTree.deploy();
        await orderStatisticsTree.waitForDeployment();
 
        CustomMinHeapLib = await ethers.getContractFactory("CustomMinHeapLib");
        CustomMinHeapLib = await CustomMinHeapLib.deploy();
        await CustomMinHeapLib.waitForDeployment();
        
        EthereumKiller = await ethers.getContractFactory("EthereumKiller", {
            libraries: {
                OrderStatisticsTree: orderStatisticsTree.target,
                CustomMinHeapLib: CustomMinHeapLib.target,
            },
        });
        [owner, bidder1, bidder2, bidder3, bidder4, bidder5, bidder6, bidder7, bidder8, bidder9, bidder10, buyer1, buyer2, buyer3, buyer4, buyer5, seller, buyer] = await ethers.getSigners();
 
        xrc721 = await EthereumKiller.deploy();
        await xrc721.waitForDeployment();
 
        // Create multiple tokens and initial sales
        await xrc721.mintAndListForSale(owner.address, 100, ethers.parseEther("50000"), "tokenURI100");
        await xrc721.mintAndListForSale(owner.address, 50, ethers.parseEther("37500"), "tokenURI50");
        await xrc721.mintAndListForSale(owner.address, 200, ethers.parseEther("25000"), "tokenURI200");
 
        await xrc721.connect(buyer1).buyToken(50, ethers.parseEther("37500"), { value: ethers.parseEther("37500") });
        await xrc721.connect(buyer2).buyToken(100, ethers.parseEther("50000"), { value: ethers.parseEther("50000") });
        await xrc721.connect(buyer3).buyToken(200, ethers.parseEther("25000"), { value: ethers.parseEther("25000") });

        // Add more sales for token 50
        await xrc721.connect(buyer1).listTokenForSale(50, ethers.parseEther("75000"));
        await xrc721.connect(buyer2).buyToken(50, ethers.parseEther("75000"), { value: ethers.parseEther("75000") });

        await xrc721.connect(buyer2).listTokenForSale(50, ethers.parseEther("100000"));
        await xrc721.connect(buyer3).buyToken(50, ethers.parseEther("100000"), { value: ethers.parseEther("100000") });

        await xrc721.connect(buyer3).listTokenForSale(50, ethers.parseEther("125000"));
        await xrc721.connect(buyer4).buyToken(50, ethers.parseEther("125000"), { value: ethers.parseEther("125000") });
    });
 
    it("should revert for non-existent token", async function() {
        await expect(
            xrc721.getTokenSalesHistory(999, 0, 1, true)
        // ).to.be.revertedWith("XRC721: query for nonexistent token");
        ).to.be.revertedWithCustomError(xrc721, "TokenNonexistent");
    });
 
    it("should revert for zero count", async function() {
        await expect(
            xrc721.getTokenSalesHistory(50, 0, 0, true)
        // ).to.be.revertedWith("Count must be > 0");
        ).to.be.revertedWithCustomError(xrc721, "CountMustBePositive");
    });
 
    it("should return empty array if start is beyond sales count", async function() {
        const result = await xrc721.getTokenSalesHistory(50, 10, 1, true);
        expect(result.length).to.equal(0);
    });
 
    it("should return first 3 sales when ascending", async function() {
        const result = await xrc721.getTokenSalesHistory(50, 0, 3, true);
        expect(result.length).to.equal(3);
        
        // First sale
        expect(result[0].price).to.equal(ethers.parseEther("37500"));
        expect(result[0].seller).to.equal(owner.address);
        expect(result[0].buyer).to.equal(buyer1.address);
 
        // Second sale
        expect(result[1].price).to.equal(ethers.parseEther("75000"));
        expect(result[1].seller).to.equal(buyer1.address);
        expect(result[1].buyer).to.equal(buyer2.address);
 
        // Third sale
        expect(result[2].price).to.equal(ethers.parseEther("100000"));
        expect(result[2].seller).to.equal(buyer2.address);
        expect(result[2].buyer).to.equal(buyer3.address);
    });
 
    it("should return first 3 sales when descending", async function() {
        const result = await xrc721.getTokenSalesHistory(50, 0, 3, false);
        expect(result.length).to.equal(3);
        
        // Most recent sale first
        expect(result[0].price).to.equal(ethers.parseEther("125000"));
        expect(result[0].seller).to.equal(buyer3.address);
        expect(result[0].buyer).to.equal(buyer4.address);
 
        // Second most recent
        expect(result[1].price).to.equal(ethers.parseEther("100000"));
        expect(result[1].seller).to.equal(buyer2.address);
        expect(result[1].buyer).to.equal(buyer3.address);
 
        // Third most recent
        expect(result[2].price).to.equal(ethers.parseEther("75000"));
        expect(result[2].seller).to.equal(buyer1.address);
        expect(result[2].buyer).to.equal(buyer2.address);
    });
 
    it("should handle partial results correctly with offset when ascending", async function() {
        const result = await xrc721.getTokenSalesHistory(50, 2, 2, true);
        expect(result.length).to.equal(2);
        
        // Third sale
        expect(result[0].price).to.equal(ethers.parseEther("100000"));
        expect(result[0].seller).to.equal(buyer2.address);
        expect(result[0].buyer).to.equal(buyer3.address);
 
        // Fourth sale
        expect(result[1].price).to.equal(ethers.parseEther("125000"));
        expect(result[1].seller).to.equal(buyer3.address);
        expect(result[1].buyer).to.equal(buyer4.address);
    });
 
    it("should handle partial results correctly with offset when descending", async function() {
        const result = await xrc721.getTokenSalesHistory(50, 2, 2, false);
        expect(result.length).to.equal(2);
        
        // Third from last
        expect(result[0].price).to.equal(ethers.parseEther("75000"));
        expect(result[0].seller).to.equal(buyer1.address);
        expect(result[0].buyer).to.equal(buyer2.address);
 
        // Fourth from last (first sale)
        expect(result[1].price).to.equal(ethers.parseEther("37500"));
        expect(result[1].seller).to.equal(owner.address);
        expect(result[1].buyer).to.equal(buyer1.address);
    });
 
    it("should return all sales when count exceeds total", async function() {
        const result = await xrc721.getTokenSalesHistory(50, 0, 10, true);
        expect(result.length).to.equal(4);
 
        const prices = result.map(sale => sale.price);
        const expected = [
            ethers.parseEther("37500"),
            ethers.parseEther("75000"),
            ethers.parseEther("100000"),
            ethers.parseEther("125000")
        ].map(price => price.toString());
 
        expect(prices.slice(0, 4).map(p => p.toString())).to.deep.equal(expected);
    });
 
    it("should maintain correct sale data structure throughout", async function() {
      const result = await xrc721.getTokenSalesHistory(50, 0, 5, true);
      
      result.forEach(sale => {
          expect(sale[0]).to.be.a('bigint'); // salesId
          // Sale struct members are returned in order: [tokenId, seller, buyer, price, timestamp]
          expect(sale[1]).to.equal(50);  // tokenId
          expect(ethers.isAddress(sale[2])).to.be.true;  // seller
          expect(ethers.isAddress(sale[3])).to.be.true;  // buyer
          expect(sale[4]).to.be.a('bigint');  // price
          expect(sale[5]).to.be.a('bigint');  // timestamp
      });
  });
 });

});

describe("Sales ID Tracking", function() {
  let EthereumKiller, xrc721;
  let OrderStatisticsTree, orderStatisticsTree;
  let CustomMinHeapLib;
  let owner, buyer1, buyer2, buyer3, buyer4, bidder1, bidder2;

  beforeEach(async function () {
    // Deploy OrderStatisticsTree library
    OrderStatisticsTree = await ethers.getContractFactory("OrderStatisticsTree");
    orderStatisticsTree = await OrderStatisticsTree.deploy();
    await orderStatisticsTree.waitForDeployment();

    // Deploy CustomMinHeapLib library
    CustomMinHeapLib = await ethers.getContractFactory("CustomMinHeapLib");
    CustomMinHeapLib = await CustomMinHeapLib.deploy();
    await CustomMinHeapLib.waitForDeployment();
    
    // Deploy XRC721 contract with libraries
    EthereumKiller = await ethers.getContractFactory("EthereumKiller", {
      libraries: {
        OrderStatisticsTree: orderStatisticsTree.target,
        CustomMinHeapLib: CustomMinHeapLib.target,
      },
    });

    // Get signers
    [owner, buyer1, buyer2, buyer3, buyer4, bidder1, bidder2] = await ethers.getSigners();

    // Deploy the contract
    xrc721 = await EthereumKiller.deploy();
    await xrc721.waitForDeployment();
  });

  it("should correctly assign and increment salesId as the first argument in TokenSold events", async function () {
    // Mint several tokens for testing
    await xrc721.mintAndListForSale(owner.address, 50, ethers.parseEther("25000"), "tokenURI50");
    await xrc721.mintAndListForSale(owner.address, 51, ethers.parseEther("37500"), "tokenURI51");
    await xrc721.mintAndListForSale(owner.address, 52, ethers.parseEther("50000"), "tokenURI52");
    await xrc721.mintAndListForSale(owner.address, 53, ethers.parseEther("62500"), "tokenURI53");
    await xrc721.mintAndListForSale(owner.address, 54, ethers.parseEther("75000"), "tokenURI54");
    
    // First sale: Direct buy (salesId should be 0)
    await expect(xrc721.connect(buyer1).buyToken(50, ethers.parseEther("25000"), { value: ethers.parseEther("25000") }))
      .to.emit(xrc721, "TokenSold")
      .withArgs(0, 50, owner.address, buyer1.address, ethers.parseEther("25000"), (timestamp) => timestamp > 0);
    
    // Second sale: Make offer and accept (salesId should be 1)
    await xrc721.connect(bidder1).makeOffer(51, { value: ethers.parseEther("30000") });
    await expect(xrc721.connect(owner).acceptOffer(51, bidder1.address))
      .to.emit(xrc721, "TokenSold")
      .withArgs(1, 51, owner.address, bidder1.address, ethers.parseEther("30000"), (timestamp) => timestamp > 0);
    
    // Third sale: Another direct buy (salesId should be 2)
    await expect(xrc721.connect(buyer2).buyToken(52, ethers.parseEther("50000"), { value: ethers.parseEther("50000") }))
      .to.emit(xrc721, "TokenSold")
      .withArgs(2, 52, owner.address, buyer2.address, ethers.parseEther("50000"), (timestamp) => timestamp > 0);
    
    // Fourth sale: Another offer acceptance (salesId should be 3)
    await xrc721.connect(bidder2).makeOffer(53, { value: ethers.parseEther("55000") });
    await expect(xrc721.connect(owner).acceptOffer(53, bidder2.address))
      .to.emit(xrc721, "TokenSold")
      .withArgs(3, 53, owner.address, bidder2.address, ethers.parseEther("55000"), (timestamp) => timestamp > 0);
    
    // List token by buyer for resale
    await xrc721.connect(buyer1).listTokenForSale(50, ethers.parseEther("37500"));
    
    // Fifth sale: Buying a token listed by a previous buyer (salesId should be 4)
    await expect(xrc721.connect(buyer3).buyToken(50, ethers.parseEther("37500"), { value: ethers.parseEther("37500") }))
      .to.emit(xrc721, "TokenSold")
      .withArgs(4, 50, buyer1.address, buyer3.address, ethers.parseEther("37500"), (timestamp) => timestamp > 0);
    
    // Verify sales history contains correct salesIds
    const salesHistory50 = await xrc721.getTokenSalesHistory(50, 0, 10, true);
    expect(salesHistory50.length).to.equal(2);
    expect(salesHistory50[0].salesId).to.equal(0);
    expect(salesHistory50[1].salesId).to.equal(4);
    
    // Verify the total sales count
    expect(await xrc721.getTotalSalesCount()).to.equal(5);
    
    // Final transaction - purchase the last token
    await expect(xrc721.connect(buyer4).buyToken(54, ethers.parseEther("75000"), { value: ethers.parseEther("75000") }))
      .to.emit(xrc721, "TokenSold")
      .withArgs(5, 54, owner.address, buyer4.address, ethers.parseEther("75000"), (timestamp) => timestamp > 0);
    
    // Verify the updated total sales count
    expect(await xrc721.getTotalSalesCount()).to.equal(6);
  });
});

describe("CustomMinHeapLib", function () {
  let CustomMinHeapLibTest;
  let heapInstance;

  beforeEach(async function () {

      CustomMinHeapLib = await ethers.getContractFactory("CustomMinHeapLib");
      CustomMinHeapLib = await CustomMinHeapLib.deploy();
      await CustomMinHeapLib.waitForDeployment();

      // // Deploy the library as a standalone contract for testing purposes
      // const CustomMinHeapLibFactory = await ethers.getContractFactory("CustomMinHeapLibTest");
      // heapInstance = await CustomMinHeapLibFactory.deploy();
      // Get the ContractFactory and Signers here.
      CustomMinHeapLibFactory = await ethers.getContractFactory("CustomMinHeapLibTest", {
        libraries: {
          CustomMinHeapLib: CustomMinHeapLib.target,
        },
      });
      
      heapInstance = await CustomMinHeapLibFactory.deploy();
      await heapInstance.waitForDeployment();  // Wait for the contract deployment to be mined
  });

  it("should insert elements and maintain the min-heap property", async function () {
      await heapInstance.insert(10, 1);
      await heapInstance.insert(20, 2);
      await heapInstance.insert(5, 3);

      const minElement = await heapInstance.getMin();
      expect(minElement.price).to.equal(5);
      expect(minElement.tokenId).to.equal(3);
  });

  it("should remove elements and maintain the min-heap property", async function () {
      await heapInstance.insert(15, 4);
      await heapInstance.insert(25, 5);
      await heapInstance.insert(10, 1);  // Insert elements to maintain context

      await heapInstance.remove(1); // Remove the element with tokenId 1 (price = 10)

      const minElement = await heapInstance.getMin();
      expect(minElement.price).to.equal(15); // The new min should be the element with price 15
      expect(minElement.tokenId).to.equal(4);
  });

  it("should correctly handle multiple inserts and removals", async function () {
      await heapInstance.insert(3, 6);
      await heapInstance.insert(7, 7);
      await heapInstance.insert(2, 8);
      await heapInstance.insert(9, 9);

      let minElement = await heapInstance.getMin();
      expect(minElement.price).to.equal(2);
      expect(minElement.tokenId).to.equal(8);

      await heapInstance.remove(8); // Remove the element with tokenId 8

      minElement = await heapInstance.getMin();
      expect(minElement.price).to.equal(3);
      expect(minElement.tokenId).to.equal(6);

      await heapInstance.remove(6); // Remove the element with tokenId 6

      minElement = await heapInstance.getMin();
      expect(minElement.price).to.equal(7);
      expect(minElement.tokenId).to.equal(7);
  });

  it("should correctly handle the edge case of removing the last element", async function () {
      await heapInstance.insert(12, 10);

      let minElement = await heapInstance.getMin();
      expect(minElement.price).to.equal(12);
      expect(minElement.tokenId).to.equal(10);

      await heapInstance.remove(10); // Remove the element with tokenId 10

      await expect(heapInstance.getMin()).to.be.revertedWith("Heap is empty");
  });

  it("should correctly handle inserting multiple elements, checking size after each operation, and removing all to empty the heap", async function () {
    // Insert multiple elements and check size
    await heapInstance.insert(30, 1);
    let size = await heapInstance.size();
    expect(size).to.equal(1);

    await heapInstance.insert(20, 2);
    size = await heapInstance.size();
    expect(size).to.equal(2);

    await heapInstance.insert(50, 3);
    size = await heapInstance.size();
    expect(size).to.equal(3);

    await heapInstance.insert(10, 4);
    size = await heapInstance.size();
    expect(size).to.equal(4);

    await heapInstance.insert(40, 5);
    size = await heapInstance.size();
    expect(size).to.equal(5);

    // Check the minimum element
    let minElement = await heapInstance.getMin();
    expect(minElement.price).to.equal(10);
    expect(minElement.tokenId).to.equal(4);

    // Remove elements one by one and check size
    await heapInstance.remove(4); // Remove element with tokenId 4
    size = await heapInstance.size();
    expect(size).to.equal(4);

    await heapInstance.remove(2); // Remove element with tokenId 2
    size = await heapInstance.size();
    expect(size).to.equal(3);

    await heapInstance.remove(5); // Remove element with tokenId 5
    size = await heapInstance.size();
    expect(size).to.equal(2);

    await heapInstance.remove(1); // Remove element with tokenId 1
    size = await heapInstance.size();
    expect(size).to.equal(1);

    await heapInstance.remove(3); // Remove element with tokenId 3
    size = await heapInstance.size();
    expect(size).to.equal(0);

    // Check that the heap is empty
    await expect(heapInstance.getMin()).to.be.revertedWith("Heap is empty");
});



  it("should correctly return the size of the heap", async function () {
      await heapInstance.insert(18, 11);
      await heapInstance.insert(22, 12);
      await heapInstance.insert(14, 13);

      let size = await heapInstance.size();
      expect(size).to.equal(3);

      await heapInstance.remove(12);

      size = await heapInstance.size();
      expect(size).to.equal(2);
  });

  it("should maintain the correct heap structure after multiple operations", async function () {
      await heapInstance.insert(50, 14);
      await heapInstance.insert(40, 15);
      await heapInstance.insert(30, 16);
      await heapInstance.insert(20, 17);
      await heapInstance.insert(10, 18);

      let minElement = await heapInstance.getMin();
      expect(minElement.price).to.equal(10);
      expect(minElement.tokenId).to.equal(18);

      await heapInstance.remove(18);
      minElement = await heapInstance.getMin();
      expect(minElement.price).to.equal(20);
      expect(minElement.tokenId).to.equal(17);

      await heapInstance.remove(17);
      minElement = await heapInstance.getMin();
      expect(minElement.price).to.equal(30);
      expect(minElement.tokenId).to.equal(16);

      await heapInstance.insert(5, 19);
      minElement = await heapInstance.getMin();
      expect(minElement.price).to.equal(5);
      expect(minElement.tokenId).to.equal(19);
  });

  it("should handle a complex sequence of inserts and removals while maintaining the min-heap property", async function () {
    // Insert initial elements
    await heapInstance.insert(50, 1);
    await heapInstance.insert(20, 2);
    await heapInstance.insert(30, 3);
    await heapInstance.insert(40, 4);
    await heapInstance.insert(10, 5);

    // Check the minimum element
    let minElement = await heapInstance.getMin();
    expect(minElement.price).to.equal(10);
    expect(minElement.tokenId).to.equal(5);

    // Remove the current min (tokenId 5)
    await heapInstance.remove(5);
    minElement = await heapInstance.getMin();
    expect(minElement.price).to.equal(20);
    expect(minElement.tokenId).to.equal(2);

    // Insert more elements
    await heapInstance.insert(60, 6);
    await heapInstance.insert(15, 7);
    await heapInstance.insert(25, 8);

    // Check the minimum element
    minElement = await heapInstance.getMin();
    expect(minElement.price).to.equal(15);
    expect(minElement.tokenId).to.equal(7);

    // Remove some elements
    await heapInstance.remove(7);  // Removing tokenId 7
    minElement = await heapInstance.getMin();
    expect(minElement.price).to.equal(20);
    expect(minElement.tokenId).to.equal(2);

    await heapInstance.remove(2);  // Removing tokenId 2
    minElement = await heapInstance.getMin();
    expect(minElement.price).to.equal(25);
    expect(minElement.tokenId).to.equal(8);

    // Insert and remove more elements in a complex manner
    await heapInstance.insert(5, 9);   // Insert a new minimum element
    minElement = await heapInstance.getMin();
    expect(minElement.price).to.equal(5);
    expect(minElement.tokenId).to.equal(9);

    await heapInstance.insert(35, 10);
    await heapInstance.insert(45, 11);
    await heapInstance.remove(9);  // Remove the current min (tokenId 9)
    minElement = await heapInstance.getMin();
    expect(minElement.price).to.equal(25);
    expect(minElement.tokenId).to.equal(8);

    await heapInstance.remove(8);  // Remove tokenId 8
    minElement = await heapInstance.getMin();
    expect(minElement.price).to.equal(30);
    expect(minElement.tokenId).to.equal(3);

    // Continue with more operations
    await heapInstance.insert(12, 12);  // Insert a new element that should be the new min
    minElement = await heapInstance.getMin();
    expect(minElement.price).to.equal(12);
    expect(minElement.tokenId).to.equal(12);

    await heapInstance.remove(12);  // Remove the current min (tokenId 12)
    minElement = await heapInstance.getMin();
    expect(minElement.price).to.equal(30);
    expect(minElement.tokenId).to.equal(3);

    await heapInstance.remove(3);  // Remove tokenId 3
    minElement = await heapInstance.getMin();
    expect(minElement.price).to.equal(35);
    expect(minElement.tokenId).to.equal(10);

    await heapInstance.remove(10);  // Remove tokenId 10
    minElement = await heapInstance.getMin();
    expect(minElement.price).to.equal(40);
    expect(minElement.tokenId).to.equal(4);

    await heapInstance.remove(4);  // Remove tokenId 4
    minElement = await heapInstance.getMin();
    expect(minElement.price).to.equal(45);
    expect(minElement.tokenId).to.equal(11);

    await heapInstance.remove(11);  // Remove tokenId 11
    minElement = await heapInstance.getMin();
    expect(minElement.price).to.equal(50);
    expect(minElement.tokenId).to.equal(1);

    await heapInstance.remove(1);  // Remove tokenId 1

    await heapInstance.remove(6);  // Remove tokenId 6

    // The heap should be empty now
    await expect(heapInstance.getMin()).to.be.revertedWith("Heap is empty");
});

});


describe("OrderStatisticsTree", function () {
  let OrderStatisticsTreeTest;
  let treeInstance;

  beforeEach(async function () {
    OrderStatisticsTree = await ethers.getContractFactory("OrderStatisticsTree");
    orderStatisticsTree = await OrderStatisticsTree.deploy();
    await orderStatisticsTree.waitForDeployment();
    // console.log(orderStatisticsTree.target);
    
      // Deploy the library as a standalone contract for testing purposes
       OrderStatisticsTreeTestFactory = await ethers.getContractFactory("OrderStatisticsTreeTest", {
        libraries: {
          OrderStatisticsTree: orderStatisticsTree.target,
        },
      });
      treeInstance = await OrderStatisticsTreeTestFactory.deploy();
      await treeInstance.waitForDeployment();  // Wait for the contract deployment to be mined
      await treeInstance.initializeTree(ComparatorType.PRICETOKEN_PRICE_TOKENID);
  });

  it("should insert elements and maintain the red-black tree properties", async function () {
    // console.log("123");
      await treeInstance.insert(10, 1);
      // console.log("55555");
      await treeInstance.insert(20, 2);
      // console.log("7777777");
      await treeInstance.insert(5, 3);

      const minElement = await treeInstance.getMin();
      expect(minElement.price).to.equal(5);
      expect(minElement.tokenId).to.equal(3);
  });

  it("should remove elements and maintain the red-black tree properties", async function () {
      await treeInstance.insert(15, 4);
      await treeInstance.insert(25, 5);
      await treeInstance.insert(10, 1);  // Insert elements to maintain context

      await treeInstance.remove(1); // Remove the element with tokenId 1 (price = 10)

      const minElement = await treeInstance.getMin();
      expect(minElement.price).to.equal(15); // The new min should be the element with price 15
      expect(minElement.tokenId).to.equal(4);
  });

  it("should correctly handle multiple inserts and removals", async function () {
      await treeInstance.insert(3, 6);
      await treeInstance.insert(7, 7);
      await treeInstance.insert(2, 8);
      await treeInstance.insert(9, 9);

      let minElement = await treeInstance.getMin();
      expect(minElement.price).to.equal(2);
      expect(minElement.tokenId).to.equal(8);

      await treeInstance.remove(8); // Remove the element with tokenId 8

      minElement = await treeInstance.getMin();
      expect(minElement.price).to.equal(3);
      expect(minElement.tokenId).to.equal(6);

      await treeInstance.remove(6); // Remove the element with tokenId 6

      minElement = await treeInstance.getMin();
      expect(minElement.price).to.equal(7);
      expect(minElement.tokenId).to.equal(7);
  });

  it("should correctly handle the edge case of removing the last element", async function () {
      await treeInstance.insert(12, 10);

      let minElement = await treeInstance.getMin();
      expect(minElement.price).to.equal(12);
      expect(minElement.tokenId).to.equal(10);

      await treeInstance.remove(10); // Remove the element with tokenId 10

      await expect(treeInstance.getMin()).to.be.revertedWith("RedBlackTree: tree is empty");
  });

  it("should correctly handle inserting multiple elements, checking size after each operation, and removing all to empty the tree", async function () {
    // Insert multiple elements and check size
    await treeInstance.insert(30, 1);
    let size = await treeInstance.size();
    expect(size).to.equal(1);

    await treeInstance.insert(20, 2);
    size = await treeInstance.size();
    expect(size).to.equal(2);

    await treeInstance.insert(50, 3);
    size = await treeInstance.size();
    expect(size).to.equal(3);

    await treeInstance.insert(10, 4);
    size = await treeInstance.size();
    expect(size).to.equal(4);

    await treeInstance.insert(40, 5);
    size = await treeInstance.size();
    expect(size).to.equal(5);

    // Check the minimum element
    let minElement = await treeInstance.getMin();
    expect(minElement.price).to.equal(10);
    expect(minElement.tokenId).to.equal(4);

    // Remove elements one by one and check size
    await treeInstance.remove(4); // Remove element with tokenId 4
    size = await treeInstance.size();
    expect(size).to.equal(4);

    await treeInstance.remove(2); // Remove element with tokenId 2
    size = await treeInstance.size();
    expect(size).to.equal(3);

    await treeInstance.remove(5); // Remove element with tokenId 5
    size = await treeInstance.size();
    expect(size).to.equal(2);

    await treeInstance.remove(1); // Remove element with tokenId 1
    size = await treeInstance.size();
    expect(size).to.equal(1);

    await treeInstance.remove(3); // Remove element with tokenId 3
    size = await treeInstance.size();
    expect(size).to.equal(0);

    // Check that the tree is empty
    await expect(treeInstance.getMin()).to.be.revertedWith("RedBlackTree: tree is empty");
  });

  it("should correctly return the size of the tree", async function () {
      await treeInstance.insert(18, 11);
      await treeInstance.insert(22, 12);
      await treeInstance.insert(14, 13);

      let size = await treeInstance.size();
      expect(size).to.equal(3);

      await treeInstance.remove(12);

      size = await treeInstance.size();
      expect(size).to.equal(2);
  });

  it("should maintain the correct red-black tree structure after multiple operations", async function () {
      await treeInstance.insert(50, 14);
      await treeInstance.insert(40, 15);
      await treeInstance.insert(30, 16);
      await treeInstance.insert(20, 17);
      await treeInstance.insert(10, 18);

      let minElement = await treeInstance.getMin();
      expect(minElement.price).to.equal(10);
      expect(minElement.tokenId).to.equal(18);

      await treeInstance.remove(18);
      minElement = await treeInstance.getMin();
      expect(minElement.price).to.equal(20);
      expect(minElement.tokenId).to.equal(17);

      await treeInstance.remove(17);
      minElement = await treeInstance.getMin();
      expect(minElement.price).to.equal(30);
      expect(minElement.tokenId).to.equal(16);

      await treeInstance.insert(5, 19);
      minElement = await treeInstance.getMin();
      expect(minElement.price).to.equal(5);
      expect(minElement.tokenId).to.equal(19);
  });

  it("should handle a complex sequence of inserts and removals while maintaining the red-black tree properties", async function () {
    // Insert initial elements
    await treeInstance.insert(50, 1);
    await treeInstance.insert(20, 2);
    await treeInstance.insert(30, 3);
    await treeInstance.insert(40, 4);
    await treeInstance.insert(10, 5);

    // Check the minimum element
    let minElement = await treeInstance.getMin();
    expect(minElement.price).to.equal(10);
    expect(minElement.tokenId).to.equal(5);

    // Remove the current min (tokenId 5)
    await treeInstance.remove(5);
    minElement = await treeInstance.getMin();
    expect(minElement.price).to.equal(20);
    expect(minElement.tokenId).to.equal(2);

    // Insert more elements
    await treeInstance.insert(60, 6);
    await treeInstance.insert(15, 7);
    await treeInstance.insert(25, 8);

    // Check the minimum element
    minElement = await treeInstance.getMin();
    expect(minElement.price).to.equal(15);
    expect(minElement.tokenId).to.equal(7);

    // Remove some elements
    await treeInstance.remove(7);  // Removing tokenId 7
    minElement = await treeInstance.getMin();
    expect(minElement.price).to.equal(20);
    expect(minElement.tokenId).to.equal(2);

    await treeInstance.remove(2);  // Removing tokenId 2
    minElement = await treeInstance.getMin();
    expect(minElement.price).to.equal(25);
    expect(minElement.tokenId).to.equal(8);

    // Insert and remove more elements in a complex manner
    await treeInstance.insert(5, 9);   // Insert a new minimum element
    minElement = await treeInstance.getMin();
    expect(minElement.price).to.equal(5);
    expect(minElement.tokenId).to.equal(9);

    await treeInstance.insert(35, 10);
    await treeInstance.insert(45, 11);
    await treeInstance.remove(9);  // Remove the current min (tokenId 9)
    minElement = await treeInstance.getMin();
    expect(minElement.price).to.equal(25);
    expect(minElement.tokenId).to.equal(8);

    await treeInstance.remove(8);  // Remove tokenId 8
    minElement = await treeInstance.getMin();
    expect(minElement.price).to.equal(30);
    expect(minElement.tokenId).to.equal(3);

    // Continue with more operations
    await treeInstance.insert(12, 12);  // Insert a new element that should be the new min
    minElement = await treeInstance.getMin();
    expect(minElement.price).to.equal(12);
    expect(minElement.tokenId).to.equal(12);

    await treeInstance.remove(12);  // Remove the current min (tokenId 12)
    minElement = await treeInstance.getMin();
    expect(minElement.price).to.equal(30);
    expect(minElement.tokenId).to.equal(3);

    await treeInstance.remove(3);  // Remove tokenId 3
    minElement = await treeInstance.getMin();
    expect(minElement.price).to.equal(35);
    expect(minElement.tokenId).to.equal(10);

    await treeInstance.remove(10);  // Remove tokenId 10
    minElement = await treeInstance.getMin();
    expect(minElement.price).to.equal(40);
    expect(minElement.tokenId).to.equal(4);

    await treeInstance.remove(4);  // Remove tokenId 4
    minElement = await treeInstance.getMin();
    expect(minElement.price).to.equal(45);
    expect(minElement.tokenId).to.equal(11);

    await treeInstance.remove(11);  // Remove tokenId 11
    minElement = await treeInstance.getMin();
    expect(minElement.price).to.equal(50);
    expect(minElement.tokenId).to.equal(1);

    await treeInstance.remove(1);  // Remove tokenId 1

    await treeInstance.remove(6);  // Remove tokenId 6

    // The tree should be empty now
    await expect(treeInstance.getMin()).to.be.revertedWith("RedBlackTree: tree is empty");
  });


  it("should correctly insert elements and maintain the tree structure and indexing", async function () {
    await treeInstance.insert(30, 1);
    await treeInstance.insert(20, 2);
    await treeInstance.insert(40, 3);
    await treeInstance.insert(10, 4);
    await treeInstance.insert(25, 5);
    await treeInstance.insert(35, 6);
    await treeInstance.insert(50, 7);

    let priceToken = await treeInstance.getPriceTokenByIndex(0);
    expect(priceToken.price).to.equal(10);
    expect(priceToken.tokenId).to.equal(4);

    priceToken = await treeInstance.getPriceTokenByIndex(1);
    expect(priceToken.price).to.equal(20);
    expect(priceToken.tokenId).to.equal(2);

    priceToken = await treeInstance.getPriceTokenByIndex(2);
    expect(priceToken.price).to.equal(25);
    expect(priceToken.tokenId).to.equal(5);

    priceToken = await treeInstance.getPriceTokenByIndex(3);
    expect(priceToken.price).to.equal(30);
    expect(priceToken.tokenId).to.equal(1);

    priceToken = await treeInstance.getPriceTokenByIndex(4);
    expect(priceToken.price).to.equal(35);
    expect(priceToken.tokenId).to.equal(6);

    priceToken = await treeInstance.getPriceTokenByIndex(5);
    expect(priceToken.price).to.equal(40);
    expect(priceToken.tokenId).to.equal(3);

    priceToken = await treeInstance.getPriceTokenByIndex(6);
    expect(priceToken.price).to.equal(50);
    expect(priceToken.tokenId).to.equal(7);
});

it("should correctly remove elements and maintain the tree structure and indexing", async function () {
    await treeInstance.insert(30, 1);
    await treeInstance.insert(20, 2);
    await treeInstance.insert(40, 3);
    await treeInstance.insert(10, 4);
    await treeInstance.insert(25, 5);
    await treeInstance.insert(35, 6);
    await treeInstance.insert(50, 7);

    // Remove some nodes and check the structure
    await treeInstance.remove(1); // Remove the node with tokenId 1 (price 30)

    let priceToken = await treeInstance.getPriceTokenByIndex(0);
    expect(priceToken.price).to.equal(10);
    expect(priceToken.tokenId).to.equal(4);

    priceToken = await treeInstance.getPriceTokenByIndex(1);
    expect(priceToken.price).to.equal(20);
    expect(priceToken.tokenId).to.equal(2);

    priceToken = await treeInstance.getPriceTokenByIndex(2);
    expect(priceToken.price).to.equal(25);
    expect(priceToken.tokenId).to.equal(5);

    priceToken = await treeInstance.getPriceTokenByIndex(3);
    expect(priceToken.price).to.equal(35);
    expect(priceToken.tokenId).to.equal(6);

    priceToken = await treeInstance.getPriceTokenByIndex(4);
    expect(priceToken.price).to.equal(40);
    expect(priceToken.tokenId).to.equal(3);

    priceToken = await treeInstance.getPriceTokenByIndex(5);
    expect(priceToken.price).to.equal(50);
    expect(priceToken.tokenId).to.equal(7);

    // Further removals
    await treeInstance.remove(4); // Remove node with tokenId 4 (price 10)

    priceToken = await treeInstance.getPriceTokenByIndex(0);
    expect(priceToken.price).to.equal(20);
    expect(priceToken.tokenId).to.equal(2);

    priceToken = await treeInstance.getPriceTokenByIndex(1);
    expect(priceToken.price).to.equal(25);
    expect(priceToken.tokenId).to.equal(5);

    priceToken = await treeInstance.getPriceTokenByIndex(2);
    expect(priceToken.price).to.equal(35);
    expect(priceToken.tokenId).to.equal(6);

    priceToken = await treeInstance.getPriceTokenByIndex(3);
    expect(priceToken.price).to.equal(40);
    expect(priceToken.tokenId).to.equal(3);

    priceToken = await treeInstance.getPriceTokenByIndex(4);
    expect(priceToken.price).to.equal(50);
    expect(priceToken.tokenId).to.equal(7);
});

it("should handle complex interleaved operations correctly", async function () {
    await treeInstance.insert(30, 1);
    await treeInstance.insert(20, 2);
    await treeInstance.insert(40, 3);
    await treeInstance.insert(10, 4);

    // Initial checks
    let priceToken = await treeInstance.getPriceTokenByIndex(0);
    expect(priceToken.price).to.equal(10);
    expect(priceToken.tokenId).to.equal(4);

    priceToken = await treeInstance.getPriceTokenByIndex(1);
    expect(priceToken.price).to.equal(20);
    expect(priceToken.tokenId).to.equal(2);

    priceToken = await treeInstance.getPriceTokenByIndex(2);
    expect(priceToken.price).to.equal(30);
    expect(priceToken.tokenId).to.equal(1);

    priceToken = await treeInstance.getPriceTokenByIndex(3);
    expect(priceToken.price).to.equal(40);
    expect(priceToken.tokenId).to.equal(3);

    // Remove and insert interleaved
    await treeInstance.remove(2); // Remove tokenId 2 (price 20)
    await treeInstance.insert(25, 5); // Insert new node with tokenId 5 (price 25)

    priceToken = await treeInstance.getPriceTokenByIndex(0);
    expect(priceToken.price).to.equal(10);
    expect(priceToken.tokenId).to.equal(4);

    priceToken = await treeInstance.getPriceTokenByIndex(1);
    expect(priceToken.price).to.equal(25);
    expect(priceToken.tokenId).to.equal(5);

    priceToken = await treeInstance.getPriceTokenByIndex(2);
    expect(priceToken.price).to.equal(30);
    expect(priceToken.tokenId).to.equal(1);

    priceToken = await treeInstance.getPriceTokenByIndex(3);
    expect(priceToken.price).to.equal(40);
    expect(priceToken.tokenId).to.equal(3);

    // Further interleaved operations
    await treeInstance.insert(15, 6); // Insert new node with tokenId 6 (price 15)
    await treeInstance.remove(1); // Remove tokenId 1 (price 30)

    priceToken = await treeInstance.getPriceTokenByIndex(0);
    expect(priceToken.price).to.equal(10);
    expect(priceToken.tokenId).to.equal(4);

    priceToken = await treeInstance.getPriceTokenByIndex(1);
    expect(priceToken.price).to.equal(15);
    expect(priceToken.tokenId).to.equal(6);

    priceToken = await treeInstance.getPriceTokenByIndex(2);
    expect(priceToken.price).to.equal(25);
    expect(priceToken.tokenId).to.equal(5);

    priceToken = await treeInstance.getPriceTokenByIndex(3);
    expect(priceToken.price).to.equal(40);
    expect(priceToken.tokenId).to.equal(3);
});

function verifyNode(node, expected) {
  expect(node.priceToken.price).to.equal(expected.price);
  expect(node.priceToken.tokenId).to.equal(expected.tokenId);
  expect(node.color).to.equal(expected.color); // Compare node color with expected color
  expect(node.size).to.equal(expected.size);  // Check the size of the subtree rooted at this node
}


// it("should insert nodes, retrieve them by index, and verify if the final tree is a balanced Red-Black Tree", async function () {
//   // Insert elements in the given order
//   await treeInstance.insert(20, 1); // Root node
//   await treeInstance.insert(15, 2); // Left child
//   await treeInstance.insert(25, 3); // Right child
//   await treeInstance.insert(10, 4); // Insert causing a right rotation
//   await treeInstance.insert(5, 5);  // Insert causing a left-right rotation
//   await treeInstance.insert(30, 6); // Insert causing a left rotation
//   await treeInstance.insert(35, 7); // Insert causing a right-left rotation

//   // Retrieve all nodes by their index (tokenId)
//   const nodes = [];
//   for (let i = 1; i <= 7; i++) {
//       const node = await treeInstance.getNodeByTokenId(i);
//       nodes.push({
//           tokenId: priceToken.data.tokenId,
//           price: priceToken.data.price,
//           red: priceToken.red,
//           size: priceToken.size
//       });
//   }

//   let node_15 = treeInstance.getNodeByTokenId(2);
//   expect(node_15.red == false, "node15 is not black");

//   // Verify Red-Black Tree properties

//   // 1. The root must be black
//   expect(nodes[0].red).to.equal(false);

//   // 2. Red property: No red node can have a red child
//   for (let node of nodes) {
//       if (priceToken.red) {
//           // Check children for red nodes (use the size to determine parent-child relationships)
//           for (let otherNode of nodes) {
//               if (otherpriceToken.size < priceToken.size && otherpriceToken.price < priceToken.price) {
//                   expect(otherpriceToken.red).to.equal(false); // Left child should not be red
//               }
//               if (otherpriceToken.size < priceToken.size && otherpriceToken.price > priceToken.price) {
//                   expect(otherpriceToken.red).to.equal(false); // Right child should not be red
//               }
//           }
//       }
//   }

//   // 3. Black height property: Every path from a node to its descendant leaves should have the same number of black nodes
//   function calculateBlackHeight(node, nodes) {
//       if (!node) return 1; // Null leaves are black
//       let blackHeight = 0;
//       if (!priceToken.red) blackHeight++; // Count black nodes
//       for (let child of nodes) {
//           if (child.size < priceToken.size && child.price < priceToken.price) {
//               blackHeight += calculateBlackHeight(child, nodes); // Left child
//           } else if (child.size < priceToken.size && child.price > priceToken.price) {
//               blackHeight += calculateBlackHeight(child, nodes); // Right child
//           }
//       }
//       return blackHeight;
//   }

//   const blackHeights = nodes.map(node => calculateBlackHeight(node, nodes));
//   // Check that all paths have the same black height
//   expect(new Set(blackHeights).size).to.equal(3);

//   // If all the above conditions pass, the tree is a valid Red-Black Tree
// });






const maxUint256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;

it("should correctly handle inserting 200 unique elements and removing 100 randomly", async function () {
  // Insert 200 unique elements
  const elements = new Set();
  while (elements.size < 200) {
      const price = Math.floor(Math.random() * 1000);  // Random price for diversity
      const tokenId = Math.floor(Math.random() * 10000) + 1;  // Unique TokenId
      if (!elements.has(tokenId)) {
          elements.add(tokenId);
          await treeInstance.insert(price, tokenId);
      }
  }

  // Convert the set to an array for easier manipulation
  const elementsArray = Array.from(elements);

  // Randomly remove 100 elements
  const elementsToRemove = new Set();
  while (elementsToRemove.size < 100) {
      const index = Math.floor(Math.random() * elementsArray.length);
      const elementToRemove = elementsArray.splice(index, 1)[0];
      elementsToRemove.add(elementToRemove);
      // console.log("token_id_removed: " + elementToRemove);
      await treeInstance.remove(elementToRemove);
  }

  // Verify that the tree still has 100 elements
  const remainingSize = await treeInstance.size();
  expect(remainingSize).to.equal(100);

  //let tree_structure = await treeInstance.printTree();
  //console.log(tree_structure);

  // console.log("elementsArray size: " + elementsArray.length);
  let tree_structure_size = await treeInstance.size();
  // console.log("TTTTTTTTTT" + tree_structure_size);
  let start_count = 1;
  // Verify that the remaining tree satisfies the Red-Black Tree properties
  for (const tokenId of elementsArray) {
    // console.log("token_id: " + tokenId + ":count " + start_count);
    start_count++;
      const node = await treeInstance.getNodeByTokenId(tokenId);
      expect(node.priceToken.tokenId).to.equal(tokenId);
  }

  // let tree_structure = await treeInstance.printTree();
  // console.log(tree_structure);

  // Check Red-Black Tree properties
  await verifyRedBlackTreeProperties(treeInstance);
});

// async function verifyRedBlackTreeProperties(treeInstance) {
//   const rootNode = await treeInstance.getNodeByTokenId(treeInstance.root());
//   expect(rootNode.color).to.equal(Color.BLACK); // Root should be black

//   // Traverse and check each node
//   await checkNode(treeInstance, rootNode.key.tokenId);
// }

// async function checkNode(treeInstance, tokenId) {
//   const node = await treeInstance.getNodeByTokenId(tokenId);
// // console.log(node);
// // console.log(await treeInstance.height());
//   // Check if both children of a red node are black
//   if (node.color == Color.RED) {
//       if (node.left != maxUint256) {
//           const leftChild = await treeInstance.getNodeByTokenId(node.left);
//           expect(leftChild.color).to.equal(Color.BLACK);
//       }
//       if (node.right != maxUint256) {
//           const rightChild = await treeInstance.getNodeByTokenId(node.right);
//           expect(rightChild.color).to.equal(Color.BLACK);
//       }
//   }

//   // Recursively check left and right subtrees
//   if (node.left != maxUint256) await checkNode(treeInstance, node.left);
//   if (node.right != maxUint256) await checkNode(treeInstance, node.right);
// }





async function verifyRedBlackTreeProperties(treeInstance) {
  const rootNode = await treeInstance.getNodeByTokenId(treeInstance.root());
  expect(rootNode.color).to.equal(Color.BLACK); // Root should be black

  // Start verification process and ensure consistent black height
  const blackHeight = await checkNode(treeInstance, treeInstance.root(), 0);
  // console.log(`Black Height: ${blackHeight}`);
}

async function checkNode(treeInstance, tokenId, blackCount) {
  if (tokenId == maxUint256) {
    // We've reached a NULL_NODE, return the black count
    return blackCount;
  }

  const node = await treeInstance.getNodeByTokenId(tokenId);

  // If node is black, increment the black count
  if (node.color == Color.BLACK) {
    blackCount++;
  }

  // Check if both children of a red node are black
  if (node.color == Color.RED) {
    if (node.left != maxUint256) {
      const leftChild = await treeInstance.getNodeByTokenId(node.left);
      expect(leftChild.color).to.equal(Color.BLACK);
    }
    if (node.right != maxUint256) {
      const rightChild = await treeInstance.getNodeByTokenId(node.right);
      expect(rightChild.color).to.equal(Color.BLACK);
    }
  }

  // Recursively check left and right subtrees
  let leftBlackHeight = 0;
  let rightBlackHeight = 0;

  if (node.left != maxUint256) {
    leftBlackHeight = await checkNode(treeInstance, node.left, blackCount);
  } else {
    leftBlackHeight = blackCount;
  }

  if (node.right != maxUint256) {
    rightBlackHeight = await checkNode(treeInstance, node.right, blackCount);
  } else {
    rightBlackHeight = blackCount;
  }

  // Verify that both left and right subtrees have the same black height
  expect(leftBlackHeight).to.equal(rightBlackHeight, `Black height mismatch at node ${tokenId}`);

  // Return the black height for this subtree
  return leftBlackHeight;
}

it("should correctly perform insertions and maintain tree properties", async function () {
  // Perform insertions
  await treeInstance.insert(20, 1);
  await treeInstance.insert(15, 2);
  await treeInstance.insert(25, 3);
  await treeInstance.insert(10, 4);
  await treeInstance.insert(5, 5);
  await treeInstance.insert(30, 6);
  await treeInstance.insert(35, 7);

  let node;

  // Root node
  node = await treeInstance.getNodeByTokenId(1);
  verifyNode(node, { price: 20, tokenId: 1, color: Color.BLACK, size: 7 });

  // Left subtree
  node = await treeInstance.getNodeByTokenId(4);
  verifyNode(node, { price: 10, tokenId: 4, color: Color.BLACK, size: 3 });

  node = await treeInstance.getNodeByTokenId(5);
  verifyNode(node, { price: 5, tokenId: 5, color: Color.RED, size: 1 });

  node = await treeInstance.getNodeByTokenId(2);
  verifyNode(node, { price: 15, tokenId: 2, color: Color.RED, size: 1 });

  // Right subtree
  node = await treeInstance.getNodeByTokenId(6);
  verifyNode(node, { price: 30, tokenId: 6, color: Color.BLACK, size: 3 });

  node = await treeInstance.getNodeByTokenId(3);
  verifyNode(node, { price: 25, tokenId: 3, color: Color.RED, size: 1 });

  node = await treeInstance.getNodeByTokenId(7);
  verifyNode(node, { price: 35, tokenId: 7, color: Color.RED, size: 1 });

  // Verify overall tree properties
  await verifyRedBlackTreeProperties(treeInstance);
});


it("should correctly handle transplants and maintain tree properties", async function () {
  // Insert elements that will cause transplants
  await treeInstance.insert(20, 1);
  await treeInstance.insert(15, 2);
  await treeInstance.insert(25, 3);
  await treeInstance.insert(10, 4);
  await treeInstance.insert(17, 5);
  await treeInstance.insert(5, 6);
  await treeInstance.insert(12, 7);

  // Perform removal that requires transplant
  await treeInstance.remove(2);

  // let node;

  // Root node
  node = await treeInstance.getNodeByTokenId(1);
  verifyNode(node, { price: 20, tokenId: 1, color: Color.BLACK, size: 6 });

  // Left subtree
  node = await treeInstance.getNodeByTokenId(4);
  verifyNode(node, { price: 10, tokenId: 4, color: Color.RED, size: 4 });

  node = await treeInstance.getNodeByTokenId(6);
  verifyNode(node, { price: 5, tokenId: 6, color: Color.BLACK, size: 1 });

  node = await treeInstance.getNodeByTokenId(7);
  verifyNode(node, { price: 12, tokenId: 7, color: Color.RED, size: 1 });

  node = await treeInstance.getNodeByTokenId(5);
  verifyNode(node, { price: 17, tokenId: 5, color: Color.BLACK, size: 2 });

  // Right subtree
  node = await treeInstance.getNodeByTokenId(3);
  verifyNode(node, { price: 25, tokenId: 3, color: Color.BLACK, size: 1 });

  // Verify overall tree properties
  await verifyRedBlackTreeProperties(treeInstance);
});

it("should correctly handle multiple complex operations with rotations and transplants", async function () {
  await treeInstance.insert(10, 1);
  await treeInstance.insert(20, 2);
  await treeInstance.insert(5, 3);
  await treeInstance.insert(1, 4);
  await treeInstance.insert(6, 5);
  await treeInstance.insert(15, 6);
  await treeInstance.insert(25, 7);
  await treeInstance.insert(12, 8);
  await treeInstance.insert(17, 9);
  await treeInstance.insert(30, 10);

  await treeInstance.remove(1);  // Removes node with price 10
  await treeInstance.remove(4);  // Removes node with price 1
  await treeInstance.remove(9);  // Removes node with price 17

  let node;

  // Root node
  node = await treeInstance.getNodeByTokenId(8);
  verifyNode(node, { price: 12, tokenId: 8, color: Color.BLACK, size: 7 });

  // Left subtree
  node = await treeInstance.getNodeByTokenId(3);
  verifyNode(node, { price: 5, tokenId: 3, color: Color.BLACK, size: 2 });

  node = await treeInstance.getNodeByTokenId(5);
  verifyNode(node, { price: 6, tokenId: 5, color: Color.RED, size: 1 });

  // Right subtree
  node = await treeInstance.getNodeByTokenId(2);
  verifyNode(node, { price: 20, tokenId: 2, color: Color.RED, size: 4 });

  node = await treeInstance.getNodeByTokenId(6);
  verifyNode(node, { price: 15, tokenId: 6, color: Color.BLACK, size: 1 });

  node = await treeInstance.getNodeByTokenId(7);
  verifyNode(node, { price: 25, tokenId: 7, color: Color.BLACK, size: 2 });

  node = await treeInstance.getNodeByTokenId(10);
  verifyNode(node, { price: 30, tokenId: 10, color: Color.RED, size: 1 });

  // Verify overall tree properties
  await verifyRedBlackTreeProperties(treeInstance);
});

it("should correctly handle edge cases including insertions and removals causing double black violations", async function () {
  // Insert elements that could cause double black violations
  await treeInstance.insert(30, 1);
  await treeInstance.insert(20, 2);
  await treeInstance.insert(40, 3);
  await treeInstance.insert(10, 4);
  await treeInstance.insert(25, 5);
  await treeInstance.insert(35, 6);
  await treeInstance.insert(50, 7);

  // Perform operations that should trigger double black resolution
  await treeInstance.remove(3); // Removing node with tokenId 3 (price 40), causes double black
  await treeInstance.remove(6); // Removing node with tokenId 6 (price 35), fixes double black

  // Verify the final tree structure and properties
  let node;

  // Root
  node = await treeInstance.getNodeByTokenId(1);
  verifyNode(node, { price: 30, tokenId: 1, color: Color.BLACK, size: 5 });

  // Left subtree
  node = await treeInstance.getNodeByTokenId(2);
  verifyNode(node, { price: 20, tokenId: 2, color: Color.BLACK, size: 3 });

  node = await treeInstance.getNodeByTokenId(4);
  verifyNode(node, { price: 10, tokenId: 4, color: Color.RED, size: 1 });

  node = await treeInstance.getNodeByTokenId(5);
  verifyNode(node, { price: 25, tokenId: 5, color: Color.RED, size: 1 });

  // Right subtree
  node = await treeInstance.getNodeByTokenId(7);
  verifyNode(node, { price: 50, tokenId: 7, color: Color.BLACK, size: 1 });

  await verifyRedBlackTreeProperties(treeInstance);
});

it("should handle 50 inserts and 50 removes while maintaining tree properties", async function () {
  // Insert 1
  await treeInstance.insert(50, 1);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 2
  await treeInstance.insert(25, 2);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 3
  await treeInstance.insert(75, 3);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 1
  await treeInstance.remove(1);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 4
  await treeInstance.insert(12, 4);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 5
  await treeInstance.insert(37, 5);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 2
  await treeInstance.remove(2);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 6
  await treeInstance.insert(62, 6);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 7
  await treeInstance.insert(87, 7);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 3
  await treeInstance.remove(3);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 8
  await treeInstance.insert(6, 8);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 9
  await treeInstance.insert(18, 9);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 4
  await treeInstance.remove(4);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 10
  await treeInstance.insert(31, 10);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 11
  await treeInstance.insert(43, 11);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 5
  await treeInstance.remove(5);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 12
  await treeInstance.insert(56, 12);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 13
  await treeInstance.insert(68, 13);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 6
  await treeInstance.remove(6);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 14
  await treeInstance.insert(81, 14);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 15
  await treeInstance.insert(93, 15);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 7
  await treeInstance.remove(7);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 16
  await treeInstance.insert(3, 16);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 17
  await treeInstance.insert(9, 17);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 8
  await treeInstance.remove(8);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 18
  await treeInstance.insert(15, 18);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 19
  await treeInstance.insert(21, 19);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 9
  await treeInstance.remove(9);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 20
  await treeInstance.insert(28, 20);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 21
  await treeInstance.insert(34, 21);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 10
  await treeInstance.remove(10);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 22
  await treeInstance.insert(40, 22);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 23
  await treeInstance.insert(46, 23);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 11
  await treeInstance.remove(11);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 24
  await treeInstance.insert(53, 24);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 25
  await treeInstance.insert(59, 25);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 12
  await treeInstance.remove(12);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 26
  await treeInstance.insert(65, 26);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 27
  await treeInstance.insert(71, 27);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 13
  await treeInstance.remove(13);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 28
  await treeInstance.insert(78, 28);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 29
  await treeInstance.insert(84, 29);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 14
  await treeInstance.remove(14);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 30
  await treeInstance.insert(90, 30);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 31
  await treeInstance.insert(96, 31);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 15
  await treeInstance.remove(15);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 32
  await treeInstance.insert(1, 32);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 33
  await treeInstance.insert(4, 33);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 16
  await treeInstance.remove(16);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 34
  await treeInstance.insert(7, 34);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 35
  await treeInstance.insert(10, 35);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 17
  await treeInstance.remove(17);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 36
  await treeInstance.insert(13, 36);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 37
  await treeInstance.insert(16, 37);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 18
  await treeInstance.remove(18);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 38
  await treeInstance.insert(19, 38);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 39
  await treeInstance.insert(22, 39);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 19
  await treeInstance.remove(19);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 40
  await treeInstance.insert(25, 40);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 41
  await treeInstance.insert(28, 41);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 20
  await treeInstance.remove(20);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 42
  await treeInstance.insert(31, 42);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 43
  await treeInstance.insert(34, 43);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 21
  await treeInstance.remove(21);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 44
  await treeInstance.insert(37, 44);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 45
  await treeInstance.insert(40, 45);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 22
  await treeInstance.remove(22);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 46
  await treeInstance.insert(43, 46);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 47
  await treeInstance.insert(46, 47);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 23
  await treeInstance.remove(23);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 48
  await treeInstance.insert(49, 48);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 49
  await treeInstance.insert(52, 49);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 24
  await treeInstance.remove(24);
  await verifyRedBlackTreeProperties(treeInstance);

  // Insert 50
  await treeInstance.insert(55, 50);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove 25
  await treeInstance.remove(25);
  await verifyRedBlackTreeProperties(treeInstance);

  // Remove remaining nodes
  for (let i = 26; i <= 50; i++) {
    await treeInstance.remove(i);
    await verifyRedBlackTreeProperties(treeInstance);
  }

});



it("should correctly return price tokens by index with various prices (zero-based)", async function() {
  // Insert elements with various prices
  await treeInstance.insert(50, 1);
  await treeInstance.insert(30, 2);
  await treeInstance.insert(70, 3);
  await treeInstance.insert(20, 4);
  await treeInstance.insert(40, 5);
  await treeInstance.insert(60, 6);
  await treeInstance.insert(80, 7);

  // Test getPriceTokenByIndex
  let result = await treeInstance.getPriceTokenByIndex(0);
  expect(result.price).to.equal(20);
  expect(result.tokenId).to.equal(4);

  result = await treeInstance.getPriceTokenByIndex(2);
  expect(result.price).to.equal(40);
  expect(result.tokenId).to.equal(5);

  result = await treeInstance.getPriceTokenByIndex(4);
  expect(result.price).to.equal(60);
  expect(result.tokenId).to.equal(6);

  result = await treeInstance.getPriceTokenByIndex(6);
  expect(result.price).to.equal(80);
  expect(result.tokenId).to.equal(7);

  // // Test edge cases
  // try {
  //   await treeInstance.getPriceTokenByIndex(-1);
  //   assert.fail("Should have thrown an error for index -1");
  // } catch (error) {
  //   // console.log(error.message);
  //   expect(error.message).to.include("Index out of range");
  // }

  // Test edge cases
  // try {
  //   await treeInstance.getPriceTokenByIndex(0);
  //   assert.fail("Should have thrown an error for index 0");
  // } catch (error) {
  //   // console.log(error.message);
  //   expect(error.message).to.include("Index out of range");
  // }
  await expect(treeInstance.getPriceTokenByIndexZero())
  .to.be.revertedWith("Index out of range");


  try {
    await treeInstance.getPriceTokenByIndex(7);
    assert.fail("Should have thrown an error for index out of range");
  } catch (error) {
    expect(error.message).to.include("Index out of range");
  }

  // Remove an element and test again
  await treeInstance.remove(5);  // Remove price 40

  result = await treeInstance.getPriceTokenByIndex(2);
  expect(result.price).to.equal(50);
  expect(result.tokenId).to.equal(1);

  // Insert a new element and test
  await treeInstance.insert(45, 8);

  result = await treeInstance.getPriceTokenByIndex(2);
  expect(result.price).to.equal(45);
  expect(result.tokenId).to.equal(8);
});

it("should correctly handle elements with same price but different tokenIds (zero-based)", async function() {
  // Insert elements with same prices but different tokenIds
  await treeInstance.insert(50, 1);
  await treeInstance.insert(50, 2);
  await treeInstance.insert(30, 3);
  await treeInstance.insert(30, 4);
  await treeInstance.insert(70, 5);
  await treeInstance.insert(70, 6);

  // Test getPriceTokenByIndex
  let result = await treeInstance.getPriceTokenByIndex(0);
  expect(result.price).to.equal(30);
  expect(result.tokenId).to.equal(3);

  result = await treeInstance.getPriceTokenByIndex(1);
  expect(result.price).to.equal(30);
  expect(result.tokenId).to.equal(4);

  result = await treeInstance.getPriceTokenByIndex(2);
  expect(result.price).to.equal(50);
  expect(result.tokenId).to.equal(1);

  result = await treeInstance.getPriceTokenByIndex(3);
  expect(result.price).to.equal(50);
  expect(result.tokenId).to.equal(2);

  result = await treeInstance.getPriceTokenByIndex(4);
  expect(result.price).to.equal(70);
  expect(result.tokenId).to.equal(5);

  result = await treeInstance.getPriceTokenByIndex(5);
  expect(result.price).to.equal(70);
  expect(result.tokenId).to.equal(6);

  // Remove an element with a duplicate price and test again
  await treeInstance.remove(1);  // Remove first 50

  result = await treeInstance.getPriceTokenByIndex(2);
  expect(result.price).to.equal(50);
  expect(result.tokenId).to.equal(2);

  // Insert a new element with an existing price and test
  await treeInstance.insert(30, 7);

  result = await treeInstance.getPriceTokenByIndex(0);
  expect(result.price).to.equal(30);
  expect(result.tokenId).to.equal(3);

  result = await treeInstance.getPriceTokenByIndex(1);
  expect(result.price).to.equal(30);
  expect(result.tokenId).to.equal(4);

  result = await treeInstance.getPriceTokenByIndex(2);
  expect(result.price).to.equal(30);
  expect(result.tokenId).to.equal(7);
});
it("should handle complex scenarios and maintain correct structure and ordering", async function () {
  // Test empty tree

  // await expect(treeInstance.getPriceTokenByIndexZero()).to.be.revertedWith("Tree is not initialized");

  
  // Insert initial elements
  await treeInstance.insert(50, 1);
  await treeInstance.insert(30, 2);
  await treeInstance.insert(70, 3);
  await treeInstance.insert(20, 4);
  await treeInstance.insert(40, 5);
  await treeInstance.insert(60, 6);
  await treeInstance.insert(80, 7);

  await expect(treeInstance.getPriceTokenByIndexZero()).to.be.revertedWith("Index out of range");

  // Test getPriceTokenByIndex for all elements
  for (let i = 0; i < 7; i++) {
    const result = await treeInstance.getPriceTokenByIndex(i);
    expect(result.price).to.equal([20, 30, 40, 50, 60, 70, 80][i]);
    expect(result.tokenId).to.equal([4, 2, 5, 1, 6, 3, 7][i]);
  }

  // Test edge cases
  await expect(treeInstance.getPriceTokenByIndexZero()).to.be.revertedWith("Index out of range");
  await expect(treeInstance.getPriceTokenByIndex(7)).to.be.revertedWith("Index out of range");

  // Remove elements
  await treeInstance.remove(5); // Remove 40
  await treeInstance.remove(1); // Remove 50 (root)

  // Insert elements with duplicate prices
  await treeInstance.insert(30, 8);
  await treeInstance.insert(30, 9);

  // Verify ordering of duplicate prices
  let result = await treeInstance.getPriceTokenByIndex(1);
  expect(result.price).to.equal(30);
  expect(result.tokenId).to.equal(2);

  result = await treeInstance.getPriceTokenByIndex(2);
  expect(result.price).to.equal(30);
  expect(result.tokenId).to.equal(8);

  result = await treeInstance.getPriceTokenByIndex(3);
  expect(result.price).to.equal(30);
  expect(result.tokenId).to.equal(9);

  // Remove middle element of duplicate prices
  await treeInstance.remove(8);

  // Insert elements to test rebalancing
  await treeInstance.insert(10, 10);
  await treeInstance.insert(15, 11);
  await treeInstance.insert(5, 12);

  // Verify red-black properties
  await verifyRedBlackTreeProperties(treeInstance);

  // Test remove non-existent element
  await expect(treeInstance.remove(100)).to.be.revertedWith("TokenId not found");

  // Remove all elements except one
  for (const tokenId of [2, 3, 4, 6, 7, 9, 10, 11]) {
    await treeInstance.remove(tokenId);
  }

  // Verify last element
  result = await treeInstance.getPriceTokenByIndex(0);
  expect(result.price).to.equal(5);
  expect(result.tokenId).to.equal(12);

  // Remove last element
  await treeInstance.remove(12);

  // Verify empty tree
  await expect(treeInstance.getPriceTokenByIndex(0)).to.be.revertedWith("Index out of range");



   // Hardcoded random order for 50 inserts with unique tokenIds
   const insertsOrder = [
    {price: 270, tokenId: 123}, {price: 150, tokenId: 101}, {price: 430, tokenId: 145},
    {price: 80, tokenId: 108}, {price: 320, tokenId: 132}, {price: 190, tokenId: 119},
    {price: 500, tokenId: 150}, {price: 40, tokenId: 104}, {price: 380, tokenId: 138},
    {price: 230, tokenId: 124}, {price: 110, tokenId: 111}, {price: 470, tokenId: 147},
    {price: 20, tokenId: 102}, {price: 290, tokenId: 129}, {price: 140, tokenId: 114},
    {price: 410, tokenId: 141}, {price: 60, tokenId: 106}, {price: 350, tokenId: 135},
    {price: 200, tokenId: 120}, {price: 490, tokenId: 149}, {price: 30, tokenId: 103},
    {price: 340, tokenId: 134}, {price: 170, tokenId: 117}, {price: 450, tokenId: 146},
    {price: 90, tokenId: 109}, {price: 300, tokenId: 130}, {price: 160, tokenId: 116},
    {price: 420, tokenId: 142}, {price: 70, tokenId: 107}, {price: 360, tokenId: 136},
    {price: 210, tokenId: 121}, {price: 480, tokenId: 148}, {price: 50, tokenId: 105},
    {price: 330, tokenId: 133}, {price: 180, tokenId: 118}, {price: 440, tokenId: 144},
    {price: 100, tokenId: 110}, {price: 310, tokenId: 131}, {price: 220, tokenId: 122},
    {price: 460, tokenId: 143}, {price: 10, tokenId: 151}, {price: 370, tokenId: 137},
    {price: 240, tokenId: 125}, {price: 130, tokenId: 113}, {price: 400, tokenId: 140},
    {price: 280, tokenId: 128}, {price: 120, tokenId: 112}, {price: 390, tokenId: 139},
    {price: 250, tokenId: 126}, {price: 260, tokenId: 127}
  ];

  // Perform the 50 inserts
  for (const insert of insertsOrder) {
    await treeInstance.insert(insert.price, insert.tokenId);
  }

  // Verify red-black properties after inserts
  await verifyRedBlackTreeProperties(treeInstance);

  // Hardcoded random order for 25 removes
  const removesOrder = [
    108, 132, 119, 104, 138, 111, 147, 102, 129, 106, 135, 120, 
    103, 134, 117, 109, 130, 107, 136, 121, 105, 133, 118, 110, 131
  ];

  // Perform the 25 removes
  for (const tokenId of removesOrder) {
    await treeInstance.remove(tokenId);
  }

  // Verify red-black properties after removes
  await verifyRedBlackTreeProperties(treeInstance);



});

it("should correctly handle duplicate tokenId insertions", async function () {
  // Insert initial elements
  await treeInstance.insert(50, 1);
  await treeInstance.insert(30, 2);
  await treeInstance.insert(70, 3);

  // Attempt to insert a duplicate tokenId
  await expect(treeInstance.insert(40, 1))
    .to.be.revertedWith("TokenId already exists");

  // Insert a new unique tokenId
  await treeInstance.insert(60, 4);

  // Attempt to insert another duplicate tokenId
  await expect(treeInstance.insert(80, 2))
    .to.be.revertedWith("TokenId already exists");

  // Remove an element
  await treeInstance.remove(3);

  // Attempt to insert the removed tokenId (should succeed if your implementation allows this)
  await treeInstance.insert(75, 3);

  // Verify the structure is correct
  let result = await treeInstance.getPriceTokenByIndex(0);
  expect(result.price).to.equal(30);
  expect(result.tokenId).to.equal(2);

  result = await treeInstance.getPriceTokenByIndex(3);
  expect(result.price).to.equal(75);
  expect(result.tokenId).to.equal(3);

  // Attempt to insert the reused tokenId again
  await expect(treeInstance.insert(90, 3))
    .to.be.revertedWith("TokenId already exists");

  // Verify the final size of the tree
  const finalSize = await treeInstance.size();
  expect(finalSize).to.equal(4);
});

it("should handle complex scenarios with duplicate tokenIds correctly", async function () {
  // Insert initial elements
  await treeInstance.insert(50, 1);
  await treeInstance.insert(30, 2);
  await treeInstance.insert(70, 3);
  await treeInstance.insert(20, 4);
  await treeInstance.insert(40, 5); //20, 35, 40, 50, 60, 65, 70, 
  await treeInstance.insert(60, 6); //20, 35, 40, 50, 65, 70, 80
  await treeInstance.insert(80, 7);

  // Attempt to insert duplicates
  await expect(treeInstance.insert(100, 1)).to.be.revertedWith("TokenId already exists");
  await expect(treeInstance.insert(10, 7)).to.be.revertedWith("TokenId already exists");

  // Remove some elements
  await treeInstance.remove(2);  // Remove 30
  await treeInstance.remove(6);  // Remove 60

  // Attempt to insert with removed tokenIds
  await treeInstance.insert(35, 2);  // Should succeed
  await treeInstance.insert(65, 6);  // Should succeed

  // ADD A SIZE CHECK HERE
  // ADD TEST WHICH CONFIRMS ALL NODES ARE FROM LOWEST TO HIGHEST

  // Verify structure after reinsertion
  let result = await treeInstance.getPriceTokenByIndex(1);
  expect(result.price).to.equal(35);
  expect(result.tokenId).to.equal(2);

  // console.log(await treeInstance.getPriceTokenByIndex(0));
  // console.log(await treeInstance.getPriceTokenByIndex(1));
  // console.log(await treeInstance.getPriceTokenByIndex(2));
  // console.log(await treeInstance.getPriceTokenByIndex(3));
  // console.log(await treeInstance.getPriceTokenByIndex(4));
  // console.log(await treeInstance.getPriceTokenByIndex(5));
  // console.log(await treeInstance.getPriceTokenByIndex(6));

  result = await treeInstance.getPriceTokenByIndex(5);
  expect(result.price).to.equal(70);
  expect(result.tokenId).to.equal(3);

  // Attempt to insert duplicates of reinserted tokenIds
  await expect(treeInstance.insert(45, 2)).to.be.revertedWith("TokenId already exists");
  await expect(treeInstance.insert(55, 6)).to.be.revertedWith("TokenId already exists");

  // Insert elements with edge case tokenIds
  await treeInstance.insert(5, 0);   // Assuming 0 is a valid tokenId
  await treeInstance.insert(95, 2**32 - 1);  // Max uint32, adjust if using a different size

  // Verify edge case insertions
  result = await treeInstance.getPriceTokenByIndex(0);
  expect(result.price).to.equal(5);
  expect(result.tokenId).to.equal(0);

  result = await treeInstance.getPriceTokenByIndex(8);
  expect(result.price).to.equal(95);
  expect(result.tokenId).to.equal(2**32 - 1);

  // Attempt to insert duplicates of edge cases
  await expect(treeInstance.insert(10, 0)).to.be.revertedWith("TokenId already exists");
  await expect(treeInstance.insert(90, 2**32 - 1)).to.be.revertedWith("TokenId already exists");

  // Remove all elements and reinsert with the same tokenIds
  for (let i = 1; i <= 7; i++) {
    await treeInstance.remove(i);
  }
  await treeInstance.remove(0);
  await treeInstance.remove(2**32 - 1);

  // Reinsert with the same tokenIds
  await treeInstance.insert(15, 1);
  await treeInstance.insert(25, 2);
  await treeInstance.insert(35, 3);
  await treeInstance.insert(45, 4);
  await treeInstance.insert(55, 5);
  await treeInstance.insert(65, 6);
  await treeInstance.insert(75, 7);
  await treeInstance.insert(85, 0);
  await treeInstance.insert(95, 2**32 - 1);

  // Verify final structure
  for (let i = 0; i < 9; i++) {
    result = await treeInstance.getPriceTokenByIndex(i);
    expect(result.price).to.equal(15 + i * 10);
    expect(result.tokenId).to.equal(i < 7 ? i + 1 : (i === 7 ? 0 : 2**32 - 1));
  }

  // Verify final size
  const finalSize = await treeInstance.size();
  expect(finalSize).to.equal(9);
});

it("should handle complex intermingled operations and maintain correct order", async function () {
  // Sequence of inserts and removes
  await treeInstance.insert(50, 1);
  await treeInstance.insert(30, 2);
  await treeInstance.insert(70, 3);
  await treeInstance.insert(20, 4);
  await treeInstance.insert(40, 5);
  await treeInstance.insert(60, 6);
  await treeInstance.insert(80, 7);
  await treeInstance.remove(5);  // Remove 40
  await treeInstance.insert(35, 8);
  await treeInstance.insert(75, 9);
  await treeInstance.remove(1);  // Remove 50
  await treeInstance.insert(55, 10);
  await treeInstance.remove(7);  // Remove 80
  await treeInstance.insert(65, 11);
  await treeInstance.insert(25, 12);
  await treeInstance.remove(2);  // Remove 30
  await treeInstance.insert(45, 13);
  await treeInstance.insert(85, 14);
  await treeInstance.remove(6);  // Remove 60
  await treeInstance.insert(15, 15);
  await treeInstance.insert(90, 16);
  await treeInstance.remove(4);  // Remove 20
  await treeInstance.insert(10, 17);
  await treeInstance.insert(95, 18);
  await treeInstance.remove(3);  // Remove 70
  await treeInstance.insert(5, 19);
  await treeInstance.insert(100, 20);
  await treeInstance.remove(9);  // Remove 75

  // Verify red-black properties
  await verifyRedBlackTreeProperties(treeInstance);

  // Verify final structure (prices from lowest to highest)
  const expectedOrder = [
    { price: 5, tokenId: 19 },
    { price: 10, tokenId: 17 },
    { price: 15, tokenId: 15 },
    { price: 25, tokenId: 12 },
    { price: 35, tokenId: 8 },
    { price: 45, tokenId: 13 },
    { price: 55, tokenId: 10 },
    { price: 65, tokenId: 11 },
    { price: 85, tokenId: 14 },
    { price: 90, tokenId: 16 },
    { price: 95, tokenId: 18 },
    { price: 100, tokenId: 20 }
  ];

  for (let i = 0; i < expectedOrder.length; i++) {
    const result = await treeInstance.getPriceTokenByIndex(i);
    expect(result.price).to.equal(expectedOrder[i].price, `Mismatch in price at index ${i}`);
    expect(result.tokenId).to.equal(expectedOrder[i].tokenId, `Mismatch in tokenId at index ${i}`);
  }

  // Verify size
  const size = await treeInstance.size();
  expect(size).to.equal(expectedOrder.length, "Incorrect final size");

  // Verify that trying to access an index beyond the size fails
  await expect(treeInstance.getPriceTokenByIndex(expectedOrder.length))
    .to.be.revertedWith("Index out of range");
});


});

describe("OrderStatisticsTree - PriceToken Range Methods", function () {
  let treeInstance;

  beforeEach(async function () {
    OrderStatisticsTree = await ethers.getContractFactory("OrderStatisticsTree");
    orderStatisticsTree = await OrderStatisticsTree.deploy();
    await orderStatisticsTree.waitForDeployment();
    // console.log(orderStatisticsTree.target);

   OrderStatisticsTreeTestFactory = await ethers.getContractFactory("OrderStatisticsTreeTest", {
    libraries: {
      OrderStatisticsTree: orderStatisticsTree.target,
    },
  });
    treeInstance = await OrderStatisticsTreeTestFactory.deploy();
    await treeInstance.waitForDeployment();
    await treeInstance.initializeTree(ComparatorType.PRICETOKEN_PRICE_TOKENID);

    // Insert some initial data
    await treeInstance.insert(50, 1);
    await treeInstance.insert(30, 2);
    await treeInstance.insert(70, 3);
    await treeInstance.insert(20, 4);
    await treeInstance.insert(40, 5);
    await treeInstance.insert(60, 6);
    await treeInstance.insert(80, 7);
  });

  describe("getPriceTokenRange", function() {
    it("should return correct range from the start", async function () {
      const result = await treeInstance.getPriceTokenRange(0, 3);
      expect(result.length).to.equal(3);
      expect(result[0].price).to.equal(20);
      expect(result[0].tokenId).to.equal(4);
      expect(result[1].price).to.equal(30);
      expect(result[1].tokenId).to.equal(2);
      expect(result[2].price).to.equal(40);
      expect(result[2].tokenId).to.equal(5);
    });

    it("should return correct range from the middle", async function () {
      const result = await treeInstance.getPriceTokenRange(3, 3);
      expect(result.length).to.equal(3);
      expect(result[0].price).to.equal(50);
      expect(result[0].tokenId).to.equal(1);
      expect(result[1].price).to.equal(60);
      expect(result[1].tokenId).to.equal(6);
      expect(result[2].price).to.equal(70);
      expect(result[2].tokenId).to.equal(3);
    });

    it("should return correct range when count exceeds available elements", async function () {
      const result = await treeInstance.getPriceTokenRange(5, 5);
      expect(result.length).to.equal(2);
      expect(result[0].price).to.equal(70);
      expect(result[0].tokenId).to.equal(3);
      expect(result[1].price).to.equal(80);
      expect(result[1].tokenId).to.equal(7);
    });

    it("should return all elements when count is larger than tree size", async function () {
      const result = await treeInstance.getPriceTokenRange(0, 10);
      expect(result.length).to.equal(7);
      expect(result[0].price).to.equal(20);
      expect(result[6].price).to.equal(80);
    });

    it("should revert for out of range start index", async function () {
      // await expect(treeInstance.getPriceTokenRange(7, 1)).to.be.revertedWith("Start index out of range");
      const result = await treeInstance.getPriceTokenRange(7, 1);
      expect(result.length).to.equal(0);
    });
  });

  describe("getPriceTokenRangeReverse", function() {
    it("should return correct range from the end", async function () {
      const result = await treeInstance.getPriceTokenRangeReverse(6, 3);
      expect(result.length).to.equal(3);
      expect(result[0].price).to.equal(80);
      expect(result[0].tokenId).to.equal(7);
      expect(result[1].price).to.equal(70);
      expect(result[1].tokenId).to.equal(3);
      expect(result[2].price).to.equal(60);
      expect(result[2].tokenId).to.equal(6);
    });

    it("should return correct range from the middle", async function () {
      const result = await treeInstance.getPriceTokenRangeReverse(3, 3);
      expect(result.length).to.equal(3);
      expect(result[0].price).to.equal(50);
      expect(result[0].tokenId).to.equal(1);
      expect(result[1].price).to.equal(40);
      expect(result[1].tokenId).to.equal(5);
      expect(result[2].price).to.equal(30);
      expect(result[2].tokenId).to.equal(2);
    });

    it("should return correct range when count exceeds available elements", async function () {
      const result = await treeInstance.getPriceTokenRangeReverse(1, 5);
      expect(result.length).to.equal(2);
      expect(result[0].price).to.equal(30);
      expect(result[0].tokenId).to.equal(2);
      expect(result[1].price).to.equal(20);
      expect(result[1].tokenId).to.equal(4);
    });

    it("should return all elements in reverse when count is larger than tree size", async function () {
      const result = await treeInstance.getPriceTokenRangeReverse(6, 10);
      expect(result.length).to.equal(7);
      expect(result[0].price).to.equal(80);
      expect(result[6].price).to.equal(20);
    });

    it("should revert for out of range start index", async function () {
      // await expect(treeInstance.getPriceTokenRangeReverse(7, 1)).to.be.revertedWith("Start index out of range");
      const result = await treeInstance.getPriceTokenRangeReverse(7, 1);
      expect(result.length).to.equal(0);
    });
  });

  it("should handle empty tree", async function () {
    // Remove all elements
    for (let i = 1; i <= 7; i++) {
      await treeInstance.remove(i);
    }

    // await expect(treeInstance.getPriceTokenRange(0, 1)).to.be.revertedWith("Start index out of range");
    // await expect(treeInstance.getPriceTokenRangeReverse(0, 1)).to.be.revertedWith("Start index out of range");
     result = await treeInstance.getPriceTokenRange(0, 1);
    expect(result.length).to.equal(0);
     result = await treeInstance.getPriceTokenRangeReverse(0, 1);
    expect(result.length).to.equal(0);
  });

  it("should handle large number of elements", async function () {
    // Add more elements to the tree
    for (let i = 8; i <= 100; i++) {
      await treeInstance.insert(i * 10, i);
    }

    const forwardResult = await treeInstance.getPriceTokenRange(50, 20);
    expect(forwardResult.length).to.equal(20);
    expect(forwardResult[0].price).to.equal(510);
    expect(forwardResult[19].price).to.equal(700);

    const reverseResult = await treeInstance.getPriceTokenRangeReverse(99, 20);
    expect(reverseResult.length).to.equal(20);
    expect(reverseResult[0].price).to.equal(1000);
    expect(reverseResult[19].price).to.equal(810);
  });
});



describe("OrderStatisticsTree - PriceToken Range Methods Edge Cases", function () {
  let treeInstance;

  beforeEach(async function () {
    OrderStatisticsTree = await ethers.getContractFactory("OrderStatisticsTree");
    orderStatisticsTree = await OrderStatisticsTree.deploy();
    await orderStatisticsTree.waitForDeployment();
    // console.log(orderStatisticsTree.target);

    OrderStatisticsTreeTestFactory = await ethers.getContractFactory("OrderStatisticsTreeTest", {
      libraries: {
        OrderStatisticsTree: orderStatisticsTree.target,
      },
    });
    treeInstance = await OrderStatisticsTreeTestFactory.deploy();
    await treeInstance.waitForDeployment();
    await treeInstance.initializeTree(ComparatorType.PRICETOKEN_PRICE_TOKENID);

    // Insert some initial data
    await treeInstance.insert(50, 1);
    await treeInstance.insert(30, 2);
    await treeInstance.insert(70, 3);
    await treeInstance.insert(20, 4);
    await treeInstance.insert(40, 5);
    await treeInstance.insert(60, 6);
    await treeInstance.insert(80, 7);
  });

  describe("getPriceTokenRange edge cases", function() {
    it("should revert when count is 0", async function () {
      // const result = await treeInstance.getPriceTokenRange(0, 0);
      // expect(result.length).to.equal(0);
      // count must be greater than zero
      await expect(treeInstance.getPriceTokenRange(0, 0)).to.be.revertedWith("count must be greater than zero");
    });

    it("should handle start index at 0", async function () {
      const result = await treeInstance.getPriceTokenRange(0, 1);
      expect(result.length).to.equal(1);
      expect(result[0].price).to.equal(20);
      expect(result[0].tokenId).to.equal(4);
    });

    it("should handle start index at last element", async function () {
      const result = await treeInstance.getPriceTokenRange(6, 1);
      expect(result.length).to.equal(1);
      expect(result[0].price).to.equal(80);
      expect(result[0].tokenId).to.equal(7);
    });

    it("should return empty array when start index is at last element and count > 1", async function () {
      const result = await treeInstance.getPriceTokenRange(6, 2);
      expect(result.length).to.equal(1);
      expect(result[0].price).to.equal(80);
      expect(result[0].tokenId).to.equal(7);
    });

    it("should revert when start index is out of range (negative)", async function () {
      // await expect(treeInstance.getPriceTokenRange(Number.MAX_SAFE_INTEGER, 1)).to.be.revertedWith("Start index out of range");
      result = await treeInstance.getPriceTokenRange(Number.MAX_SAFE_INTEGER, 1);
      expect(result.length).to.equal(0);
    });

    it("should revert when start index is out of range (too large)", async function () {
      // await expect(treeInstance.getPriceTokenRange(7, 1)).to.be.revertedWith("Start index out of range");
      result = await treeInstance.getPriceTokenRange(7, 1);
      expect(result.length).to.equal(0);
    });

    it("should handle maximum possible count", async function () {
      const result = await treeInstance.getPriceTokenRange(0, Number.MAX_SAFE_INTEGER);
      expect(result.length).to.equal(7);
      expect(result[0].price).to.equal(20);
      expect(result[6].price).to.equal(80);
    });
  });

  describe("getPriceTokenRangeReverse edge cases", function() {
    it("should revert when count is 0", async function () {
      // const result = await treeInstance.getPriceTokenRangeReverse(6, 0);
      // expect(result.length).to.equal(0);
      // count must be greater than zero
      await expect(treeInstance.getPriceTokenRangeReverse(6, 0)).to.be.revertedWith("count must be greater than zero");
    });

    it("should handle start index at 0", async function () {
      const result = await treeInstance.getPriceTokenRangeReverse(0, 1);
      expect(result.length).to.equal(1);
      expect(result[0].price).to.equal(20);
      expect(result[0].tokenId).to.equal(4);
    });

    it("should handle start index at last element", async function () {
      const result = await treeInstance.getPriceTokenRangeReverse(6, 1);
      expect(result.length).to.equal(1);
      expect(result[0].price).to.equal(80);
      expect(result[0].tokenId).to.equal(7);
    });

    it("should return all elements when start index is at last element and count > tree size", async function () {
      const result = await treeInstance.getPriceTokenRangeReverse(6, 10);
      expect(result.length).to.equal(7);
      expect(result[0].price).to.equal(80);
      expect(result[6].price).to.equal(20);
    });

    it("should revert when start index is out of range (negative)", async function () {
      // await expect(treeInstance.getPriceTokenRangeReverse(Number.MAX_SAFE_INTEGER, 1)).to.be.revertedWith("Start index out of range");
      result = await treeInstance.getPriceTokenRangeReverse(Number.MAX_SAFE_INTEGER, 1);
      expect(result.length).to.equal(0);
    });

    it("should revert when start index is out of range (too large)", async function () {
      // await expect(treeInstance.getPriceTokenRangeReverse(7, 1)).to.be.revertedWith("Start index out of range");
      result = await treeInstance.getPriceTokenRangeReverse(7, 1);
      expect(result.length).to.equal(0);
    });

    it("should handle maximum possible count", async function () {
      const result = await treeInstance.getPriceTokenRangeReverse(6, Number.MAX_SAFE_INTEGER);
      expect(result.length).to.equal(7);
      expect(result[0].price).to.equal(80);
      expect(result[6].price).to.equal(20);
    });
  });

  describe("Special cases for both functions", function() {
    it("should handle tree with single element", async function () {
      // Remove all but one element
      for (let i = 2; i <= 7; i++) {
        await treeInstance.remove(i);
      }

      const forwardResult = await treeInstance.getPriceTokenRange(0, 1);
      expect(forwardResult.length).to.equal(1);
      expect(forwardResult[0].price).to.equal(50);
      expect(forwardResult[0].tokenId).to.equal(1);

      const reverseResult = await treeInstance.getPriceTokenRangeReverse(0, 1);
      expect(reverseResult.length).to.equal(1);
      expect(reverseResult[0].price).to.equal(50);
      expect(reverseResult[0].tokenId).to.equal(1);
    });

    it("should handle empty tree", async function () {
      // Remove all elements
      for (let i = 1; i <= 7; i++) {
        await treeInstance.remove(i);
      }

      // await expect(treeInstance.getPriceTokenRange(0, 1)).to.be.revertedWith("Start index out of range");
      // await expect(treeInstance.getPriceTokenRangeReverse(0, 1)).to.be.revertedWith("Start index out of range");
      result = await treeInstance.getPriceTokenRange(0, 1);
      expect(result.length).to.equal(0);
      result = await treeInstance.getPriceTokenRangeReverse(0, 1);
      expect(result.length).to.equal(0);
    });

    it("should handle inserting and removing elements between range queries", async function () {
      let result = await treeInstance.getPriceTokenRange(0, 3);
      expect(result.length).to.equal(3);
      expect(result[0].price).to.equal(20);

      await treeInstance.insert(10, 8);
      await treeInstance.remove(4); // Remove 20

      result = await treeInstance.getPriceTokenRange(0, 3);
      expect(result.length).to.equal(3);
      expect(result[0].price).to.equal(10);

      result = await treeInstance.getPriceTokenRangeReverse(6, 3);
      expect(result.length).to.equal(3);
      expect(result[0].price).to.equal(80);
    });
  });
});