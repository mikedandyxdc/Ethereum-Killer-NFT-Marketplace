const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("OriginalNFTMarketplace", function () {
  let originalNFT, marketplace;
  let deployer, buyer, buyer2, royaltyOwner;
  let originalOwnerAddress;
  let originalOwnerSigner;

  const MIN_PRICE = ethers.parseEther("25000");
  const LIST_PRICE = ethers.parseEther("50000");
  const TOKEN_ID = 1;

  async function impersonateOriginalOwner() {
    originalOwnerAddress = await originalNFT.ownerOf(TOKEN_ID);
    await network.provider.send("hardhat_setBalance", [originalOwnerAddress, "0xC9F2C9CD04674EDEA40000000"]); // 1,000,000,000 ETH
    await network.provider.send("hardhat_impersonateAccount", [originalOwnerAddress]);
    originalOwnerSigner = await ethers.getSigner(originalOwnerAddress);
  }

  async function stopImpersonating() {
    await network.provider.send("hardhat_stopImpersonatingAccount", [originalOwnerAddress]);
  }

  beforeEach(async function () {
    [deployer, buyer, buyer2, royaltyOwner] = await ethers.getSigners();

    const OriginalNFT = await ethers.getContractFactory("OriginalNFT");
    originalNFT = await OriginalNFT.deploy();
    await originalNFT.waitForDeployment();

    const OriginalNFTMarketplace = await ethers.getContractFactory("OriginalNFTMarketplace");
    // marketplace = await OriginalNFTMarketplace.deploy(royaltyOwner.address);
    // await marketplace.waitForDeployment();
    // // Wire up
    // await marketplace.setOriginalNFT(await originalNFT.getAddress());
    marketplace = await OriginalNFTMarketplace.deploy(royaltyOwner.address, await originalNFT.getAddress());
    await marketplace.waitForDeployment();

    // Impersonate original owner and approve marketplace
    await impersonateOriginalOwner();
    await originalNFT.connect(originalOwnerSigner).setApprovalForAll(await marketplace.getAddress(), true);
    await stopImpersonating();
  });

  // =========================================================================
  // setOriginalNFT
  // =========================================================================
  // describe("setOriginalNFT", function () {
  //   it("should revert if called twice", async function () {
  //     const OriginalNFTMarketplace = await ethers.getContractFactory("OriginalNFTMarketplace");
  //     const mp = await OriginalNFTMarketplace.deploy(royaltyOwner.address);
  //     await mp.waitForDeployment();
  //     await mp.setOriginalNFT(await originalNFT.getAddress());
  //     await expect(mp.setOriginalNFT(await originalNFT.getAddress()))
  //       .to.be.revertedWithCustomError(mp, "OriginalAlreadySet");
  //   });
  //
  //   it("should revert if zero address", async function () {
  //     const OriginalNFTMarketplace = await ethers.getContractFactory("OriginalNFTMarketplace");
  //     const mp = await OriginalNFTMarketplace.deploy(royaltyOwner.address);
  //     await mp.waitForDeployment();
  //     await expect(mp.setOriginalNFT(ethers.ZeroAddress))
  //       .to.be.revertedWithCustomError(mp, "ZeroAddress");
  //   });
  //
  //   it("should revert if not owner", async function () {
  //     const OriginalNFTMarketplace = await ethers.getContractFactory("OriginalNFTMarketplace");
  //     const mp = await OriginalNFTMarketplace.deploy(royaltyOwner.address);
  //     await mp.waitForDeployment();
  //     await expect(mp.connect(buyer).setOriginalNFT(await originalNFT.getAddress()))
  //       .to.be.revertedWith("Ownable: caller is not the owner");
  //   });
  // });

  // =========================================================================
  // setRoyaltyOwner
  // =========================================================================
  describe("setRoyaltyOwner", function () {
    it("should allow royalty owner to change", async function () {
      await marketplace.connect(royaltyOwner).setRoyaltyOwner(buyer.address);
      expect(await marketplace.royaltyOwner()).to.equal(buyer.address);
    });

    it("should revert if caller is not royalty owner", async function () {
      await expect(marketplace.connect(buyer).setRoyaltyOwner(buyer.address))
        .to.be.revertedWithCustomError(marketplace, "CallerNotOwner");
    });

    it("should revert if zero address", async function () {
      await expect(marketplace.connect(royaltyOwner).setRoyaltyOwner(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(marketplace, "ZeroAddress");
    });

    it("should emit RoyaltyOwnerChanged", async function () {
      await expect(marketplace.connect(royaltyOwner).setRoyaltyOwner(buyer.address))
        .to.emit(marketplace, "RoyaltyOwnerChanged")
        .withArgs(royaltyOwner.address, buyer.address);
    });
  });

  // =========================================================================
  // listOriginal
  // =========================================================================
  describe("listOriginal", function () {
    it("should list at valid price", async function () {
      await impersonateOriginalOwner();
      await expect(marketplace.connect(originalOwnerSigner).listOriginal(LIST_PRICE))
        .to.emit(marketplace, "OriginalListed")
        .withArgs(originalOwnerAddress, LIST_PRICE);
      expect(await marketplace.originalPrice()).to.equal(LIST_PRICE);
      expect(await marketplace.isOriginalForSale()).to.be.true;
      await stopImpersonating();
    });

    it("should revert if not owner of token", async function () {
      await expect(marketplace.connect(buyer).listOriginal(LIST_PRICE))
        .to.be.revertedWithCustomError(marketplace, "CallerNotOwner");
    });

    it("should revert if price below minimum", async function () {
      await impersonateOriginalOwner();
      await expect(marketplace.connect(originalOwnerSigner).listOriginal(ethers.parseEther("100")))
        .to.be.revertedWithCustomError(marketplace, "PriceBelowMinimum");
      await stopImpersonating();
    });

    it("should revert if already listed", async function () {
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).listOriginal(LIST_PRICE);
      await expect(marketplace.connect(originalOwnerSigner).listOriginal(LIST_PRICE))
        .to.be.revertedWithCustomError(marketplace, "TokenAlreadyForSale");
      await stopImpersonating();
    });

    it("should revert if marketplace not approved", async function () {
      // Deploy fresh marketplace without approval
      const OriginalNFTMarketplace = await ethers.getContractFactory("OriginalNFTMarketplace");
      // const mp = await OriginalNFTMarketplace.deploy(royaltyOwner.address);
      // await mp.waitForDeployment();
      // await mp.setOriginalNFT(await originalNFT.getAddress());
      const mp = await OriginalNFTMarketplace.deploy(royaltyOwner.address, await originalNFT.getAddress());
      await mp.waitForDeployment();

      await impersonateOriginalOwner();
      await expect(mp.connect(originalOwnerSigner).listOriginal(LIST_PRICE))
        .to.be.revertedWithCustomError(mp, "OriginalNotApproved");
      await stopImpersonating();
    });
  });

  // =========================================================================
  // delistOriginal
  // =========================================================================
  describe("delistOriginal", function () {
    beforeEach(async function () {
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).listOriginal(LIST_PRICE);
      await stopImpersonating();
    });

    it("should delist successfully", async function () {
      await impersonateOriginalOwner();
      await expect(marketplace.connect(originalOwnerSigner).delistOriginal())
        .to.emit(marketplace, "OriginalDelisted")
        .withArgs(originalOwnerAddress);
      expect(await marketplace.originalPrice()).to.equal(0);
      expect(await marketplace.isOriginalForSale()).to.be.false;
      await stopImpersonating();
    });

    it("should revert if not owner", async function () {
      await expect(marketplace.connect(buyer).delistOriginal())
        .to.be.revertedWithCustomError(marketplace, "CallerNotOwner");
    });

    it("should revert if not listed", async function () {
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).delistOriginal();
      await expect(marketplace.connect(originalOwnerSigner).delistOriginal())
        .to.be.revertedWithCustomError(marketplace, "TokenNotForSale");
      await stopImpersonating();
    });
  });

  // =========================================================================
  // updateOriginalPrice
  // =========================================================================
  describe("updateOriginalPrice", function () {
    beforeEach(async function () {
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).listOriginal(LIST_PRICE);
      await stopImpersonating();
    });

    it("should update price", async function () {
      const newPrice = ethers.parseEther("75000");
      await impersonateOriginalOwner();
      await expect(marketplace.connect(originalOwnerSigner).updateOriginalPrice(newPrice))
        .to.emit(marketplace, "OriginalPriceUpdated")
        .withArgs(originalOwnerAddress, newPrice);
      expect(await marketplace.originalPrice()).to.equal(newPrice);
      await stopImpersonating();
    });

    it("should revert if not owner", async function () {
      await expect(marketplace.connect(buyer).updateOriginalPrice(ethers.parseEther("75000")))
        .to.be.revertedWithCustomError(marketplace, "CallerNotOwner");
    });

    it("should revert if not listed", async function () {
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).delistOriginal();
      await expect(marketplace.connect(originalOwnerSigner).updateOriginalPrice(ethers.parseEther("75000")))
        .to.be.revertedWithCustomError(marketplace, "TokenNotForSale");
      await stopImpersonating();
    });

    it("should revert if below minimum", async function () {
      await impersonateOriginalOwner();
      await expect(marketplace.connect(originalOwnerSigner).updateOriginalPrice(ethers.parseEther("100")))
        .to.be.revertedWithCustomError(marketplace, "PriceBelowMinimum");
      await stopImpersonating();
    });

    it("should revert if same price", async function () {
      await impersonateOriginalOwner();
      await expect(marketplace.connect(originalOwnerSigner).updateOriginalPrice(LIST_PRICE))
        .to.be.revertedWithCustomError(marketplace, "PriceMustBeDifferent");
      await stopImpersonating();
    });
  });

  // =========================================================================
  // buyOriginal
  // =========================================================================
  describe("buyOriginal", function () {
    beforeEach(async function () {
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).listOriginal(LIST_PRICE);
      await stopImpersonating();
    });

    it("should buy successfully with correct royalty split", async function () {
      const royaltyBefore = await ethers.provider.getBalance(royaltyOwner.address);
      const sellerBefore = await ethers.provider.getBalance(originalOwnerAddress);

      await marketplace.connect(buyer).buyOriginal(LIST_PRICE, { value: LIST_PRICE });

      // Token transferred
      expect(await originalNFT.ownerOf(TOKEN_ID)).to.equal(buyer.address);
      // Price cleared
      expect(await marketplace.originalPrice()).to.equal(0);
      expect(await marketplace.isOriginalForSale()).to.be.false;

      // Royalty: 12% of 50000 = 6000
      const expectedRoyalty = (LIST_PRICE * 1200n) / 10000n;
      const expectedSellerProceeds = LIST_PRICE - expectedRoyalty;
      const royaltyAfter = await ethers.provider.getBalance(royaltyOwner.address);
      expect(royaltyAfter - royaltyBefore).to.equal(expectedRoyalty);

      const sellerAfter = await ethers.provider.getBalance(originalOwnerAddress);
      expect(sellerAfter - sellerBefore).to.equal(expectedSellerProceeds);
    });

    it("should emit OriginalSold", async function () {
      await expect(marketplace.connect(buyer).buyOriginal(LIST_PRICE, { value: LIST_PRICE }))
        .to.emit(marketplace, "OriginalSold")
        .withArgs(originalOwnerAddress, buyer.address, LIST_PRICE);
    });

    it("should record sale in history", async function () {
      await marketplace.connect(buyer).buyOriginal(LIST_PRICE, { value: LIST_PRICE });
      const history = await marketplace.getOriginalSalesHistory();
      expect(history.length).to.equal(1);
      expect(history[0].seller).to.equal(originalOwnerAddress);
      expect(history[0].buyer).to.equal(buyer.address);
      expect(history[0].price).to.equal(LIST_PRICE);
    });

    it("should refund overpayment", async function () {
      const overpay = ethers.parseEther("60000");
      const balBefore = await ethers.provider.getBalance(buyer.address);
      const tx = await marketplace.connect(buyer).buyOriginal(LIST_PRICE, { value: overpay });
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(buyer.address);
      // Buyer should have paid LIST_PRICE + gas, not overpay + gas
      expect(balBefore - balAfter - gasCost).to.equal(LIST_PRICE);
    });

    it("should refund buyer's existing offer on buy", async function () {
      const offerAmount = ethers.parseEther("30000");
      await marketplace.connect(buyer).makeOriginalOffer({ value: offerAmount });

      const balBefore = await ethers.provider.getBalance(buyer.address);
      const tx = await marketplace.connect(buyer).buyOriginal(LIST_PRICE, { value: LIST_PRICE });
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(buyer.address);
      // Net cost = LIST_PRICE - offerRefund
      expect(balBefore - balAfter - gasCost).to.equal(LIST_PRICE - offerAmount);
    });

    it("should revert if not listed", async function () {
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).delistOriginal();
      await stopImpersonating();
      await expect(marketplace.connect(buyer).buyOriginal(LIST_PRICE, { value: LIST_PRICE }))
        .to.be.revertedWithCustomError(marketplace, "TokenNotForSale");
    });

    it("should revert if caller is owner", async function () {
      await impersonateOriginalOwner();
      await expect(marketplace.connect(originalOwnerSigner).buyOriginal(LIST_PRICE, { value: LIST_PRICE }))
        .to.be.revertedWithCustomError(marketplace, "CallerIsOwner");
      await stopImpersonating();
    });

    it("should revert if price changed (front-run protection)", async function () {
      await expect(marketplace.connect(buyer).buyOriginal(ethers.parseEther("40000"), { value: LIST_PRICE }))
        .to.be.revertedWithCustomError(marketplace, "PriceChanged");
    });

    it("should revert if insufficient payment", async function () {
      await expect(marketplace.connect(buyer).buyOriginal(LIST_PRICE, { value: ethers.parseEther("10000") }))
        .to.be.revertedWithCustomError(marketplace, "InsufficientPayment");
    });

    it("should revert if marketplace approval revoked after listing", async function () {
      await impersonateOriginalOwner();
      await originalNFT.connect(originalOwnerSigner).setApprovalForAll(await marketplace.getAddress(), false);
      await stopImpersonating();
      await expect(marketplace.connect(buyer).buyOriginal(LIST_PRICE, { value: LIST_PRICE }))
        .to.be.revertedWithCustomError(marketplace, "OriginalNotApproved");
    });
  });

  // =========================================================================
  // makeOriginalOffer
  // =========================================================================
  describe("makeOriginalOffer", function () {
    it("should make an offer", async function () {
      const offerAmount = ethers.parseEther("40000");
      await expect(marketplace.connect(buyer).makeOriginalOffer({ value: offerAmount }))
        .to.emit(marketplace, "OriginalOfferMade")
        .withArgs(buyer.address, offerAmount);
      expect(await marketplace.originalOffers(buyer.address)).to.equal(offerAmount);
    });

    it("should replace offer and refund previous", async function () {
      const first = ethers.parseEther("30000");
      const second = ethers.parseEther("40000");
      await marketplace.connect(buyer).makeOriginalOffer({ value: first });

      const balBefore = await ethers.provider.getBalance(buyer.address);
      const tx = await marketplace.connect(buyer).makeOriginalOffer({ value: second });
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(buyer.address);

      // Offer replaced, not accumulated
      expect(await marketplace.originalOffers(buyer.address)).to.equal(second);
      // Refunded first offer (net cost = second - first + gas)
      expect(balBefore - balAfter - gasCost).to.equal(second - first);
    });

    it("should revert if zero value", async function () {
      await expect(marketplace.connect(buyer).makeOriginalOffer({ value: 0 }))
        .to.be.revertedWithCustomError(marketplace, "PriceBelowMinimum");
    });

    it("should revert if caller is token owner", async function () {
      await impersonateOriginalOwner();
      await expect(marketplace.connect(originalOwnerSigner).makeOriginalOffer({ value: ethers.parseEther("40000") }))
        .to.be.revertedWithCustomError(marketplace, "CallerIsOwner");
      await stopImpersonating();
    });

    it("should revert if new offer not greater than existing", async function () {
      await marketplace.connect(buyer).makeOriginalOffer({ value: ethers.parseEther("50000") });
      await expect(marketplace.connect(buyer).makeOriginalOffer({ value: ethers.parseEther("30000") }))
        .to.be.revertedWithCustomError(marketplace, "OfferMustBeGreater");
    });
  });

  // =========================================================================
  // withdrawOriginalOffer
  // =========================================================================
  describe("withdrawOriginalOffer", function () {
    it("should cancel and refund", async function () {
      const offerAmount = ethers.parseEther("40000");
      await marketplace.connect(buyer).makeOriginalOffer({ value: offerAmount });

      const balBefore = await ethers.provider.getBalance(buyer.address);
      const tx = await marketplace.connect(buyer).withdrawOriginalOffer();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(buyer.address);

      expect(balAfter - balBefore + gasCost).to.equal(offerAmount);
      expect(await marketplace.originalOffers(buyer.address)).to.equal(0);
    });

    it("should emit OriginalOfferWithdrawn", async function () {
      const offerAmount = ethers.parseEther("40000");
      await marketplace.connect(buyer).makeOriginalOffer({ value: offerAmount });
      await expect(marketplace.connect(buyer).withdrawOriginalOffer())
        .to.emit(marketplace, "OriginalOfferWithdrawn")
        .withArgs(buyer.address, offerAmount);
    });

    it("should revert if no active offer", async function () {
      await expect(marketplace.connect(buyer).withdrawOriginalOffer())
        .to.be.revertedWithCustomError(marketplace, "NoActiveOffer");
    });
  });

  // =========================================================================
  // acceptOriginalOffer
  // =========================================================================
  describe("acceptOriginalOffer", function () {
    const offerAmount = ethers.parseEther("45000");

    beforeEach(async function () {
      await marketplace.connect(buyer).makeOriginalOffer({ value: offerAmount });
    });

    it("should accept offer with correct royalty split", async function () {
      const royaltyBefore = await ethers.provider.getBalance(royaltyOwner.address);
      const sellerBefore = await ethers.provider.getBalance(originalOwnerAddress);

      await impersonateOriginalOwner();
      const tx = await marketplace.connect(originalOwnerSigner).acceptOriginalOffer(buyer.address);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      await stopImpersonating();

      const sellerAfter = await ethers.provider.getBalance(originalOwnerAddress);
      const royaltyAfter = await ethers.provider.getBalance(royaltyOwner.address);

      // Token transferred
      expect(await originalNFT.ownerOf(TOKEN_ID)).to.equal(buyer.address);
      // Offer cleared
      expect(await marketplace.originalOffers(buyer.address)).to.equal(0);
      // Price cleared
      expect(await marketplace.originalPrice()).to.equal(0);

      // Royalty: 12% of 45000 = 5400
      const expectedRoyalty = (offerAmount * 1200n) / 10000n;
      const expectedSellerProceeds = offerAmount - expectedRoyalty;
      expect(royaltyAfter - royaltyBefore).to.equal(expectedRoyalty);
      expect(sellerAfter - sellerBefore + gasCost).to.equal(expectedSellerProceeds);
    });

    it("should emit OriginalOfferAccepted", async function () {
      await impersonateOriginalOwner();
      await expect(marketplace.connect(originalOwnerSigner).acceptOriginalOffer(buyer.address))
        .to.emit(marketplace, "OriginalOfferAccepted")
        .withArgs(originalOwnerAddress, buyer.address, offerAmount);
      await stopImpersonating();
    });

    it("should record sale in history", async function () {
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).acceptOriginalOffer(buyer.address);
      await stopImpersonating();
      const history = await marketplace.getOriginalSalesHistory();
      expect(history.length).to.equal(1);
      expect(history[0].seller).to.equal(originalOwnerAddress);
      expect(history[0].buyer).to.equal(buyer.address);
      expect(history[0].price).to.equal(offerAmount);
    });

    it("should revert if not token owner", async function () {
      await expect(marketplace.connect(buyer2).acceptOriginalOffer(buyer.address))
        .to.be.revertedWithCustomError(marketplace, "CallerNotOwner");
    });

    it("should revert if no active offer from bidder", async function () {
      await impersonateOriginalOwner();
      await expect(marketplace.connect(originalOwnerSigner).acceptOriginalOffer(buyer2.address))
        .to.be.revertedWithCustomError(marketplace, "NoActiveOffer");
      await stopImpersonating();
    });

    it("should revert if marketplace not approved", async function () {
      // Revoke approval
      await impersonateOriginalOwner();
      await originalNFT.connect(originalOwnerSigner).setApprovalForAll(await marketplace.getAddress(), false);
      await expect(marketplace.connect(originalOwnerSigner).acceptOriginalOffer(buyer.address))
        .to.be.revertedWithCustomError(marketplace, "OriginalNotApproved");
      await stopImpersonating();
    });
  });

  // =========================================================================
  // getOriginalSalesHistory
  // =========================================================================
  describe("getOriginalSalesHistory", function () {
    it("should return empty initially", async function () {
      const history = await marketplace.getOriginalSalesHistory();
      expect(history.length).to.equal(0);
    });

    it("should track multiple sales", async function () {
      // Sale 1: buy
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).listOriginal(LIST_PRICE);
      await stopImpersonating();
      await marketplace.connect(buyer).buyOriginal(LIST_PRICE, { value: LIST_PRICE });

      // Sale 2: buyer lists, buyer2 buys
      await originalNFT.connect(buyer).setApprovalForAll(await marketplace.getAddress(), true);
      await marketplace.connect(buyer).listOriginal(LIST_PRICE);
      await marketplace.connect(buyer2).buyOriginal(LIST_PRICE, { value: LIST_PRICE });

      const history = await marketplace.getOriginalSalesHistory();
      expect(history.length).to.equal(2);
      expect(history[0].seller).to.equal(originalOwnerAddress);
      expect(history[0].buyer).to.equal(buyer.address);
      expect(history[1].seller).to.equal(buyer.address);
      expect(history[1].buyer).to.equal(buyer2.address);
    });
  });

  // =========================================================================
  // getOriginalOwner
  // =========================================================================
  describe("getOriginalOwner", function () {
    it("should return current owner", async function () {
      expect(await marketplace.getOriginalOwner()).to.equal(originalOwnerAddress);
    });

    it("should update after transfer via buy", async function () {
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).listOriginal(LIST_PRICE);
      await stopImpersonating();
      await marketplace.connect(buyer).buyOriginal(LIST_PRICE, { value: LIST_PRICE });
      expect(await marketplace.getOriginalOwner()).to.equal(buyer.address);
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================
  describe("Edge cases", function () {
    // it("should revert all functions if originalNFT not set", async function () {
    //   const OriginalNFTMarketplace = await ethers.getContractFactory("OriginalNFTMarketplace");
    //   const mp = await OriginalNFTMarketplace.deploy(royaltyOwner.address);
    //   await mp.waitForDeployment();
    //
    //   await expect(mp.connect(buyer).listOriginal(LIST_PRICE))
    //     .to.be.revertedWithCustomError(mp, "OriginalNotSet");
    //   await expect(mp.connect(buyer).delistOriginal())
    //     .to.be.revertedWithCustomError(mp, "OriginalNotSet");
    //   await expect(mp.connect(buyer).updateOriginalPrice(LIST_PRICE))
    //     .to.be.revertedWithCustomError(mp, "OriginalNotSet");
    //   await expect(mp.connect(buyer).buyOriginal(LIST_PRICE, { value: LIST_PRICE }))
    //     .to.be.revertedWithCustomError(mp, "OriginalNotSet");
    //   await expect(mp.connect(buyer).makeOriginalOffer({ value: ethers.parseEther("40000") }))
    //     .to.be.revertedWithCustomError(mp, "OriginalNotSet");
    //   await expect(mp.connect(buyer).withdrawOriginalOffer())
    //     .to.be.revertedWithCustomError(mp, "OriginalNotSet");
    //   await expect(mp.connect(buyer).acceptOriginalOffer(buyer2.address))
    //     .to.be.revertedWithCustomError(mp, "OriginalNotSet");
    // });

    it("should allow new owner to list after buying", async function () {
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).listOriginal(LIST_PRICE);
      await stopImpersonating();

      await marketplace.connect(buyer).buyOriginal(LIST_PRICE, { value: LIST_PRICE });

      // New owner approves and lists
      await originalNFT.connect(buyer).setApprovalForAll(await marketplace.getAddress(), true);
      const newPrice = ethers.parseEther("100000");
      await expect(marketplace.connect(buyer).listOriginal(newPrice))
        .to.emit(marketplace, "OriginalListed")
        .withArgs(buyer.address, newPrice);
    });

    it("should handle multiple offers from different bidders", async function () {
      const offer1 = ethers.parseEther("30000");
      const offer2 = ethers.parseEther("40000");
      await marketplace.connect(buyer).makeOriginalOffer({ value: offer1 });
      await marketplace.connect(buyer2).makeOriginalOffer({ value: offer2 });

      expect(await marketplace.originalOffers(buyer.address)).to.equal(offer1);
      expect(await marketplace.originalOffers(buyer2.address)).to.equal(offer2);

      // Accept buyer2's offer
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).acceptOriginalOffer(buyer2.address);
      await stopImpersonating();

      expect(await originalNFT.ownerOf(TOKEN_ID)).to.equal(buyer2.address);
      // buyer's offer still exists
      expect(await marketplace.originalOffers(buyer.address)).to.equal(offer1);
      // buyer2's offer cleared
      expect(await marketplace.originalOffers(buyer2.address)).to.equal(0);
    });

    it("constructor should revert with zero royalty owner", async function () {
      const OriginalNFTMarketplace = await ethers.getContractFactory("OriginalNFTMarketplace");
      // await expect(OriginalNFTMarketplace.deploy(ethers.ZeroAddress))
      //   .to.be.revertedWithCustomError(marketplace, "ZeroAddress");
      await expect(OriginalNFTMarketplace.deploy(ethers.ZeroAddress, await originalNFT.getAddress()))
        .to.be.revertedWithCustomError(marketplace, "ZeroAddress");
    });

    it("constructor should revert with zero originalNFT address", async function () {
      const OriginalNFTMarketplace = await ethers.getContractFactory("OriginalNFTMarketplace");
      await expect(OriginalNFTMarketplace.deploy(royaltyOwner.address, ethers.ZeroAddress))
        .to.be.revertedWithCustomError(marketplace, "ZeroAddress");
    });
  });

  // =========================================================================
  // Bidders tracking
  // =========================================================================
  describe("getOriginalBidders", function () {
    it("should return empty initially", async function () {
      const bidders = await marketplace.getOriginalBidders();
      expect(bidders.length).to.equal(0);
      expect(await marketplace.getOriginalBiddersCount()).to.equal(0);
    });

    it("should add bidder on first offer", async function () {
      await marketplace.connect(buyer).makeOriginalOffer({ value: ethers.parseEther("30000") });
      const bidders = await marketplace.getOriginalBidders();
      expect(bidders.length).to.equal(1);
      expect(bidders[0]).to.equal(buyer.address);
    });

    it("should not duplicate bidder on additional offer", async function () {
      await marketplace.connect(buyer).makeOriginalOffer({ value: ethers.parseEther("30000") });
      await marketplace.connect(buyer).makeOriginalOffer({ value: ethers.parseEther("40000") });
      const bidders = await marketplace.getOriginalBidders();
      expect(bidders.length).to.equal(1);
    });

    it("should track multiple bidders", async function () {
      await marketplace.connect(buyer).makeOriginalOffer({ value: ethers.parseEther("30000") });
      await marketplace.connect(buyer2).makeOriginalOffer({ value: ethers.parseEther("40000") });
      const bidders = await marketplace.getOriginalBidders();
      expect(bidders.length).to.equal(2);
      expect(await marketplace.getOriginalBiddersCount()).to.equal(2);
    });

    it("should remove bidder on cancel", async function () {
      await marketplace.connect(buyer).makeOriginalOffer({ value: ethers.parseEther("30000") });
      await marketplace.connect(buyer2).makeOriginalOffer({ value: ethers.parseEther("40000") });
      await marketplace.connect(buyer).withdrawOriginalOffer();
      const bidders = await marketplace.getOriginalBidders();
      expect(bidders.length).to.equal(1);
      expect(bidders[0]).to.equal(buyer2.address);
    });

    it("should remove bidder on accept", async function () {
      await marketplace.connect(buyer).makeOriginalOffer({ value: ethers.parseEther("30000") });
      await marketplace.connect(buyer2).makeOriginalOffer({ value: ethers.parseEther("40000") });

      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).acceptOriginalOffer(buyer2.address);
      await stopImpersonating();

      const bidders = await marketplace.getOriginalBidders();
      expect(bidders.length).to.equal(1);
      expect(bidders[0]).to.equal(buyer.address);
    });

    it("should remove buyer from bidders on buyOriginal if they had an offer", async function () {
      await marketplace.connect(buyer).makeOriginalOffer({ value: ethers.parseEther("30000") });

      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).listOriginal(LIST_PRICE);
      await stopImpersonating();

      await marketplace.connect(buyer).buyOriginal(LIST_PRICE, { value: LIST_PRICE });
      const bidders = await marketplace.getOriginalBidders();
      expect(bidders.length).to.equal(0);
    });

    it("should return empty after all bidders cancel", async function () {
      await marketplace.connect(buyer).makeOriginalOffer({ value: ethers.parseEther("30000") });
      await marketplace.connect(buyer2).makeOriginalOffer({ value: ethers.parseEther("40000") });
      await marketplace.connect(buyer).withdrawOriginalOffer();
      await marketplace.connect(buyer2).withdrawOriginalOffer();
      const bidders = await marketplace.getOriginalBidders();
      expect(bidders.length).to.equal(0);
      expect(await marketplace.getOriginalBiddersCount()).to.equal(0);
    });
  });

  // =========================================================================
  // Royalty & money flow comprehensive tests
  // =========================================================================
  describe("Royalty & money flow", function () {
    it("royalty is exactly 12% on buy at MIN_PRICE", async function () {
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).listOriginal(MIN_PRICE);
      await stopImpersonating();

      const royaltyBefore = await ethers.provider.getBalance(royaltyOwner.address);
      await marketplace.connect(buyer).buyOriginal(MIN_PRICE, { value: MIN_PRICE });
      const royaltyAfter = await ethers.provider.getBalance(royaltyOwner.address);

      const expectedRoyalty = (MIN_PRICE * 1200n) / 10000n; // 3000 XDC
      expect(royaltyAfter - royaltyBefore).to.equal(expectedRoyalty);
      expect(expectedRoyalty).to.equal(ethers.parseEther("3000"));
    });

    it("royalty is exactly 12% on buy at 100,000,000 XDC", async function () {
      const bigPrice = ethers.parseEther("100000000");
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).listOriginal(bigPrice);
      await stopImpersonating();

      const royaltyBefore = await ethers.provider.getBalance(royaltyOwner.address);
      const sellerBefore = await ethers.provider.getBalance(originalOwnerAddress);

      await marketplace.connect(buyer).buyOriginal(bigPrice, { value: bigPrice });

      const royaltyAfter = await ethers.provider.getBalance(royaltyOwner.address);
      const sellerAfter = await ethers.provider.getBalance(originalOwnerAddress);

      const expectedRoyalty = (bigPrice * 1200n) / 10000n; // 12,000,000 XDC
      const expectedSeller = bigPrice - expectedRoyalty; // 88,000,000 XDC
      expect(royaltyAfter - royaltyBefore).to.equal(expectedRoyalty);
      expect(expectedRoyalty).to.equal(ethers.parseEther("12000000"));
      expect(sellerAfter - sellerBefore).to.equal(expectedSeller);
      expect(expectedSeller).to.equal(ethers.parseEther("88000000"));
    });

    it("royalty + seller proceeds = price exactly on buy", async function () {
      const price = ethers.parseEther("77777");
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).listOriginal(price);
      await stopImpersonating();

      const royaltyBefore = await ethers.provider.getBalance(royaltyOwner.address);
      const sellerBefore = await ethers.provider.getBalance(originalOwnerAddress);

      await marketplace.connect(buyer).buyOriginal(price, { value: price });

      const royaltyAfter = await ethers.provider.getBalance(royaltyOwner.address);
      const sellerAfter = await ethers.provider.getBalance(originalOwnerAddress);

      const royaltyPaid = royaltyAfter - royaltyBefore;
      const sellerPaid = sellerAfter - sellerBefore;
      expect(royaltyPaid + sellerPaid).to.equal(price);
    });

    it("royalty + seller proceeds = offerAmount exactly on accept", async function () {
      const offerAmount = ethers.parseEther("63333");
      await marketplace.connect(buyer).makeOriginalOffer({ value: offerAmount });

      const royaltyBefore = await ethers.provider.getBalance(royaltyOwner.address);
      const sellerBefore = await ethers.provider.getBalance(originalOwnerAddress);

      await impersonateOriginalOwner();
      const tx = await marketplace.connect(originalOwnerSigner).acceptOriginalOffer(buyer.address);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      await stopImpersonating();

      const royaltyAfter = await ethers.provider.getBalance(royaltyOwner.address);
      const sellerAfter = await ethers.provider.getBalance(originalOwnerAddress);

      const royaltyPaid = royaltyAfter - royaltyBefore;
      const sellerPaid = (sellerAfter - sellerBefore) + gasCost;
      expect(royaltyPaid + sellerPaid).to.equal(offerAmount);
    });

    it("royalty goes to new royalty owner after change", async function () {
      // Change royalty owner to buyer2
      await marketplace.connect(royaltyOwner).setRoyaltyOwner(buyer2.address);

      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).listOriginal(LIST_PRICE);
      await stopImpersonating();

      const oldRoyaltyBefore = await ethers.provider.getBalance(royaltyOwner.address);
      const newRoyaltyBefore = await ethers.provider.getBalance(buyer2.address);

      await marketplace.connect(buyer).buyOriginal(LIST_PRICE, { value: LIST_PRICE });

      const oldRoyaltyAfter = await ethers.provider.getBalance(royaltyOwner.address);
      const newRoyaltyAfter = await ethers.provider.getBalance(buyer2.address);

      // Old royalty owner gets nothing
      expect(oldRoyaltyAfter - oldRoyaltyBefore).to.equal(0);
      // New royalty owner gets 12%
      const expectedRoyalty = (LIST_PRICE * 1200n) / 10000n;
      expect(newRoyaltyAfter - newRoyaltyBefore).to.equal(expectedRoyalty);
    });

    it("contract balance is zero after buy with no offers", async function () {
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).listOriginal(LIST_PRICE);
      await stopImpersonating();

      await marketplace.connect(buyer).buyOriginal(LIST_PRICE, { value: LIST_PRICE });

      const contractBal = await ethers.provider.getBalance(await marketplace.getAddress());
      expect(contractBal).to.equal(0);
    });

    it("contract balance equals remaining offers after buy", async function () {
      const offer1 = ethers.parseEther("30000");
      const offer2 = ethers.parseEther("40000");
      await marketplace.connect(buyer2).makeOriginalOffer({ value: offer2 });

      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).listOriginal(LIST_PRICE);
      await stopImpersonating();

      // buyer has no offer, buyer2 has offer2
      await marketplace.connect(buyer).buyOriginal(LIST_PRICE, { value: LIST_PRICE });

      const contractBal = await ethers.provider.getBalance(await marketplace.getAddress());
      expect(contractBal).to.equal(offer2);
    });

    it("contract balance is zero after all offers withdrawn", async function () {
      await marketplace.connect(buyer).makeOriginalOffer({ value: ethers.parseEther("30000") });
      await marketplace.connect(buyer2).makeOriginalOffer({ value: ethers.parseEther("40000") });

      await marketplace.connect(buyer).withdrawOriginalOffer();
      await marketplace.connect(buyer2).withdrawOriginalOffer();

      const contractBal = await ethers.provider.getBalance(await marketplace.getAddress());
      expect(contractBal).to.equal(0);
    });

    it("contract balance is zero after accept offer with no other offers", async function () {
      const offerAmount = ethers.parseEther("45000");
      await marketplace.connect(buyer).makeOriginalOffer({ value: offerAmount });

      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).acceptOriginalOffer(buyer.address);
      await stopImpersonating();

      const contractBal = await ethers.provider.getBalance(await marketplace.getAddress());
      expect(contractBal).to.equal(0);
    });

    it("contract balance equals remaining offers after accept", async function () {
      const offer1 = ethers.parseEther("30000");
      const offer2 = ethers.parseEther("45000");
      await marketplace.connect(buyer).makeOriginalOffer({ value: offer1 });
      await marketplace.connect(buyer2).makeOriginalOffer({ value: offer2 });

      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).acceptOriginalOffer(buyer2.address);
      await stopImpersonating();

      const contractBal = await ethers.provider.getBalance(await marketplace.getAddress());
      expect(contractBal).to.equal(offer1);
    });

    it("buyer net cost is exactly price when buying with existing offer", async function () {
      const offerAmount = ethers.parseEther("30000");
      await marketplace.connect(buyer).makeOriginalOffer({ value: offerAmount });

      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).listOriginal(LIST_PRICE);
      await stopImpersonating();

      const balBefore = await ethers.provider.getBalance(buyer.address);
      const tx = await marketplace.connect(buyer).buyOriginal(LIST_PRICE, { value: LIST_PRICE });
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(buyer.address);

      // Net cost = LIST_PRICE - offerRefund
      expect(balBefore - balAfter - gasCost).to.equal(LIST_PRICE - offerAmount);
    });

    it("overpayment is fully refunded on buy", async function () {
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).listOriginal(LIST_PRICE);
      await stopImpersonating();

      const overpay = ethers.parseEther("75000");
      const balBefore = await ethers.provider.getBalance(buyer.address);
      const tx = await marketplace.connect(buyer).buyOriginal(LIST_PRICE, { value: overpay });
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(buyer.address);

      // Buyer should only lose LIST_PRICE + gas, not overpay
      expect(balBefore - balAfter - gasCost).to.equal(LIST_PRICE);

      // Contract should have zero balance
      const contractBal = await ethers.provider.getBalance(await marketplace.getAddress());
      expect(contractBal).to.equal(0);
    });

    it("full offer refunded on withdraw", async function () {
      const offerAmount = ethers.parseEther("50000");
      await marketplace.connect(buyer).makeOriginalOffer({ value: offerAmount });

      const balBefore = await ethers.provider.getBalance(buyer.address);
      const tx = await marketplace.connect(buyer).withdrawOriginalOffer();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(buyer.address);

      expect(balAfter - balBefore + gasCost).to.equal(offerAmount);
    });

    it("offer replace refunds exact previous amount", async function () {
      const first = ethers.parseEther("30000");
      const second = ethers.parseEther("50000");
      await marketplace.connect(buyer).makeOriginalOffer({ value: first });

      const balBefore = await ethers.provider.getBalance(buyer.address);
      const tx = await marketplace.connect(buyer).makeOriginalOffer({ value: second });
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(buyer.address);

      // Net cost = second - first (refund of first)
      expect(balBefore - balAfter - gasCost).to.equal(second - first);

      // Contract holds exactly second
      const contractBal = await ethers.provider.getBalance(await marketplace.getAddress());
      expect(contractBal).to.equal(second);
    });
  });

  // =========================================================================
  // Attack / pentest — ensure no money loss
  // =========================================================================
  describe("Attack vectors", function () {
    it("cannot double-withdraw an offer", async function () {
      await marketplace.connect(buyer).makeOriginalOffer({ value: ethers.parseEther("30000") });
      await marketplace.connect(buyer).withdrawOriginalOffer();
      await expect(marketplace.connect(buyer).withdrawOriginalOffer())
        .to.be.revertedWithCustomError(marketplace, "NoActiveOffer");
    });

    it("cannot withdraw someone else's offer", async function () {
      await marketplace.connect(buyer).makeOriginalOffer({ value: ethers.parseEther("30000") });
      // buyer2 has no offer
      await expect(marketplace.connect(buyer2).withdrawOriginalOffer())
        .to.be.revertedWithCustomError(marketplace, "NoActiveOffer");
    });

    it("cannot buy twice (listing cleared after first buy)", async function () {
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).listOriginal(LIST_PRICE);
      await stopImpersonating();

      await marketplace.connect(buyer).buyOriginal(LIST_PRICE, { value: LIST_PRICE });

      // Second buy should fail — price is now 0
      await expect(marketplace.connect(buyer2).buyOriginal(LIST_PRICE, { value: LIST_PRICE }))
        .to.be.revertedWithCustomError(marketplace, "TokenNotForSale");
    });

    it("cannot accept same offer twice", async function () {
      await marketplace.connect(buyer).makeOriginalOffer({ value: ethers.parseEther("30000") });

      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).acceptOriginalOffer(buyer.address);
      await stopImpersonating();

      // buyer is now the owner, try to accept again from old owner perspective
      // Old owner no longer owns the token
      await impersonateOriginalOwner(); // now buyer is the owner
      await expect(marketplace.connect(originalOwnerSigner).acceptOriginalOffer(buyer.address))
        .to.be.reverted; // either CallerNotOwner or NoActiveOffer
      await stopImpersonating();
    });

    it("cannot front-run buy with price change", async function () {
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).listOriginal(LIST_PRICE);
      await stopImpersonating();

      // Buyer expects LIST_PRICE but owner changes to higher price
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).updateOriginalPrice(ethers.parseEther("100000"));
      await stopImpersonating();

      await expect(marketplace.connect(buyer).buyOriginal(LIST_PRICE, { value: LIST_PRICE }))
        .to.be.revertedWithCustomError(marketplace, "PriceChanged");
    });

    it("non-owner cannot list", async function () {
      await expect(marketplace.connect(buyer).listOriginal(LIST_PRICE))
        .to.be.revertedWithCustomError(marketplace, "CallerNotOwner");
    });

    it("non-owner cannot delist", async function () {
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).listOriginal(LIST_PRICE);
      await stopImpersonating();

      await expect(marketplace.connect(buyer).delistOriginal())
        .to.be.revertedWithCustomError(marketplace, "CallerNotOwner");
    });

    it("non-owner cannot accept offers", async function () {
      await marketplace.connect(buyer).makeOriginalOffer({ value: ethers.parseEther("30000") });
      await expect(marketplace.connect(buyer2).acceptOriginalOffer(buyer.address))
        .to.be.revertedWithCustomError(marketplace, "CallerNotOwner");
    });

    it("non-owner cannot update price", async function () {
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).listOriginal(LIST_PRICE);
      await stopImpersonating();

      await expect(marketplace.connect(buyer).updateOriginalPrice(ethers.parseEther("75000")))
        .to.be.revertedWithCustomError(marketplace, "CallerNotOwner");
    });

    it("owner cannot buy their own listing", async function () {
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).listOriginal(LIST_PRICE);
      await expect(marketplace.connect(originalOwnerSigner).buyOriginal(LIST_PRICE, { value: LIST_PRICE }))
        .to.be.revertedWithCustomError(marketplace, "CallerIsOwner");
      await stopImpersonating();
    });

    it("owner cannot make offer on their own token", async function () {
      await impersonateOriginalOwner();
      await expect(marketplace.connect(originalOwnerSigner).makeOriginalOffer({ value: ethers.parseEther("30000") }))
        .to.be.revertedWithCustomError(marketplace, "CallerIsOwner");
      await stopImpersonating();
    });

    it("cannot make zero value offer", async function () {
      await expect(marketplace.connect(buyer).makeOriginalOffer({ value: 0 }))
        .to.be.revertedWithCustomError(marketplace, "PriceBelowMinimum");
    });

    it("cannot make lower offer than existing", async function () {
      await marketplace.connect(buyer).makeOriginalOffer({ value: ethers.parseEther("50000") });
      await expect(marketplace.connect(buyer).makeOriginalOffer({ value: ethers.parseEther("30000") }))
        .to.be.revertedWithCustomError(marketplace, "OfferMustBeGreater");
    });

    it("cannot make equal offer to existing", async function () {
      const amount = ethers.parseEther("50000");
      await marketplace.connect(buyer).makeOriginalOffer({ value: amount });
      await expect(marketplace.connect(buyer).makeOriginalOffer({ value: amount }))
        .to.be.revertedWithCustomError(marketplace, "OfferMustBeGreater");
    });

    it("cannot drain contract by manipulating offers", async function () {
      // Make offers from two accounts
      const offer1 = ethers.parseEther("30000");
      const offer2 = ethers.parseEther("40000");
      await marketplace.connect(buyer).makeOriginalOffer({ value: offer1 });
      await marketplace.connect(buyer2).makeOriginalOffer({ value: offer2 });

      // Contract should hold both
      let contractBal = await ethers.provider.getBalance(await marketplace.getAddress());
      expect(contractBal).to.equal(offer1 + offer2);

      // buyer withdraws — only gets their own offer back
      await marketplace.connect(buyer).withdrawOriginalOffer();
      contractBal = await ethers.provider.getBalance(await marketplace.getAddress());
      expect(contractBal).to.equal(offer2);

      // buyer2 withdraws — gets their own offer back
      await marketplace.connect(buyer2).withdrawOriginalOffer();
      contractBal = await ethers.provider.getBalance(await marketplace.getAddress());
      expect(contractBal).to.equal(0);
    });

    it("offer survives ownership change — bidder can still withdraw", async function () {
      // buyer makes offer
      await marketplace.connect(buyer).makeOriginalOffer({ value: ethers.parseEther("30000") });

      // Owner lists and buyer2 buys (ownership changes)
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).listOriginal(LIST_PRICE);
      await stopImpersonating();

      await marketplace.connect(buyer2).buyOriginal(LIST_PRICE, { value: LIST_PRICE });

      // buyer's offer still exists and withdrawable
      expect(await marketplace.originalOffers(buyer.address)).to.equal(ethers.parseEther("30000"));
      const balBefore = await ethers.provider.getBalance(buyer.address);
      const tx = await marketplace.connect(buyer).withdrawOriginalOffer();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(buyer.address);
      expect(balAfter - balBefore + gasCost).to.equal(ethers.parseEther("30000"));
    });

    // it("cannot setOriginalNFT twice to steal funds", async function () {
    //   // Already set in beforeEach, trying again should fail
    //   await expect(marketplace.setOriginalNFT(await originalNFT.getAddress()))
    //     .to.be.revertedWithCustomError(marketplace, "OriginalAlreadySet");
    // });

    it("non-royalty-owner cannot steal royalty", async function () {
      await expect(marketplace.connect(buyer).setRoyaltyOwner(buyer.address))
        .to.be.revertedWithCustomError(marketplace, "CallerNotOwner");
    });

    it("full buy+offer+withdraw cycle leaves zero contract balance", async function () {
      // Offer → list → buy (with offer refund) → contract empty
      const offerAmount = ethers.parseEther("30000");
      await marketplace.connect(buyer).makeOriginalOffer({ value: offerAmount });

      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).listOriginal(LIST_PRICE);
      await stopImpersonating();

      await marketplace.connect(buyer).buyOriginal(LIST_PRICE, { value: LIST_PRICE });

      const contractBal = await ethers.provider.getBalance(await marketplace.getAddress());
      expect(contractBal).to.equal(0);
    });

    it("full offer+accept cycle leaves zero contract balance", async function () {
      await marketplace.connect(buyer).makeOriginalOffer({ value: ethers.parseEther("45000") });

      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).acceptOriginalOffer(buyer.address);
      await stopImpersonating();

      const contractBal = await ethers.provider.getBalance(await marketplace.getAddress());
      expect(contractBal).to.equal(0);
    });

    it("multiple buy cycles leave zero contract balance", async function () {
      // Cycle 1: list → buy
      await impersonateOriginalOwner();
      await marketplace.connect(originalOwnerSigner).listOriginal(LIST_PRICE);
      await stopImpersonating();
      await marketplace.connect(buyer).buyOriginal(LIST_PRICE, { value: LIST_PRICE });

      // Cycle 2: new owner lists → buyer2 buys
      await originalNFT.connect(buyer).setApprovalForAll(await marketplace.getAddress(), true);
      await marketplace.connect(buyer).listOriginal(ethers.parseEther("75000"));
      await marketplace.connect(buyer2).buyOriginal(ethers.parseEther("75000"), { value: ethers.parseEther("75000") });

      const contractBal = await ethers.provider.getBalance(await marketplace.getAddress());
      expect(contractBal).to.equal(0);
    });
  });
});
