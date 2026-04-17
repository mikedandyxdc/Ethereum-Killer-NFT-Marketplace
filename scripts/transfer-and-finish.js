// Script 1: Run with OLD mnemonic in .env
// Transfers all NFTs to new wallet, finishes minting, transfers ownership/royalty
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const NEW_WALLET = "0xbbB18f3417bb427C670c0587E98EAd9dBe2f638D";

// Prevent uncaught errors from crashing the process
process.on('uncaughtException', (err) => {
  console.log(`⚠️ Uncaught error: ${err.message} — will be handled by retry logic`);
});

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("Old wallet (deployer):", deployerAddress);
  console.log("New wallet:", NEW_WALLET);

  // Get contract instances
  const deployments = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, "../deployments/xdc/EthereumKiller.json"), "utf8"
  ));
  const xrc721 = await ethers.getContractAt("EthereumKiller", deployments.address, deployer);

  const marketplaceDeployments = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, "../deployments/xdc/OriginalNFTMarketplace.json"), "utf8"
  ));
  const marketplace = await ethers.getContractAt("OriginalNFTMarketplace", marketplaceDeployments.address, deployer);

  // =============================================
  // Phase 1: Transfer existing NFTs to new wallet
  // =============================================
  const totalMinted = Number(await xrc721.getTokenCount());
  console.log(`\n🔸 Transferring ${totalMinted} NFTs to new wallet...`);

  // Resume support — check progress file, fallback to binary search
  let alreadyTransferred = 0;
  const progressFile = path.resolve(__dirname, "../transfer-progress.txt");
  if (fs.existsSync(progressFile)) {
    alreadyTransferred = parseInt(fs.readFileSync(progressFile, "utf8").trim());
    console.log(`🔹 Resuming from token ${alreadyTransferred} (from progress file)`);
  } else {
    // Binary search to find boundary between new and old wallet
    let lo = 0, hi = totalMinted - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const owner = await xrc721.ownerOf(mid);
      if (owner.toLowerCase() === NEW_WALLET.toLowerCase()) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    alreadyTransferred = lo;
    if (alreadyTransferred > 0) {
      console.log(`🔹 ${alreadyTransferred} already transferred (binary search)`);
    }
  }

  for (let i = alreadyTransferred; i < totalMinted; i++) {
    try {
      // Skip if already transferred
      const currentOwner = await xrc721.ownerOf(i);
      if (currentOwner.toLowerCase() === NEW_WALLET.toLowerCase()) continue;

      const tx = await xrc721['transferFrom(address,address,uint256)'](deployerAddress, NEW_WALLET, i, { gasLimit: 5000000, gasPrice: 15000000000 });
      await tx.wait();

      fs.writeFileSync(progressFile, String(i + 1));
      if ((i + 1) % 100 === 0 || i + 1 === totalMinted) {
        console.log(`✅ Transferred: ${i + 1}/${totalMinted}`);
      }
    } catch (error) {
      const msg = error?.message || String(error);
      // Auto-retry on any connection/network error
      if (msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || msg.includes('network') || msg.includes('Timeout') || msg.includes('timeout')) {
        console.log(`⚠️ Connection error at token ${i}, retrying in 5s...`);
        await new Promise(r => setTimeout(r, 5000));
        i--;
        continue;
      }
      // Skip if already transferred
      if (msg.includes('execution reverted') || msg.includes('CALL_EXCEPTION')) {
        console.log(`⚠️ Token ${i} reverted — skipping`);
        continue;
      }
      console.error(`❌ Error transferring token ${i}:`, msg);
      console.log("🔹 Re-run this script to resume.");
      return;
    }
  }
  console.log("✅ All NFTs transferred!");

  // =============================================
  // Phase 2: Finish minting remaining to new wallet
  // =============================================
  const totalTokens = 10000;
  const remaining = totalTokens - totalMinted;

  if (remaining > 0) {
    console.log(`\n🔸 Minting remaining ${remaining} tokens to new wallet...`);

    const metadataPath = path.resolve(__dirname, "../nfts/master_metadata.json");
    const rawMetadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    const tokenMetadata = {};
    for (const bg of Object.values(rawMetadata)) {
      for (const [tokenKey, meta] of Object.entries(bg)) {
        tokenMetadata[tokenKey] = meta;
      }
    }

    for (let i = totalMinted; i < totalTokens; i++) {
      try {
        const paddedId = String(i).padStart(4, "0");
        const meta = tokenMetadata[paddedId];
        const uri = meta ? JSON.stringify(meta) : "";
        const price = i % 400 === 0 ? ethers.parseEther("10000000") : ethers.parseEther("25000");

        // const tx = await xrc721.mintAndListForSale(NEW_WALLET, i, price, uri, { gasLimit: 10000000 });
        const tx = await xrc721.mintAndListForSale(NEW_WALLET, i, price, uri, { gasLimit: 5000000, gasPrice: 15000000000 });
        await tx.wait();

        if ((i + 1) % 100 === 0 || i + 1 === totalTokens) {
          console.log(`✅ Minted: ${i + 1}/${totalTokens}`);
        }
      } catch (error) {
        if (error.message.includes('ECONNRESET') || error.message.includes('ETIMEDOUT') || error.message.includes('network')) {
          console.log(`⚠️ Connection error at token ${i}, retrying in 5s...`);
          await new Promise(r => setTimeout(r, 5000));
          i--;
          continue;
        }
        console.error(`❌ Error minting token ${i}:`, error.message);
        console.log("🔹 Re-run this script to resume.");
        return;
      }
    }
    console.log("✅ All tokens minted!");
  } else {
    console.log("✅ All tokens already minted.");
  }

  // =============================================
  // Phase 3: Transfer ownership and royalty
  // =============================================
  console.log("\n🔸 Transferring ownership and royalty...");

  try {
    // EthereumKiller
    let tx = await xrc721.transferOwnership(NEW_WALLET);
    await tx.wait();
    console.log("✅ EthereumKiller ownership transferred");

    tx = await xrc721.setRoyaltyOwner(NEW_WALLET);
    await tx.wait();
    console.log("✅ EthereumKiller royalty owner transferred");

    // OriginalNFTMarketplace
    tx = await marketplace.transferOwnership(NEW_WALLET);
    await tx.wait();
    console.log("✅ OriginalNFTMarketplace ownership transferred");

    tx = await marketplace.setRoyaltyOwner(NEW_WALLET);
    await tx.wait();
    console.log("✅ OriginalNFTMarketplace royalty owner transferred");
  } catch (error) {
    console.error("❌ Error transferring ownership:", error.message);
    return;
  }

  console.log("\n🎉 DONE! All NFTs, ownership, and royalty transferred to:", NEW_WALLET);
  console.log("⚠️  Now swap .env to new mnemonic and run scripts/relist.js");
}

main().catch(console.error);
